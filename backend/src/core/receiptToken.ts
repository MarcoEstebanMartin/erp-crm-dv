import crypto from 'crypto';

export type ReceiptKind = 'office' | 'field';

const TOKEN_VERSION = 'dv-receipt-v1';
const TOKEN_HEX_LENGTH = 16;

export const DEFAULT_PUBLIC_APP_URL = 'https://erp-dv-prueba-production.up.railway.app';

const EPHEMERAL_HOST_SUFFIXES = [
  '.trycloudflare.com',
  '.ngrok-free.app',
  '.ngrok.io',
  '.loca.lt',
];

function isNonPublicHost(hostname: string): boolean {
  const host = hostname.toLowerCase();
  if (host === 'localhost' || host === '127.0.0.1' || host === '0.0.0.0') return true;
  return EPHEMERAL_HOST_SUFFIXES.some((suffix) => host.endsWith(suffix));
}

/**
 * Normaliza la URL base pública para compartir comprobantes, evitando barras finales
 * y cayendo al dominio de producción oficial si se pasa vacío, localhost o túneles temporales.
 */
export function normalizePublicAppUrl(rawUrl?: string | null): string {
  const trimmed = (rawUrl || '').trim().replace(/\/+$/, '');
  if (!trimmed) return DEFAULT_PUBLIC_APP_URL;

  try {
    const parsed = new URL(trimmed);
    if (isNonPublicHost(parsed.hostname)) {
      return DEFAULT_PUBLIC_APP_URL;
    }
    return `${parsed.protocol}//${parsed.host}${parsed.pathname.replace(/\/+$/, '')}`;
  } catch {
    return DEFAULT_PUBLIC_APP_URL;
  }
}

/**
 * Genera una firma HMAC-SHA256 determinística y no predecible para un recibo.
 * Produce 16 caracteres hexadecimales (64 bits de entropía): corta para WhatsApp
 * e imposible de adivinar o enumerar por terceros.
 */
export function signReceiptToken(params: {
  kind: ReceiptKind;
  id: number;
  secret: string;
}): string {
  if (!Number.isInteger(params.id) || params.id <= 0) {
    throw new Error('ID de recibo inválido para firmar');
  }
  if (!params.secret || params.secret.trim().length === 0) {
    throw new Error('Secreto de firma de recibos no configurado');
  }

  return crypto
    .createHmac('sha256', params.secret)
    .update(`${TOKEN_VERSION}:${params.kind}:${params.id}`)
    .digest('hex')
    .slice(0, TOKEN_HEX_LENGTH);
}

/**
 * Verifica un token de recibo en tiempo constante (timing-safe) para evitar
 * ataques de enumeración y timing attacks.
 */
export function verifyReceiptToken(params: {
  kind: ReceiptKind;
  id: number;
  token?: string | null;
  secret: string;
}): boolean {
  if (!Number.isInteger(params.id) || params.id <= 0) return false;
  if (!params.token || typeof params.token !== 'string') return false;

  const candidate = params.token.trim().toLowerCase();
  if (candidate.length !== TOKEN_HEX_LENGTH || !/^[0-9a-f]+$/.test(candidate)) {
    return false;
  }

  const expected = signReceiptToken({
    kind: params.kind,
    id: params.id,
    secret: params.secret,
  });

  return crypto.timingSafeEqual(Buffer.from(candidate, 'utf8'), Buffer.from(expected, 'utf8'));
}

/**
 * Formatea un código legible anti-estafas derivado del token firmado: `DV-XXXX-XXXX`.
 */
export function formatVerificationCode(token: string): string {
  const clean = token.trim().toUpperCase().replace(/[^0-9A-F]/g, '');
  const head = clean.slice(0, 8).padEnd(8, '0');
  return `DV-${head.slice(0, 4)}-${head.slice(4, 8)}`;
}

/**
 * Construye el enlace público oficial y firmado de un recibo de cobro.
 */
export function buildPublicReceiptUrl(params: {
  baseUrl?: string | null;
  id: number;
  token: string;
}): string {
  const cleanBase = normalizePublicAppUrl(params.baseUrl);
  return `${cleanBase}/recibo/${params.id}?v=${encodeURIComponent(params.token)}`;
}
