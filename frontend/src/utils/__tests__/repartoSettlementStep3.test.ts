import { describe, expect, it } from 'vitest';
import {
  buildInitialRouteSettlements,
  computeRouteSettlementTotals,
  formatFieldReceiptBreakdown,
} from '../../components/reparto/repartoSettlementHelpers';

describe('Paso 3 — Prellenado y totales de Liquidación de Viaje', () => {
  const mockRoute = {
    id: 4,
    orders: [
      { id: 101, personaId: 10, invoiceNumber: 'INT-00101', totalAmount: 10000, persona: { id: 10, name: 'Kiosco A' } },
      { id: 102, personaId: 10, invoiceNumber: 'INT-00102', totalAmount: 5000, persona: { id: 10, name: 'Kiosco A' } },
      { id: 103, personaId: 20, invoiceNumber: 'INT-00103', totalAmount: 8000, persona: { id: 20, name: 'Almacén B' } },
      { id: 104, personaId: 30, invoiceNumber: 'INT-00104', totalAmount: 12000, persona: { id: 30, name: 'Bar C' } },
    ],
    fieldReceipts: [
      {
        id: 1,
        receiptNumber: 'REC-C-0000010',
        provisionalCode: 'PROV-10',
        personaId: 10,
        status: 'ISSUED',
        totalAmount: 15000,
        payments: [
          { paymentMethod: 'CASH', amount: 10000, status: 'IN_TRANSIT' },
          { paymentMethod: 'BANK_TRANSFER', amount: 5000, status: 'PENDING_BANK' },
        ],
      },
      {
        id: 2,
        receiptNumber: 'REC-C-0000011',
        provisionalCode: 'PROV-11',
        personaId: 20,
        status: 'VOIDED',
        totalAmount: 8000,
        payments: [{ paymentMethod: 'CASH', amount: 8000, status: 'IN_TRANSIT' }],
      },
    ],
  };

  it('precarga FIELD_RECEIPT bloqueado para clientes con recibo en calle y CREDITO para los demás', () => {
    const rows = buildInitialRouteSettlements(mockRoute, [{ id: 1, name: 'Mercado Pago' }]);

    expect(rows[0].paymentMethod).toBe('FIELD_RECEIPT');
    expect(rows[0].lockedByFieldReceipt).toBe(true);
    expect(rows[0].fieldReceipts?.receiptNumbers).toEqual(['REC-C-0000010']);

    // Cliente 20 solo tenía recibo VOIDED => arranca en CREDITO (A Cuenta C/C)
    expect(rows[2].paymentMethod).toBe('CREDITO');
    expect(rows[2].lockedByFieldReceipt).toBe(false);

    // Cliente 30 sin recibos => arranca en CREDITO
    expect(rows[3].paymentMethod).toBe('CREDITO');
    expect(rows[3].lockedByFieldReceipt).toBe(false);
  });

  it('calcula totales consolidados sin duplicar el recibo de calle cuando un cliente tiene 2 pedidos en el mismo viaje', () => {
    const rows = buildInitialRouteSettlements(mockRoute, [{ id: 1, name: 'Mercado Pago' }]);
    // Simulamos cobro manual excepcional en oficina para el pedido 104 (Bar C)
    rows[3].paymentMethod = 'CHECK';

    const totals = computeRouteSettlementTotals(rows);

    expect(totals.totalOrders).toBe(35000);
    // Kiosco A tiene 2 pedidos (101 y 102) pero 1 solo recibo de calle ($10.000 efectivo + $5.000 transf): NO se duplica
    expect(totals.totalCash).toBe(10000);
    expect(totals.totalTransfer).toBe(5000);
    expect(totals.totalCheck).toBe(12000);
    expect(totals.totalCredit).toBe(8000);
    expect(totals.fieldReceiptOrdersCount).toBe(2);

    // Marcamos Almacén B como No Entregado (vuelve a depósito)
    rows[2].paymentMethod = 'NOT_DELIVERED';
    const totalsWithReturn = computeRouteSettlementTotals(rows);
    expect(totalsWithReturn.notDeliveredCount).toBe(1);
    expect(totalsWithReturn.totalNotDelivered).toBe(8000);
    expect(totalsWithReturn.totalCredit).toBe(0);
  });

  it('formatea el desglose del recibo de calle en texto compacto', () => {
    expect(
      formatFieldReceiptBreakdown({
        personaId: 10,
        receiptNumbers: ['REC-C-0000010'],
        total: 15000,
        cash: 10000,
        transfer: 5000,
        check: 0,
      }),
    ).toBe('Efectivo $10.000 · Transf. $5.000');
  });
});
