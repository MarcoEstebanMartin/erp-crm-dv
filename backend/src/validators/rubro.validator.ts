import { z } from 'zod';

const pickingZoneEnum = z.enum(['FRIO', 'TABLA', 'CAJAS']);

export const createRubroSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'El nombre del rubro es requerido.'),
    description: z.string().optional().nullable(),
    profitMargin: z.coerce.number().min(0.01, 'El factor de rentabilidad debe ser positivo.').optional(),
    pickingZone: pickingZoneEnum.optional(),
  }),
});

export const updateRubroSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID del rubro debe ser numérico.'),
  }),
  body: z.object({
    name: z.string().trim().min(1, 'El nombre del rubro no puede estar vacío.').optional(),
    description: z.string().optional().nullable(),
    profitMargin: z.coerce.number().min(0.01, 'El factor de rentabilidad debe ser positivo.').optional(),
    pickingZone: pickingZoneEnum.optional(),
  }),
});

export const deleteRubroSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID del rubro debe ser numérico.'),
  }),
});
