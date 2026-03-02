import express, { Express, Request, Response } from 'express';
import { HermesClient } from '@pythnetwork/hermes-client';
import { logger } from '../utils/logger';

const app: Express = express();
const PORT = process.env.PORT || 3000;
const HERMES_ENDPOINT = process.env.HERMES_ENDPOINT || 'https://hermes.pyth.network';

// Initialize Hermes client
const hermesClient = new HermesClient(HERMES_ENDPOINT, {});

app.use(express.json());

// Health check endpoint
app.get('/health', (_req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Get price feeds by query
app.get('/api/price-feeds', async (req: Request, res: Response): Promise<void> => {
  try {
    const { query, assetType } = req.query;

    const priceFeeds = await hermesClient.getPriceFeeds({
      query: query as string,
      assetType: assetType as any,
    });

    res.json({
      success: true,
      data: priceFeeds,
      count: priceFeeds.length,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching price feeds');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Get latest price updates for specific price IDs
app.post('/api/price-updates', async (req: Request, res: Response): Promise<void> => {
  try {
    const { priceIds } = req.body;

    if (!priceIds || !Array.isArray(priceIds)) {
      res.status(400).json({
        success: false,
        error: 'priceIds array is required',
      });
      return;
    }

    const priceUpdates = await hermesClient.getLatestPriceUpdates(priceIds);

    res.json({
      success: true,
      data: priceUpdates,
    });
  } catch (error) {
    logger.error({ error }, 'Error fetching price updates');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Stream price updates (SSE endpoint)
app.get('/api/price-updates/stream', async (req: Request, res: Response): Promise<void> => {
  try {
    const priceIds = req.query.priceIds as string;

    if (!priceIds) {
      res.status(400).json({
        success: false,
        error: 'priceIds query parameter is required (comma-separated)',
      });
      return;
    }

    const priceIdArray = priceIds.split(',');

    // Set headers for SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    const eventSource = await hermesClient.getPriceUpdatesStream(priceIdArray);

    eventSource.onmessage = (event) => {
      res.write(`data: ${event.data}\n\n`);
    };

    eventSource.onerror = (error) => {
      logger.error({ error }, 'Error in price update stream');
      eventSource.close();
      res.end();
    };

    // Clean up on client disconnect
    req.on('close', () => {
      logger.info('Client disconnected from stream');
      eventSource.close();
      res.end();
    });
  } catch (error) {
    logger.error({ error }, 'Error setting up price update stream');
    res.status(500).json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

// Start server
export function startExpressServer() {
  app.listen(PORT, () => {
    logger.info({ port: PORT, hermesEndpoint: HERMES_ENDPOINT }, 'Express server started');
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`📊 Hermes endpoint: ${HERMES_ENDPOINT}\n`);
  });
}

export { app };
