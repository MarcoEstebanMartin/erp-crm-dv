import { describe, expect, it } from 'vitest';
import {
  buildRouteSettlementPrefill,
  evaluateRouteSettlementActions,
  summarizeRouteFieldReceiptsByClient,
  type RouteFieldReceiptInput,
  type RouteOrderSettlementInput,
} from '../route-settlement.engine';

describe('route-settlement.engine', () => {
  const sampleOrders: RouteOrderSettlementInput[] = [
    { id: 10, personaId: 100, clientName: 'Kiosco Centro', totalAmount: 10000 },
    { id: 11, personaId: 200, clientName: 'Almacén Sur', totalAmount: 25000 },
    { id: 12, personaId: 300, clientName: 'Bar Norte', totalAmount: 15000 },
  ];

  const sampleReceipts: RouteFieldReceiptInput[] = [
    {
      id: 1,
      receiptNumber: 'REC-C-0000001',
      provisionalCode: 'PROV-1',
      personaId: 100,
      status: 'ISSUED',
      totalAmount: 10000,
      payments: [
        { paymentMethod: 'CASH', amount: 6000, status: 'IN_TRANSIT' },
        { paymentMethod: 'BANK_TRANSFER', amount: 4000, status: 'PENDING_BANK' },
      ],
    },
    {
      id: 2,
      receiptNumber: 'REC-C-0000002',
      provisionalCode: 'PROV-2',
      personaId: 200,
      status: 'VOIDED',
      totalAmount: 25000,
      payments: [{ paymentMethod: 'CASH', amount: 25000, status: 'IN_TRANSIT' }],
    },
  ];

  it('agrupa recibos de calle por cliente ignorando recibos anulados (VOIDED) y pagos rechazados', () => {
    const receiptsWithRejected: RouteFieldReceiptInput[] = [
      ...sampleReceipts,
      {
        id: 3,
        receiptNumber: 'REC-C-0000003',
        provisionalCode: 'PROV-3',
        personaId: 300,
        status: 'ISSUED',
        totalAmount: 15000,
        payments: [
          { paymentMethod: 'CHECK', amount: 10000.4, status: 'IN_TRANSIT' },
          { paymentMethod: 'BANK_TRANSFER', amount: 5000, status: 'REJECTED' },
        ],
      },
    ];

    const summary = summarizeRouteFieldReceiptsByClient(receiptsWithRejected);

    expect(summary[100]).toBeDefined();
    expect(summary[100].receiptNumbers).toEqual(['REC-C-0000001']);
    expect(summary[100].cashAmount.toNumber()).toBe(6000);
    expect(summary[100].transferAmount.toNumber()).toBe(4000);
    expect(summary[100].checkAmount.toNumber()).toBe(0);
    expect(summary[100].totalCollected.toNumber()).toBe(10000);

    // Recibo anulado del cliente 200 no debe contar
    expect(summary[200]).toBeUndefined();

    // Pago rechazado del cliente 300 no suma; cheque redondeado al peso entero
    expect(summary[300].checkAmount.toNumber()).toBe(10000);
    expect(summary[300].transferAmount.toNumber()).toBe(0);
    expect(summary[300].totalCollected.toNumber()).toBe(10000);
  });

  it('bloquea con alarma de doble cobro si oficina intenta cobrar manualmente a un cliente que ya pagó con recibo de calle', () => {
    const result = evaluateRouteSettlementActions(sampleOrders, sampleReceipts, [
      { orderId: 10, paymentMethod: 'CASH' }, // Cliente 100 ya tiene REC-C-0000001 por $10.000
      { orderId: 11, paymentMethod: 'CREDITO' },
      { orderId: 12, paymentMethod: 'CREDITO' },
    ]);

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      code: 'DOUBLE_COLLECTION_CONFLICT',
      orderId: 10,
      personaId: 100,
      clientName: 'Kiosco Centro',
      receiptNumbers: ['REC-C-0000001'],
      alreadyCollectedAmount: 10000,
    });
    expect(result.conflicts[0].message).toContain('Doble cobro bloqueado');
    expect(result.conflicts[0].message).toContain('REC-C-0000001');
  });

  it('bloquea con alarma ORDER_ALREADY_PAID si el pedido ya fue cobrado al contado al facturar', () => {
    const ordersWithPrepaid: RouteOrderSettlementInput[] = [
      {
        id: 10,
        personaId: 100,
        clientName: 'Kiosco Centro',
        invoiceLabel: '00001-00000010',
        totalAmount: 10000,
        alreadyPaidAmount: 10000,
      },
    ];

    const result = evaluateRouteSettlementActions(ordersWithPrepaid, [], [
      { orderId: 10, paymentMethod: 'CASH' },
    ]);

    expect(result.conflicts).toHaveLength(1);
    expect(result.conflicts[0]).toMatchObject({
      code: 'ORDER_ALREADY_PAID',
      orderId: 10,
      alreadyCollectedAmount: 10000,
    });
    expect(result.conflicts[0].message).toContain('ya fue cobrado previamente');
  });

  it('permite liquidar sin duplicar cobro cuando el cliente con recibo viene como FIELD_RECEIPT y los demás en C/C o cobro excepcional', () => {
    const result = evaluateRouteSettlementActions(sampleOrders, sampleReceipts, [
      { orderId: 10, paymentMethod: 'FIELD_RECEIPT' },
      { orderId: 11, paymentMethod: 'CREDITO' },
      { orderId: 12, paymentMethod: 'CASH' }, // Cobro excepcional en oficina porque cliente 300 no tiene recibo de calle
    ]);

    expect(result.conflicts).toHaveLength(0);
    expect(result.actionsByOrderId[10].action).toBe('KEEP_FIELD_RECEIPT');
    expect(result.actionsByOrderId[11].action).toBe('LEAVE_ON_CREDIT');
    expect(result.actionsByOrderId[12].action).toBe('CREATE_OFFICE_TRANSACTION');

    expect(result.totals.ordersTotal.toNumber()).toBe(50000);
    expect(result.totals.fieldCash.toNumber()).toBe(6000);
    expect(result.totals.fieldTransfer.toNumber()).toBe(4000);
    expect(result.totals.fieldTotal.toNumber()).toBe(10000);
    expect(result.totals.officeCash.toNumber()).toBe(15000);
    expect(result.totals.officeTotal.toNumber()).toBe(15000);
    expect(result.totals.creditAccountTotal.toNumber()).toBe(25000);
  });

  it('prellena FIELD_RECEIPT para clientes con recibo en el viaje y CREDITO para el resto', () => {
    const prefill = buildRouteSettlementPrefill(sampleOrders, sampleReceipts);

    expect(prefill).toEqual([
      {
        orderId: 10,
        personaId: 100,
        suggestedPaymentMethod: 'FIELD_RECEIPT',
        hasFieldReceipts: true,
        receiptNumbers: ['REC-C-0000001'],
        fieldCollectedAmount: 10000,
        fieldCashAmount: 6000,
        fieldTransferAmount: 4000,
        fieldCheckAmount: 0,
      },
      {
        orderId: 11,
        personaId: 200,
        suggestedPaymentMethod: 'CREDITO',
        hasFieldReceipts: false,
        receiptNumbers: [],
        fieldCollectedAmount: 0,
        fieldCashAmount: 0,
        fieldTransferAmount: 0,
        fieldCheckAmount: 0,
      },
      {
        orderId: 12,
        personaId: 300,
        suggestedPaymentMethod: 'CREDITO',
        hasFieldReceipts: false,
        receiptNumbers: [],
        fieldCollectedAmount: 0,
        fieldCashAmount: 0,
        fieldTransferAmount: 0,
        fieldCheckAmount: 0,
      },
    ]);
  });
});
