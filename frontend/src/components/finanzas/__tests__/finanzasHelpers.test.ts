import { describe, expect, it } from 'vitest';
import { computeCajaGrandeBalance, computeFilteredMetricsAndLedger, parseCsvAmount, parseMercadoPagoCsv } from '../finanzasHelpers';
import {
  buildCitySalesDetailTsv,
  buildWeeklySalesTsv,
  formatShortArDate,
} from '../../reports/reportDateHelpers';

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

  it('excluye transferencias no verificadas (verified: false) del KPI Transferencias y Recaudación Neta pero las conserva en conciliación', () => {
    const transactions = [
      {
        id: 10,
        type: 'INCOME',
        paymentMethod: 'BANK_TRANSFER',
        amount: 100000,
        verified: true,
        cashDrawerId: null,
        bankAccount: { name: 'MP' },
        persona: { name: 'Cliente Verificado' },
        createdAt: '2026-11-20T10:00:00.000Z',
        description: 'Transferencia acreditada',
      },
      {
        id: 11,
        type: 'INCOME',
        paymentMethod: 'BANK_TRANSFER',
        amount: 500000,
        verified: false,
        cashDrawerId: null,
        persona: { name: 'Cliente Pendiente' },
        createdAt: '2026-11-20T11:00:00.000Z',
        description: 'Transferencia pendiente de banco',
      },
    ];

    const res = computeFilteredMetricsAndLedger([], transactions, '2026-11-20', '2026-11-20');
    expect(res.totalTransfers).toBe(100000);
    expect(res.netIncome).toBe(100000);
    expect(res.detailedTransferItems).toHaveLength(1);
    expect(res.detailedTransferItems[0].id).toBe('transfer-10');
    expect(res.transfers).toHaveLength(2);
  });

  it('excluye cierres de Caja Grande (drawerType CENTRAL) de Movimientos y de Ingresos en Efectivo', () => {
    const drawers = [
      {
        id: 16,
        drawerType: 'CENTRAL',
        branch: 'CENTRAL',
        status: 'CLOSED',
        openingBalance: -22848785,
        closingBalance: -22848785,
        realBalance: 0,
        closedAt: '2026-11-23T14:54:32.421Z',
        user: { username: 'admin' },
        transactions: [],
      },
    ];

    const res = computeFilteredMetricsAndLedger(drawers, [], '2026-11-23', '2026-11-23');
    expect(res.ledger).toHaveLength(0);
    expect(res.detailedCashItems).toHaveLength(0);
    expect(res.cashIncome).toBe(0);
    expect(res.netIncome).toBe(0);
    expect(computeCajaGrandeBalance(drawers, [])).toBe(0);
  });
});

describe('buildWeeklySalesTsv', () => {
  it('genera TSV con encabezados, localidades, totales y enteros limpios para Google Sheets', () => {
    const tsv = buildWeeklySalesTsv(
      [
        { cityLabel: 'Córdoba', official: 150000.4, internal: 200000.6, total: 350001, count: 12 },
        { cityLabel: 'Villa\tMaría', official: 0, internal: 85000, total: 85000, count: 4 },
      ],
      { official: 150000.4, internal: 285000.6, total: 435001, orders: 16 },
    );

    expect(tsv).toBe(
      [
        'Localidad\tSucursal A\tSucursal X\tTotal\tPedidos',
        'Córdoba\t150000\t200001\t350001\t12',
        'Villa María\t0\t85000\t85000\t4',
        'Total\t150000\t285001\t435001\t16',
      ].join('\n'),
    );
  });
});

describe('formatShortArDate y buildCitySalesDetailTsv', () => {
  it('formatea fechas a dd/MM en horario AR y genera TSV limpio incluyendo NC negativas', () => {
    expect(formatShortArDate('2026-11-26')).toBe('26/11');
    expect(formatShortArDate('2026-11-26T01:30:00.000Z')).toBe('25/11');

    const tsv = buildCitySalesDetailTsv(
      [
        {
          dateLabel: '26/11',
          clientName: 'Super\tNorte',
          voucher: 'FAC A 0005-00001234',
          branch: 'A',
          amount: 100000,
        },
        {
          dateLabel: '27/11',
          clientName: 'Super Norte',
          voucher: 'NC A 0005-00000045',
          branch: 'A',
          amount: -10000,
        },
      ],
      90000,
    );

    expect(tsv).toBe(
      [
        'Fecha\tCliente\tComprobante\tSucursal\tImporte',
        '26/11\tSuper Norte\tFAC A 0005-00001234\tA\t100000',
        '27/11\tSuper Norte\tNC A 0005-00000045\tA\t-10000',
        'Total\t\t\t\t90000',
      ].join('\n'),
    );
  });
});
