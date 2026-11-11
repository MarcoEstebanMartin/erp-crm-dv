import dotenv from 'dotenv';
dotenv.config();

export type TrustProxySetting = boolean | number | string;

export interface EnvConfig {
  PORT: number;
  NODE_ENV: 'development' | 'production' | 'test';
  JWT_SECRET: string;
  CORS_ORIGIN: string | string[] | boolean;
  TRUST_PROXY: TrustProxySetting;
  JSON_BODY_LIMIT: string;
  IGNORE_STOCK_CHECK: boolean;
  AFIP_PRODUCTION: boolean;
  PRODUCTION_CATALOG_DATABASE_URL?: string;
}

export function parseTrustProxy(rawValue?: string): TrustProxySetting {
  if (!rawValue || rawValue.trim() === '') {
    // Por defecto solo confía en proxies locales (Nginx local, Vite Proxy, Ngrok),
    // impidiendo que atacantes externos o en red falsifiquen X-Forwarded-For directo.
    return 'loopback';
  }
  const normalized = rawValue.trim().toLowerCase();
  if (normalized === 'true') return true;
  if (normalized === 'false') return false;
  const asNumber = Number(normalized);
  if (!Number.isNaN(asNumber) && Number.isInteger(asNumber) && asNumber >= 0) {
    return asNumber;
  }
  return rawValue.trim();
}

export function validateEnvConfig(sourceEnv: NodeJS.ProcessEnv = process.env): EnvConfig {
  const JWT_SECRET = sourceEnv.JWT_SECRET;
  if (!JWT_SECRET || JWT_SECRET.trim() === '') {
    throw new Error(
      'FATAL: La variable de entorno JWT_SECRET no está definida en la configuración del servidor.',
    );
  }

  const nodeEnv =
    (sourceEnv.NODE_ENV as 'development' | 'production' | 'test') || 'development';

  const rawCors = (sourceEnv.CORS_ORIGIN || sourceEnv.FRONTEND_URL || '').trim();
  let corsOrigin: string | string[] | boolean;

  if (nodeEnv === 'production') {
    if ((!rawCors || rawCors === '*') && sourceEnv.ALLOW_WILDCARD_CORS !== 'true') {
      throw new Error(
        'FATAL SEGURIDAD PRODUCCIÓN: CORS_ORIGIN (o FRONTEND_URL) debe definir los dominios explícitos permitidos en producción (prohibido "*").',
      );
    }
    corsOrigin = rawCors.includes(',')
      ? rawCors.split(',').map((s) => s.trim()).filter(Boolean)
      : rawCors || '*';
  } else {
    // En desarrollo y tests permitimos localhost, IP WiFi de celulares y túneles Ngrok
    if (!rawCors || rawCors === '*') {
      corsOrigin = true;
    } else {
      corsOrigin = rawCors.includes(',')
        ? rawCors.split(',').map((s) => s.trim()).filter(Boolean)
        : rawCors;
    }
  }

  return {
    PORT: parseInt(sourceEnv.PORT || '3000', 10),
    NODE_ENV: nodeEnv,
    JWT_SECRET,
    CORS_ORIGIN: corsOrigin,
    TRUST_PROXY: parseTrustProxy(sourceEnv.TRUST_PROXY),
    JSON_BODY_LIMIT: (sourceEnv.JSON_BODY_LIMIT || '1mb').trim(),
    IGNORE_STOCK_CHECK: sourceEnv.IGNORE_STOCK_CHECK === 'true',
    AFIP_PRODUCTION: sourceEnv.AFIP_PRODUCTION === 'true',
    PRODUCTION_CATALOG_DATABASE_URL: sourceEnv.PRODUCTION_CATALOG_DATABASE_URL?.trim() || undefined,
  };
}

export const env = validateEnvConfig();
