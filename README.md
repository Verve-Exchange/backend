# Pyth Network Relayer for Stellar Soroban

Production-ready price relayer service that fetches price data from Pyth Network and submits it to Stellar Soroban smart contracts.

## Architecture

```
Pyth Network → Hermes API → Relayer Service → Stellar Soroban
```

## Features

- ✅ Real-time price updates from Pyth Network
- ✅ Automatic retry logic with exponential backoff
- ✅ Staleness detection and prevention
- ✅ Health check endpoints for monitoring
- ✅ Prometheus metrics export
- ✅ Graceful shutdown handling
- ✅ Production-ready logging with Pino
- ✅ TypeScript for type safety

## Prerequisites

- Node.js >= 18.0.0
- Funded Stellar account (testnet or mainnet)
- Pyth receiver contract deployed on Stellar

## Installation

```bash
npm install
```

## Configuration

1. Copy the example environment file:

```bash
cp .env.example .env
```

2. Configure your environment variables:

```env
# Network
STELLAR_NETWORK=testnet
STELLAR_RPC_URL=https://soroban-testnet.stellar.org

# Relayer account
RELAYER_SECRET_KEY=S...YOUR_SECRET_KEY...

# Pyth configuration
PYTH_HERMES_URL=https://hermes.pyth.network
PYTH_RECEIVER_CONTRACT_ID=C...CONTRACT_ID...

# Price feeds (add your Pyth feed IDs)
PRICE_FEED_XAUUSD=0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2
PRICE_FEED_EURUSD=0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b
```

## Adding New Feeds

The list of supported feeds and their configuration is centralized in `src/config/constants.ts`. You can modify this file to add, remove, or update feed parameters.

To add a new feed:

1.  Add the feed entry to the `SUPPORTED_FEEDS` array in `src/config/constants.ts`:
    ```typescript
    {
      symbol: "BTCUSD",
      feedId: "0xe62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43",
      maxStaleness: 60, // seconds
      maxDeviationBps: 200, // 2% deviation threshold
    },
    ```
2.  Register the new feed on the contract:
    ```bash
    npx tsx scripts/register-feeds.ts
    ```

## Usage

### Development (with Nodemon)

The application uses nodemon for automatic restarts during development:

```bash
# Run the relayer service (auto-restarts on file changes)
npm run dev
# or
npm run dev:relayer

# Run the Express API server (auto-restarts on file changes)
npm run dev:server
```

Nodemon features:

- Watches all `.ts` and `.json` files in the `src` directory
- Automatically restarts when files change
- Type `rs` in the terminal to manually restart
- 1 second delay before restart to avoid multiple rapid restarts

### Production

```bash
# Build
npm run build

# Start relayer
npm start
# or
npm run start:relayer

# Start API server
npm run start:server
```

### With PM2 (Recommended for Production)

```bash
# Install PM2
npm install -g pm2

# Start with PM2
pm2 start dist/index.js --name pyth-relayer

# View logs
pm2 logs pyth-relayer

# Monitor
pm2 monit

# Auto-restart on reboot
pm2 startup
pm2 save
```

## Health Checks

The relayer exposes several health check endpoints:

### Health Status

```bash
curl http://localhost:3000/health
```

Returns:

```json
{
  "status": "healthy",
  "uptime": 123456,
  "stats": {
    "totalUpdates": 100,
    "successfulUpdates": 98,
    "failedUpdates": 2,
    "priceFeeds": { ... }
  }
}
```

### Readiness Check

```bash
curl http://localhost:3000/ready
```

### Liveness Check

```bash
curl http://localhost:3000/live
```

### Prometheus Metrics

```bash
curl http://localhost:3000/metrics
```

## Monitoring

### Key Metrics

- `relayer_total_updates` - Total price update attempts
- `relayer_successful_updates` - Successful updates
- `relayer_failed_updates` - Failed updates
- `relayer_feed_updates_total{symbol}` - Per-feed update count
- `relayer_feed_errors_total{symbol}` - Per-feed error count

### Grafana Dashboard

Import the provided Grafana dashboard for visualization:

```bash
# TODO: Add Grafana dashboard JSON
```

## Supported Price Feeds

| Symbol | Asset      | Pyth Feed ID                                                         |
| ------ | ---------- | -------------------------------------------------------------------- |
| XAUUSD | Gold/USD   | `0x765d2ba906dbc32ca17cc11f5310a89e9ee1f6420508c63861f2f8ba4ee34bb2` |
| XAGUSD | Silver/USD | `0xf2fb02c32b055c805e7238d628e5e9dadef274376114eb1f012337cabe93871e` |
| EURUSD | EUR/USD    | `0xa995d00bb36a63cef7fd2c287dc105fc8f3d93779f062f09551b0af3e81ec30b` |
| GBPUSD | GBP/USD    | `0x84c2dde9633d93d1bcad84e7dc41c9d56578b7ec52fabedc1f335d673df0a7c1` |
| USDJPY | USD/JPY    | `0xef2c98c804ba503c6a707e38be4dfbb16683775f195b091252bf24693042fd52` |

## Error Handling

The relayer implements robust error handling:

1. **Retry Logic**: Failed submissions are retried up to 3 times with exponential backoff
2. **Staleness Detection**: Prices older than 60 seconds are rejected
3. **Account Validation**: Checks if relayer account is funded before starting
4. **Graceful Shutdown**: Handles SIGINT/SIGTERM for clean shutdown

## Logging

Logs are output in JSON format with the following levels:

- `error` - Critical errors
- `warn` - Warnings (stale prices, retries)
- `info` - Important events (successful updates, startup)
- `debug` - Detailed debugging information

Set log level via `LOG_LEVEL` environment variable.

## Cost Estimation

### Testnet

- Transaction fees: ~0.00001 XLM per update
- Updates per day: ~17,280 (5-second interval)
- Daily cost: ~0.17 XLM (~$0.02)

### Mainnet

- Transaction fees: ~0.00001 XLM per update
- Updates per day: ~17,280
- Daily cost: ~0.17 XLM (~$0.02)

## Troubleshooting

### Relayer won't start

1. Check if account is funded:

```bash
curl "https://horizon-testnet.stellar.org/accounts/YOUR_PUBLIC_KEY"
```

2. Verify contract ID is correct
3. Check RPC URL is accessible

### Price updates failing

1. Check Pyth Hermes API status
2. Verify feed IDs are correct
3. Check account has sufficient XLM balance
4. Review logs for specific errors

### High error rate

1. Increase `UPDATE_INTERVAL_MS` to reduce frequency
2. Check network connectivity
3. Verify contract is not paused
4. Review Stellar network status

## Development

### Project Structure

```
backend/
├── src/
│   ├── clients/           # External service clients
│   │   ├── pyth-client.ts       # Pyth Hermes API client
│   │   └── stellar-client.ts    # Stellar Soroban RPC client
│   ├── config/            # Configuration management
│   │   └── index.ts             # App configuration loader
│   ├── servers/           # Server implementations
│   │   ├── express-server.ts    # Express API server
│   │   └── health-server.ts     # Health check server
│   ├── services/          # Business logic services
│   │   └── relayer.ts           # Price relayer service
│   ├── types/             # TypeScript type definitions
│   │   └── index.ts             # Shared types
│   ├── utils/             # Utility functions
│   │   └── logger.ts            # Logging utility
│   ├── index.ts           # Entry point (relayer)
│   ├── server.ts          # Entry point (API server)
│   └── README.md          # Source code documentation
├── package.json
├── tsconfig.json
├── nodemon.json           # Nodemon configuration
└── .env.example
```

### Adding New Price Feeds

1. Get Pyth feed ID from [Pyth Price Feeds](https://pyth.network/developers/price-feed-ids)
2. Add it to `SUPPORTED_FEEDS` in `src/config/constants.ts`.
3. Run `npx tsx scripts/register-feeds.ts` to register it on-chain.

### Running Tests

```bash
npm test
```

## License

MIT
