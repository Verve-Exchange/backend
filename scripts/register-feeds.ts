import {
  Contract,
  Keypair,
  TransactionBuilder,
  BASE_FEE,
  nativeToScVal,
  rpc,
  Networks,
} from "@stellar/stellar-sdk";
import * as dotenv from "dotenv";
import { fileURLToPath } from "url";
import { dirname, resolve } from "path";
import { SUPPORTED_FEEDS } from "../src/config/constants";

// Load .env BEFORE importing constants that depend on it
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: resolve(__dirname, "../.env") });

const SECRET_KEY = process.env.RELAYER_SECRET_KEY as string;
const CONTRACT_ID = process.env.ORACLE_CONTRACT_ID as string;
const RPC_URL =
  process.env.STELLAR_RPC_URL || "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE = Networks.TESTNET;

if (!SECRET_KEY || !CONTRACT_ID) {
  console.error("Please set RELAYER_SECRET_KEY and ORACLE_CONTRACT_ID in .env");
  process.exit(1);
}

async function main() {
  const server = new rpc.Server(RPC_URL);
  const keypair = Keypair.fromSecret(SECRET_KEY);
  const contract = new Contract(CONTRACT_ID);

  console.log(`Working with contract ${CONTRACT_ID}...`);
  console.log(`Using account ${keypair.publicKey()}`);
  console.log(
    `Available feeds in config:`,
    SUPPORTED_FEEDS.map((f) => f.symbol).join(", "),
  );

  try {
    const account = await server.getAccount(keypair.publicKey());

    // Check if initialized first?
    // We can just try to initialize and ignore "Authorized" (AlreadyInitialized) error or similar if we could distinguishing it,
    // but better to just try.
    // Actually, let's just try to initialize.

    console.log(`Attempting to initialize contract...`);
    try {
      const initOp = contract.call(
        "initialize",
        nativeToScVal(keypair.publicKey(), { type: "address" }),
      );

      const initTx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(initOp)
        .setTimeout(30)
        .build();

      const initSim = await server.simulateTransaction(initTx);
      if (!rpc.Api.isSimulationError(initSim)) {
        const initPrep = rpc.assembleTransaction(initTx, initSim).build();
        initPrep.sign(keypair);
        const initRes = await server.sendTransaction(initPrep);
        console.log(`Initialization result: ${initRes.status}`);
        if (initRes.status === "PENDING") {
          account.incrementSequenceNumber();
        }
      } else {
        // Likely already initialized or other error
        // check if error is "Unauthorized" or similar which implies initialized
        console.log(
          "Initialization simulation failed (likely already initialized):",
          JSON.stringify(initSim.error || ""),
        );
      }
    } catch (e) {
      const errorMessage = e instanceof Error ? e.message : String(e);
      console.log("Initialization skipped or failed:", errorMessage);
    }

    for (const feed of SUPPORTED_FEEDS) {
      console.log(`Registering ${feed.symbol}...`);

      // Convert hex string to Buffer for Bytes
      const feedIdBuffer = Buffer.from(feed.feedId.replace("0x", ""), "hex");

      const operation = contract.call(
        "register_feed",
        nativeToScVal(feed.symbol, { type: "symbol" }),
        nativeToScVal(feedIdBuffer), // Bytes
        nativeToScVal(feed.maxStaleness, { type: "u64" }), // max_staleness
        nativeToScVal(feed.maxDeviationBps, { type: "u32" }), // max_deviation_bps
      );

      const tx = new TransactionBuilder(account, {
        fee: BASE_FEE,
        networkPassphrase: NETWORK_PASSPHRASE,
      })
        .addOperation(operation)
        .setTimeout(30)
        .build();

      const simulated = await server.simulateTransaction(tx);
      if (rpc.Api.isSimulationError(simulated)) {
        console.error("Simulation failed:", JSON.stringify(simulated, null, 2));
        continue;
      }

      const prepared = rpc.assembleTransaction(tx, simulated).build();
      prepared.sign(keypair);

      const response = await server.sendTransaction(prepared);
      if (response.status !== "PENDING") {
        // Success status varies, but check for error
        if (response.status === "ERROR") {
          console.error(
            "Transaction failed:",
            JSON.stringify(response, null, 2),
          );
          continue;
        }
      }

      console.log(`Submitted ${feed.symbol}: ${response.hash}`);

      // Increase sequence number for next tx
      account.incrementSequenceNumber();
    }
  } catch (err) {
    console.error("Error:", err);
  }
}

main();
