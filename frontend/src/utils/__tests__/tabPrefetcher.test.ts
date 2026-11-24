import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prefetchTabChunk, resetPrefetchedTabsForTest } from '../tabPrefetcher';

describe('Paso 2.3 — Prefetch de chunks al pasar el mouse por Sidebar', () => {
  beforeEach(() => {
    resetPrefetchedTabsForTest();
  });

  it('ejecuta el loader una sola vez por combinación rol:pestaña (deduplicado)', () => {
    const loader = vi.fn().mockResolvedValue({});
    const custom = { products: loader };

    expect(prefetchTabChunk('ADMIN', 'products', custom)).toBe(true);
    expect(prefetchTabChunk('ADMIN', 'products', custom)).toBe(false);
    expect(prefetchTabChunk('ADMIN', 'products', custom)).toBe(false);
    expect(loader).toHaveBeenCalledTimes(1);
  });

  it('ignora pestañas inexistentes o roles sin loader sin arrojar errores', () => {
    expect(prefetchTabChunk('VENDEDOR', 'inicio')).toBe(false);
    expect(prefetchTabChunk('ADMIN', 'pestana-inexistente')).toBe(false);
  });

  it('permite reintentar si el prefetch falla por un microcorte de red', async () => {
    const loader = vi.fn().mockRejectedValueOnce(new Error('Network error')).mockResolvedValueOnce({});
    const custom = { clients: loader };

    expect(prefetchTabChunk('ADMIN', 'clients', custom)).toBe(true);
    await new Promise((r) => setTimeout(r, 10));
    expect(prefetchTabChunk('ADMIN', 'clients', custom)).toBe(true);
    expect(loader).toHaveBeenCalledTimes(2);
  });
});
