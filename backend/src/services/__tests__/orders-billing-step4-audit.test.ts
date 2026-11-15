import { beforeEach, describe, expect, it, vi } from 'vitest';
import { BillingType, OrderStatus, PaymentMethod, Role, SalesChannel } from '@prisma/client';

vi.mock('../../utils/audit', () => ({
  logAudit: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../order.service', () => ({
  OrderService: {
    createOrder: vi.fn(),
    updateOrderWeights: vi.fn(),
    confirmArmado: vi.fn(),
  },
}));

vi.mock('../orders/order-billing.service', () => ({
  OrderBillingService: {
    invoiceOrder: vi.fn(),
    requestCaeForOrder: vi.fn(),
  },
}));

vi.mock('../orders/order-queries.service', () => ({
  OrderQueriesService: {
    getOrders: vi.fn(),
    getOrderById: vi.fn(),
  },
}));

vi.mock('../orders/order-status.service', () => ({
  OrderStatusService: {
    updateOrderStatus: vi.fn(),
  },
}));

vi.mock('../orders/order-edit.service', () => ({
  OrderEditService: {
    updateOrder: vi.fn(),
  },
}));

vi.mock('../directInvoice.service', () => ({
  DirectInvoiceService: {
    createDirectInvoice: vi.fn(),
  },
}));

import {
  confirmArmadoSchema,
  createDirectInvoiceSchema,
  createOrderSchema,
  invoiceOrderSchema,
  updateOrderStatusSchema,
  updateOrderWeightsSchema,
} from '../../validators/order.validator';
import {
  confirmArmado,
  createOrder,
  requestCaeForOrder,
  updateOrderWeights,
} from '../../controllers/order.controller';
import { OrderService } from '../order.service';
import { OrderBillingService } from '../orders/order-billing.service';
import { formatAfipCurrency } from '../ivaExport.service';
import {
  buildMonthDateStrings,
  formatArDateDDMMYYYY,
  formatArDateYYYYMMDD,
  formatUtcDateYYYYMMDD,
  getAfipDocNumber,
  getAfipDocType,
  getAfipVoucherType,
  padString,
  parseInvoiceNumber,
} from '../billing/iva-afip-format.helper';

function makeMockRes() {
  const res: any = {
    statusCode: 200,
    payload: null,
    status: vi.fn((code: number) => {
      res.statusCode = code;
      return res;
    }),
    json: vi.fn((body: unknown) => {
      res.payload = body;
      return res;
    }),
  };
  return res;
}

describe('Paso 4A - Contratos Zod de Pedidos (order.validator.ts)', () => {
  it('updateOrderWeightsSchema valida body.items [{ orderItemId, weight }] usado por frontend y servicio', () => {
    const valid = updateOrderWeightsSchema.safeParse({
      params: { id: '42' },
      body: {
        items: [{ orderItemId: 10, weight: 3.425 }],
      },
    });
    expect(valid.success).toBe(true);

    const legacyMismatch = updateOrderWeightsSchema.safeParse({
      params: { id: '42' },
      body: { itemWeights: { '10': 3.425 } },
    });
    expect(legacyMismatch.success).toBe(false);

    const emptyItems = updateOrderWeightsSchema.safeParse({
      params: { id: '42' },
      body: { items: [] },
    });
    expect(emptyItems.success).toBe(false);

    const badParam = updateOrderWeightsSchema.safeParse({
      params: { id: 'abc' },
      body: { items: [{ orderItemId: 10, weight: 1.2 }] },
    });
    expect(badParam.success).toBe(false);
  });

  it('confirmArmadoSchema acepta faltantes en 0 y pesos en 0 para productos ajustados en báscula', () => {
    const validFaltante = confirmArmadoSchema.safeParse({
      params: { id: '95' },
      body: {
        items: [
          { orderItemId: 1, quantity: 0, weight: 0 },
          { orderItemId: 2, quantity: 3, weight: 4.5 },
        ],
      },
    });
    expect(validFaltante.success).toBe(true);

    const negativeQty = confirmArmadoSchema.safeParse({
      params: { id: '95' },
      body: { items: [{ orderItemId: 1, quantity: -1 }] },
    });
    expect(negativeQty.success).toBe(false);
  });

  it('createOrderSchema acepta personaId o clientId y rechaza payloads sin cliente', () => {
    const byClientId = createOrderSchema.safeParse({
      body: {
        clientId: 7,
        billingType: BillingType.INTERNAL,
        salesChannel: SalesChannel.MOSTRADOR,
        notes: null,
        items: [{ productId: 5, quantity: 2, weight: null }],
      },
    });
    expect(byClientId.success).toBe(true);

    const missingClient = createOrderSchema.safeParse({
      body: {
        items: [{ productId: 5, quantity: 1 }],
      },
    });
    expect(missingClient.success).toBe(false);
  });

  it('invoiceOrderSchema, createDirectInvoiceSchema y updateOrderStatusSchema validan campos operativos', () => {
    expect(
      invoiceOrderSchema.safeParse({
        params: { id: '15' },
        body: {
          billingType: BillingType.OFFICIAL,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          bankAccountId: null,
          deferCae: false,
        },
      }).success,
    ).toBe(true);

    expect(
      createDirectInvoiceSchema.safeParse({
        body: {
          personaId: 12,
          billingType: BillingType.INTERNAL,
          paymentMethod: PaymentMethod.CHECK,
          checkNumber: '00045122',
          checkAmount: 15000,
          items: [{ productId: 3, quantity: 4, weight: null }],
        },
      }).success,
    ).toBe(true);

    expect(
      updateOrderStatusSchema.safeParse({
        params: { id: '15' },
        body: {
          status: OrderStatus.PREPARED,
          bultosCount: 2,
        },
      }).success,
    ).toBe(true);
  });
});

describe('Paso 4A - Helpers AFIP extraídos (iva-afip-format.helper.ts)', () => {
  it('mantiene formatAfipCurrency re-exportado desde ivaExport.service con Decimal.js', () => {
    expect(formatAfipCurrency('1234.5')).toBe('000000000123450');
    expect(formatAfipCurrency(-12.34, 15)).toBe('-00000000001234');
    expect(formatAfipCurrency(null, 8)).toBe('00000000');
  });

  it('calcula fechas de período fiscal incluyendo años bisiestos y valida rango', () => {
    expect(buildMonthDateStrings(2, 2024)).toEqual({
      startDateStr: '2024-02-01',
      endDateStr: '2024-02-29',
    });
    expect(() => buildMonthDateStrings(13, 2024)).toThrow('Período fiscal inválido');
  });

  it('normaliza documentos, comprobantes, strings y fechas AFIP', () => {
    expect(getAfipDocType('30-71512345-9')).toBe('80');
    expect(getAfipDocType('35123456')).toBe('96');
    expect(getAfipDocType(undefined)).toBe('99');
    expect(getAfipDocNumber('30-71512345-9')).toBe('00000000030715123459');
    expect(getAfipVoucherType('FACTURA_B')).toBe('006');
    expect(getAfipVoucherType('NOTA_CREDITO_C')).toBe('013');
    expect(parseInvoiceNumber('00003-00000125')).toEqual({
      ptoVenta: '00003',
      cbte: '00000000000000000125',
    });
    expect(padString('Ángel & Cía', 12)).toBe('Angel & Cia ');

    const dt = new Date('2026-04-05T15:30:00.000Z');
    expect(formatArDateYYYYMMDD(dt)).toBe('20260405');
    expect(formatArDateDDMMYYYY(dt)).toBe('05/04/2026');
    expect(formatUtcDateYYYYMMDD(dt)).toBe('20260405');
  });
});

describe('Paso 4A - Controlador delgado de pedidos (order.controller.ts)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exige autenticación (401) y roles autorizados (403)', async () => {
    const unauthRes = makeMockRes();
    await updateOrderWeights({ params: { id: '5' }, body: { items: [] } } as any, unauthRes);
    expect(unauthRes.statusCode).toBe(401);

    const forbiddenRes = makeMockRes();
    await updateOrderWeights(
      { user: { id: 9, role: Role.VENDEDOR }, params: { id: '5' }, body: { items: [] } } as any,
      forbiddenRes,
    );
    expect(forbiddenRes.statusCode).toBe(403);

    const caeForbidden = makeMockRes();
    await requestCaeForOrder(
      { user: { id: 9, role: Role.DEPOSITO }, params: { id: '5' } } as any,
      caeForbidden,
    );
    expect(caeForbidden.statusCode).toBe(403);
  });

  it('delega confirmArmado pasando [] por defecto cuando body.items no viene informado', async () => {
    vi.mocked(OrderService.confirmArmado).mockResolvedValue({
      id: 77,
      totalAmount: 15000,
      status: OrderStatus.PREPARED,
    } as any);

    const res = makeMockRes();
    await confirmArmado(
      { user: { id: 2, role: Role.DEPOSITO }, params: { id: '77' }, body: {} } as any,
      res,
    );

    expect(OrderService.confirmArmado).toHaveBeenCalledWith(77, []);
    expect(res.statusCode).toBe(200);
    expect(res.payload?.status).toBe('success');
  });

  it('createOrder acepta clientId cuando personaId no viene explícito y respeta errores del servicio', async () => {
    vi.mocked(OrderService.createOrder).mockResolvedValue({
      id: 88,
      personaId: 14,
      totalAmount: 5400,
      status: OrderStatus.PENDING,
    } as any);

    const res = makeMockRes();
    await createOrder(
      {
        user: { id: 3, role: Role.VENDEDOR },
        body: { clientId: 14, items: [{ productId: 1, quantity: 2 }] },
      } as any,
      res,
    );

    expect(OrderService.createOrder).toHaveBeenCalledWith(
      expect.objectContaining({ sellerId: 3, personaId: 14 }),
    );
    expect(res.statusCode).toBe(201);

    vi.mocked(OrderBillingService.requestCaeForOrder).mockRejectedValue(new Error('AFIP offline'));
    const caeErr = makeMockRes();
    await requestCaeForOrder(
      { user: { id: 1, role: Role.ADMIN }, params: { id: '88' } } as any,
      caeErr,
    );
    expect(caeErr.statusCode).toBe(400);
    expect(caeErr.payload?.message).toBe('Error AFIP al solicitar CAE: AFIP offline');
  });
});
