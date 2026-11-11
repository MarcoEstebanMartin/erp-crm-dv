import { z } from 'zod';
import { roundToIntegerPeso, roundToTwoDecimals } from '../core/money';

export const INVOICE_EXTRACTION_JSON_SCHEMA: Record<string, any> = {
  type: 'object',
  properties: {
    supplierName: { type: 'string' },
    cuit: { type: ['string', 'null'] },
    receiverCuit: { type: ['string', 'null'] },
    receiverName: { type: ['string', 'null'] },
    documentType: {
      type: 'string',
      enum: ['FACTURA_A', 'FACTURA_B', 'FACTURA_C', 'REMITO'],
    },
    documentNumber: { type: 'string' },
    issueDate: { type: 'string' },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: ['string', 'null'] },
          description: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          subtotal: { type: 'number' },
        },
        required: ['code', 'description', 'quantity', 'unitPrice', 'subtotal'],
      },
    },
    netAmount: { type: 'number' },
    taxAmount: { type: 'number' },
    percepcionAmount: { type: 'number' },
    percepcionIIBBAmount: { type: 'number' },
    percepcionIvaAmount: { type: 'number' },
    percepcionIva5329Amount: { type: 'number' },
    percepcionJurisdiction: { type: ['string', 'null'] },
    totalAmount: { type: 'number' },
  },
  required: [
    'supplierName',
    'cuit',
    'receiverCuit',
    'receiverName',
    'documentType',
    'documentNumber',
    'issueDate',
    'items',
    'netAmount',
    'taxAmount',
    'percepcionAmount',
    'percepcionIIBBAmount',
    'percepcionIvaAmount',
    'percepcionIva5329Amount',
    'percepcionJurisdiction',
    'totalAmount',
  ],
};

const safeNonNegativeMoney = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    const num = Number(val ?? 0);
    if (!Number.isFinite(num) || num < 0) return 0;
    return roundToTwoDecimals(num).toNumber();
  });

const safeQuantity = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    const num = Number(val ?? 0);
    if (!Number.isFinite(num) || num < 0) return 0;
    return num;
  });

export const extractedInvoiceValidator = z.object({
  supplierName: z.string().trim().default('Proveedor Sin Nombre'),
  cuit: z.string().trim().nullable().optional().transform((v) => (v ? v : null)),
  receiverCuit: z.string().trim().nullable().optional().transform((v) => (v ? v : null)),
  receiverName: z.string().trim().nullable().optional().transform((v) => (v ? v : null)),
  documentType: z.string().trim().default('FACTURA_A'),
  documentNumber: z.string().trim().default('0000-00000000'),
  issueDate: z.string().trim().default(() => new Date().toISOString().slice(0, 10)),
  items: z
    .array(
      z.object({
        code: z.string().trim().nullable().optional().transform((v) => (v ? v : null)),
        description: z.string().trim().default('Artículo'),
        quantity: safeQuantity,
        unitPrice: safeNonNegativeMoney,
        subtotal: safeNonNegativeMoney,
      }),
    )
    .default([]),
  netAmount: safeNonNegativeMoney,
  taxAmount: safeNonNegativeMoney,
  percepcionAmount: safeNonNegativeMoney,
  percepcionIIBBAmount: safeNonNegativeMoney,
  percepcionIvaAmount: safeNonNegativeMoney,
  percepcionIva5329Amount: safeNonNegativeMoney,
  percepcionJurisdiction: z
    .string()
    .trim()
    .nullable()
    .optional()
    .transform((v) => (v ? v : null)),
  totalAmount: safeNonNegativeMoney,
});

export const PARSED_ORDER_ITEMS_JSON_SCHEMA: Record<string, any> = {
  type: 'object',
  properties: {
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'integer' },
          quantity: { type: 'number' },
          note: { type: 'string' },
        },
        required: ['productId', 'quantity'],
      },
    },
  },
  required: ['items'],
};

export const parsedOrderItemsValidator = z.object({
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().positive(),
        note: z.string().optional(),
      }),
    )
    .default([]),
});

export const CHATBOT_RESPONSE_JSON_SCHEMA: Record<string, any> = {
  type: 'object',
  properties: {
    text: { type: 'string' },
    intent: {
      type: 'string',
      enum: [
        'CATALOG_INQUIRY',
        'ORDER_DRAFT',
        'RECEIPT_OCR',
        'TRANSFER_TO_HUMAN',
        'GENERAL_TALK',
      ],
    },
    draftOrderItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'integer' },
          productName: { type: 'string' },
          sku: { type: 'string' },
          quantity: { type: 'number' },
          unitPrice: { type: 'number' },
          subtotal: { type: 'number' },
        },
        required: ['productId', 'productName', 'sku', 'quantity', 'unitPrice', 'subtotal'],
      },
    },
    transferToHuman: { type: 'boolean' },
  },
  required: ['text', 'intent', 'draftOrderItems', 'transferToHuman'],
};

export const chatbotResponseValidator = z.object({
  text: z.string().default(''),
  intent: z
    .enum([
      'CATALOG_INQUIRY',
      'ORDER_DRAFT',
      'RECEIPT_OCR',
      'TRANSFER_TO_HUMAN',
      'GENERAL_TALK',
    ])
    .default('GENERAL_TALK'),
  draftOrderItems: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        productName: z.string().default('Producto'),
        sku: z.string().default(''),
        quantity: z.coerce.number().positive(),
        unitPrice: z.coerce
          .number()
          .min(0)
          .transform((v) => roundToIntegerPeso(v).toNumber()),
        subtotal: z.coerce
          .number()
          .min(0)
          .transform((v) => roundToIntegerPeso(v).toNumber()),
      }),
    )
    .default([]),
  transferToHuman: z.coerce.boolean().default(false),
});

export function parseStructuredJsonText(rawText: string): unknown {
  const cleaned = rawText
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();
  return JSON.parse(cleaned);
}
