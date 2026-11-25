import fs from 'fs';
import path from 'path';
import { PrismaClient } from '@prisma/client';
import { Request, Response, NextFunction, RequestHandler } from 'express';
import { env } from '../config/env.config';

const SAFE_IMAGE_FILENAME_RE = /^([a-zA-Z0-9_-]+)\.(jpg|jpeg|png|webp)$/i;
const VERSIONED_IMAGE_FILENAME_RE = /^.+_[a-zA-Z0-9]{6,}\.(jpg|jpeg|png|webp)$/i;
const MAX_CONCURRENT_IMAGE_FETCHES = 4;
const IMAGE_FETCH_TX_OPTIONS = { maxWait: 15000, timeout: 15000 } as const;

export function createConcurrencyLimiter(maxConcurrent: number) {
  const limit = Math.max(1, Math.floor(maxConcurrent));
  let active = 0;
  const queue: Array<() => void> = [];

  return async function runLimited<T>(task: () => Promise<T>): Promise<T> {
    if (active >= limit) {
      await new Promise<void>((resolve) => {
        queue.push(resolve);
      });
    }
    active += 1;
    try {
      return await task();
    } finally {
      active -= 1;
      const next = queue.shift();
      if (next) next();
    }
  };
}

const runImageDbFetch = createConcurrencyLimiter(MAX_CONCURRENT_IMAGE_FETCHES);

/**
 * Política inteligente de caché HTTP para fotos de productos:
 * - Archivos versionados (`SKU_epoch.png` / `SKU_hash.png`): cambian de URL al actualizar la foto,
 *   por lo que el navegador puede servirlos desde memoria en 0ms durante 7 días sin riesgo de foto vieja.
 * - Archivos legados sin sufijo de versión (`SKU.jpg`): caché corto de 1 hora + revalidación silenciosa.
 */
export function resolveProductImageCacheHeader(filenameOrPath: string): string {
  const base = path.basename(filenameOrPath || '');
  if (VERSIONED_IMAGE_FILENAME_RE.test(base)) {
    return 'public, max-age=604800, stale-while-revalidate=86400';
  }
  return 'public, max-age=3600, stale-while-revalidate=86400';
}

export function applyProductImageStaticHeaders(res: Response, filePath: string): void {
  res.setHeader('Cache-Control', resolveProductImageCacheHeader(filePath));
}

interface RawImageRow {
  mime_type: string | null;
  img_b64: string | null;
}

let sharedReadClient: PrismaClient | null = null;
let sharedReadUrl: string | null = null;
const inFlightDownloads = new Map<string, Promise<{ buffer: Buffer; mimeType: string } | null>>();

function getReadOnlyImageClient(overrideUrl?: string): PrismaClient | null {
  const url = (overrideUrl || env.PRODUCTION_CATALOG_DATABASE_URL || '').trim();
  if (!url) return null;
  if (overrideUrl && overrideUrl !== sharedReadUrl) {
    return new PrismaClient({ datasources: { db: { url } } });
  }
  if (!sharedReadClient || sharedReadUrl !== url) {
    sharedReadClient = new PrismaClient({ datasources: { db: { url } } });
    sharedReadUrl = url;
  }
  return sharedReadClient;
}

function inferMimeFromExtension(filename: string, dbMime?: string | null): string {
  if (dbMime && dbMime.startsWith('image/')) return dbMime;
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

/**
 * Hidrata en disco una foto faltante de producto desde `chatbot-dv.product_images` (READ ONLY)
 * con control de concurrencia (`runImageDbFetch`) y escritura atómica.
 * Reutilizado tanto por el middleware HTTP como por el generador PDF de Catalog Studio en Railway.
 */
export async function ensureProductImageOnDisk(
  rawNameInput: string,
  productsUploadsDir: string,
  overrideProdDbUrl?: string,
): Promise<{ buffer: Buffer; mimeType: string; fullPath: string } | null> {
  const rawName = path.basename(rawNameInput || '');
  const match = SAFE_IMAGE_FILENAME_RE.exec(rawName);
  if (!match) return null;

  const targetPath = path.join(productsUploadsDir, rawName);
  if (fs.existsSync(targetPath)) {
    const cachedBuffer = fs.readFileSync(targetPath);
    if (cachedBuffer.length > 0) {
      return {
        buffer: cachedBuffer,
        mimeType: inferMimeFromExtension(rawName),
        fullPath: targetPath,
      };
    }
  }

  const skuCandidate = match[1].split('_')[0].trim();
  if (!skuCandidate) return null;

  const client = getReadOnlyImageClient(overrideProdDbUrl);
  if (!client) return null;

  let pending = inFlightDownloads.get(rawName);
  if (!pending) {
    pending = runImageDbFetch(async () => {
      if (fs.existsSync(targetPath)) {
        const cachedBuffer = fs.readFileSync(targetPath);
        if (cachedBuffer.length > 0) {
          return {
            buffer: cachedBuffer,
            mimeType: inferMimeFromExtension(rawName),
          };
        }
      }

      const rows = await client.$transaction(
        async (tx) => {
          await tx.$executeRawUnsafe('SET LOCAL transaction_read_only = on');
          return tx.$queryRawUnsafe<RawImageRow[]>(
            `SELECT mime_type, ENCODE(image_data, 'base64') AS img_b64
             FROM public.product_images
             WHERE TRIM(sku) = $1 AND OCTET_LENGTH(image_data) > 0
             LIMIT 1`,
            skuCandidate,
          );
        },
        IMAGE_FETCH_TX_OPTIONS,
      );
      const row = rows[0];
      if (!row?.img_b64) return null;

      const buffer = Buffer.from(row.img_b64, 'base64');
      if (buffer.length === 0) return null;

      if (!fs.existsSync(productsUploadsDir)) {
        fs.mkdirSync(productsUploadsDir, { recursive: true });
      }
      const tmpPath = `${targetPath}.tmp_${process.pid}_${Date.now()}`;
      fs.writeFileSync(tmpPath, buffer);
      fs.renameSync(tmpPath, targetPath);

      return {
        buffer,
        mimeType: inferMimeFromExtension(rawName, row.mime_type),
      };
    }).finally(() => {
      inFlightDownloads.delete(rawName);
    });
    inFlightDownloads.set(rawName, pending);
  }

  const resolved = await pending;
  if (!resolved) return null;
  return { ...resolved, fullPath: targetPath };
}

/**
 * Middleware de autocuración de caché local de imágenes (`backend/uploads/products/`).
 * Si un contenedor nuevo (ej. Railway o segunda PC) aún no tiene el archivo en disco,
 * lo recupera en modo READ ONLY desde `chatbot-dv.product_images`, lo persiste atómicamente
 * en disco para servir futuras lecturas en 0.1ms y lo entrega al navegador sin tocar precios.
 */
export function createProductImageCacheFallback(
  productsUploadsDir: string,
  overrideProdDbUrl?: string,
): RequestHandler {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    const method = (req.method || 'GET').toUpperCase();
    if (method !== 'GET' && method !== 'HEAD') {
      next();
      return;
    }

    const rawName = path.basename(req.path || '');
    try {
      const resolved = await ensureProductImageOnDisk(
        rawName,
        productsUploadsDir,
        overrideProdDbUrl,
      );

      if (!resolved) {
        next();
        return;
      }

      res.setHeader('Content-Type', resolved.mimeType);
      res.setHeader('Content-Length', String(resolved.buffer.length));
      res.setHeader('Cache-Control', resolveProductImageCacheHeader(rawName));
      res.status(200).end(method === 'HEAD' ? undefined : resolved.buffer);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[ProductImageCache] Error recuperando ${rawName}: ${msg}`);
      next();
    }
  };
}
