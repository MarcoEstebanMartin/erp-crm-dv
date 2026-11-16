import compression, { type CompressionFilter } from 'compression';
import type { Request, Response } from 'express';

const DEFAULT_COMPRESSION_THRESHOLD_BYTES = 1024;

export const shouldCompressResponse: CompressionFilter = (req: Request, res: Response) => {
  if (req.headers['x-no-compression']) {
    return false;
  }
  return compression.filter(req, res);
};

/**
 * Compresión HTTP gzip/deflate para respuestas JSON y assets de texto (>= 1 KB),
 * excluyendo binarios ya comprimidos (PNG/JPG/ZIP/PDF) y respetando x-no-compression.
 */
export function createHttpCompressionMiddleware() {
  return compression({
    threshold: DEFAULT_COMPRESSION_THRESHOLD_BYTES,
    level: 6,
    filter: shouldCompressResponse,
  });
}
