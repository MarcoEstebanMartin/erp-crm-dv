import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingType, LedgerEntryType, LedgerSourceType, PaymentMethod, TransactionType } from '@prisma/client';

const {
  prismaMock,
  mockRecordLedgerMovement,
  mockRecordPerceptions,
  mockLogAudit,
} = vi.hoisted(() => ({
  prismaMock: {
    persona: {
      findUnique: vi.fn(),
    },
    supplierInvoice: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
    transaction: {
      findFirst: vi.fn(),
    },
    $transaction: vi.fn(),
  },
  mockRecordLedgerMovement: vi.fn(),
  mockRecordPerceptions: vi.fn(),
  mockLogAudit: vi.fn(),
}));

vi.mock('../../utils/prisma', () => ({
  default: prismaMock,
}));

vi.mock('../ledger/account-ledger.service', () => ({
  recordLedgerMovement: mockRecordLedgerMovement,
}));

vi.mock('../billing/supplier-tax.helper', () => ({
  recordSupplierInvoicePerceptions: mockRecordPerceptions,
}));

vi.mock('../../utils/audit', () => ({
  logAudit: mockLogAudit,
}));

vi.mock('../gemini.service', () => ({
  geminiService: {
    extractInvoiceData: vi.fn(),
  },
}));

import { purchaseDocumentService } from '../purchases/purchase-document.service';
import { purchaseOrderService } from '../purchases/purchase-order.service';
import { supplierInvoiceService } from '../billing/supplier-invoice.service';
import { personaPaymentSubService } from '../personas/persona-payment.service';

describe('Proveedores Step 2 — Escáner IA, Tránsito, Lotes Limpios y Pagos/Retenciones', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRecordLedgerMovement.mockResolvedValue({
      entry: { id: 1 },
      updatedPersona: { id: 50, outstandingBalance: 0 },
    });
    mockRecordPerceptions.mockResolvedValue(undefined);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it('confirmExtractedDocument acepta FACTURA_A en modo IN_TRANSIT sin sumar stock todavía', async () => {
    prismaMock.persona.findUnique.mockResolvedValue({
      id: 50,
      name: 'DISTRIBUIDORA LA PAMPA SRL',
      cuit: '30-71234567-9',
      isProvider: true,
      paymentTermDays: 15,
    });

    const tx = {
      supplierInvoice: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 901,
          personaId: 50,
          invoiceNumber: '0003-00014580',
          invoiceType: 'FACTURA_A',
          receptionStatus: 'IN_TRANSIT',
          totalAmount: 12500,
        }),
      },
      providerProductMapping: {
        upsert: vi.fn().mockResolvedValue({}),
      },
      purchaseOrder: {
        create: vi.fn().mockResolvedValue({
          id: 401,
          personaId: 50,
          supplierInvoiceId: 901,
          status: 'PENDING',
        }),
      },
      product: { update: vi.fn() },
      productLot: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
      stockMovement: { create: vi.fn() },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(tx));

    const res = await purchaseDocumentService.confirmExtractedDocument({
      userId: 1,
      providerId: 50,
      documentType: 'FACTURA_A',
      documentNumber: '0003-00014580',
      issueDate: '2026-11-18',
      receptionMode: 'IN_TRANSIT',
      billingType: 'OFFICIAL',
      netAmount: 10000,
      taxAmount: 2100,
      percepcionIva5329: 400,
      totalAmount: 12500,
      items: [
        {
          code: 'P-100',
          description: 'Dulce de Batata 5kg',
          productId: 11,
          quantity: 10,
          unitPrice: 1000,
          isNonStock: false,
        },
      ],
    });

    expect(res).toMatchObject({
      supplierInvoiceId: 901,
      purchaseOrderId: 401,
      receptionMode: 'IN_TRANSIT',
    });

    // Mapping guardado incluso en tránsito
    expect(tx.providerProductMapping.upsert).toHaveBeenCalledTimes(1);
    // Factura creada con RG 5329 incluida y estado en tránsito
    expect(tx.supplierInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceType: 'FACTURA_A',
          receptionStatus: 'IN_TRANSIT',
          receivedAt: null,
          percepcionIvaAmount: 400,
          billingType: BillingType.OFFICIAL,
        }),
      }),
    );
    // Recepción vinculada PENDING
    expect(tx.purchaseOrder.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          supplierInvoiceId: 901,
          status: 'PENDING',
          receivedAt: null,
        }),
      }),
    );
    // Deuda asentada en AccountLedger una sola vez
    expect(mockRecordLedgerMovement).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        personaId: 50,
        entryType: LedgerEntryType.CREDIT,
        sourceType: LedgerSourceType.SUPPLIER_INVOICE,
        supplierInvoiceId: 901,
        purchaseOrderId: 401,
        amount: 12500,
      }),
    );
    // Cero cambios en stock mientras esté en tránsito
    expect(tx.product.update).not.toHaveBeenCalled();
    expect(tx.productLot.create).not.toHaveBeenCalled();
    expect(tx.stockMovement.create).not.toHaveBeenCalled();
  });

  it('receivePurchaseOrder sobre orden vinculada ingresa stock con lote limpio S/L y NO duplica factura ni asiento contable', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      purchaseOrder: {
        findUnique: vi.fn().mockResolvedValue({
          id: 401,
          personaId: 50,
          status: 'PENDING',
          supplierInvoiceId: 901,
          supplierInvoice: { id: 901, invoiceNumber: '0003-00014580' },
          totalAmount: 10000,
          items: [{ id: 1, productId: 11, quantity: 10, costPrice: 1000 }],
        }),
        update: vi.fn().mockResolvedValue({
          id: 401,
          status: 'RECEIVED',
          supplierInvoiceId: 901,
        }),
      },
      purchaseOrderItem: {
        update: vi.fn().mockResolvedValue({}),
      },
      product: {
        update: vi.fn().mockResolvedValue({ id: 11 }),
      },
      productLot: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 77, lotNumber: 'S/L', location: 'S/U' }),
      },
      stockMovement: {
        create: vi.fn().mockResolvedValue({ id: 555 }),
      },
      supplierInvoice: {
        update: vi.fn().mockResolvedValue({ id: 901, receptionStatus: 'RECEIVED' }),
        create: vi.fn(),
      },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await purchaseOrderService.receivePurchaseOrder({
      userId: 1,
      orderId: 401,
      receivedQuantities: { '11': 8 },
      lotAssignments: { '11': { lotNumber: '', expirationDate: '' } },
    });

    // Ajusta cantidad recibida real (8 en lugar de 10)
    expect(tx.purchaseOrderItem.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { quantity: 8, subtotal: 8000 },
    });
    expect(tx.product.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 11 },
        data: expect.objectContaining({ stock: { increment: 8 } }),
      }),
    );
    // Crea lote limpio 'S/L' sin prefijo basura ni vencimiento +180d ficticio
    expect(tx.productLot.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        productId: 11,
        lotNumber: 'S/L',
        stock: 8,
        location: 'S/U',
      }),
    });
    const createdExp: Date = tx.productLot.create.mock.calls[0][0].data.expirationDate;
    expect(createdExp.getUTCFullYear()).toBe(2036);

    // Kardex vinculado a INV-901
    expect(tx.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: 11,
          quantity: 8,
          type: 'IN',
          purchaseOrderId: 401,
          referenceId: 'INV-901',
          productLotId: 77,
        }),
      }),
    );

    // Marca la factura vinculada como RECEIVED y jamás crea una segunda factura ni asiento
    expect(tx.supplierInvoice.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 901 },
        data: expect.objectContaining({ receptionStatus: 'RECEIVED' }),
      }),
    );
    expect(tx.supplierInvoice.create).not.toHaveBeenCalled();
    expect(mockRecordLedgerMovement).not.toHaveBeenCalled();
  });

  it('receivePurchaseOrder sin factura previa con FACTURA_C en Sucursal A calcula IVA $0', async () => {
    const tx = {
      $queryRaw: vi.fn().mockResolvedValue([]),
      purchaseOrder: {
        findUnique: vi.fn().mockResolvedValue({
          id: 402,
          personaId: 50,
          status: 'PENDING',
          supplierInvoiceId: null,
          supplierInvoice: null,
          totalAmount: 5000,
          items: [{ id: 2, productId: 12, quantity: 5, costPrice: 1000 }],
        }),
        update: vi.fn().mockResolvedValue({ id: 402, status: 'RECEIVED', supplierInvoiceId: 902 }),
      },
      product: { update: vi.fn().mockResolvedValue({}) },
      productLot: {
        findUnique: vi.fn().mockResolvedValue({ id: 80 }),
        update: vi.fn().mockResolvedValue({ id: 80 }),
      },
      stockMovement: { create: vi.fn().mockResolvedValue({}) },
      supplierInvoice: {
        create: vi.fn().mockResolvedValue({ id: 902 }),
      },
    };
    prismaMock.$transaction.mockImplementation(async (cb: any) => cb(tx));

    await purchaseOrderService.receivePurchaseOrder({
      userId: 1,
      orderId: 402,
      billingType: 'OFFICIAL',
      invoiceType: 'FACTURA_C',
      invoiceNumber: '0001-00000100',
    });

    expect(tx.supplierInvoice.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          invoiceType: 'FACTURA_C',
          netAmount: 5000,
          taxAmount: 0,
          totalAmount: 5000,
          receptionStatus: 'RECEIVED',
        }),
      }),
    );
  });

  it('deleteSupplierInvoice bloquea anulación si el lote recibido ya se vendió parcialmente y registra Kardex inmutable si tiene stock', async () => {
    // 1) Bloqueo si lote ya consumido
    prismaMock.supplierInvoice.findUnique.mockResolvedValue({
      id: 901,
      personaId: 50,
      invoiceNumber: '0003-00014580',
      status: 'PENDING',
      paidAmount: 0,
      totalAmount: 12500,
      billingType: BillingType.OFFICIAL,
      persona: { name: 'DISTRIBUIDORA LA PAMPA SRL' },
    });

    const txInsufficient = {
      purchaseOrder: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      stockMovement: {
        findMany: vi.fn().mockResolvedValue([
          { id: 10, productId: 11, quantity: 10, productLotId: 77, userId: 1 },
        ]),
        create: vi.fn(),
        update: vi.fn(),
      },
      productLot: {
        findUnique: vi.fn().mockResolvedValue({ id: 77, stock: 3 }),
      },
    };
    prismaMock.$transaction.mockImplementationOnce(async (cb: any) => cb(txInsufficient));

    await expect(
      supplierInvoiceService.deleteSupplierInvoice({ userId: 1, invoiceId: 901 }),
    ).rejects.toThrow(/ya fue vendida o reubicada/);

    // 2) Anulación exitosa con Kardex inmutable ADJUSTMENT negativo
    const txValid = {
      purchaseOrder: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        updateMany: vi.fn().mockResolvedValue({ count: 1 }),
      },
      stockMovement: {
        findMany: vi.fn().mockResolvedValue([
          { id: 10, productId: 11, quantity: 8, productLotId: 77, userId: 1 },
        ]),
        create: vi.fn().mockResolvedValue({ id: 11 }),
        update: vi.fn().mockResolvedValue({}),
      },
      productLot: {
        findUnique: vi.fn().mockResolvedValue({ id: 77, stock: 8 }),
        update: vi.fn().mockResolvedValue({}),
      },
      product: { update: vi.fn().mockResolvedValue({}) },
      taxWithholding: { deleteMany: vi.fn().mockResolvedValue({}) },
      supplierInvoice: { delete: vi.fn().mockResolvedValue({}) },
    };
    prismaMock.$transaction.mockImplementationOnce(async (cb: any) => cb(txValid));

    await supplierInvoiceService.deleteSupplierInvoice({ userId: 1, invoiceId: 901 });

    expect(txValid.stockMovement.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          productId: 11,
          quantity: -8,
          type: 'ADJUSTMENT',
          referenceId: 'VOID-INV-901',
          productLotId: 77,
        }),
      }),
    );
    expect(txValid.stockMovement.update).toHaveBeenCalledWith({
      where: { id: 10 },
      data: { referenceId: 'VOIDED-INV-901' },
    });
    expect(txValid.purchaseOrder.updateMany).toHaveBeenCalledWith({
      where: { supplierInvoiceId: 901, status: 'RECEIVED' },
      data: { status: 'CANCELLED', supplierInvoiceId: null },
    });
  });

  it('recordPersonaPayment bloquea sobrepago y asienta retención practicada en el DEBE del proveedor', async () => {
    prismaMock.persona.findUnique.mockResolvedValue({
      id: 50,
      name: 'PROVEEDOR DEMO',
      isProvider: true,
      isClient: false,
    });

    // 1) Bloqueo de sobrepago (factura $1000 pendiente, intenta pagar $900 + retención $200 = $1100)
    const txOverpay = {
      supplierInvoice: {
        findUnique: vi.fn().mockResolvedValue({
          id: 905,
          personaId: 50,
          invoiceNumber: '0001-00000050',
          status: 'PENDING',
          totalAmount: 1000,
          paidAmount: 0,
        }),
      },
    };
    prismaMock.$transaction.mockImplementationOnce(async (cb: any) => cb(txOverpay));

    await expect(
      personaPaymentSubService.recordPersonaPayment(
        50,
        {
          supplierInvoiceId: 905,
          amount: 900,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          type: TransactionType.OUTCOME,
          retenciones: [{ taxType: 'IIBB', number: 'R-01', amount: 200 }],
        },
        1,
        'ADMIN',
      ),
    ).rejects.toThrow(/supera el saldo pendiente/);

    // 2) Pago exacto ($850 transferencia + $150 retención = $1000) -> PAID + RETENCION_PRACTICADA + DEBIT
    const txValidPay = {
      supplierInvoice: {
        findUnique: vi.fn().mockResolvedValue({
          id: 905,
          personaId: 50,
          invoiceNumber: '0001-00000050',
          status: 'PENDING',
          totalAmount: 1000,
          paidAmount: 0,
        }),
        update: vi.fn().mockResolvedValue({}),
      },
      bankAccount: {
        findFirst: vi.fn().mockResolvedValue({ id: 2 }),
        update: vi.fn().mockResolvedValue({}),
      },
      transaction: {
        create: vi.fn().mockResolvedValue({ id: 700, amount: 850 }),
      },
      taxWithholding: {
        create: vi.fn().mockResolvedValue({ id: 300, date: new Date('2026-11-18T12:00:00Z'), jurisdiction: 'AR-B' }),
      },
      persona: {
        findUniqueOrThrow: vi.fn().mockResolvedValue({ id: 50, outstandingBalance: 0 }),
      },
    };
    prismaMock.$transaction.mockImplementationOnce(async (cb: any) => cb(txValidPay));

    await personaPaymentSubService.recordPersonaPayment(
      50,
      {
        supplierInvoiceId: 905,
        amount: 850,
        paymentMethod: PaymentMethod.BANK_TRANSFER,
        type: TransactionType.OUTCOME,
        branch: 'A',
        retenciones: [{ taxType: 'IIBB', number: 'R-01', amount: 150 }],
      },
      1,
      'ADMIN',
    );

    expect(txValidPay.supplierInvoice.update).toHaveBeenCalledWith({
      where: { id: 905 },
      data: { paidAmount: 1000, status: 'PAID' },
    });
    expect(txValidPay.taxWithholding.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          type: 'RETENCION_PRACTICADA',
          taxType: 'IIBB',
          number: 'R-01',
          amount: 150,
        }),
      }),
    );
    expect(mockRecordLedgerMovement).toHaveBeenCalledWith(
      txValidPay,
      expect.objectContaining({
        personaId: 50,
        entryType: LedgerEntryType.DEBIT,
        sourceType: LedgerSourceType.TAX_WITHHOLDING,
        taxWithholdingId: 300,
        amount: 150,
      }),
    );
  });
});
