import { Request, Response } from 'express';
import { type HttpJsonCacheEntry } from './cache';

/**
 * Compara la cabecera If-None-Match del cliente contra el ETag vigente (soporta listas separadas por coma).
 */
export function isEtagMatching(ifNoneMatchHeader: unknown, etag: string): boolean {
  if (typeof ifNoneMatchHeader !== 'string' || !ifNoneMatchHeader.trim()) {
    return false;
  }
  const normalizedTarget = etag.replace(/^W\//, '').trim();
  const candidates = ifNoneMatchHeader.split(',').map((token) => token.trim());

  return candidates.some((candidate) => {
    if (candidate === '*') return true;
    return candidate.replace(/^W\//, '').trim() === normalizedTarget;
  });
}

/**
 * Envía una respuesta JSON pre-serializada con ETag y soporte nativo de 304 Not Modified.
 * Evita re-serializar objetos grandes y reduce a 0 bytes la transferencia cuando el catálogo no cambió.
 */
export function sendCachedJsonResponse(
  req: Request,
  res: Response,
  entry: HttpJsonCacheEntry,
  cacheControl: string = 'private, max-age=0, must-revalidate',
): void {
  if (typeof res.setHeader === 'function') {
    res.setHeader('ETag', entry.etag);
    res.setHeader('Cache-Control', cacheControl);
  }

  if (isEtagMatching(req.headers?.['if-none-match'], entry.etag)) {
    res.status(304).end();
    return;
  }

  if (typeof res.setHeader === 'function') {
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
  }
  res.status(200).send(entry.json);
}
