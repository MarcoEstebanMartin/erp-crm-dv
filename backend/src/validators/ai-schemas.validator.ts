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
      enum: ['FACTURA_A', 'FACTURA_B', 'FACTURA_C', 'NOTA_CREDITO_A', 'NOTA_CREDITO_B', 'NOTA_CREDITO_C', 'REMITO'],
    },
    documentNumber: { type: 'string' },
    issueDate: { type: 'string' },
    dueDate: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          code: { type: ['string', 'null'] },
          ean: { type: ['string', 'null'] },
          description: { type: 'string' },
          quantity: { type: 'number' },
          unitOfMeasure: { type: ['string', 'null'] },
          unitsPerPack: { type: 'number' },
          unitPrice: { type: 'number' },
          subtotal: { type: 'number' },
          isNonStock: { type: 'boolean' },
        },
        required: [
          'code',
          'ean',
          'description',
          'quantity',
          'unitOfMeasure',
          'unitsPerPack',
          'unitPrice',
          'subtotal',
          'isNonStock',
        ],
      },
    },
    netAmount: { type: 'number' },
    taxAmount: { type: 'number' },
    impuestosInternos: { type: 'number' },
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
    'dueDate',
    'items',
    'netAmount',
    'taxAmount',
    'impuestosInternos',
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

const safePackUnits = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((val) => {
    const num = Math.trunc(Number(val ?? 1));
    if (!Number.isFinite(num) || num < 1) return 1;
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
  dueDate: z.string().trim().nullable().optional().transform((v) => (v && /^\d{4}-\d{2}-\d{2}/.test(v) ? v.slice(0, 10) : null)),
  items: z
    .array(
      z.object({
        code: z.string().trim().nullable().optional().transform((v) => (v ? v : null)),
        ean: z
          .string()
          .trim()
          .nullable()
          .optional()
          .transform((v) => {
            if (!v) return null;
            const digits = v.replace(/\D/g, '');
            return digits.length >= 8 ? digits : null;
          }),
        description: z.string().trim().default('Artículo'),
        quantity: safeQuantity,
        unitOfMeasure: z
          .string()
          .trim()
          .nullable()
          .optional()
          .transform((v) => (v ? v.toUpperCase() : null)),
        unitsPerPack: safePackUnits.default(1),
        unitPrice: safeNonNegativeMoney,
        subtotal: safeNonNegativeMoney,
        isNonStock: z.coerce.boolean().default(false),
      }),
    )
    .default([]),
  netAmount: safeNonNegativeMoney,
  taxAmount: safeNonNegativeMoney,
  impuestosInternos: safeNonNegativeMoney.default(0),
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
