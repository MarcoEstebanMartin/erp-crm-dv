import { describe, it, expect, vi, beforeEach } from 'vitest';
import { appCache } from '../cache';
import { isEtagMatching, sendCachedJsonResponse } from '../http-cache.util';

function createMockRes() {
  const headers: Record<string, string> = {};
  const res: any = {
    statusCode: 200,
    headers,
    sentBody: undefined,
    ended: false,
    setHeader(k: string, v: string) {
      headers[k] = v;
    },
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    send(body: string) {
      this.sentBody = body;
      return this;
    },
    end() {
      this.ended = true;
      return this;
    },
  };
  return res;
}

describe('Paso 2.2 — Caché HTTP pre-serializado + ETag (304 Not Modified)', () => {
  beforeEach(() => {
    appCache.clear();
  });

  it('guarda JSON pre-serializado con ETag y responde 200 en el primer request y 304 si coincide If-None-Match', () => {
    const entry = appCache.setSerializedJson('products_http__false_full_nocost', {
      status: 'success',
      data: { products: [{ id: 1, name: 'Queso Cremoso', listPrice: 5000 }] },
    });

    expect(entry.etag).toMatch(/^W\/"[a-f0-9]{16}"$/);

    // 1er request (sin If-None-Match) -> 200 OK con JSON pre-serializado
    const res1 = createMockRes();
    sendCachedJsonResponse({ headers: {} } as any, res1, entry);
    expect(res1.statusCode).toBe(200);
    expect(res1.headers['ETag']).toBe(entry.etag);
    expect(res1.headers['Cache-Control']).toBe('private, max-age=0, must-revalidate');
    expect(res1.sentBody).toBe(entry.json);

    // 2do request (con If-None-Match igual) -> 304 Not Modified y 0 bytes de cuerpo
    const res2 = createMockRes();
    sendCachedJsonResponse({ headers: { 'if-none-match': entry.etag } } as any, res2, entry);
    expect(res2.statusCode).toBe(304);
    expect(res2.ended).toBe(true);
    expect(res2.sentBody).toBeUndefined();
  });

  it('soporta listas de ETags y comparación débil/fuerte en If-None-Match', () => {
    expect(isEtagMatching('W/"abc123", W/"def456"', 'W/"def456"')).toBe(true);
    expect(isEtagMatching('"def456"', 'W/"def456"')).toBe(true);
    expect(isEtagMatching('W/"otro"', 'W/"def456"')).toBe(false);
    expect(isEtagMatching(undefined, 'W/"def456"')).toBe(false);
  });

  it('invalida entradas pre-serializadas al llamar invalidateProductCatalog e invalidateProductCatalogThrottled', () => {
    appCache.setSerializedJson('products_http__false_full_cost', { ok: true }, 60);
    appCache.setSerializedJson('weekly_promos_active', { ok: true }, 60);

    expect(appCache.getSerializedJson('products_http__false_full_cost')).not.toBeNull();

    // Invalidación suavizada borra products_ pero preserva weekly_promos_
    appCache.invalidateProductCatalogThrottled(15_000, Date.now());
    expect(appCache.getSerializedJson('products_http__false_full_cost')).toBeNull();
    expect(appCache.getSerializedJson('weekly_promos_active')).not.toBeNull();

    // Invalidación completa borra ambos
    appCache.setSerializedJson('products_http__false_full_cost', { ok: true }, 60);
    appCache.invalidateProductCatalog();
    expect(appCache.getSerializedJson('products_http__false_full_cost')).toBeNull();
    expect(appCache.getSerializedJson('weekly_promos_active')).toBeNull();
  });

  it('expira automáticamente entradas vencidas según TTL', () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000_000);
    appCache.setSerializedJson('products_http_test', { ok: true }, 5);

    nowSpy.mockReturnValue(1_004_000);
    expect(appCache.getSerializedJson('products_http_test')).not.toBeNull();

    nowSpy.mockReturnValue(1_006_000);
    expect(appCache.getSerializedJson('products_http_test')).toBeNull();
    nowSpy.mockRestore();
  });
});
