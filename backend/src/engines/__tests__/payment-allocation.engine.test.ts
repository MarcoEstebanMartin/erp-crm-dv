import { describe, expect, it } from 'vitest';
import {
  computeClientReceivablesSummary,
  computeInvoicePaymentStatus,
  computeOrderPendingAmount,
  planCreditApplicationToNewOrder,
  planPaymentAllocations,
} from '../payment-allocation.engine';

describe('payment-allocation.engine (Motor Profesional de Imputaciones)', () => {
  it('calcula saldo pendiente descontando imputaciones y notas de crédito aprobadas', () => {
    const pending = computeOrderPendingAmount({
      totalAmount: '30692',
      allocatedAmount: '10000',
      creditNotesAmount: '692',
    });
    expect(pending.toNumber()).toBe(20000);
    expect(computeInvoicePaymentStatus(30692, 20000, 692)).toBe('PARTIAL');
    expect(computeInvoicePaymentStatus(30692, 0, 692)).toBe('PAID');
    expect(computeInvoicePaymentStatus(30692, 30000, 692)).toBe('PENDING');
  });

  it('no devuelve pendiente negativo si las imputaciones + NC superan el total', () => {
    const pending = computeOrderPendingAmount({
      totalAmount: 18224,
      allocatedAmount: 36448,
      creditNotesAmount: 0,
    });
    expect(pending.toNumber()).toBe(0);
    expect(computeInvoicePaymentStatus(18224, 0, 0)).toBe('PAID');
  });

  it('aplica FIFO automático: 1 pago cubre factura más vieja entera + parcial de la segunda', () => {
    const result = planPaymentAllocations({
      paymentAmount: 50000,
      orders: [
        { id: 87, invoiceNumber: '00001-00000005', totalAmount: 30692, allocatedAmount: 0, creditNotesAmount: 0 },
        { id: 89, invoiceNumber: '00001-00000007', totalAmount: 30692, allocatedAmount: 0, creditNotesAmount: 0 },
        { id: 91, invoiceNumber: 'INT-00091', totalAmount: 44624, allocatedAmount: 0, creditNotesAmount: 0 },
      ],
    });

    expect(result.totalAllocated).toBe(50000);
    expect(result.unallocatedCredit).toBe(0);
    expect(result.allocations).toEqual([
      {
        orderId: 87,
        invoiceNumber: '00001-00000005',
        amount: 30692,
        previousPending: 30692,
        newPending: 0,
        newStatus: 'PAID',
      },
      {
        orderId: 89,
        invoiceNumber: '00001-00000007',
        amount: 19308,
        previousPending: 30692,
        newPending: 11384,
        newStatus: 'PARTIAL',
      },
    ]);
  });

  it('deja el excedente como saldo a favor (unallocatedCredit) cuando el pago supera toda la deuda', () => {
    const result = planPaymentAllocations({
      paymentAmount: 100000,
      orders: [
        { id: 1, invoiceNumber: '00001-00000001', totalAmount: 50000, allocatedAmount: 0, creditNotesAmount: 0 },
        { id: 2, invoiceNumber: '00001-00000002', totalAmount: 30000, allocatedAmount: 0, creditNotesAmount: 0 },
      ],
    });

    expect(result.totalAllocated).toBe(80000);
    expect(result.unallocatedCredit).toBe(20000);
    expect(result.allocations).toHaveLength(2);
    expect(result.allocations[0].newStatus).toBe('PAID');
    expect(result.allocations[1].newStatus).toBe('PAID');
  });

  it('imputa primero a preferredOrderId y derrama el sobrante en FIFO a las más viejas', () => {
    const result = planPaymentAllocations({
      paymentAmount: 50000,
      preferredOrderId: 91,
      orders: [
        { id: 87, invoiceNumber: '00001-00000005', totalAmount: 30692, allocatedAmount: 0, creditNotesAmount: 0 },
        { id: 91, invoiceNumber: 'INT-00091', totalAmount: 44624, allocatedAmount: 0, creditNotesAmount: 0 },
      ],
    });

    expect(result.totalAllocated).toBe(50000);
    expect(result.unallocatedCredit).toBe(0);
    expect(result.allocations).toEqual([
      {
        orderId: 91,
        invoiceNumber: 'INT-00091',
        amount: 44624,
        previousPending: 44624,
        newPending: 0,
        newStatus: 'PAID',
      },
      {
        orderId: 87,
        invoiceNumber: '00001-00000005',
        amount: 5376,
        previousPending: 30692,
        newPending: 25316,
        newStatus: 'PARTIAL',
      },
    ]);
  });

  it('respeta allocateOverflowToFifo=false dejando el excedente como saldo a favor', () => {
    const result = planPaymentAllocations({
      paymentAmount: 50000,
      preferredOrderId: 91,
      allocateOverflowToFifo: false,
      orders: [
        { id: 87, invoiceNumber: '00001-00000005', totalAmount: 30692, allocatedAmount: 0, creditNotesAmount: 0 },
        { id: 91, invoiceNumber: 'INT-00091', totalAmount: 44624, allocatedAmount: 0, creditNotesAmount: 0 },
      ],
    });

    expect(result.totalAllocated).toBe(44624);
    expect(result.unallocatedCredit).toBe(5376);
    expect(result.allocations).toHaveLength(1);
    expect(result.allocations[0].orderId).toBe(91);
  });

  it('respeta imputaciones manuales y nunca sobre-imputa más que el pendiente de cada factura', () => {
    const result = planPaymentAllocations({
      paymentAmount: 40000,
      orders: [
        { id: 10, invoiceNumber: 'F-10', totalAmount: 25000, allocatedAmount: 10000, creditNotesAmount: 0 },
        { id: 11, invoiceNumber: 'F-11', totalAmount: 30000, allocatedAmount: 0, creditNotesAmount: 0 },
      ],
      manualAllocations: [
        { orderId: 10, amount: 25000 }, // solo debe 15000 -> cap a 15000
        { orderId: 11, amount: 30000 }, // quedan 25000 del pago -> cap a 25000
      ],
    });

    expect(result.totalAllocated).toBe(40000);
    expect(result.unallocatedCredit).toBe(0);
    expect(result.allocations[0].amount).toBe(15000);
    expect(result.allocations[0].newStatus).toBe('PAID');
    expect(result.allocations[1].amount).toBe(25000);
    expect(result.allocations[1].newStatus).toBe('PARTIAL');
  });

  it('auto-aplica saldo a favor de cobros previos (FIFO) al emitir una nueva factura', () => {
    const applied = planCreditApplicationToNewOrder({
      orderId: 100,
      orderTotal: 35000,
      creditTransactions: [
        { transactionId: 501, availableCredit: 15000 },
        { transactionId: 502, availableCredit: 30000 },
      ],
    });

    expect(applied.totalApplied).toBe(35000);
    expect(applied.remainingOrderPending).toBe(0);
    expect(applied.orderStatus).toBe('PAID');
    expect(applied.allocations).toEqual([
      { transactionId: 501, orderId: 100, amount: 15000 },
      { transactionId: 502, orderId: 100, amount: 20000 },
    ]);
  });

  it('auto-aplica saldo a favor parcial dejando la nueva factura en estado PARTIAL', () => {
    const applied = planCreditApplicationToNewOrder({
      orderId: 101,
      orderTotal: 44624,
      creditTransactions: [{ transactionId: 503, availableCredit: 10000 }],
    });

    expect(applied.totalApplied).toBe(10000);
    expect(applied.remainingOrderPending).toBe(34624);
    expect(applied.orderStatus).toBe('PARTIAL');
    expect(applied.allocations).toEqual([{ transactionId: 503, orderId: 101, amount: 10000 }]);
  });

  it('garantiza invariante netBalance = totalPendingOnInvoices - totalAvailableCredit (caso ABBATE)', () => {
    // 4 facturas sin imputación ($136.700) menos $86.864 de crédito aplicado en FIFO = $49.836
    const fifo = planPaymentAllocations({
      paymentAmount: 86864,
      orders: [
        { id: 87, invoiceNumber: '00001-00000005', totalAmount: 30692, allocatedAmount: 0, creditNotesAmount: 0 },
        { id: 89, invoiceNumber: '00001-00000007', totalAmount: 30692, allocatedAmount: 0, creditNotesAmount: 0 },
        { id: 91, invoiceNumber: 'INT-00091', totalAmount: 44624, allocatedAmount: 0, creditNotesAmount: 0 },
        { id: 84, invoiceNumber: '00001-00000009', totalAmount: 30692, allocatedAmount: 0, creditNotesAmount: 0 },
      ],
    });

    expect(fifo.totalAllocated).toBe(86864);
    expect(fifo.unallocatedCredit).toBe(0);
    // Cancela #87 (30692), cancela #89 (30692), y aplica 25480 a #91 (queda 19144 pendiente) + #84 (30692 pendiente)
    expect(fifo.allocations.map((a) => ({ id: a.orderId, amt: a.amount, rem: a.newPending }))).toEqual([
      { id: 87, amt: 30692, rem: 0 },
      { id: 89, amt: 30692, rem: 0 },
      { id: 91, amt: 25480, rem: 19144 },
    ]);

    const summary = computeClientReceivablesSummary(
      [
        { id: 87, invoiceNumber: '00001-00000005', totalAmount: 30692, allocatedAmount: 30692, creditNotesAmount: 0 },
        { id: 89, invoiceNumber: '00001-00000007', totalAmount: 30692, allocatedAmount: 30692, creditNotesAmount: 0 },
        { id: 91, invoiceNumber: 'INT-00091', totalAmount: 44624, allocatedAmount: 25480, creditNotesAmount: 0 },
        { id: 84, invoiceNumber: '00001-00000009', totalAmount: 30692, allocatedAmount: 0, creditNotesAmount: 0 },
      ],
      [],
    );

    expect(summary.pendingInvoices).toHaveLength(2);
    expect(summary.totalPendingOnInvoices).toBe(49836); // 19144 + 30692 = 49836 EXACTO!
    expect(summary.totalAvailableCredit).toBe(0);
    expect(summary.netBalance).toBe(49836);
  });

  it('imputa varias facturas puntuales elegidas (ej. las últimas 2) sin tocar la más vieja', () => {
    const result = planPaymentAllocations({
      paymentAmount: 409817,
      preferredOrderIds: [2, 3],
      orders: [
        { id: 1, invoiceNumber: 'INT-00001', totalAmount: 356992, allocatedAmount: 0, creditNotesAmount: 0 },
        { id: 2, invoiceNumber: 'INT-00002', totalAmount: 178496, allocatedAmount: 0, creditNotesAmount: 0 },
        { id: 3, invoiceNumber: 'INT-00003', totalAmount: 231321, allocatedAmount: 0, creditNotesAmount: 0 },
      ],
    });

    expect(result.totalAllocated).toBe(409817);
    expect(result.unallocatedCredit).toBe(0);
    expect(result.allocations).toEqual([
      {
        orderId: 2,
        invoiceNumber: 'INT-00002',
        amount: 178496,
        previousPending: 178496,
        newPending: 0,
        newStatus: 'PAID',
      },
      {
        orderId: 3,
        invoiceNumber: 'INT-00003',
        amount: 231321,
        previousPending: 231321,
        newPending: 0,
        newStatus: 'PAID',
      },
    ]);
  });

  it('cubre parcialmente la última de las seleccionadas si el monto es menor y derrama a FIFO si es mayor', () => {
    const orders = [
      { id: 1, invoiceNumber: 'INT-00001', totalAmount: 356992, allocatedAmount: 0, creditNotesAmount: 0 },
      { id: 2, invoiceNumber: 'INT-00002', totalAmount: 178496, allocatedAmount: 0, creditNotesAmount: 0 },
      { id: 3, invoiceNumber: 'INT-00003', totalAmount: 231321, allocatedAmount: 0, creditNotesAmount: 0 },
    ];

    const partial = planPaymentAllocations({
      paymentAmount: 300000,
      preferredOrderIds: [2, 3],
      orders,
    });
    expect(partial.allocations.map((a) => ({ id: a.orderId, amt: a.amount, status: a.newStatus }))).toEqual([
      { id: 2, amt: 178496, status: 'PAID' },
      { id: 3, amt: 121504, status: 'PARTIAL' },
    ]);

    const overflow = planPaymentAllocations({
      paymentAmount: 500000,
      preferredOrderIds: [2, 3],
      orders,
    });
    expect(overflow.allocations.map((a) => ({ id: a.orderId, amt: a.amount, status: a.newStatus }))).toEqual([
      { id: 2, amt: 178496, status: 'PAID' },
      { id: 3, amt: 231321, status: 'PAID' },
      { id: 1, amt: 90183, status: 'PARTIAL' },
    ]);
  });
});
