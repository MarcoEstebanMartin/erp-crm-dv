import { z } from 'zod';

export const createSaleRouteSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'El nombre de la ruta es requerido'),
    sellerId: z.union([z.number(), z.string()]).optional().nullable(),
    dayOfWeek: z.string().optional().nullable(),
  }),
});

export const updateSaleRouteSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID de la ruta debe ser numérico'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    sellerId: z.union([z.number(), z.string()]).optional().nullable(),
    dayOfWeek: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const updateSequenceSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID de la ruta debe ser numérico'),
  }),
  body: z.object({
    clientIds: z.array(z.number()).min(1, 'Debe proporcionar al menos un ID de cliente'),
  }),
});

export const recordRouteVisitSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID de la ruta debe ser numérico'),
  }),
  body: z.object({
    personaId: z.number().int('El ID del cliente debe ser un entero'),
    status: z.enum(['ORDERED', 'NO_BUY']),
    noBuyReason: z.string().optional().nullable(),
    notes: z.string().optional().nullable(),
    latitude: z.number().optional().nullable(),
    longitude: z.number().optional().nullable(),
  }),
});
