import { Networks } from "@stellar/stellar-sdk";
import {
  loadEnv,
  getEnvVar,
  getEnvVarOptional,
  getEnvVarInt,
  validateSecretKey,
  validateContractId,
  validateUrl,
} from "../utils/env-loader";
import { MissingEnvVarError, InvalidEnvVarError } from "../utils/errors";

// Load environment variables at module initialization
loadEnv();

import { SUPPORTED_FEEDS, PriceFeedInfo } from "../constants";

export interface PriceFeedConfig {
  symbol: string;
  feedId: string;
  maxStaleness: number;
}

export interface RelayerConfig {
  stellar: {
    network: string;
    rpcUrl: string;
    horizonUrl: string;
    networkPassphrase: string;
  };
  relayer: {
    secretKey: string;
    publicKey: string;
  };
  pyth: {
    hermesUrl: string;
    oracleContractId: string;
  };
  priceFeeds: PriceFeedConfig[];
  settings: {
    updateIntervalMs: number;
    maxStalenessSeconds: number;
    maxRetries: number;
    retryDelayMs: number;
  };
  healthCheck: {
    port: number;
  };
  logging: {
    level: string;
  };
}

function getNetworkPassphrase(network: string): string {
  const normalized = network.toLowerCase();

  switch (normalized) {
    case "testnet":
      return Networks.TESTNET;
    case "mainnet":
    case "public":
      return Networks.PUBLIC;
    case "futurenet":
      return Networks.FUTURENET;
    case "standalone":
      return Networks.STANDALONE;
    default:
      throw new InvalidEnvVarError(
        "STELLAR_NETWORK",
        `Unknown network: ${network}. Must be one of: testnet, mainnet, futurenet, standalone`,
      );
  }
}

function validateConfig(): void {
  const required = [
    "STELLAR_NETWORK",
    "STELLAR_RPC_URL",
    "RELAYER_SECRET_KEY",
    "PYTH_HERMES_URL",
    "ORACLE_CONTRACT_ID",
  ];

  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new MissingEnvVarError(missing);
  }

  // Validate formats
  const secretKey = process.env.RELAYER_SECRET_KEY!;
  validateSecretKey(secretKey);

  const contractId = process.env.ORACLE_CONTRACT_ID!;
  validateContractId(contractId);

  const rpcUrl = process.env.STELLAR_RPC_URL!;
  validateUrl(rpcUrl, "STELLAR_RPC_URL");

  const hermesUrl = process.env.PYTH_HERMES_URL!;
  validateUrl(hermesUrl, "PYTH_HERMES_URL");

  if (process.env.STELLAR_HORIZON_URL) {
    validateUrl(process.env.STELLAR_HORIZON_URL, "STELLAR_HORIZON_URL");
  }
}

export function loadConfig(): RelayerConfig {
  validateConfig();

  const network = getEnvVar("STELLAR_NETWORK");

  return {
    stellar: {
      network,
      rpcUrl: getEnvVar("STELLAR_RPC_URL"),
      horizonUrl: getEnvVarOptional(
        "STELLAR_HORIZON_URL",
        "https://horizon-testnet.stellar.org",
      ),
      networkPassphrase: getNetworkPassphrase(network),
    },
    relayer: {
      secretKey: getEnvVar("RELAYER_SECRET_KEY"),
      publicKey: getEnvVarOptional("RELAYER_PUBLIC_KEY", ""),
    },
    pyth: {
      hermesUrl: getEnvVar("PYTH_HERMES_URL"),
      oracleContractId: getEnvVar("ORACLE_CONTRACT_ID"),
    },
    priceFeeds: SUPPORTED_FEEDS.map((feed: PriceFeedInfo) => ({
      symbol: feed.symbol,
      feedId: getEnvVarOptional(`PRICE_FEED_${feed.symbol}`, feed.feedId),
      maxStaleness: feed.maxStaleness,
    })),
    settings: {
      updateIntervalMs: getEnvVarInt("UPDATE_INTERVAL_MS", 5000),
      maxStalenessSeconds: getEnvVarInt("MAX_STALENESS_SECONDS", 60),
      maxRetries: getEnvVarInt("MAX_RETRIES", 3),
      retryDelayMs: getEnvVarInt("RETRY_DELAY_MS", 1000),
    },
    healthCheck: {
      port: getEnvVarInt("HEALTH_CHECK_PORT", 3000),
    },
    logging: {
      level: getEnvVarOptional("LOG_LEVEL", "info"),
    },
  };
}
