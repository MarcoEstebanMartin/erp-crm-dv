import { z } from 'zod';

export const positiveIdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID inválido'),
  }),
});

export const createDiscountRuleSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'El nombre de la regla es obligatorio').max(160).optional(),
    discountPercentage: z.coerce.number().min(0).max(100),
    personaId: z.coerce.number().int().positive().nullable().optional(),
    productId: z.coerce.number().int().positive().nullable().optional(),
    rubroId: z.coerce.number().int().positive().nullable().optional(),
    billingType: z.enum(['OFFICIAL', 'INTERNAL']).nullable().optional(),
    priceList: z.string().max(20).nullable().optional(),
    minQuantity: z.coerce.number().int().min(0).nullable().optional(),
    isActive: z.boolean().optional(),
  }).passthrough(),
});

export const createSplitBillingSchema = z.object({
  body: z
    .object({
      rubroId: z.coerce.number().int().positive('rubroId debe ser entero positivo'),
      percentageOfficial: z.coerce.number().min(0).max(100),
      percentageInternal: z.coerce.number().min(0).max(100),
      isActive: z.boolean().optional(),
    })
    .refine(
      (data) => Math.abs(data.percentageOfficial + data.percentageInternal - 100) < 0.01,
      { message: 'La suma de percentageOfficial + percentageInternal debe ser exactamente 100%.' },
    ),
});

export const updatePerceptionSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de percepción inválido'),
  }),
  body: z.object({
    name: z.string().trim().min(1).max(120).optional(),
    aliquot: z.coerce.number().min(0, 'La alícuota no puede ser negativa').max(100, 'La alícuota no puede superar 100%').optional(),
    isActive: z.boolean().optional(),
    description: z.string().max(300).nullable().optional(),
  }).passthrough(),
});

export const webChatMessageSchema = z.object({
  body: z.object({
    message: z.string().max(4000, 'Mensaje demasiado largo').optional(),
    history: z.array(z.any()).max(30, 'Historial excede el máximo permitido').optional(),
    mediaBase64: z.string().max(8 * 1024 * 1024, 'Archivo adjunto excede el límite').nullable().optional(),
    mediaMimeType: z.string().max(80).nullable().optional(),
  }).passthrough(),
});

export const addClientToRouteSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de ruta inválido'),
  }),
  body: z.object({
    clientId: z.coerce.number().int().positive('clientId inválido').optional(),
    personaId: z.coerce.number().int().positive('personaId inválido').optional(),
  }).refine((b) => Boolean(b.clientId || b.personaId), {
    message: 'Se requiere clientId o personaId válido.',
  }),
});

export const removeClientFromRouteSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de ruta inválido'),
    clientId: z.coerce.number().int().positive('ID de cliente inválido'),
  }),
});
