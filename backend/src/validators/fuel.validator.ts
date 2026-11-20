import { z } from 'zod';

const optionalPositiveNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().positive('Debe ser mayor a 0.').optional(),
);

const nullablePositiveInt = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.coerce.number().int().positive().nullable().optional(),
);

export const createFuelLogSchema = z.object({
  body: z.object({
    vehicleId: z.coerce.number().int().positive('Vehículo requerido.'),
    odometer: z.coerce.number().int().min(0, 'Odómetro inválido.'),
    liters: z.coerce.number().positive('Litros debe ser mayor a 0.'),
    date: z.string().optional().nullable(),
    ticketNumber: z.string().trim().max(60).optional().nullable(),
    isFullTank: z.boolean().optional(),
    notes: z.string().trim().max(500).optional().nullable(),
  }),
});

export const settleFuelLogsSchema = z.object({
  body: z.object({
    logIds: z.array(z.coerce.number().int().positive()).min(1, 'Seleccioná al menos un ticket.'),
    dieselPricePerLiter: optionalPositiveNumber,
    naftaPricePerLiter: optionalPositiveNumber,
    dieselTotalCost: optionalPositiveNumber,
    naftaTotalCost: optionalPositiveNumber,
    settledDate: z.string().optional().nullable(),
    affectFinance: z.boolean().optional(),
    paymentMethod: z.enum(['CASH', 'TRANSFER', 'BANK_TRANSFER']).optional(),
    bankAccountId: nullablePositiveInt,
    billingType: z.enum(['OFFICIAL', 'INTERNAL']).optional(),
    notes: z.string().trim().max(300).optional().nullable(),
  }),
});
