import { describe, it, expect } from 'vitest';
import {
  buildDefaultWeeklyPromoName,
  canUserManageWeeklyPromos,
  evaluateCartWeeklyPromos,
  isWeeklyPromoCurrentlyValid,
  type WeeklyPromoSpec,
} from './weekly-promos.engine';

describe('weekly-promos.engine', () => {
  const productsById = new Map([
    [1, { id: 1, isPesable: false, approximateWeight: 1, costPrice: 2000, listPrice: 3000 }],
    [2, { id: 2, isPesable: false, approximateWeight: 1, costPrice: 5000, listPrice: 9000 }],
    [3, { id: 3, isPesable: false, approximateWeight: 1, costPrice: 4000, listPrice: 7000 }],
    [4, { id: 4, isPesable: true, approximateWeight: 3.5, costPrice: 8000, listPrice: 12000 }],
  ]);

  const basePricingByProductId = new Map([
    [1, { baseUnitPrice: 3000, baseListPrice: 3000, baseDiscountPct: 0 }],
    [2, { baseUnitPrice: 9000, baseListPrice: 9000, baseDiscountPct: 0 }],
    [3, { baseUnitPrice: 7000, baseListPrice: 7000, baseDiscountPct: 0 }],
    [4, { baseUnitPrice: 12000, baseListPrice: 12000, baseDiscountPct: 0 }],
  ]);

  it('restringe permisos exclusivamente a admin y dario con rol administrativo', () => {
    expect(canUserManageWeeklyPromos({ username: 'admin', role: 'ADMIN' })).toBe(true);
    expect(canUserManageWeeklyPromos({ username: 'dario', role: 'ADMIN' })).toBe(true);
    expect(canUserManageWeeklyPromos({ username: 'DARIO', role: 'FACTURACION' })).toBe(true);
    expect(canUserManageWeeklyPromos({ username: 'agustin', role: 'ADMIN' })).toBe(false);
    expect(canUserManageWeeklyPromos({ username: 'diego', role: 'VENDEDOR' })).toBe(false);
    expect(canUserManageWeeklyPromos({ username: 'miguel', role: 'DEPOSITO' })).toBe(false);
    expect(canUserManageWeeklyPromos({ username: 'admin', role: 'VENDEDOR' })).toBe(false);
    expect(canUserManageWeeklyPromos(null)).toBe(false);
  });

  it('valida correctamente ventana de vigencia temporal e interruptor activo', () => {
    const now = new Date('2026-11-14T15:00:00.000Z');
    expect(
      isWeeklyPromoCurrentlyValid(
        { isActive: true, startDate: '2026-11-10T00:00:00.000Z', endDate: '2026-11-20T23:59:59.999Z' },
        now,
      ),
    ).toBe(true);
    expect(
      isWeeklyPromoCurrentlyValid(
        { isActive: false, startDate: '2026-11-10T00:00:00.000Z', endDate: '2026-11-20T23:59:59.999Z' },
        now,
      ),
    ).toBe(false);
    expect(
      isWeeklyPromoCurrentlyValid(
        { isActive: true, startDate: '2026-11-15T00:00:00.000Z', endDate: '2026-11-20T23:59:59.999Z' },
        now,
      ),
    ).toBe(false);
    expect(
      isWeeklyPromoCurrentlyValid(
        { isActive: true, startDate: '2026-11-01T00:00:00.000Z', endDate: '2026-11-13T23:59:59.999Z' },
        now,
      ),
    ).toBe(false);
  });

  it('autogenera nombres legibles para los 3 tipos de oferta', () => {
    expect(
      buildDefaultWeeklyPromoName({
        type: 'OFFER_PRICE',
        items: [{ productName: 'QUESO CREMOSO', minQuantity: 1 }],
      }),
    ).toBe('Oferta · QUESO CREMOSO');

    expect(
      buildDefaultWeeklyPromoName({
        type: 'OFFER_PRICE',
        items: [{ productName: 'YERBA AMANDA', minQuantity: 6 }],
      }),
    ).toBe('Oferta x6 · YERBA AMANDA');

    expect(
      buildDefaultWeeklyPromoName({
        type: 'BUY_X_GET_Y',
        items: [{ productName: 'JUGO MOCORETÁ', minQuantity: 3, freeQuantity: 1 }],
      }),
    ).toBe('3+1 Gratis · JUGO MOCORETÁ');

    expect(
      buildDefaultWeeklyPromoName({
        type: 'COMBO',
        items: [
          { productName: 'BRANCA MENTA', minQuantity: 12 },
          { productName: 'VITTONE 750', minQuantity: 12 },
        ],
      }),
    ).toBe('Combo · BRANCA MENTA + VITTONE 750');
  });

  it('aplica OFFER_PRICE en pesos enteros respetando cantidad mínima y garantía de mejor precio', () => {
    const promos: WeeklyPromoSpec[] = [
      {
        id: 10,
        name: 'Oferta x6',
        type: 'OFFER_PRICE',
        isActive: true,
        startDate: '2026-11-10T00:00:00.000Z',
        endDate: '2026-11-20T23:59:59.999Z',
        items: [{ productId: 1, minQuantity: 6, freeQuantity: 0, promoUnitPrice: 2499.6 }],
      },
    ];

    const belowMin = evaluateCartWeeklyPromos({
      lines: [{ productId: 1, quantity: 5 }],
      productsById,
      basePricingByProductId,
      promos,
      now: new Date('2026-11-14T12:00:00.000Z'),
    });
    expect(belowMin.lines[0].unitPrice).toBe(3000);
    expect(belowMin.totalAmount).toBe(15000);
    expect(belowMin.appliedPromoIds).toEqual([]);

    const metMin = evaluateCartWeeklyPromos({
      lines: [{ productId: 1, quantity: 6 }],
      productsById,
      basePricingByProductId,
      promos,
      now: new Date('2026-11-14T12:00:00.000Z'),
    });
    expect(metMin.lines[0].unitPrice).toBe(2500);
    expect(metMin.totalAmount).toBe(15000);
    expect(metMin.appliedPromoIds).toEqual([10]);

    // Si el cliente ya paga menos (ej. $2200), jamás encarece el precio
    const cheaperBase = new Map(basePricingByProductId);
    cheaperBase.set(1, { baseUnitPrice: 2200, baseListPrice: 3000, baseDiscountPct: 0 });
    const neverMoreExpensive = evaluateCartWeeklyPromos({
      lines: [{ productId: 1, quantity: 6 }],
      productsById,
      basePricingByProductId: cheaperBase,
      promos,
      now: new Date('2026-11-14T12:00:00.000Z'),
    });
    expect(neverMoreExpensive.lines[0].unitPrice).toBe(2200);
    expect(neverMoreExpensive.appliedPromoIds).toEqual([]);
  });

  it('aplica BUY_X_GET_Y (3+1 Gratis) con renglón bonificado a $0, stock exacto, bloqueo en pesables y anti-duplicación', () => {
    const promos: WeeklyPromoSpec[] = [
      {
        id: 20,
        name: '3+1 Gratis',
        type: 'BUY_X_GET_Y',
        isActive: true,
        startDate: '2026-11-10T00:00:00.000Z',
        endDate: '2026-11-20T23:59:59.999Z',
        items: [{ productId: 1, minQuantity: 3, freeQuantity: 1, promoUnitPrice: null }],
      },
      {
        id: 21,
        name: 'Pesable no permitido',
        type: 'BUY_X_GET_Y',
        isActive: true,
        startDate: '2026-11-10T00:00:00.000Z',
        endDate: '2026-11-20T23:59:59.999Z',
        items: [{ productId: 4, minQuantity: 3, freeQuantity: 1, promoUnitPrice: null }],
      },
    ];
    const now = new Date('2026-11-14T12:00:00.000Z');

    // Llevando 2 -> 0 gratis
    const res2 = evaluateCartWeeklyPromos({
      lines: [{ productId: 1, quantity: 2 }],
      productsById,
      basePricingByProductId,
      promos,
      now,
    });
    expect(res2.lines).toHaveLength(1);
    expect(res2.stockRequiredByProduct[1]).toBe(2);

    // Llevando 3 -> 3 pagas + 1 bonificada a $0 (4 stock)
    const res3 = evaluateCartWeeklyPromos({
      lines: [{ productId: 1, quantity: 3 }],
      productsById,
      basePricingByProductId,
      promos,
      now,
    });
    expect(res3.lines).toHaveLength(2);
    expect(res3.lines[0]).toMatchObject({ quantity: 3, unitPrice: 3000, subtotal: 9000, isPromoBonus: false });
    expect(res3.lines[1]).toMatchObject({
      productId: 1,
      quantity: 1,
      weight: null,
      unitPrice: 0,
      subtotal: 0,
      unitCostSnapshot: 2000,
      listPriceSnapshot: 3000,
      discountPctSnapshot: 100,
      isPromoBonus: true,
      appliedPromoId: 20,
    });
    expect(res3.totalAmount).toBe(9000);
    expect(res3.stockRequiredByProduct[1]).toBe(4);

    // Llevando 6 -> 6 pagas + 2 bonificadas (8 stock)
    const res6 = evaluateCartWeeklyPromos({
      lines: [{ productId: 1, quantity: 6 }],
      productsById,
      basePricingByProductId,
      promos,
      now,
    });
    expect(res6.lines[1].quantity).toBe(2);
    expect(res6.stockRequiredByProduct[1]).toBe(8);

    // Llevando 7 + línea previa isPromoBonus: true (reedición) -> no duplica bonificación, da 2 bonificadas (9 stock)
    const res7 = evaluateCartWeeklyPromos({
      lines: [
        { productId: 1, quantity: 7 },
        { productId: 1, quantity: 2, isPromoBonus: true },
      ],
      productsById,
      basePricingByProductId,
      promos,
      now,
    });
    expect(res7.lines).toHaveLength(2);
    expect(res7.lines[1].quantity).toBe(2);
    expect(res7.stockRequiredByProduct[1]).toBe(9);

    // Pesable nunca recibe N+M
    const resPesable = evaluateCartWeeklyPromos({
      lines: [{ productId: 4, quantity: 3, weight: 10.5 }],
      productsById,
      basePricingByProductId,
      promos,
      now,
    });
    expect(resPesable.lines).toHaveLength(1);
    expect(resPesable.lines[0].isPromoBonus).toBe(false);
  });

  it('aplica COMBO únicamente cuando todos los integrantes cumplen sus mínimos simultáneamente', () => {
    const promos: WeeklyPromoSpec[] = [
      {
        id: 30,
        name: 'Combo Fernet',
        type: 'COMBO',
        isActive: true,
        startDate: '2026-11-10T00:00:00.000Z',
        endDate: '2026-11-20T23:59:59.999Z',
        items: [
          { productId: 2, minQuantity: 12, freeQuantity: 0, promoUnitPrice: 8057 },
          { productId: 3, minQuantity: 12, freeQuantity: 0, promoUnitPrice: 5751 },
        ],
      },
    ];
    const now = new Date('2026-11-14T12:00:00.000Z');

    // Falta cantidad del segundo producto -> ninguno baja
    const incomplete = evaluateCartWeeklyPromos({
      lines: [
        { productId: 2, quantity: 12 },
        { productId: 3, quantity: 11 },
      ],
      productsById,
      basePricingByProductId,
      promos,
      now,
    });
    expect(incomplete.lines[0].unitPrice).toBe(9000);
    expect(incomplete.lines[1].unitPrice).toBe(7000);
    expect(incomplete.appliedPromoIds).toEqual([]);

    // Cumplen ambos -> ambos bajan a su precio entero especial
    const complete = evaluateCartWeeklyPromos({
      lines: [
        { productId: 2, quantity: 12 },
        { productId: 3, quantity: 12 },
      ],
      productsById,
      basePricingByProductId,
      promos,
      now,
    });
    expect(complete.lines[0]).toMatchObject({ unitPrice: 8057, subtotal: 96684, appliedPromoId: 30 });
    expect(complete.lines[1]).toMatchObject({ unitPrice: 5751, subtotal: 69012, appliedPromoId: 30 });
    expect(complete.totalAmount).toBe(165696);
    expect(complete.appliedPromoIds).toEqual([30]);
  });
});
