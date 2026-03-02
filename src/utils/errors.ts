/**
 * Base error class for all application errors
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly isOperational: boolean = true
  ) {
    super(message);
    this.name = this.constructor.name;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Configuration and environment errors
 */
export class ConfigError extends AppError {
  constructor(message: string) {
    super(message, 'CONFIG_ERROR', 500);
  }
}

export class EnvNotLoadedError extends ConfigError {
  constructor() {
    super('Environment variables not loaded. .env file may be missing or invalid.');
  }
}

export class MissingEnvVarError extends ConfigError {
  constructor(variables: string[]) {
    super(`Missing required environment variables: ${variables.join(', ')}`);
  }
}

export class InvalidEnvVarError extends ConfigError {
  constructor(variable: string, reason: string) {
    super(`Invalid environment variable ${variable}: ${reason}`);
  }
}

/**
 * Network and connection errors
 */
export class NetworkError extends AppError {
  constructor(message: string, public readonly service: string) {
    super(message, 'NETWORK_ERROR', 503);
  }
}

export class PythConnectionError extends NetworkError {
  constructor(message: string) {
    super(`Failed to connect to Pyth Hermes: ${message}`, 'pyth');
  }
}

export class StellarConnectionError extends NetworkError {
  constructor(message: string) {
    super(`Failed to connect to Stellar network: ${message}`, 'stellar');
  }
}

/**
 * Account and authentication errors
 */
export class AccountError extends AppError {
  constructor(message: string) {
    super(message, 'ACCOUNT_ERROR', 401);
  }
}

export class AccountNotFundedError extends AccountError {
  constructor(publicKey: string) {
    super(`Account ${publicKey} is not funded. Please fund the account before starting the relayer.`);
  }
}

export class InvalidSecretKeyError extends AccountError {
  constructor() {
    super('Invalid Stellar secret key format. Must start with "S" and be 56 characters long.');
  }
}

export class InsufficientBalanceError extends AccountError {
  constructor(balance: string, required: string) {
    super(`Insufficient balance. Current: ${balance} XLM, Required: ${required} XLM`);
  }
}

/**
 * Contract errors
 */
export class ContractError extends AppError {
  constructor(message: string) {
    super(message, 'CONTRACT_ERROR', 500);
  }
}

export class ContractNotFoundError extends ContractError {
  constructor(contractId: string) {
    super(`Contract ${contractId} not found on the network.`);
  }
}

export class ContractInvocationError extends ContractError {
  constructor(method: string, reason: string) {
    super(`Failed to invoke contract method "${method}": ${reason}`);
  }
}

export class TransactionSimulationError extends ContractError {
  constructor(details: string) {
    super(`Transaction simulation failed: ${details}`);
  }
}

export class TransactionSubmissionError extends ContractError {
  constructor(details: string) {
    super(`Transaction submission failed: ${details}`);
  }
}

/**
 * Price feed errors
 */
export class PriceFeedError extends AppError {
  constructor(message: string, public readonly symbol: string) {
    super(message, 'PRICE_FEED_ERROR', 500);
  }
}

export class StalePriceError extends PriceFeedError {
  constructor(symbol: string, age: number, maxAge: number) {
    super(
      `Price for ${symbol} is stale. Age: ${age}s, Max allowed: ${maxAge}s`,
      symbol
    );
  }
}

export class NoPriceDataError extends PriceFeedError {
  constructor(symbol: string) {
    super(`No price data available for ${symbol}`, symbol);
  }
}

export class InvalidPriceError extends PriceFeedError {
  constructor(symbol: string, reason: string) {
    super(`Invalid price for ${symbol}: ${reason}`, symbol);
  }
}

/**
 * Retry and timeout errors
 */
export class RetryError extends AppError {
  constructor(operation: string, attempts: number) {
    super(`Operation "${operation}" failed after ${attempts} retry attempts`, 'RETRY_ERROR', 500);
  }
}

export class TimeoutError extends AppError {
  constructor(operation: string, timeout: number) {
    super(`Operation "${operation}" timed out after ${timeout}ms`, 'TIMEOUT_ERROR', 504);
  }
}

/**
 * Validation errors
 */
export class ValidationError extends AppError {
  constructor(message: string) {
    super(message, 'VALIDATION_ERROR', 400);
  }
}

/**
 * Error handler utility
 */
export function handleError(error: unknown): AppError {
  if (error instanceof AppError) {
    return error;
  }

  if (error instanceof Error) {
    return new AppError(error.message, 'UNKNOWN_ERROR', 500, false);
  }

  return new AppError(String(error), 'UNKNOWN_ERROR', 500, false);
}

/**
 * Check if error is operational (expected) or programming error
 */
export function isOperationalError(error: Error): boolean {
  if (error instanceof AppError) {
    return error.isOperational;
  }
  return false;
}
