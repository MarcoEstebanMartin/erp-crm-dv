import { z } from 'zod';

const safeNumericPreprocess = (defaultValue = 0) => 
  z.preprocess(val => {
    if (val === '' || val === null || val === undefined) return defaultValue;
    const num = Number(val);
    return isNaN(num) ? defaultValue : num;
  }, z.number());

const safeNullableNumericPreprocess = () => 
  z.preprocess(val => {
    if (val === '' || val === null || val === undefined) return null;
    const num = Number(val);
    return isNaN(num) ? null : num;
  }, z.number().nullable());

export const createPersonaSchema = z.object({
  body: z.object({
    name: z.string().min(1, 'El nombre o razón social es requerido'),
    cuit: z.string().optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    route: z.string().optional().nullable(),
    saleRouteId: safeNullableNumericPreprocess().optional(),
    routeSequence: safeNullableNumericPreprocess().optional(),
    phone: z.string().optional().nullable(),
    email: z.string().email('Debe ser un email válido').optional().nullable().or(z.literal('')),
    isClient: z.boolean().optional(),
    isProvider: z.boolean().optional(),
    isSeller: z.boolean().optional(),
    isCommissionAgent: z.boolean().optional(),
    creditLimit: safeNumericPreprocess(0).refine(val => val >= 0, 'El límite de crédito debe ser mayor o igual a 0').optional(),
    priceList: z.string().optional().nullable(),
    discount: safeNumericPreprocess(0).refine(val => val >= 0 && val <= 100, 'El descuento debe estar entre 0 y 100').optional(),
    contacts: z.any().optional(),
    sellerId: z.union([z.number(), z.string()]).optional().nullable(),
    paymentTermDays: safeNumericPreprocess(30).refine(val => val >= 0, 'El plazo de pago debe ser mayor o igual a 0').optional(),
    isActive: z.boolean().optional(),
    rubro: z.string().optional().nullable(),
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
    route: z.string().optional().nullable(),
    saleRouteId: safeNullableNumericPreprocess().optional(),
    routeSequence: safeNullableNumericPreprocess().optional(),
    phone: z.string().optional().nullable(),
    email: z.string().email('Debe ser un email válido').optional().nullable().or(z.literal('')),
    isClient: z.boolean().optional(),
    isProvider: z.boolean().optional(),
    isSeller: z.boolean().optional(),
    isCommissionAgent: z.boolean().optional(),
    creditLimit: safeNumericPreprocess(0).refine(val => val >= 0, 'El límite de crédito debe ser mayor o igual a 0').optional(),
    priceList: z.string().optional().nullable(),
    discount: safeNumericPreprocess(0).refine(val => val >= 0 && val <= 100, 'El descuento debe estar entre 0 y 100').optional(),
    contacts: z.any().optional(),
    sellerId: z.union([z.number(), z.string()]).optional().nullable(),
    paymentTermDays: safeNumericPreprocess(30).refine(val => val >= 0, 'El plazo de pago debe ser mayor o igual a 0').optional(),
    isActive: z.boolean().optional(),
    rubro: z.string().optional().nullable(),
  }),
});

export const recordPersonaPaymentSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser numérico'),
  }),
  body: z.object({
    amount: z.number().positive('El monto debe ser mayor a cero').optional(),
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']).optional(),
    payments: z.array(z.object({
      amount: z.number().positive('El monto debe ser mayor a cero'),
      paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']),
      bankAccountId: z.union([z.number(), z.string()]).optional().nullable(),
      description: z.string().optional(),
    })).optional(),
    description: z.string().optional(),
    branch: z.enum(['A', 'X']).optional(),
    type: z.enum(['INCOME', 'OUTCOME']).optional(),
    supplierInvoiceId: z.union([z.number(), z.string()]).optional().nullable(),
    orderId: z.number().optional().nullable(),
    bankAccountId: z.union([z.number(), z.string()]).optional().nullable(),
    retenciones: z.array(z.object({
      taxType: z.enum(['GANANCIAS', 'IIBB']),
      number: z.string(),
      amount: z.number().positive('El monto de la retención debe ser mayor a cero'),
    })).optional(),
  }),
});

export const recordVisitSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser numérico'),
  }),
  body: z.object({
    reason: z.string().min(1, 'El motivo es requerido'),
    notes: z.string().optional().nullable(),
  }),
});
