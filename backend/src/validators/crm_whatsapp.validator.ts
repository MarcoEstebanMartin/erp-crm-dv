import { z } from 'zod';

const draftItemInputSchema = z.object({
  productId: z.coerce.number().int().positive('productId debe ser un entero positivo'),
  quantity: z.coerce.number().int().positive('quantity debe ser un entero positivo'),
  weight: z.coerce.number().positive('weight debe ser positivo').optional(),
});

export const approveOrderDraftSchema = z.object({
  params: z.object({
    draftId: z.coerce.number().int().positive('draftId inválido'),
  }),
  body: z
    .object({
      items: z.array(draftItemInputSchema).min(1, 'Debe incluir al menos un ítem').optional(),
      billingType: z.enum(['OFFICIAL', 'INTERNAL']).optional(),
      notes: z.string().max(500).optional(),
    })
    .optional(),
});
