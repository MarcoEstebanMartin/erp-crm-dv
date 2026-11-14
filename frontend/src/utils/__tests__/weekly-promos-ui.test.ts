import { describe, expect, it } from 'vitest';
import {
  type WeeklyPromo,
  canManageWeeklyPromos,
  formatPromoConditionSummary,
  formatPromoDateRange,
  getDefaultPromoDates,
  resolvePromoVisualStatus,
} from '../../components/admin/config/weeklyPromo.helpers';
import {
  evaluateFrontendCartPromos,
  getProductPromoBadge,
  isBonusOrderItem,
} from '../weeklyPromoCartEvaluator';

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

  it('evalúa Precio Oferta, N+M Gratis, Combo y pesables exactos en weeklyPromoCartEvaluator', () => {
    const now = new Date('2026-11-15T12:00:00Z');
    const promos: WeeklyPromo[] = [
      {
        id: 1,
        name: 'Aceite x6',
        type: 'OFFER_PRICE',
        isActive: true,
        startDate: '2026-11-14T00:00:00Z',
        endDate: '2026-11-21T23:59:59Z',
        items: [{ id: 1, promoId: 1, productId: 10, minQuantity: 6, freeQuantity: 0, promoUnitPrice: 2500 }],
      },
      {
        id: 2,
        name: '3+1 Gaseosa',
        type: 'BUY_X_GET_Y',
        isActive: true,
        startDate: '2026-11-14T00:00:00Z',
        endDate: '2026-11-21T23:59:59Z',
        items: [{ id: 2, promoId: 2, productId: 11, minQuantity: 3, freeQuantity: 1, promoUnitPrice: null }],
      },
      {
        id: 3,
        name: 'Combo Fiambres',
        type: 'COMBO',
        isActive: true,
        startDate: '2026-11-14T00:00:00Z',
        endDate: '2026-11-21T23:59:59Z',
        items: [
          { id: 3, promoId: 3, productId: 20, minQuantity: 1, freeQuantity: 0, promoUnitPrice: 4000 },
          { id: 4, promoId: 3, productId: 21, minQuantity: 1, freeQuantity: 0, promoUnitPrice: 3800 },
        ],
      },
    ];

    expect(getProductPromoBadge(10, promos, false, now)).toBe('x6 a $2.500');
    expect(getProductPromoBadge(11, promos, false, now)).toBe('3+1 Gratis');
    expect(getProductPromoBadge(11, promos, true, now)).toBeNull();
    expect(getProductPromoBadge(20, promos, true, now)).toBe('Combo $4.000');

    // Con Jamón sin Queso: el combo NO se activa; Aceite >= 6 aplica $2.500; Gaseosa 3 da +1 gratis
    const partial = evaluateFrontendCartPromos({
      promos,
      now,
      items: [
        { productId: 10, productName: 'Aceite', quantity: 6, baseUnitPrice: 3100 },
        { productId: 11, productName: 'Gaseosa', quantity: 3, baseUnitPrice: 2800 },
        { productId: 20, productName: 'Jamón', quantity: 1, isPesable: true, weight: 2.5, baseUnitPrice: 4900 },
      ],
    });
    expect(partial.byProductId[10]).toMatchObject({ effectiveUnitPrice: 2500, lineSubtotal: 15000, promoApplied: true });
    expect(partial.byProductId[20]).toMatchObject({ effectiveUnitPrice: 4900, lineSubtotal: 12250, promoApplied: false });
    expect(partial.bonusLines).toEqual([
      { productId: 11, productName: 'Gaseosa', quantity: 1, promoId: 2, promoName: '3+1 Gaseosa' },
    ]);
    expect(partial.stockRequiredByProduct[11]).toBe(4);
    expect(partial.totalBonusUnits).toBe(1);
    expect(partial.totalAmount).toBe(15000 + 8400 + 12250);

    // Con ambos productos del combo y precio de cliente ya menor ($2.200 < $2.500 en aceite)
    const full = evaluateFrontendCartPromos({
      promos,
      now,
      items: [
        { productId: 10, productName: 'Aceite', quantity: 6, baseUnitPrice: 2200 },
        { productId: 20, productName: 'Jamón', quantity: 1, isPesable: true, weight: 2.5, baseUnitPrice: 4900 },
        { productId: 21, productName: 'Queso', quantity: 1, baseUnitPrice: 4400 },
      ],
    });
    expect(full.byProductId[10]).toMatchObject({ effectiveUnitPrice: 2200, promoApplied: false });
    expect(full.byProductId[20]).toMatchObject({ effectiveUnitPrice: 4000, lineSubtotal: 10000, promoApplied: true });
    expect(full.byProductId[21]).toMatchObject({ effectiveUnitPrice: 3800, lineSubtotal: 3800, promoApplied: true });
    expect(full.totalAmount).toBe(6 * 2200 + 10000 + 3800);

    // Detecta renglones bonificados $0 al abrir pedido para editar o repetir compra
    expect(isBonusOrderItem({ unitPrice: 0, discountPctSnapshot: 100 })).toBe(true);
    expect(isBonusOrderItem({ unitPrice: 0, discountPctSnapshot: 0 })).toBe(false);
    expect(isBonusOrderItem({ unitPrice: 2500, discountPctSnapshot: 0 })).toBe(false);
  });
});
