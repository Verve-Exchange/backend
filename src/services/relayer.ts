import { logger } from '../utils/logger';
import { PythClient } from '../clients/pyth-client';
import { StellarClient } from '../clients/stellar-client';
import { RelayerConfig } from '../config';
import { RelayerStats } from '../types';
import {
  AccountNotFundedError,
  StalePriceError,
  RetryError,
  handleError,
} from '../utils/errors';

export class PriceRelayer {
  private pythClient: PythClient;
  private stellarClient: StellarClient;
  private config: RelayerConfig;
  private isRunning: boolean = false;
  private stats: RelayerStats;

  constructor(config: RelayerConfig) {
    this.config = config;
    this.pythClient = new PythClient(config.pyth.hermesUrl);
    this.stellarClient = new StellarClient(config);

    this.stats = {
      startTime: new Date(),
      totalUpdates: 0,
      successfulUpdates: 0,
      failedUpdates: 0,
      lastUpdateTime: null,
      priceFeeds: {},
    };

    // Initialize price feed stats
    for (const feed of config.priceFeeds) {
      this.stats.priceFeeds[feed.symbol] = {
        lastPrice: '0',
        lastUpdate: new Date(),
        updateCount: 0,
        errorCount: 0,
      };
    }
  }

  /**
   * Start the relayer
   */
  async start(): Promise<void> {
    logger.info('Starting Pyth price relayer...');

    // Check if account is funded
    const isFunded = await this.stellarClient.isAccountFunded();
    if (!isFunded) {
      throw new AccountNotFundedError(this.config.relayer.publicKey || 'unknown');
    }

    const balance = await this.stellarClient.getBalance();
    logger.info({ balance }, 'Relayer account balance');

    this.isRunning = true;
    logger.info('Relayer started successfully');

    // Start main loop
    this.runLoop();
  }

  /**
   * Stop the relayer
   */
  stop(): void {
    logger.info('Stopping relayer...');
    this.isRunning = false;
  }

  /**
   * Main relayer loop
   */
  private async runLoop(): Promise<void> {
    while (this.isRunning) {
      try {
        await this.updatePrices();
      } catch (error) {
        logger.error({ error }, 'Error in relayer loop');
      }

      // Wait for next interval
      await this.sleep(this.config.settings.updateIntervalMs);
    }
  }

  /**
   * Update prices for all configured feeds
   */
  private async updatePrices(): Promise<void> {
    try {
      // Fetch latest price updates
      const updates = await this.pythClient.fetchPriceUpdates(this.config.priceFeeds);

      if (updates.length === 0) {
        logger.debug('No new price updates available');
        return;
      }

      logger.info({ count: updates.length }, 'Processing price updates');

      // Submit each price update to Oracle Manager
      for (const update of updates) {
        try {
          // Check staleness
          if (this.pythClient.isStale(update.publishTime, this.config.settings.maxStalenessSeconds)) {
            logger.warn({ symbol: update.symbol, publishTime: update.publishTime }, 'Price is stale, skipping');
            throw new StalePriceError(
              update.symbol,
              Math.floor(Date.now() / 1000) - update.publishTime,
              this.config.settings.maxStalenessSeconds
            );
          }

          // Submit to Oracle Manager with retries
          const txHash = await this.submitWithRetry(
            update.symbol,
            update.price,
            parseInt(update.conf, 10),
            update.expo
          );

          // Mark as submitted
          this.pythClient.markAsSubmitted(update.symbol, update.publishTime);

          // Update stats
          this.stats.totalUpdates++;
          this.stats.successfulUpdates++;
          this.stats.lastUpdateTime = new Date();
          this.stats.priceFeeds[update.symbol].lastPrice = update.price;
          this.stats.priceFeeds[update.symbol].lastUpdate = new Date();
          this.stats.priceFeeds[update.symbol].updateCount++;

          logger.info(
            {
              symbol: update.symbol,
              price: update.price,
              expo: update.expo,
              publishTime: update.publishTime,
              txHash,
            },
            'Price update submitted successfully'
          );
        } catch (error) {
          this.stats.totalUpdates++;
          this.stats.failedUpdates++;
          this.stats.priceFeeds[update.symbol].errorCount++;

          const appError = handleError(error);
          logger.error(
            {
              error: appError.message,
              code: appError.code,
              symbol: update.symbol,
            },
            'Failed to submit price update'
          );
        }
      }
    } catch (error) {
      logger.error({ error }, 'Failed to update prices');
    }
  }

  /**
   * Submit price update with retry logic
   */
  private async submitWithRetry(
    asset: string,
    price: string,
    confidence: number,
    expo: number
  ): Promise<string> {
    for (let attempt = 1; attempt <= this.config.settings.maxRetries; attempt++) {
      try {
        return await this.stellarClient.submitPriceUpdate(asset, price, confidence, expo);
      } catch (error) {
        const appError = handleError(error);
        
        logger.warn(
          {
            asset,
            attempt,
            maxRetries: this.config.settings.maxRetries,
            error: appError.message,
            code: appError.code,
          },
          'Retry attempt failed'
        );

        if (attempt < this.config.settings.maxRetries) {
          await this.sleep(this.config.settings.retryDelayMs * attempt);
        }
      }
    }

    throw new RetryError(`Submit price for ${asset}`, this.config.settings.maxRetries);
  }

  /**
   * Get relayer statistics
   */
  getStats(): RelayerStats {
    return { ...this.stats };
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
