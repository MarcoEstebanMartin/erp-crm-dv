import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  buildHabitualPurchasesToAppend,
  buildInitialFixedPurchases,
  buildNormalizedSaleRow,
  computeWeeklyPulseChain,
  computeWeeklyPulseSummary,
  DEFAULT_WEEKLY_FIXED_CONCEPTS,
  DEFAULT_WEEKLY_RESULT_BUFFER,
  getWorkWeekBounds,
} from './weekly-pulse.engine';

describe('weekly-pulse.engine', () => {
  it('replica al peso exacto la fórmula del Excel (caso sobre-compra: hoja 19-11 -> 26-11)', () => {
    const summary = computeWeeklyPulseSummary({
      openingCredit: 26_732_900,
      resultBuffer: 18_000_000,
      purchases: [
        { id: '1', source: 'AUTO_INVOICE', company: 'REMOTTI', date: '2026-11-20', amount: 19_859_337 },
        { id: '2', source: 'AUTO_INVOICE', company: 'RESTO PROVEEDORES', date: '2026-11-19', amount: 43_807_602 },
        { id: '3', source: 'MANUAL', company: 'COMISION M.PAGO', date: '2026-11-17', amount: 200_000 },
      ],
      sales: [
        buildNormalizedSaleRow({
          id: 'v1',
          source: 'AUTO',
          locality: 'GENERAL VILLEGAS',
          date: '2026-11-17',
          amountA: 46_938_618,
          amountX: 44_123_067,
        }),
      ],
    });

    expect(summary.weekPurchasesTotal).toBe(63_866_939);
    expect(summary.totalPurchasesWithCredit).toBe(90_599_839);
    expect(summary.salesTotal).toBe(91_061_685);
    expect(summary.closingCredit).toBe(17_538_154); // Exacto a '26-11'!D25
    expect(summary.status).toBe('OVERBOUGHT');
  });

  it('replica al peso exacto la fórmula del Excel (caso margen disponible: hoja 10-05 -> 17-05)', () => {
    const summary = computeWeeklyPulseSummary({
      openingCredit: -113_764_158,
      resultBuffer: 20_000_000,
      purchases: [
        { id: '1', source: 'AUTO_INVOICE', company: 'COMPRAS SEMANA', date: '2026-05-15', amount: 62_673_165 },
      ],
      sales: [
        buildNormalizedSaleRow({
          id: 'v1',
          source: 'AUTO',
          locality: 'TODAS',
          date: '2026-05-16',
          amountA: 30_318_565,
          amountX: 43_794_049,
        }),
      ],
    });

    expect(summary.totalPurchasesWithCredit).toBe(-51_090_993);
    expect(summary.salesTotal).toBe(74_112_614);
    expect(summary.closingCredit).toBe(-105_203_607); // Exacto a '17-05'!D25
    expect(summary.status).toBe('AVAILABLE');
  });

  it('excluye del cálculo las compras marcadas como excluded sin borrarlas', () => {
    const summary = computeWeeklyPulseSummary({
      openingCredit: 0,
      resultBuffer: DEFAULT_WEEKLY_RESULT_BUFFER,
      purchases: [
        { id: '1', source: 'AUTO_INVOICE', company: 'REMOTTI', date: '2026-11-24', amount: 10_000_000, excluded: false },
        { id: '2', source: 'AUTO_INVOICE', company: 'NIZA SA', date: '2026-11-25', amount: 15_000_000, excluded: true },
      ],
      sales: [
        buildNormalizedSaleRow({
          id: 'v1',
          source: 'AUTO',
          locality: 'RIVADAVIA',
          date: '2026-11-25',
          amountA: 15_000_000,
          amountX: 15_000_000,
        }),
      ],
    });

    expect(summary.weekPurchasesTotal).toBe(10_000_000);
    expect(summary.closingCredit).toBe(0);
    expect(summary.status).toBe('BALANCED');
  });

  it('encadena semanas consecutivas y respeta manualOpeningCredit en la semana inicial', () => {
    const chain = computeWeeklyPulseChain([
      {
        weekStart: '2026-11-16',
        manualOpeningCredit: 26_732_900,
        resultBuffer: 18_000_000,
        purchases: [{ id: 'p1', source: 'AUTO_INVOICE', company: 'A', date: '2026-11-18', amount: 63_866_939 }],
        sales: [buildNormalizedSaleRow({ id: 's1', source: 'AUTO', locality: 'GV', date: '2026-11-18', amountA: 46_938_618, amountX: 44_123_067 })],
      },
      {
        weekStart: '2026-11-23',
        manualOpeningCredit: null,
        resultBuffer: 20_000_000,
        purchases: [{ id: 'p2', source: 'AUTO_INVOICE', company: 'B', date: '2026-11-25', amount: 54_125_395 }],
        sales: [buildNormalizedSaleRow({ id: 's2', source: 'AUTO', locality: 'GV', date: '2026-11-25', amountA: 27_807_550, amountX: 27_453_415 })],
      },
    ]);

    expect(chain[0].isManualOpeningCredit).toBe(true);
    expect(chain[0].summary.closingCredit).toBe(17_538_154);

    expect(chain[1].isManualOpeningCredit).toBe(false);
    expect(chain[1].summary.openingCredit).toBe(17_538_154);
    expect(chain[1].summary.totalPurchasesWithCredit).toBe(71_663_549);
    // 71_663_549 + 20_000_000 - 55_260_965 = 36_402_584
    expect(chain[1].summary.closingCredit).toBe(36_402_584);
  });

  it('calcula correctamente los límites de semana laboral Lunes a Sábado', () => {
    // 2026-11-27 es Viernes
    expect(getWorkWeekBounds('2026-11-27')).toEqual({
      weekStart: '2026-11-23',
      weekEnd: '2026-11-28',
    });
    // Domingo 2026-11-29 pertenece a la semana que arrancó el Lunes 2026-11-23
    expect(getWorkWeekBounds('2026-11-29')).toEqual({
      weekStart: '2026-11-23',
      weekEnd: '2026-11-28',
    });
    expect(addDaysIso('2026-11-23', 7)).toBe('2026-11-30');
  });

  it('genera fijos semanales en $0 sin duplicar los que ya existen y sin alterar el total', () => {
    const existing = [
      { id: 'mp-1', source: 'MANUAL' as const, company: '  comision   m.pago ', date: '2026-11-24', amount: 250_000 },
    ];
    const seeded = buildInitialFixedPurchases('2026-11-23', existing, DEFAULT_WEEKLY_FIXED_CONCEPTS);
    expect(seeded).toHaveLength(1);
    expect(seeded[0]).toMatchObject({
      source: 'MANUAL',
      company: 'PERC-ING.BRUTOS',
      date: '2026-11-23',
      amount: 0,
    });

    const summary = computeWeeklyPulseSummary({
      openingCredit: 0,
      resultBuffer: 0,
      purchases: [...existing, ...seeded],
      sales: [],
    });
    expect(summary.weekPurchasesTotal).toBe(250_000);
  });

  it('trae proveedores habituales salteando los que ya entraron por factura o carga manual', () => {
    const existing = [
      { id: 'inv:1', source: 'AUTO_INVOICE' as const, company: 'REMOTTI', date: '2026-11-24', amount: 1_500_000 },
      { id: 'mp-2', source: 'MANUAL' as const, company: 'cremigal', date: '2026-11-25', amount: 800_000 },
    ];
    const toAppend = buildHabitualPurchasesToAppend('2026-11-23', ['REMOTTI', 'CREMIGAL', 'NIZA SA', 'VITAL'], existing);
    expect(toAppend.map((x) => x.company)).toEqual(['NIZA SA', 'VITAL']);
    expect(toAppend.every((x) => x.amount === 0 && x.date === '2026-11-23')).toBe(true);
  });
});
