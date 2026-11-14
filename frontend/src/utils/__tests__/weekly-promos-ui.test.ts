import { describe, expect, it } from 'vitest';
import {
  canManageWeeklyPromos,
  formatPromoConditionSummary,
  formatPromoDateRange,
  getDefaultPromoDates,
  resolvePromoVisualStatus,
} from '../../components/admin/config/weeklyPromo.helpers';

describe('weeklyPromo.helpers (UI & permisos Ofertas Semanales)', () => {
  it('restringe la gestión exclusivamente a admin y dario con rol ADMIN o FACTURACION', () => {
    expect(canManageWeeklyPromos({ username: 'admin', role: 'ADMIN' })).toBe(true);
    expect(canManageWeeklyPromos({ username: 'dario', role: 'ADMIN' })).toBe(true);
    expect(canManageWeeklyPromos({ username: 'Dario', role: 'FACTURACION' })).toBe(true);

    expect(canManageWeeklyPromos({ username: 'agustin', role: 'ADMIN' })).toBe(false);
    expect(canManageWeeklyPromos({ username: 'diego', role: 'VENDEDOR' })).toBe(false);
    expect(canManageWeeklyPromos({ username: 'miguel', role: 'DEPOSITO' })).toBe(false);
    expect(canManageWeeklyPromos({ username: 'dario', role: 'VENDEDOR' })).toBe(false);
    expect(canManageWeeklyPromos(null)).toBe(false);
  });

  it('calcula 7 días corridos de vigencia por defecto incluso cruzando fin de mes', () => {
    const { startDate, endDate } = getDefaultPromoDates(new Date(2026, 10, 28, 15, 30));
    expect(startDate).toBe('2026-11-28');
    expect(endDate).toBe('2026-12-05');
  });

  it('resuelve correctamente estados VIGENTE, PROGRAMADA, PAUSADA y VENCIDA', () => {
    const now = new Date('2026-11-15T12:00:00Z');
    expect(
      resolvePromoVisualStatus(
        { isActive: true, startDate: '2026-11-14T00:00:00Z', endDate: '2026-11-21T23:59:59Z' },
        now,
      ),
    ).toBe('VIGENTE');
    expect(
      resolvePromoVisualStatus(
        { isActive: true, startDate: '2026-11-18T00:00:00Z', endDate: '2026-11-25T23:59:59Z' },
        now,
      ),
    ).toBe('PROGRAMADA');
    expect(
      resolvePromoVisualStatus(
        { isActive: true, startDate: '2026-11-01T00:00:00Z', endDate: '2026-11-10T23:59:59Z' },
        now,
      ),
    ).toBe('VENCIDA');
    expect(
      resolvePromoVisualStatus(
        { isActive: false, startDate: '2026-11-14T00:00:00Z', endDate: '2026-11-21T23:59:59Z' },
        now,
      ),
    ).toBe('PAUSADA');
  });

  it('formatea resúmenes claros para Precio Oferta, N+M Gratis, Combo y fechas', () => {
    expect(
      formatPromoConditionSummary({
        type: 'OFFER_PRICE',
        items: [
          {
            id: 1,
            promoId: 1,
            productId: 10,
            minQuantity: 6,
            freeQuantity: 0,
            promoUnitPrice: 2500,
            product: { id: 10, sku: 'A1', name: 'Aceite Girasol 1.5L', listPrice: 3100 },
          },
        ],
      }),
    ).toBe('Aceite Girasol 1.5L · Desde 6 u. a $2.500 c/u');

    expect(
      formatPromoConditionSummary({
        type: 'BUY_X_GET_Y',
        items: [
          {
            id: 2,
            promoId: 2,
            productId: 11,
            minQuantity: 3,
            freeQuantity: 1,
            promoUnitPrice: null,
            product: { id: 11, sku: 'B1', name: 'Gaseosa Cola 2.25L', listPrice: 2800 },
          },
        ],
      }),
    ).toBe('Gaseosa Cola 2.25L · Pagás 3 y llevás 1 sin cargo');

    expect(
      formatPromoConditionSummary({
        type: 'COMBO',
        items: [
          {
            id: 3,
            promoId: 3,
            productId: 20,
            minQuantity: 1,
            freeQuantity: 0,
            promoUnitPrice: 4200,
            product: { id: 20, sku: 'J1', name: 'Jamón Cocido', listPrice: 4900 },
          },
          {
            id: 4,
            promoId: 3,
            productId: 21,
            minQuantity: 1,
            freeQuantity: 0,
            promoUnitPrice: 3800,
            product: { id: 21, sku: 'Q1', name: 'Queso Barra', listPrice: 4400 },
          },
        ],
      }),
    ).toBe('1 u. Jamón Cocido ($4.200 c/u) + 1 u. Queso Barra ($3.800 c/u)');

    expect(formatPromoDateRange('2026-11-14T12:00:00Z', '2026-11-21T12:00:00Z')).toBe('14/11 → 21/11');
  });
});
