import { z } from 'zod';

export const parseAiOrderBodySchema = z.object({
  body: z
    .object({
      text: z.string().trim().max(8000, 'El texto es demasiado largo (máximo 8000 caracteres).').optional(),
      audioBase64: z.string().trim().max(12_000_000, 'El audio supera el límite permitido (9 MB).').optional(),
      audioMimeType: z.string().trim().max(100).optional(),
      selectedClientId: z.coerce.number().int().positive().optional(),
    })
    .refine(
      (data) => Boolean((data.text && data.text.length > 0) || (data.audioBase64 && data.audioBase64.length > 0)),
      { message: 'Debés enviar un texto o un audio para interpretar el pedido.' },
    ),
});

export const AI_ORDER_PARSE_JSON_SCHEMA: Record<string, any> = {
  type: 'object',
  properties: {
    detectedClientId: { type: ['integer', 'null'] },
    clientQuery: { type: ['string', 'null'] },
    items: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          productId: { type: 'integer' },
          quantity: { type: 'number' },
          note: { type: ['string', 'null'] },
        },
        required: ['productId', 'quantity'],
      },
    },
    unmatchedLines: {
      type: 'array',
      items: { type: 'string' },
    },
    orderNotes: { type: ['string', 'null'] },
  },
  required: ['detectedClientId', 'clientQuery', 'items', 'unmatchedLines', 'orderNotes'],
};

export const aiOrderParseResultValidator = z.object({
  detectedClientId: z.coerce.number().int().positive().nullable().optional().default(null),
  clientQuery: z.string().trim().nullable().optional().default(null),
  items: z
    .array(
      z.object({
        productId: z.coerce.number().int().positive(),
        quantity: z.coerce.number().positive(),
        note: z.string().trim().nullable().optional(),
      }),
    )
    .default([]),
  unmatchedLines: z.array(z.string().trim()).default([]),
  orderNotes: z.string().trim().nullable().optional().default(null),
});
