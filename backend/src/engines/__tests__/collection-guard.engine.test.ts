import { describe, expect, it } from 'vitest';
import { evaluateCollectionGuard } from '../collection-guard.engine';

describe('collection-guard.engine (Guardia Central Anti-Doble Cobro)', () => {
  const now = new Date('2026-11-19T12:00:00Z');

  it('permite un cobro normal cuando el monto es menor o igual a la deuda del cliente', () => {
    const res = evaluateCollectionGuard({
      clientName: 'Kiosco Centro',
      paymentAmount: 100,
      clientOutstandingBalance: 100,
      now,
    });

    expect(res.allowed).toBe(true);
    expect(res.code).toBeUndefined();
    expect(res.effectiveDebt.toNumber()).toBe(100);
    expect(res.normalizedAmount.toNumber()).toBe(100);
  });

  it('BLOQUEA cobrar $100 por segunda vez cuando el cliente ya tiene saldo $0', () => {
    const res = evaluateCollectionGuard({
      clientName: 'Kiosco Centro',
      paymentAmount: 100,
      clientOutstandingBalance: 0,
      now,
    });

    expect(res.allowed).toBe(false);
    expect(res.code).toBe('ZERO_DEBT_BLOCKED');
    expect(res.message).toContain('no registra deuda pendiente');
  });

  it('BLOQUEA sobrepago cuando intentan cobrar más de la deuda actual sin anticipo explícito', () => {
    const res = evaluateCollectionGuard({
      clientName: 'Almacén Sur',
      paymentAmount: 200,
      clientOutstandingBalance: 100,
      now,
    });

    expect(res.allowed).toBe(false);
    expect(res.code).toBe('OVERPAYMENT_BLOCKED');
    expect(res.message).toContain('Alarma de sobrepago');
  });

  it('BLOQUEA recibo duplicado del mismo monto dentro de la ventana de 5 minutos (incluso con anticipo)', () => {
    const twoMinutesAgo = new Date(now.getTime() - 2 * 60 * 1000);
    const res = evaluateCollectionGuard({
      clientName: 'Kiosco Centro',
      paymentAmount: 100,
      clientOutstandingBalance: 500,
      allowCreditOnAccount: true,
      recentDuplicate: {
        id: 77,
        receiptNumber: 'REC-C-0000077',
        amount: 100,
        createdAt: twoMinutesAgo,
      },
      now,
    });

    expect(res.allowed).toBe(false);
    expect(res.code).toBe('DUPLICATE_RECEIPT_WINDOW');
    expect(res.message).toContain('Alarma de recibo duplicado');
    expect(res.message).toContain('REC-C-0000077');
  });

  it('BLOQUEA cobrar un comprobante (orderId) que ya fue saldado previamente', () => {
    const res = evaluateCollectionGuard({
      clientName: 'Bar Norte',
      paymentAmount: 100,
      clientOutstandingBalance: 300,
      targetOrder: {
        orderId: 55,
        invoiceLabel: '00001-00000055',
        orderTotal: 100,
        alreadyPaidOnOrder: 100,
      },
      now,
    });

    expect(res.allowed).toBe(false);
    expect(res.code).toBe('ORDER_ALREADY_PAID');
    expect(res.message).toContain('ya se encuentra saldado');
  });

  it('permite cobrar en el camión un pedido PREPARED aún no facturado sumándolo a la deuda exigible', () => {
    const res = evaluateCollectionGuard({
      clientName: 'Kiosco Ruta',
      paymentAmount: 100,
      clientOutstandingBalance: 0,
      unbilledRouteOrdersAmount: 100,
      now,
    });

    expect(res.allowed).toBe(true);
    expect(res.effectiveDebt.toNumber()).toBe(100);
  });

  it('permite anticipo explícito (allowCreditOnAccount = true) cuando no hay duplicado reciente', () => {
    const res = evaluateCollectionGuard({
      clientName: 'Cliente Fiel',
      paymentAmount: 50000,
      clientOutstandingBalance: 0,
      allowCreditOnAccount: true,
      now,
    });

    expect(res.allowed).toBe(true);
  });
});
