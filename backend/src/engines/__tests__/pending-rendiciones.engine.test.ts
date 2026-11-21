import { describe, expect, it } from 'vitest';
import {
  classifyCollectorChannel,
  summarizeOpenFieldSettlements,
} from '../pending-rendiciones.engine';

describe('pending-rendiciones.engine', () => {
  it('clasifica como DRIVER cuando hay deliveryRouteId en la rendición o recibos, o rol DEPOSITO', () => {
    expect(classifyCollectorChannel({ deliveryRouteId: 4, collectorRole: 'VENDEDOR' })).toBe('DRIVER');
    expect(
      classifyCollectorChannel({
        deliveryRouteId: null,
        receiptDeliveryRouteIds: [null, 12],
        collectorRole: 'ADMIN',
      }),
    ).toBe('DRIVER');
    expect(classifyCollectorChannel({ deliveryRouteId: null, collectorRole: 'DEPOSITO' })).toBe('DRIVER');
    expect(classifyCollectorChannel({ deliveryRouteId: null, collectorRole: 'VENDEDOR' })).toBe('SELLER');
  });

  it('resume rendiciones abiertas con Decimal.js en pesos enteros y omite cerradas o vacías', () => {
    const summaries = summarizeOpenFieldSettlements([
      {
        id: 1,
        collectorUserId: 7,
        status: 'OPEN',
        expectedCash: '15000.00',
        expectedChecksCount: 1,
        expectedChecksAmount: '25000.40',
        pendingTransfersAmount: '10000.60',
        collector: { id: 7, username: 'diego', role: 'VENDEDOR' },
        receipts: [
          { id: 101, status: 'ISSUED', deliveryRouteId: null },
          { id: 102, status: 'VOIDED', deliveryRouteId: null },
          { id: 106, status: 'VERIFIED', deliveryRouteId: null },
        ],
      },
      {
        id: 2,
        collectorUserId: 9,
        status: 'OPEN',
        deliveryRouteId: 4,
        expectedCash: '50000',
        expectedChecksCount: 0,
        expectedChecksAmount: '0',
        pendingTransfersAmount: '0',
        collector: { id: 9, username: 'miguel', role: 'DEPOSITO' },
        deliveryRoute: { id: 4, driverName: 'Miguel Alberca', vehiclePlate: 'AE 178 EC' },
        receipts: [{ id: 103, status: 'ISSUED', deliveryRouteId: 4 }],
      },
      {
        id: 3,
        collectorUserId: 8,
        status: 'APPROVED',
        expectedCash: '9000',
        expectedChecksCount: 0,
        expectedChecksAmount: '0',
        pendingTransfersAmount: '0',
        collector: { id: 8, username: 'juan', role: 'VENDEDOR' },
        receipts: [{ id: 104, status: 'SETTLED', deliveryRouteId: null }],
      },
      {
        id: 4,
        collectorUserId: 10,
        status: 'OPEN',
        expectedCash: '0',
        expectedChecksCount: 0,
        expectedChecksAmount: '0',
        pendingTransfersAmount: '0',
        collector: { id: 10, username: 'vacio', role: 'VENDEDOR' },
        receipts: [],
      },
      {
        id: 5,
        collectorUserId: 11,
        status: 'OPEN',
        expectedCash: '0',
        expectedChecksCount: 0,
        expectedChecksAmount: '0',
        pendingTransfersAmount: '0',
        collector: { id: 11, username: 'acreditado', role: 'VENDEDOR' },
        receipts: [{ id: 105, status: 'VERIFIED', deliveryRouteId: null }],
      },
    ]);

    expect(summaries).toHaveLength(2);
    expect(summaries[0]).toMatchObject({
      id: 1,
      collectorName: 'diego',
      channel: 'SELLER',
      receiptCount: 1,
      expectedCash: 15000,
      expectedChecksAmount: 25000,
      pendingTransfersAmount: 10001,
      totalPending: 50001,
      routeLabel: null,
    });
    expect(summaries[1]).toMatchObject({
      id: 2,
      collectorName: 'miguel',
      channel: 'DRIVER',
      deliveryRouteId: 4,
      routeLabel: 'Viaje #4 (AE 178 EC)',
      receiptCount: 1,
      totalPending: 50000,
    });
  });
});
