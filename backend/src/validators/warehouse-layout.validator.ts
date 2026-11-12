import { z } from 'zod';
import {
  VALID_CHAMBER_CODES,
  VALID_LEVEL_PRESETS,
  VALID_WAREHOUSE_IDS,
} from '../engines/warehouse-layout.engine';

export const upsertWarehouseCellSchema = z.object({
  body: z
    .object({
      depId: z.enum(VALID_WAREHOUSE_IDS),
      row: z.number().int().min(1).max(32),
      col: z.number().int().min(1).max(23),
      isStorage: z.boolean(),
      levels: z.string().trim().max(40).optional().default('A'),
      chamber: z.enum(VALID_CHAMBER_CODES).optional().default('GENERAL'),
      label: z.string().trim().max(60).optional().nullable(),
      fill: z
        .string()
        .trim()
        .regex(/^#[0-9A-Fa-f]{3,6}$/, 'Color hexadecimal inválido')
        .optional()
        .nullable(),
      isBlocked: z.boolean().optional().default(false),
      maxUnits: z.number().int().min(1).max(100000).optional().nullable(),
    })
    .superRefine((val, ctx) => {
      if (val.isStorage && !(VALID_LEVEL_PRESETS as readonly string[]).includes(val.levels)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['levels'],
          message: `Los niveles de un Slot deben ser uno de: ${VALID_LEVEL_PRESETS.join(', ')}`,
        });
      }
    }),
});

export const resetWarehouseCellSchema = z.object({
  params: z.object({
    code: z
      .string()
      .trim()
      .regex(/^D\d+-R\d{2}-C\d{2}$/, 'Código de celda inválido (ej: D1-R01-C04)'),
  }),
  body: z
    .object({
      fallbackBlueprint: z
        .object({
          isStorage: z.boolean(),
          levels: z.string().trim().max(40),
        })
        .optional(),
    })
    .optional(),
});
