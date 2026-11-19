import { describe, expect, it } from 'vitest';
import type { CollectorSettlementDTO } from '../../../api/fieldReceipts.api';
import {
  isPendingOpenSettlement,
  resolveFieldReceiptChannel,
  resolveSettlementChannel,
} from '../fieldSettlementChannel';

function makeSettlement(overrides: Partial<CollectorSettlementDTO & { deliveryRouteId?: number | null }> = {}) {
  return {
    id: 1,
    collectorUserId: 5,
    collector: { id: 5, username: 'diego', role: 'VENDEDOR' },
    status: 'OPEN',
    expectedCash: '15000',
    declaredCash: null,
    cashDifference: null,
    expectedChecksCount: 0,
    expectedChecksAmount: '0',
    pendingTransfersAmount: '0',
    createdAt: '2026-11-19T17:00:00Z',
    approvedAt: null,
    receipts: [
      {
        id: 10,
        receiptNumber: 'REC-C-0000001',
        provisionalCode: 'PROV-1',
        personaId: 1,
        totalAmount: '15000',
        status: 'ISSUED',
        capturedAt: '2026-11-19T17:00:00Z',
        whatsappStatus: 'SENT',
        whatsappError: null,
        pdfUrl: null,
        payments: [],
      },
    ],
    ...overrides,
  } as CollectorSettlementDTO & { deliveryRouteId?: number | null };
}

describe('fieldSettlementChannel', () => {
  it('clasifica Vendedor vs Repartidor por deliveryRouteId o rol DEPOSITO', () => {
    const seller = makeSettlement();
    expect(resolveSettlementChannel(seller)).toBe('SELLER');
    expect(resolveFieldReceiptChannel(seller.receipts[0], seller)).toBe('SELLER');

    const driverByRoute = makeSettlement({ deliveryRouteId: 4 });
    expect(resolveSettlementChannel(driverByRoute)).toBe('DRIVER');
    expect(resolveFieldReceiptChannel(driverByRoute.receipts[0], driverByRoute)).toBe('DRIVER');

    const driverByRole = makeSettlement({ collector: { id: 9, username: 'miguel', role: 'DEPOSITO' } });
    expect(resolveSettlementChannel(driverByRole)).toBe('DRIVER');
  });

  it('detecta solo rendiciones OPEN/SUBMITTED con recibos activos o saldo pendiente', () => {
    expect(isPendingOpenSettlement(makeSettlement())).toBe(true);
    expect(isPendingOpenSettlement(makeSettlement({ status: 'APPROVED' }))).toBe(false);
    expect(
      isPendingOpenSettlement(
        makeSettlement({
          expectedCash: '0',
          receipts: [],
        }),
      ),
    ).toBe(false);
  });
});
