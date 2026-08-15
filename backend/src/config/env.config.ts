import dotenv from 'dotenv';
dotenv.config();

interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  JWT_SECRET: string;
  CORS_ORIGIN: string;
  ARCHIVOS_PATH: string;
  IGNORE_STOCK_CHECK: boolean;
  AFIP_PRODUCTION: boolean;
}

function validateEnv(): EnvConfig {
  const JWT_SECRET = process.env.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET.trim() === '') {
    throw new Error('FATAL: La variable de entorno JWT_SECRET no está definida en la configuración del servidor.');
  }

  return {
    PORT: parseInt(process.env.PORT || '3000', 10),
    NODE_ENV: (process.env.NODE_ENV as 'development' | 'production' | 'test') || 'development',
    JWT_SECRET,
    CORS_ORIGIN: process.env.CORS_ORIGIN || '*',
    ARCHIVOS_PATH: process.env.ARCHIVOS_PATH || '../../ARCHIVOS',
    IGNORE_STOCK_CHECK: process.env.IGNORE_STOCK_CHECK === 'true',
    AFIP_PRODUCTION: process.env.AFIP_PRODUCTION === 'true',
  };
}

export const env = validateEnv();
