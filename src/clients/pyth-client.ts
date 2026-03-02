import { HermesClient } from '@pythnetwork/hermes-client';
import { logger } from '../utils/logger';
import { PriceUpdate } from '../types';
import { PriceFeedConfig } from '../config';
import { PythConnectionError } from '../utils/errors';

export class PythClient {
  private client: HermesClient;
  private lastPublishTimes: Map<string, number> = new Map();

  constructor(hermesUrl: string) {
    this.client = new HermesClient(hermesUrl);
    logger.info({ hermesUrl }, 'Pyth client initialized');
  }

  /**
   * Fetch latest price updates for configured feeds
   */
  async fetchPriceUpdates(feeds: PriceFeedConfig[]): Promise<PriceUpdate[]> {
    const feedIds = feeds.map((f) => f.feedId);

    try {
      // Get latest price updates
      const response = await this.client.getLatestPriceUpdates(feedIds);

      if (!response || !response.parsed || response.parsed.length === 0) {
        logger.warn('No price feeds returned from Pyth');
        return [];
      }

      const updates: PriceUpdate[] = [];

      for (const parsedData of response.parsed) {
        const config = feeds.find((f) => f.feedId === `0x${parsedData.id}`);
        if (!config) continue;

        const price = parsedData.price;
        if (!price) {
          logger.warn({ feedId: parsedData.id }, 'No price data in feed');
          continue;
        }

        const publishTime = Number(price.publish_time);
        const lastPublishTime = this.lastPublishTimes.get(config.symbol) || 0;

        // Only include if newer than last submitted
        if (publishTime > lastPublishTime) {
          updates.push({
            symbol: config.symbol,
            feedId: config.feedId,
            price: price.price,
            conf: price.conf,
            expo: price.expo,
            publishTime,
          });

          logger.debug(
            {
              symbol: config.symbol,
              price: price.price,
              expo: price.expo,
              publishTime,
            },
            'New price update available'
          );
        }
      }

      return updates;
    } catch (error) {
      logger.error({ error, feedIds }, 'Failed to fetch price updates from Pyth');
      throw new PythConnectionError(
        error instanceof Error ? error.message : 'Unknown error fetching price updates'
      );
    }
  }

  /**
   * Get price update data (VAA) for submission to Soroban
   */
  async getPriceUpdateData(feedIds: string[]): Promise<string[]> {
    try {
      const updates = await this.client.getLatestPriceUpdates(feedIds);
      
      if (!updates || !updates.binary || !updates.binary.data) {
        throw new Error('No price update data returned');
      }

      // Return array of hex-encoded VAAs
      return updates.binary.data;
    } catch (error) {
      logger.error({ error, feedIds }, 'Failed to get price update data');
      throw error;
    }
  }

  /**
   * Mark a price as submitted
   */
  markAsSubmitted(symbol: string, publishTime: number): void {
    this.lastPublishTimes.set(symbol, publishTime);
  }

  /**
   * Check if price is stale
   */
  isStale(publishTime: number, maxStaleness: number): boolean {
    const now = Math.floor(Date.now() / 1000);
    return now - publishTime > maxStaleness;
  }
}
