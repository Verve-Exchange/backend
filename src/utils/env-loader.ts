import dotenv from 'dotenv';
import { existsSync } from 'fs';
import { resolve } from 'path';
import { EnvNotLoadedError, InvalidEnvVarError } from './errors';
import { logger } from './logger';

/**
 * Load and validate environment variables
 */
export function loadEnv(): void {
  const envPath = resolve(process.cwd(), '.env');

  // Check if .env file exists
  if (!existsSync(envPath)) {
    logger.warn({ envPath }, '.env file not found, using environment variables only');
  }

  // Load .env file
  const result = dotenv.config({ path: envPath });

  if (result.error) {
    if (result.error.message.includes('ENOENT')) {
      logger.warn('.env file not found, using system environment variables');
    } else {
      throw new EnvNotLoadedError();
    }
  } else {
    logger.info({ envPath }, 'Environment variables loaded from .env file');
  }
}

/**
 * Get required environment variable
 */
export function getEnvVar(key: string): string {
  const value = process.env[key];

  if (!value) {
    throw new InvalidEnvVarError(key, 'Variable is required but not set');
  }

  return value;
}

/**
 * Get optional environment variable with default
 */
export function getEnvVarOptional(key: string, defaultValue: string): string {
  return process.env[key] || defaultValue;
}

/**
 * Get environment variable as integer
 */
export function getEnvVarInt(key: string, defaultValue?: number): number {
  const value = process.env[key];

  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new InvalidEnvVarError(key, 'Variable is required but not set');
  }

  const parsed = parseInt(value, 10);

  if (isNaN(parsed)) {
    throw new InvalidEnvVarError(key, `Expected integer, got "${value}"`);
  }

  return parsed;
}

/**
 * Get environment variable as boolean
 */
export function getEnvVarBool(key: string, defaultValue?: boolean): boolean {
  const value = process.env[key];

  if (!value) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new InvalidEnvVarError(key, 'Variable is required but not set');
  }

  const normalized = value.toLowerCase();

  if (['true', '1', 'yes', 'on'].includes(normalized)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalized)) {
    return false;
  }

  throw new InvalidEnvVarError(key, `Expected boolean, got "${value}"`);
}

/**
 * Validate Stellar secret key format
 */
export function validateSecretKey(key: string): void {
  if (!key.startsWith('S') || key.length !== 56) {
    throw new InvalidEnvVarError('RELAYER_SECRET_KEY', 'Invalid Stellar secret key format');
  }
}

/**
 * Validate contract ID format
 */
export function validateContractId(contractId: string): void {
  if (!contractId.startsWith('C') || contractId.length !== 56) {
    throw new InvalidEnvVarError('ORACLE_CONTRACT_ID', 'Invalid Stellar contract ID format');
  }
}

/**
 * Validate URL format
 */
export function validateUrl(url: string, varName: string): void {
  try {
    new URL(url);
  } catch {
    throw new InvalidEnvVarError(varName, `Invalid URL format: ${url}`);
  }
}
