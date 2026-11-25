import fs from 'fs';
import path from 'path';
import sharp from 'sharp';

export interface CroppedImageResult {
  buffer: Buffer;
  width: number;
  height: number;
}

const UPLOADS_PRODUCTS_DIR = path.resolve(__dirname, '../../../uploads/products');
const LOGO_ASSET_PATH = path.resolve(__dirname, '../../../assets/logo_dv_clean.png');

interface CacheEntry {
  mtimeMs: number;
  data: CroppedImageResult;
}

const MAX_CACHE_ITEMS = 450;
const imageCache = new Map<string, CacheEntry>();

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
  const fullPath = resolveSafeProductPhotoPath(imageUrl);
  if (!fullPath) return null;

  let stat: fs.Stats;
  try {
    stat = fs.statSync(fullPath);
  } catch {
    return null;
  }

  const cached = imageCache.get(fullPath);
  if (cached && cached.mtimeMs === stat.mtimeMs) {
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
      .resize({ width: 520, height: 520, fit: 'inside', withoutEnlargement: true })
      .png({ compressionLevel: 6 })
      .toBuffer({ resolveWithObject: true });

    if (!info.width || !info.height) return null;

    const result: CroppedImageResult = {
      buffer: data,
      width: info.width,
      height: info.height,
    };

    if (imageCache.size >= MAX_CACHE_ITEMS) {
      const oldestKey = imageCache.keys().next().value;
      if (oldestKey) imageCache.delete(oldestKey);
    }
    imageCache.set(fullPath, { mtimeMs: stat.mtimeMs, data: result });
    return result;
  } catch {
    return null;
  }
}
