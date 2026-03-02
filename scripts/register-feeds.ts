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

// Load .env
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

const FEEDS = [
  {
    symbol: "XAUUSD",
    id: "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
  },
  {
    symbol: "XAGUSD",
    id: "0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e",
  },
  {
    symbol: "EURUSD",
    id: "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
  },
  {
    symbol: "GBPUSD",
    id: "0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1",
  },
  {
    symbol: "USDJPY",
    id: "0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52",
  },
];

if (!SECRET_KEY || !CONTRACT_ID) {
  console.error("Please set RELAYER_SECRET_KEY and ORACLE_CONTRACT_ID in .env");
  process.exit(1);
}

async function main() {
  const server = new rpc.Server(RPC_URL);
  const keypair = Keypair.fromSecret(SECRET_KEY);
  const contract = new Contract(CONTRACT_ID);

  console.log(`Registering feeds on contract ${CONTRACT_ID}...`);
  console.log(`Using account ${keypair.publicKey()}`);

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

    for (const feed of FEEDS) {
      console.log(`Registering ${feed.symbol}...`);

      // Convert hex string to Buffer for Bytes
      const feedIdBuffer = Buffer.from(feed.id.replace("0x", ""), "hex");

      const operation = contract.call(
        "register_feed",
        nativeToScVal(feed.symbol, { type: "symbol" }),
        nativeToScVal(feedIdBuffer), // Bytes
        nativeToScVal(60, { type: "u64" }), // max_staleness
        nativeToScVal(500, { type: "u32" }), // max_deviation_bps (5%)
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
