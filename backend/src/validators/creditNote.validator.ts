import { z } from 'zod';

export const creditNoteIdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de Nota de Crédito inválido.'),
  }),
});

export const createCreditNoteSchema = z.object({
  body: z.object({
    personaId: z.coerce.number().int().positive('El cliente es obligatorio.'),
    orderId: z.coerce.number().int().positive().optional().nullable(),
    billingType: z.enum(['OFFICIAL', 'INTERNAL']).optional(),
    reason: z.string().trim().min(1, 'El motivo es obligatorio.').max(80),
    comments: z.string().max(1000).optional().nullable(),
    items: z
      .array(
        z.object({
          productId: z.coerce.number().int().positive('productId inválido.'),
          quantity: z.coerce.number().positive('La cantidad debe ser mayor a cero.'),
          weight: z.coerce.number().min(0).optional().nullable(),
          unitPrice: z.coerce.number().min(0, 'El precio unitario no puede ser negativo.'),
        }),
      )
      .min(1, 'Debe incluir al menos un ítem en la Nota de Crédito.'),
  }),
});
