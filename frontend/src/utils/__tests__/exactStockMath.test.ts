import { describe, expect, it } from 'vitest';
import {
  calculateExactStockValuation,
  computeExactLatentMargin,
  divRoundHalfUp,
  parseScaledBigInt,
  resolveProductRowValuation,
} from '../exactStockMath';
import { computeStockStats, getDisplayedStock, hasProductPendingAdjustment } from '../../components/stock/types';
import { createIdempotencyKey, resolveRequestIdempotencyKey } from '../idempotencyClient';

describe('exactStockMath — Valorización Cero-Float BigInt (ROUND_HALF_UP)', () => {
  it('calcula artículos pesables al peso entero exacto: 100 hormas × 4.2 kg × $9.131,20 = $3.835.104', () => {
    const tybo = calculateExactStockValuation({
      physicalUnits: 100,
      isPesable: true,
      approximateWeight: '4.2',
      costPrice: '9131.20',
      listPrice: '11500',
    });

    expect(tybo.isWeighable).toBe(true);
    expect(tybo.physicalUnits).toBe(100);
    expect(tybo.estimatedTotalKg).toBe(420);
    expect(tybo.stockValueCost).toBe(3_835_104);
    expect(tybo.stockValueSale).toBe(4_830_000);
  });

  it('aplica redondeo ROUND_HALF_UP exacto al peso entero (.5 redondea hacia arriba sin deriva IEEE-754)', () => {
    expect(parseScaledBigInt('9131.20')).toBe(9_131_200_000n);
    expect(divRoundHalfUp(5n, 2n)).toBe(3n);
    expect(divRoundHalfUp(-5n, 2n)).toBe(-3n);

    // 3 u. × 1.25 kg = 3.75 kg × $100.40 = $376.50 exactos -> $377 ROUND_HALF_UP
    const tieRow = calculateExactStockValuation({
      physicalUnits: 3,
      isPesable: true,
      approximateWeight: 1.25,
      costPrice: 100.4,
      listPrice: 200,
    });
    expect(tieRow.estimatedTotalKg).toBe(3.75);
    expect(tieRow.stockValueCost).toBe(377);
    expect(tieRow.stockValueSale).toBe(750);
  });

  it('prioriza stockValuation del servidor sin edición y recalcula en vivo en Modo Inventario Rápido', () => {
    const productFromApi = {
      id: 1735,
      sku: '0001',
      stock: 100,
      minStock: 100,
      isPesable: true,
      approximateWeight: 4.2,
      costPrice: 9131.2,
      listPrice: 11500,
      lots: [
        { id: 868, lotNumber: 'S/L', stock: 80, location: 'S/U' },
        { id: 1115, lotNumber: 'S/L', stock: 20, location: 'D1-R01-C04-C' },
      ],
      stockValuation: {
        physicalUnits: 100,
        estimatedTotalKg: 420,
        effectiveMultiplier: 4.2,
        stockValueCost: 3_835_104,
        stockValueSale: 4_830_000,
        latentProfit: 994_896,
        latentMarginPct: 25.94,
        stockHealth: 'OK',
      },
    };

    const unedited = resolveProductRowValuation(productFromApi, 100, {
      hasPendingEdit: false,
      canViewCosts: true,
    });
    expect(unedited.stockValueCost).toBe(3_835_104);
    expect(unedited.stockValueSale).toBe(4_830_000);

    // En Modo Inventario Rápido se cuentan 50 u. en el lote 868 (total 70 u. -> 294 kg)
    const pending = { 'lot-868': 50 };
    const displayed = getDisplayedStock(productFromApi, pending);
    expect(displayed).toBe(70);
    expect(hasProductPendingAdjustment(productFromApi, pending)).toBe(true);

    const liveEdited = resolveProductRowValuation(productFromApi, displayed, {
      hasPendingEdit: true,
      canViewCosts: true,
    });
    // 70 × 4.2 = 294 kg; 294 × 9131.20 = 2,684,572.80 -> $2.684.573 ROUND_HALF_UP
    expect(liveEdited.estimatedTotalKg).toBe(294);
    expect(liveEdited.stockValueCost).toBe(2_684_573);
    expect(liveEdited.stockValueSale).toBe(3_381_000);

    // Rol sin permiso de costos (ej. DEPOSITO): jamás expone costo y preserva venta
    const restricted = resolveProductRowValuation(productFromApi, 100, {
      hasPendingEdit: false,
      canViewCosts: false,
    });
    expect(restricted.stockValueCost).toBe(0);
    expect(restricted.stockValueSale).toBe(4_830_000);
  });

  it('garantiza 0 centavos fantasma: la suma visual de filas coincide al 100% con los KPIs superiores', () => {
    // Tres SKUs cuyo costo individual tiene $0.40 de fracción:
    // Por renglón cada uno redondea a $100; si se sumaran floats antes de redondear daría 301.20 -> $301 (centavo fantasma)
    const rows = [1, 2, 3].map((id) => ({
      id,
      sku: `000${id}`,
      stock: 1,
      minStock: 0,
      isPesable: false,
      costPrice: '100.40',
      listPrice: '150.40',
      lots: [{ id: id * 10, lotNumber: 'S/L', stock: 1, location: 'S/U' }],
    }));

    const visualSumCost = rows
      .map((p) => resolveProductRowValuation(p, 1).stockValueCost)
      .reduce((acc, v) => acc + v, 0);
    const visualSumSale = rows
      .map((p) => resolveProductRowValuation(p, 1).stockValueSale)
      .reduce((acc, v) => acc + v, 0);

    const stats = computeStockStats(rows, {}, true);

    expect(visualSumCost).toBe(300);
    expect(stats.totalCost).toBe(visualSumCost);
    expect(visualSumSale).toBe(450);
    expect(stats.totalRetailVal).toBe(visualSumSale);
  });

  it('calcula ganancia latente y signos de margen positivo, negativo y cero sin floats', () => {
    const positive = computeExactLatentMargin(1_000_000, 1_356_000);
    expect(positive.latentProfit).toBe(356_000);
    expect(positive.latentMarginPct).toBe(35.6);
    expect(positive.latentMarginPctInt).toBe(36);
    expect(positive.sign).toBe('+');

    const negative = computeExactLatentMargin(1_000_000, 850_000);
    expect(negative.latentProfit).toBe(-150_000);
    expect(negative.latentMarginPct).toBe(-15);
    expect(negative.latentMarginPctInt).toBe(-15);
    expect(negative.sign).toBe('-');

    const zeroEqual = computeExactLatentMargin(500_000, 500_000);
    expect(zeroEqual.latentProfit).toBe(0);
    expect(zeroEqual.latentMarginPct).toBe(0);
    expect(zeroEqual.latentMarginPctInt).toBe(0);
    expect(zeroEqual.sign).toBe('');

    const zeroCost = computeExactLatentMargin(0, 0);
    expect(zeroCost.latentProfit).toBe(0);
    expect(zeroCost.latentMarginPct).toBe(0);
    expect(zeroCost.sign).toBe('');
  });

  it('genera claves Idempotency-Key independientes por método para PUT, PATCH y DELETE', () => {
    const putKey = resolveRequestIdempotencyKey('PUT', '/products/lots/15', '{"location":"D1-R01-C04-A"}');
    const delKey = resolveRequestIdempotencyKey('DELETE', '/products/lots/15');
    const patchKey = resolveRequestIdempotencyKey('PATCH', '/products/lots/15', '{"lotNumber":"L1"}');

    expect(putKey.length).toBeGreaterThanOrEqual(16);
    expect(delKey.length).toBeGreaterThanOrEqual(16);
    expect(patchKey.length).toBeGreaterThanOrEqual(16);
    expect(putKey).not.toBe(delKey);
    expect(putKey).not.toBe(patchKey);
    expect(createIdempotencyKey().length).toBeGreaterThanOrEqual(16);
  });
});
