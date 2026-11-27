import { z } from 'zod';

const isoDateRegex = /^\d{4}-\d{2}-\d{2}$/;

const manualPurchaseItemSchema = z.object({
  id: z.string().min(1).max(64),
  company: z.string().trim().min(1, 'Ingresá un concepto o proveedor').max(120),
  date: z.string().regex(isoDateRegex, 'Fecha inválida (YYYY-MM-DD)'),
  amount: z.coerce.number().finite(),
});

const manualSaleItemSchema = z.object({
  id: z.string().min(1).max(64),
  locality: z.string().trim().min(1, 'Ingresá una localidad').max(120),
  date: z.string().regex(isoDateRegex, 'Fecha inválida (YYYY-MM-DD)'),
  amountA: z.coerce.number().finite(),
  amountX: z.coerce.number().finite(),
});

export const getWeeklyPulseQuerySchema = z.object({
  query: z.object({
    weekStart: z
      .string()
      .regex(isoDateRegex, 'weekStart debe tener formato YYYY-MM-DD')
      .optional(),
  }),
});

export const saveWeeklyPulseSchema = z.object({
  body: z.object({
    weekStart: z.string().regex(isoDateRegex, 'weekStart debe tener formato YYYY-MM-DD'),
    resultBuffer: z.coerce.number().finite().min(0, 'El resultado no puede ser negativo'),
    manualOpeningCredit: z.union([z.coerce.number().finite(), z.null()]).optional(),
    manualPurchases: z.array(manualPurchaseItemSchema).max(100).default([]),
    manualSales: z.array(manualSaleItemSchema).max(100).default([]),
    excludedSourceKeys: z.array(z.string().min(1).max(80)).max(200).default([]),
  }),
});

export type SaveWeeklyPulseBody = z.infer<typeof saveWeeklyPulseSchema>['body'];
