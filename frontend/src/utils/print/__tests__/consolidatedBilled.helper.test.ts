import { describe, expect, it } from 'vitest';
import { buildConsolidatedBilledReport } from '../consolidatedBilled.helper';

describe('buildConsolidatedBilledReport', () => {
  const sampleOrders = [
    {
      id: 101,
      status: 'COMPLETED',
      invoiceNumber: '0005-00001042',
      bultos: 3,
      persona: { name: 'Supermercado América Norte' },
      items: [
        {
          productId: 10,
          quantity: 2,
          weight: '8.35',
          product: { id: 10, name: 'Queso Barra Tybo', pickingZone: 'FRIO', defaultLocation: 'F-01', isPesable: true },
        },
        {
          productId: 20,
          quantity: 5,
          product: { id: 20, name: 'Fideos Tallarín x10', pickingZone: 'CAJAS', defaultLocation: 'C-04', isPesable: false },
        },
      ],
    },
    {
      id: 102,
      status: 'COMPLETED',
      invoiceNumber: '0005-00001045',
      bultos: 2,
      persona: { name: 'Despensa La Esquina' },
      items: [
        {
          productId: 10,
          quantity: 3,
          weight: '12.15',
          product: { id: 10, name: 'Queso Barra Tybo', pickingZone: 'FRIO', defaultLocation: 'F-01', isPesable: true },
        },
      ],
    },
    {
      id: 103,
      status: 'CANCELLED',
      invoiceNumber: '0005-00001046',
      bultos: 1,
      persona: { name: 'Cliente Anulado' },
      items: [
        {
          productId: 20,
          quantity: 99,
          product: { id: 20, name: 'Fideos Tallarín x10', pickingZone: 'CAJAS', defaultLocation: 'C-04' },
        },
      ],
    },
  ];

  it('consolida múltiples tandas facturadas con pesos reales exactos, bultos y desglose por comprobante', () => {
    const report = buildConsolidatedBilledReport(sampleOrders, 'ALL');

    expect(report.ordersCount).toBe(2);
    expect(report.productsCount).toBe(2);
    expect(report.totalBultos).toBe(5);
    expect(report.totalUnitsLabel).toBe('10');
    expect(report.totalWeightKgLabel).toBe('20,50 kg');

    // Ordenado por sector: FRIO primero, luego CAJAS
    expect(report.items[0].productName).toBe('Queso Barra Tybo');
    expect(report.items[0].totalQuantityLabel).toBe('5');
    expect(report.items[0].totalWeightKgLabel).toBe('20,50 kg');
    expect(report.items[0].hasEstimatedWeight).toBe(false);
    expect(report.items[0].orderBreakdown).toEqual([
      {
        orderId: 101,
        docLabel: '0005-1042',
        clientName: 'Supermercado América',
        quantityLabel: '2',
        weightKgLabel: '8,35 kg',
      },
      {
        orderId: 102,
        docLabel: '0005-1045',
        clientName: 'Despensa La',
        quantityLabel: '3',
        weightKgLabel: '12,15 kg',
      },
    ]);

    expect(report.items[1].productName).toBe('Fideos Tallarín x10');
    expect(report.items[1].totalQuantityLabel).toBe('5');
    expect(report.items[1].totalWeightKgLabel).toBeNull();
  });

  it('filtra correctamente por sector (FRIO / CAJAS) y excluye pedidos anulados', () => {
    const frioOnly = buildConsolidatedBilledReport(sampleOrders, 'FRIO');
    expect(frioOnly.ordersCount).toBe(2);
    expect(frioOnly.productsCount).toBe(1);
    expect(frioOnly.items[0].pickingZone).toBe('FRIO');

    const cajasOnly = buildConsolidatedBilledReport(sampleOrders, 'CAJAS');
    expect(cajasOnly.ordersCount).toBe(1);
    expect(cajasOnly.totalBultos).toBe(3);
    expect(cajasOnly.items[0].totalQuantityLabel).toBe('5');
  });

  it('evita errores de punto flotante al sumar pesos decimales (0.1 + 0.2 === 0.30 kg)', () => {
    const floatOrders = [
      {
        id: 201,
        status: 'COMPLETED',
        persona: { name: 'Cliente A' },
        items: [{ productId: 1, quantity: 1, weight: '0.1', product: { id: 1, name: 'Jamón', isPesable: true } }],
      },
      {
        id: 202,
        status: 'COMPLETED',
        persona: { name: 'Cliente B' },
        items: [{ productId: 1, quantity: 1, weight: '0.2', product: { id: 1, name: 'Jamón', isPesable: true } }],
      },
    ];

    const report = buildConsolidatedBilledReport(floatOrders);
    expect(report.items[0].totalWeightKgLabel).toBe('0,30 kg');
    expect(report.items[0].orderBreakdown[0].docLabel).toBe('#201');
  });

  it('lee bultosCount (campo de prisma/reparto) y hereda pickingZone desde rubro', () => {
    const tripOrders = [
      {
        id: 301,
        status: 'COMPLETED',
        bultosCount: 4,
        persona: { name: 'Kiosco Centro' },
        items: [
          {
            productId: 50,
            quantity: 6,
            product: { id: 50, name: 'Gaseosa 2.25L', rubro: { pickingZone: 'TABLA' } },
          },
        ],
      },
    ];

    const report = buildConsolidatedBilledReport(tripOrders);
    expect(report.totalBultos).toBe(4);
    expect(report.items[0].pickingZone).toBe('TABLA');
  });
});
