import express, { Request, Response } from 'express';
import { logger } from '../utils/logger';
import { PriceRelayer } from '../services/relayer';
import { HealthStatus } from '../types';

export class HealthServer {
  private app: express.Application;
  private relayer: PriceRelayer;
  private port: number;

  constructor(relayer: PriceRelayer, port: number) {
    this.app = express();
    this.relayer = relayer;
    this.port = port;

    this.setupRoutes();
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (req: Request, res: Response) => {
      const stats = this.relayer.getStats();
      const uptime = Date.now() - stats.startTime.getTime();

      const status: HealthStatus = {
        status: this.determineHealthStatus(stats),
        uptime,
        stats,
        lastError: null,
      };

      const httpStatus = status.status === 'healthy' ? 200 : status.status === 'degraded' ? 200 : 503;

      res.status(httpStatus).json(status);
    });

    // Readiness check
    this.app.get('/ready', (req: Request, res: Response) => {
      const stats = this.relayer.getStats();
      const isReady = stats.successfulUpdates > 0;

      res.status(isReady ? 200 : 503).json({
        ready: isReady,
        successfulUpdates: stats.successfulUpdates,
      });
    });

    // Liveness check
    this.app.get('/live', (req: Request, res: Response) => {
      res.status(200).json({ alive: true });
    });

    // Stats endpoint
    this.app.get('/stats', (req: Request, res: Response) => {
      const stats = this.relayer.getStats();
      res.json(stats);
    });

    // Metrics endpoint (Prometheus format)
    this.app.get('/metrics', (req: Request, res: Response) => {
      const stats = this.relayer.getStats();
      const metrics = this.formatPrometheusMetrics(stats);
      res.set('Content-Type', 'text/plain').send(metrics);
    });
  }

  private determineHealthStatus(stats: any): 'healthy' | 'degraded' | 'unhealthy' {
    const totalUpdates = stats.totalUpdates;
    const successRate = totalUpdates > 0 ? stats.successfulUpdates / totalUpdates : 1;

    // Check if last update was recent (within 2x update interval)
    const timeSinceLastUpdate = stats.lastUpdateTime
      ? Date.now() - new Date(stats.lastUpdateTime).getTime()
      : Infinity;

    if (successRate >= 0.95 && timeSinceLastUpdate < 30000) {
      return 'healthy';
    } else if (successRate >= 0.7 || timeSinceLastUpdate < 60000) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  private formatPrometheusMetrics(stats: any): string {
    let metrics = '';

    metrics += `# HELP relayer_total_updates Total number of price update attempts\n`;
    metrics += `# TYPE relayer_total_updates counter\n`;
    metrics += `relayer_total_updates ${stats.totalUpdates}\n\n`;

    metrics += `# HELP relayer_successful_updates Number of successful price updates\n`;
    metrics += `# TYPE relayer_successful_updates counter\n`;
    metrics += `relayer_successful_updates ${stats.successfulUpdates}\n\n`;

    metrics += `# HELP relayer_failed_updates Number of failed price updates\n`;
    metrics += `# TYPE relayer_failed_updates counter\n`;
    metrics += `relayer_failed_updates ${stats.failedUpdates}\n\n`;

    // Per-feed metrics
    for (const [symbol, feedStats] of Object.entries(stats.priceFeeds)) {
      const feed = feedStats as any;

      metrics += `# HELP relayer_feed_updates_total Total updates for ${symbol}\n`;
      metrics += `# TYPE relayer_feed_updates_total counter\n`;
      metrics += `relayer_feed_updates_total{symbol="${symbol}"} ${feed.updateCount}\n\n`;

      metrics += `# HELP relayer_feed_errors_total Total errors for ${symbol}\n`;
      metrics += `# TYPE relayer_feed_errors_total counter\n`;
      metrics += `relayer_feed_errors_total{symbol="${symbol}"} ${feed.errorCount}\n\n`;
    }

    return metrics;
  }

  start(): void {
    this.app.listen(this.port, () => {
      logger.info({ port: this.port }, 'Health check server started');
    });
  }
}
