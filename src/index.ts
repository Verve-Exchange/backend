import { loadConfig } from './config';
import { logger } from './utils/logger';
import { PriceRelayer } from './services/relayer';
import { HealthServer } from './servers/health-server';
import { handleError, isOperationalError } from './utils/errors';

const BANNER = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║     ____        _   _       ____       _                                      ║
║    |  _ \\ _   _| |_| |__   |  _ \\ ___| | __ _ _   _  ___ _ __                ║
║    | |_) | | | | __| '_ \\  | |_) / _ \\ |/ _\` | | | |/ _ \\ '__|               ║
║    |  __/| |_| | |_| | | | |  _ <  __/ | (_| | |_| |  __/ |                  ║
║    |_|    \\__, |\\__|_| |_| |_| \\_\\___|_|\\__,_|\\__, |\\___|_|                  ║
║           |___/                                |___/                          ║
║                                                                               ║
║                   Production Pyth Network Relayer                            ║
║                        for Stellar Soroban                                    ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`;

async function main() {
  console.log(BANNER);

  try {
    // Load configuration
    logger.info('Loading configuration...');
    const config = loadConfig();

    logger.info(
      {
        network: config.stellar.network,
        priceFeeds: config.priceFeeds.map((f) => f.symbol),
        updateInterval: config.settings.updateIntervalMs,
      },
      'Configuration loaded'
    );

    // Create relayer
    const relayer = new PriceRelayer(config);

    // Create health check server
    const healthServer = new HealthServer(relayer, config.healthCheck.port);
    healthServer.start();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      relayer.stop();
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      relayer.stop();
      process.exit(0);
    });

    // Start relayer
    await relayer.start();
  } catch (error) {
    const appError = handleError(error);
    
    logger.error(
      {
        error: appError.message,
        code: appError.code,
        stack: appError.stack,
      },
      'Fatal error starting relayer'
    );

    // Exit with different codes based on error type
    if (isOperationalError(appError)) {
      process.exit(1); // Operational error (config, network, etc.)
    } else {
      process.exit(2); // Programming error
    }
  }
}

main();
