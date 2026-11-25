import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildReportCacheKey,
  invalidateReportCache,
  withReportCache,
} from '../admin/admin-report-cache.helper';
import { resolveReportDateRange } from '../admin/admin-report.helpers';

describe('Paso 2 - Rendimiento y caché de Reportes (singleflight + TTL + rango por defecto)', () => {
  beforeEach(() => {
    invalidateReportCache();
  });

  it('construye claves de caché determinísticas ignorando orden de filtros y vacíos', () => {
    const keyA = buildReportCacheKey('zones', {
      cities: ['Villegas', 'Bunge'],
      sellerId: 5,
      city: '',
    });
    const keyB = buildReportCacheKey('zones', {
      sellerId: 5,
      cities: ['Bunge', 'Villegas'],
      city: undefined,
    });
    expect(keyA).toBe(keyB);
    expect(keyA).toBe('report:zones:cities=Bunge,Villegas&sellerId=5');
  });

  it('coalesce (singleflight): 3 requests concurrentes al mismo reporte frío ejecutan 1 sola query', async () => {
    const compute = vi.fn().mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 25));
      return { total: 123456 };
    });

    const [r1, r2, r3] = await Promise.all([
      withReportCache('finance', { startDate: '2026-11-01' }, 120, compute, {
        bypassCache: false,
      }),
      withReportCache('finance', { startDate: '2026-11-01' }, 120, compute, {
        bypassCache: false,
      }),
      withReportCache('finance', { startDate: '2026-11-01' }, 120, compute, {
        bypassCache: false,
      }),
    ]);

    expect(compute).toHaveBeenCalledTimes(1);
    expect(r1).toEqual({ total: 123456 });
    expect(r2).toEqual({ total: 123456 });
    expect(r3).toEqual({ total: 123456 });

    // Llamada posterior sirve desde caché sin volver a ejecutar compute
    const r4 = await withReportCache('finance', { startDate: '2026-11-01' }, 120, compute, {
      bypassCache: false,
    });
    expect(compute).toHaveBeenCalledTimes(1);
    expect(r4).toEqual({ total: 123456 });

    // Al invalidar por nombre, vuelve a computar
    invalidateReportCache('finance');
    await withReportCache('finance', { startDate: '2026-11-01' }, 120, compute, {
      bypassCache: false,
    });
    expect(compute).toHaveBeenCalledTimes(2);
  });

  it('resuelve mes actual en hora Argentina cuando no llegan fechas y defaultCurrentMonth=true', () => {
    const res = resolveReportDateRange({ defaultCurrentMonth: true });
    expect(res.start).toBeInstanceOf(Date);
    expect(res.end).toBeInstanceOf(Date);
    expect(res.startDateIso).toMatch(/^\d{4}-\d{2}-01$/);
    expect(res.endDateIso).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});
