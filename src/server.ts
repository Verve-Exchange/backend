import { startExpressServer } from './servers/express-server';
import { logger } from './utils/logger';
import { loadEnv } from './utils/env-loader';
import { handleError, isOperationalError } from './utils/errors';

// Load environment variables
loadEnv();

const BANNER = `
╔═══════════════════════════════════════════════════════════════════════════════╗
║                                                                               ║
║     ____        _   _       _   _                                             ║
║    |  _ \\ _   _| |_| |__   | | | | ___ _ __ _ __ ___   ___  ___              ║
║    | |_) | | | | __| '_ \\  | |_| |/ _ \\ '__| '_ \` _ \\ / _ \\/ __|         ║
║    |  __/| |_| | |_| | | | |  _  |  __/ |  | | | | | |  __/\\__ \\            ║
║    |_|    \\__, |\\__|_| |_| |_| |_|\\___|_|  |_| |_| |_|\\___||___/          ║
║           |___/                                                               ║
║                                                                               ║
║                   Pyth Hermes Express API Server                              ║
║                                                                               ║
╚═══════════════════════════════════════════════════════════════════════════════╝
`;

async function main() {
  console.log(BANNER);

  try {
    logger.info('Starting Pyth Hermes Express server...');
    startExpressServer();

    // Handle graceful shutdown
    process.on('SIGINT', () => {
      logger.info('Received SIGINT, shutting down gracefully...');
      process.exit(0);
    });

    process.on('SIGTERM', () => {
      logger.info('Received SIGTERM, shutting down gracefully...');
      process.exit(0);
    });
  } catch (error) {
    const appError = handleError(error);
    
    logger.error(
      {
        error: appError.message,
        code: appError.code,
        stack: appError.stack,
      },
      'Fatal error starting server'
    );

    // Exit with different codes based on error type
    if (isOperationalError(appError)) {
      process.exit(1);
    } else {
      process.exit(2);
    }
  }
}

main();
