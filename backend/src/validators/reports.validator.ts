import { z } from 'zod';

const isoDateOptional = z
  .string()
  .trim()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Formato de fecha inválido (YYYY-MM-DD)')
  .optional()
  .or(z.literal(''));

const numericIdOptional = z
  .string()
  .trim()
  .regex(/^\d+$/, 'ID numérico inválido')
  .optional()
  .or(z.literal(''));

const yearOptional = z
  .string()
  .trim()
  .regex(/^\d{4}$/, 'Año inválido')
  .optional()
  .or(z.literal(''));

const monthOptional = z
  .string()
  .trim()
  .regex(/^(?:0?[1-9]|1[0-2])$/, 'Mes inválido (1-12)')
  .optional()
  .or(z.literal(''));

export const getFinancialReportsQuerySchema = z.object({
  query: z.object({
    year: yearOptional,
    month: monthOptional,
    startDate: isoDateOptional,
    endDate: isoDateOptional,
  }),
});

export const getProfitabilityQuerySchema = z.object({
  query: z.object({
    startDate: isoDateOptional,
    endDate: isoDateOptional,
    sellerId: numericIdOptional,
    city: z.string().trim().max(100, 'Localidad demasiado larga').optional().or(z.literal('')),
    rubroId: numericIdOptional,
    billingType: z.enum(['ALL', 'OFFICIAL', 'INTERNAL']).optional().or(z.literal('')),
  }),
});

export const getExecutiveReportQuerySchema = z.object({
  query: z.object({
    startDate: isoDateOptional,
    endDate: isoDateOptional,
  }),
});

export const getSellerMeetingQuerySchema = z.object({
  params: z.object({
    sellerId: z.string().trim().regex(/^\d+$/, 'ID de vendedor inválido'),
  }),
  query: z.object({
    startDate: isoDateOptional,
    endDate: isoDateOptional,
  }),
});

export const getZoneReportsQuerySchema = z.object({
  query: z.object({
    sellerId: numericIdOptional,
    city: z.string().trim().max(100, 'Localidad demasiado larga').optional().or(z.literal('')),
    cities: z.string().trim().max(1000, 'Lista de localidades demasiado larga').optional().or(z.literal('')),
    startDate: isoDateOptional,
    endDate: isoDateOptional,
  }),
});
