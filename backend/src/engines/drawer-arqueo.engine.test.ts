import { describe, it, expect } from 'vitest';
import {
  calculateCentralDrawerBalance,
  calculateDrawerClosingBalance,
  calculateRendicionSummary,
  calculateVerificationDeltas,
} from './drawer-arqueo.engine';

describe('Motor Matemático de Arqueo de Caja, Conciliación Bancaria y Rendiciones', () => {
  it('calcula el saldo teórico de cierre sumando efectivo y cheques físicos en caja sin error de coma flotante', () => {
    const closing = calculateDrawerClosingBalance('10000.10', [
      { type: 'INCOME', paymentMethod: 'CASH', amount: '5000.20' },
      { type: 'INCOME', paymentMethod: 'CHECK', amount: '2500.00', bankAccountId: null },
      { type: 'INCOME', paymentMethod: 'BANK_TRANSFER', amount: '99000.00', bankAccountId: 1 },
      { type: 'OUTCOME', paymentMethod: 'CASH', amount: '1200.30' },
    ]);

    // 10000.10 + 5000.20 + 2500.00 - 1200.30 = 16300.00 exactos (ignora BANK_TRANSFER)
    expect(closing).toBe(16300);
  });

  it('calcula deltas exactos al verificar por primera vez una transferencia con ajuste de redondeo', () => {
    // Escenario: vendedor registró transferencia pendiente (verified: false) de $10.000,
    // administración la concilia con extracto MP por $10.050,25.
    const res = calculateVerificationDeltas({
      oldAmount: '10000.00',
      verifiedBefore: false,
      verifiedAfter: true,
      adjustedAmount: '10050.25',
      type: 'INCOME',
      hasPersona: true,
      hasBankAccount: true,
    });

    expect(res).toEqual({
      finalAmount: 10050.25,
      personaDecrementDelta: 50.25, // $10.000 ya habían bajado deuda al registrar; restan $50,25
      bankIncrementDelta: 10050.25, // El banco aún no la tenía acreditada; ingresa el total verificado
    });
  });

  it('evita doble conteo bancario al ajustar una transferencia que ya estaba verificada y revierte al desverificar', () => {
    const adjustedAlreadyVerified = calculateVerificationDeltas({
      oldAmount: '10000.00',
      verifiedBefore: true,
      verifiedAfter: true,
      adjustedAmount: '10050.00',
      type: 'INCOME',
      hasPersona: true,
      hasBankAccount: true,
    });

    expect(adjustedAlreadyVerified).toEqual({
      finalAmount: 10050,
      personaDecrementDelta: 50,
      bankIncrementDelta: 50,
    });

    const unverified = calculateVerificationDeltas({
      oldAmount: '10050.00',
      verifiedBefore: true,
      verifiedAfter: false,
      type: 'INCOME',
      hasPersona: true,
      hasBankAccount: true,
    });

    expect(unverified).toEqual({
      finalAmount: 10050,
      personaDecrementDelta: 0,
      bankIncrementDelta: -10050,
    });
  });

  it('calcula el resumen de rendición de calle y la diferencia exacta con Decimal.js', () => {
    const summary = calculateRendicionSummary({
      transactions: [
        { paymentMethod: 'CASH', amount: '15200.10' },
        { paymentMethod: 'CASH', amount: '4800.20' },
        { paymentMethod: 'CHECK', amount: '10000.00' },
        { paymentMethod: 'BANK_TRANSFER', amount: '50000.00' },
      ],
      realCash: '20000.00',
      realChecks: '10000.00',
    });

    expect(summary.expectedCash).toBe(20000.3);
    expect(summary.expectedChecks).toBe(10000);
    expect(summary.theoreticalClosing).toBe(30000.3);
    expect(summary.realTotal).toBe(30000);
    expect(summary.difference).toBe(-0.3);
  });

  it('calcula el acumulado teórico de Caja Grande descontando egresos centrales', () => {
    const central = calculateCentralDrawerBalance({
      lastCentralRealBalance: '50000',
      closedDrawers: [
        { openingBalance: '10000', realBalance: '85000' }, // +75000 neto
        { openingBalance: '5000', realBalance: '25000' }, // +20000 neto
      ],
      overallExpenses: [{ amount: '12000' }, { amount: '3000' }], // -15000
    });

    expect(central).toEqual({
      netDrawersCash: 95000,
      totalExpensesOverall: 15000,
      currentCalculatedBalance: 130000,
    });
  });
});
