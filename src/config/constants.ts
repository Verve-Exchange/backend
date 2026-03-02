export interface PriceFeedInfo {
  symbol: string;
  feedId: string;
  maxStaleness: number; // in seconds
  maxDeviationBps: number; // basis points (500 = 5%)
}

// Pyth Price Feed IDs
// source: https://pyth.network/developers/price-feed-ids
export const SUPPORTED_FEEDS: PriceFeedInfo[] = [
  {
    symbol: "XAUUSD",
    feedId:
      "0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2",
    maxStaleness: 60,
    maxDeviationBps: 500,
  },
  {
    symbol: "XAGUSD",
    feedId:
      "0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e",
    maxStaleness: 60,
    maxDeviationBps: 500,
  },
  {
    symbol: "EURUSD",
    feedId:
      "0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b",
    maxStaleness: 60,
    maxDeviationBps: 500,
  },
  {
    symbol: "GBPUSD",
    feedId:
      "0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1",
    maxStaleness: 60,
    maxDeviationBps: 500,
  },
  {
    symbol: "USDJPY",
    feedId:
      "0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52",
    maxStaleness: 60,
    maxDeviationBps: 500,
  },
];
