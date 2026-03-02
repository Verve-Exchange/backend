export interface PriceUpdate {
  symbol: string;
  feedId: string;
  price: string;
  conf: string;
  expo: number;
  publishTime: number;
}

export interface RelayerStats {
  startTime: Date;
  totalUpdates: number;
  successfulUpdates: number;
  failedUpdates: number;
  lastUpdateTime: Date | null;
  priceFeeds: {
    [symbol: string]: {
      lastPrice: string;
      lastUpdate: Date;
      updateCount: number;
      errorCount: number;
    };
  };
}

export interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  stats: RelayerStats;
  lastError: string | null;
}
