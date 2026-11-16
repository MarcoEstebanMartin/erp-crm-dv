import http from 'http';
import express from 'express';
import { describe, expect, it } from 'vitest';
import { createHttpCompressionMiddleware } from '../../middlewares/compression.middleware';
import { resolvePooledDatabaseUrl, resolvePrismaLogConfig } from '../../utils/prisma';

function requestRaw(
  port: number,
  path: string,
  headers: Record<string, string> = {},
): Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; byteLength: number }> {
  return new Promise((resolve, reject) => {
    const req = http.get(
      {
        hostname: '127.0.0.1',
        port,
        path,
        headers: { 'Accept-Encoding': 'gzip', ...headers },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (c) => chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c)));
        res.on('end', () => {
          const total = Buffer.concat(chunks);
          resolve({
            statusCode: res.statusCode || 0,
            headers: res.headers,
            byteLength: total.byteLength,
          });
        });
      },
    );
    req.on('error', reject);
  });
}

describe('Paso 2 Velocidad — Compresión HTTP Turbo (gzip) y Logs SQL Limpios', () => {
  it('comprime respuestas JSON >= 1 KB con gzip logrando reducción sustancial de bytes y respeta x-no-compression', async () => {
    const app = express();
    app.use(createHttpCompressionMiddleware());

    const largePayload = {
      status: 'success',
      data: Array.from({ length: 120 }, (_, i) => ({
        id: i + 1,
        name: `Cliente Distribuidora Victoria ${i + 1}`,
        city: 'General Villegas',
        route: 'VILLEGAS CENTRO',
      })),
    };
    const rawJsonBytes = Buffer.byteLength(JSON.stringify(largePayload));

    app.get('/api/large', (_req, res) => {
      res.json(largePayload);
    });
    app.get('/api/tiny', (_req, res) => {
      res.json({ ok: true });
    });

    const server = app.listen(0);
    try {
      const addr = server.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;

      const compressed = await requestRaw(port, '/api/large');
      expect(compressed.statusCode).toBe(200);
      expect(compressed.headers['content-encoding']).toBe('gzip');
      expect(compressed.byteLength).toBeLessThan(Math.floor(rawJsonBytes * 0.25));

      const bypassed = await requestRaw(port, '/api/large', { 'x-no-compression': '1' });
      expect(bypassed.statusCode).toBe(200);
      expect(bypassed.headers['content-encoding']).toBeUndefined();
      expect(bypassed.byteLength).toBe(rawJsonBytes);

      const tiny = await requestRaw(port, '/api/tiny');
      expect(tiny.statusCode).toBe(200);
      expect(tiny.headers['content-encoding']).toBeUndefined();
    } finally {
      server.close();
    }
  });

  it('resolvePrismaLogConfig silencia el spam de queries en development dejando solo slow-queries/warn/error', () => {
    expect(resolvePrismaLogConfig('development', false)).toEqual([
      { emit: 'event', level: 'query' },
      { emit: 'stdout', level: 'warn' },
      { emit: 'stdout', level: 'error' },
    ]);

    expect(resolvePrismaLogConfig('development', true)).toEqual(['query', 'warn', 'error']);
    expect(resolvePrismaLogConfig('production', false)).toEqual(['error']);
    expect(resolvePrismaLogConfig('test', false)).toEqual(['error']);
  });

  it('resolvePooledDatabaseUrl agrega pgbouncer, connection_limit y pool_timeout al pooler de Supabase sin pisar valores explícitos', () => {
    const barePooler = 'postgresql://postgres.ref:pass@aws-0-sa-east-1.pooler.supabase.com:6543/postgres';
    const resolved = resolvePooledDatabaseUrl(barePooler, '15');
    expect(resolved).toContain('pgbouncer=true');
    expect(resolved).toContain('connection_limit=15');
    expect(resolved).toContain('pool_timeout=20');

    const customPooler =
      'postgresql://postgres.ref:pass@aws-0-sa-east-1.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=25&pool_timeout=30';
    expect(resolvePooledDatabaseUrl(customPooler, '15')).toBe(customPooler);

    expect(resolvePooledDatabaseUrl('')).toBeUndefined();
  });
});
