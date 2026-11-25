import fs from 'fs';
import path from 'path';
import sharp from 'sharp';
import { ensureProductImageOnDisk } from '../../middlewares/product-image-cache.middleware';

// Evita que libvips acapare RAM nativa o CPU en contenedores con recursos acotados (Railway)
sharp.cache(false);
sharp.concurrency(2);

export interface CroppedImageResult {
  buffer: Buffer;
  width: number;
  height: number;
}

const UPLOADS_PRODUCTS_DIR = path.resolve(__dirname, '../../../uploads/products');
const LOGO_ASSET_PATH = path.resolve(__dirname, '../../../assets/logo_dv_clean.png');

interface CacheEntry {
  mtimeMs: number;
  byteLength: number;
  data: CroppedImageResult;
}

const MAX_CACHE_BYTES = 25 * 1024 * 1024; // 25 MB techo estricto en RAM
const MAX_CROP_DIMENSION = 360;
const imageCache = new Map<string, CacheEntry>();
let totalCachedBytes = 0;

export function clearCatalogImageCache(): void {
  imageCache.clear();
  totalCachedBytes = 0;
}

export function getCatalogImageCacheStats(): { entries: number; bytes: number; maxBytes: number } {
  return { entries: imageCache.size, bytes: totalCachedBytes, maxBytes: MAX_CACHE_BYTES };
}

export function resolveLogoAssetPath(): string | null {
  return fs.existsSync(LOGO_ASSET_PATH) ? LOGO_ASSET_PATH : null;
}

export function resolveSafeProductPhotoPath(imageUrl?: string | null): string | null {
  if (!imageUrl) return null;
  const clean = String(imageUrl).trim().split('?')[0];
  if (!clean || /^https?:\/\//i.test(clean)) return null;

  const baseName = path.basename(clean);
  if (!baseName || baseName === '.' || baseName === '..') return null;

  const candidate = path.resolve(UPLOADS_PRODUCTS_DIR, baseName);
  if (!candidate.startsWith(UPLOADS_PRODUCTS_DIR)) return null;
  return fs.existsSync(candidate) ? candidate : null;
}

/**
 * Loads a product photo, trims surrounding white/transparent margins via sharp
 * (matching Pillow autocrop in OFERTAS APP), and returns a PDFKit-ready PNG buffer.
 */
export async function getAutocroppedProductImage(
  imageUrl?: string | null,
): Promise<CroppedImageResult | null> {
  let fullPath = resolveSafeProductPhotoPath(imageUrl);
  if (!fullPath && imageUrl) {
    const clean = String(imageUrl).trim().split('?')[0];
    if (clean && !/^https?:\/\//i.test(clean)) {
      try {
        const hydrated = await ensureProductImageOnDisk(path.basename(clean), UPLOADS_PRODUCTS_DIR);
        if (hydrated) fullPath = hydrated.fullPath;
      } catch {
        return null;
      }
    }
  }
  if (!fullPath) return null;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(fullPath);
  } catch {
    return null;
  }

  const cached = imageCache.get(fullPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
    // Refresca orden LRU
    imageCache.delete(fullPath);
    imageCache.set(fullPath, cached);
    return cached.data;
  }

  try {
    let pipeline = sharp(fullPath).rotate();
    try {
      pipeline = pipeline.trim({ threshold: 18 });
    } catch {
      // If image is solid color or trim fails, continue untrimmed
    }

    const { data, info } = await pipeline
      .resize({
        width: MAX_CROP_DIMENSION,
        height: MAX_CROP_DIMENSION,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .png({ compressionLevel: 7 })
      .toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height) return null;

    const result: CroppedImageResult = {
      buffer: data,
      width: info.width,
      height: info.height,
    };

    const existing = imageCache.get(fullPath);
    if (existing) {
      totalCachedBytes -= existing.byteLength;
      imageCache.delete(fullPath);
    }

    const entryBytes = data.byteLength;
    if (entryBytes <= MAX_CACHE_BYTES) {
      while (totalCachedBytes + entryBytes > MAX_CACHE_BYTES && imageCache.size > 0) {
        const oldestKey = imageCache.keys().next().value;
        if (!oldestKey) break;
        const oldest = imageCache.get(oldestKey);
        if (oldest) totalCachedBytes -= oldest.byteLength;
        imageCache.delete(oldestKey);
      }
      imageCache.set(fullPath, { mtimeMs: stat.mtimeMs, byteLength: entryBytes, data: result });
      totalCachedBytes += entryBytes;
    }

    return result;
  } catch {
    return null;
  }
}
