import { z } from 'zod';

export const registerCollectionSchema = z.object({
  body: z.object({
    personaId: z.coerce.number().int().positive('Cliente requerido'),
    amount: z.coerce.number().positive('El monto debe ser mayor a cero'),
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK', 'OTHER']),
    billingType: z.enum(['OFFICIAL', 'INTERNAL']),
    description: z.string().max(500).optional().nullable(),
    orderId: z.coerce.number().int().positive().optional().nullable(),
    isCreditOnAccount: z.boolean().optional(),
    bankAccountId: z.coerce.number().int().positive().optional().nullable(),
    checkNumber: z.string().max(150).optional().nullable(),
  }),
});

export const verifyRendicionSchema = z.object({
  body: z
    .object({
      sellerId: z.coerce.number().int().positive().optional().nullable(),
      routeId: z.coerce.number().int().positive().optional().nullable(),
      realCash: z.coerce.number().min(0).optional(),
      realChecks: z.coerce.number().min(0).optional(),
      destinationDrawerId: z.coerce.number().int().positive().optional().nullable(),
      routeNote: z.string().max(500).optional().nullable(),
      notes: z.string().max(2000).optional().nullable(),
      declaredChecks: z.array(z.any()).optional(),
    })
    .refine((data) => Boolean(data.sellerId || data.routeId), {
      message: 'Debe especificar sellerId o routeId',
    }),
});
