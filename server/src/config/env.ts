import dotenv from 'dotenv';

dotenv.config();

interface EnvConfig {
  port: number;
  nodeEnv: 'development' | 'production' | 'test';
  clientUrl: string;
}

function getEnv(key: string, defaultValue?: string): string {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  return value;
}

function getEnvNumber(key: string, defaultValue?: number): number {
  const value = process.env[key];
  if (value === undefined) {
    if (defaultValue !== undefined) {
      return defaultValue;
    }
    throw new Error(`Missing required environment variable: ${key}`);
  }
  const parsed = Number(value);
  if (Number.isNaN(parsed)) {
    throw new Error(`Environment variable ${key} must be a number`);
  }
  return parsed;
}

export const env: EnvConfig = {
  port: getEnvNumber('PORT', 4000),
  nodeEnv: (getEnv('NODE_ENV', 'development') as EnvConfig['nodeEnv']),
  clientUrl: getEnv('CLIENT_URL', 'http://localhost:3000'),
};

export function validateEnv(): void {
  if (!['development', 'production', 'test'].includes(env.nodeEnv)) {
    throw new Error(`Invalid NODE_ENV: ${env.nodeEnv}`);
  }
  if (env.port < 1 || env.port > 65535) {
    throw new Error(`Invalid PORT: ${env.port}`);
  }
  try {
    new URL(env.clientUrl);
  } catch {
    throw new Error(`Invalid CLIENT_URL: ${env.clientUrl}`);
  }
}