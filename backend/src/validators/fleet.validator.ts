import { z } from 'zod';

const nullablePositiveInt = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.coerce.number().int().positive().nullable().optional(),
);

export const fleetIdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID inválido.'),
  }),
});

export const createVehicleSchema = z.object({
  body: z.object({
    plate: z.string().trim().min(1, 'La patente es obligatoria.').max(30),
    brand: z.string().trim().min(1, 'La marca es obligatoria.').max(80),
    model: z.string().trim().min(1, 'El modelo es obligatorio.').max(80),
    year: z.coerce.number().int().min(1950).max(2100),
    currentOdometer: z.coerce.number().min(0),
    status: z.enum(['ACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE']).optional(),
    notes: z.string().max(2000).optional().nullable(),
  }),
});

export const updateVehicleSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de vehículo inválido.'),
  }),
  body: z.object({
    brand: z.string().trim().min(1).max(80).optional(),
    model: z.string().trim().min(1).max(80).optional(),
    year: z.coerce.number().int().min(1950).max(2100).optional(),
    currentOdometer: z.coerce.number().min(0).optional(),
    status: z.enum(['ACTIVE', 'MAINTENANCE', 'OUT_OF_SERVICE']).optional(),
    notes: z.string().max(2000).optional().nullable(),
  }),
});

export const createMaintenanceSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de vehículo inválido.'),
  }),
  body: z.object({
    type: z.enum(['SERVICE', 'REPAIR', 'FUEL', 'CLEANING', 'OTHER']),
    description: z.string().trim().min(1, 'La descripción es obligatoria.').max(2000),
    cost: z.coerce.number().min(0, 'El costo no puede ser negativo.'),
    odometer: z.coerce.number().min(0, 'El kilometraje no puede ser negativo.'),
    date: z.string().optional().nullable(),
    supplierId: nullablePositiveInt,
    affectFinance: z.boolean().optional(),
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK', 'OTHER']).optional(),
    bankAccountId: nullablePositiveInt,
    billingType: z.enum(['OFFICIAL', 'INTERNAL']).optional(),
  }),
});

export const createExpirySchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de vehículo inválido.'),
  }),
  body: z.object({
    type: z.enum(['INSURANCE', 'VTE_ITV', 'PATENT', 'CARNET', 'OTHER']),
    description: z.string().trim().min(1, 'La descripción es obligatoria.').max(500),
    expirationDate: z.string().min(1, 'La fecha de vencimiento es obligatoria.'),
  }),
});

export const updateExpirySchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de vencimiento inválido.'),
  }),
  body: z.object({
    type: z.enum(['INSURANCE', 'VTE_ITV', 'PATENT', 'CARNET', 'OTHER']).optional(),
    description: z.string().max(500).optional(),
    expirationDate: z.string().optional(),
  }),
});
