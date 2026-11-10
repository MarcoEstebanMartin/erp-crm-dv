import { z } from 'zod';

export const storeLoginSchema = z.object({
  body: z.object({
    cuitOrCode: z.string().max(120).optional(),
    search: z.string().max(120).optional(),
    pin: z.string().max(16).optional(),
    clientId: z.coerce.number().int().positive().optional(),
  }),
});

export const storeCatalogQuerySchema = z.object({
  query: z.object({
    priceList: z.string().max(30).optional(),
    rubroId: z.coerce.number().int().positive().optional(),
    search: z.string().max(120).optional(),
  }),
});

export const createStoreOrderSchema = z.object({
  body: z.object({
    personaId: z.coerce.number().int().positive('personaId inválido'),
    notes: z.string().max(1000).optional().nullable(),
    items: z
      .array(
        z.object({
          productId: z.coerce.number().int().positive('productId inválido'),
          quantity: z.coerce.number().int().min(1, 'La cantidad mínima es 1').max(10000),
          isEmergencyOverride: z.boolean().optional(),
        }),
      )
      .min(1, 'El pedido debe incluir al menos un artículo')
      .max(300, 'El pedido supera el máximo de renglones permitido'),
  }),
});
