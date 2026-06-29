import { z } from 'zod';

export const createPersonaSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'El nombre o razón social es requerido'),
    cuit: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email('Debe ser un email válido').optional().nullable().or(z.literal('')),
    isClient: z.boolean().optional(),
    isProvider: z.boolean().optional(),
    isSeller: z.boolean().optional(),
    isCommissionAgent: z.boolean().optional(),
    creditLimit: z.number().min(0).optional(),
    priceList: z.enum(['A', 'B', 'C']).optional(),
    discount: z.number().min(0).max(100).optional(),
    contacts: z.any().optional(),
    sellerId: z.union([z.number(), z.string()]).optional().nullable(),
  }),
});

export const updatePersonaSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser numérico'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    cuit: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    phone: z.string().optional().nullable(),
    email: z.string().email().optional().nullable().or(z.literal('')),
    isClient: z.boolean().optional(),
    isProvider: z.boolean().optional(),
    isSeller: z.boolean().optional(),
    isCommissionAgent: z.boolean().optional(),
    creditLimit: z.number().min(0).optional(),
    priceList: z.enum(['A', 'B', 'C']).optional(),
    discount: z.number().min(0).max(100).optional(),
    contacts: z.any().optional(),
    sellerId: z.union([z.number(), z.string()]).optional().nullable(),
  }),
});

export const recordPersonaPaymentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser numérico'),
  }),
  body: z.object({
    amount: z.number().positive('El monto debe ser mayor a cero'),
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']),
    description: z.string().optional(),
    branch: z.enum(['A', 'X']).optional(),
    type: z.enum(['INCOME', 'OUTCOME']).optional(),
    supplierInvoiceId: z.union([z.number(), z.string()]).optional().nullable(),
  }),
});
