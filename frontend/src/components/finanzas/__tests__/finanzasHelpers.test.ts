import { describe, expect, it } from 'vitest';
import { computeFilteredMetricsAndLedger, parseCsvAmount, parseMercadoPagoCsv } from '../finanzasHelpers';

describe('parseCsvAmount', () => {
  it('parses international decimal dot amounts without multiplying by 100', () => {
    expect(parseCsvAmount('18224.50')).toBe(18224.5);
    expect(parseCsvAmount('$ 18,224.50')).toBe(18224.5);
    expect(parseCsvAmount('100.5')).toBe(100.5);
  });

  it('parses Argentine comma decimal and dot thousands amounts', () => {
    expect(parseCsvAmount('$ 18.224,50')).toBe(18224.5);
    expect(parseCsvAmount('18.224')).toBe(18224);
    expect(parseCsvAmount('1.234.567,89')).toBe(1234567.89);
    expect(parseCsvAmount('18224,5')).toBe(18224.5);
  });

  it('returns 0 for empty or invalid input', () => {
    expect(parseCsvAmount('')).toBe(0);
    expect(parseCsvAmount('abc')).toBe(0);
  });
});

describe('parseMercadoPagoCsv', () => {
  it('parses income rows and ignores negative outflows', () => {
    const csv = [
      'source_id;transaction_date;transaction_amount;payer_name;payer_id_number',
      'MP-101;2026-11-16T10:00:00Z;18224.50;ABBATE DAGA JONATHAN;20334445551',
      'MP-102;2026-11-16T11:00:00Z;-5000.00;COMISION;20334445551',
      'MP-103;2026-11-16T12:00:00Z;$ 25.500,00;CLIENTE DOS;27112223339',
    ].join('\n');

    const rows = parseMercadoPagoCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'MP-101',
      amount: 18224.5,
      payerName: 'ABBATE DAGA JONATHAN',
      payerCuit: '20334445551',
    });
    expect(rows[1]).toMatchObject({
      id: 'MP-103',
      amount: 25500,
      payerName: 'CLIENTE DOS',
      payerCuit: '27112223339',
    });
  });
});

describe('computeFilteredMetricsAndLedger', () => {
  it('incluye echeqs y cheques de facturas directas (cashDrawerId null) en Ingresos en Cheques sin duplicar los de cajas cerradas', () => {
    const drawers = [
      {
        id: 10,
        status: 'CLOSED',
        closedAt: '2026-11-18T14:00:00.000Z',
        branch: 'Central',
        transactions: [
          {
            id: 1,
            type: 'INCOME',
            paymentMethod: 'CHECK',
            amount: 50000,
            cashDrawerId: 10,
            createdAt: '2026-11-18T12:00:00.000Z',
            description: 'Cheque en caja cerrada',
          },
        ],
      },
    ];

    const transactions = [
      {
        id: 1,
        type: 'INCOME',
        paymentMethod: 'CHECK',
        amount: 50000,
        cashDrawerId: 10,
        createdAt: '2026-11-18T12:00:00.000Z',
        description: 'Cheque en caja cerrada',
      },
      {
        id: 2,
        type: 'INCOME',
        paymentMethod: 'CHECK',
        amount: 120000,
        cashDrawerId: null,
        orderId: 99,
        persona: { name: 'Cliente Echeq' },
        createdAt: '2026-11-18T16:00:00.000Z',
        description: 'Cheque N° 998877 (Emisor: Titular (Echeq)) recibido en mostrador por factura #99',
      },
    ];

    const res = computeFilteredMetricsAndLedger(drawers, transactions, '2026-11-18', '2026-11-18');
    expect(res.checkIncome).toBe(170000);
    expect(res.totalTransfers).toBe(0);
    expect(res.transfers).toHaveLength(1);
    expect(res.transfers[0].id).toBe(2);
    expect(res.detailedCheckItems).toHaveLength(2);
    expect(res.detailedCheckItems[0]).toMatchObject({
      id: 'check-direct-2',
      amount: 120000,
      origin: 'Cliente Echeq',
      paymentMethod: 'Cheque',
    });
  });
});
