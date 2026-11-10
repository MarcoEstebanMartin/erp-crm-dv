import { z } from 'zod';

export const createCategorySchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'El nombre de la categoría es obligatorio.').max(120),
    description: z.string().max(500).optional().nullable(),
  }),
});

export const createExpenseSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive('El monto debe ser un número mayor a cero.'),
    categoryId: z.coerce.number().int().positive('La categoría es obligatoria.'),
    description: z.string().trim().min(1, 'La descripción es obligatoria.').max(500),
    date: z.string().optional().nullable(),
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK', 'OTHER']),
    cashDrawerId: z.coerce.number().int().positive().optional().nullable(),
    bankAccountId: z.coerce.number().int().positive().optional().nullable(),
    vehicleId: z.coerce.number().int().positive().optional().nullable(),
    billingType: z.string().optional().nullable(),
  }),
});

export const createBulkExpensesSchema = z.object({
  body: z.object({
    expenses: z.array(z.any()).min(1, 'Debe enviar al menos un gasto para registrar en lote.'),
    targetDate: z.string().optional().nullable(),
  }),
});
