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
    taxCondition: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'CONSUMIDOR_FINAL']).optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    barrio: z.string().optional().nullable(),
    route: z.string().optional().nullable(),
    saleRouteId: safeNullableNumericPreprocess().optional(),
    routeSequence: safeNullableNumericPreprocess().optional(),
    latitude: safeNullableNumericPreprocess()
      .refine((val) => val === null || (val >= -90 && val <= 90), 'Latitud inválida')
      .optional(),
    longitude: safeNullableNumericPreprocess()
      .refine((val) => val === null || (val >= -180 && val <= 180), 'Longitud inválida')
      .optional(),
    phone: z.string().optional().nullable(),
    email: z.string().email('Debe ser un email válido').optional().nullable().or(z.literal('')),
    isClient: z.boolean().optional(),
    isProvider: z.boolean().optional(),
    providerType: z.enum(['MERCADERIA', 'RODADOS', 'SERVICIOS']).optional(),
    isSeller: z.boolean().optional(),
    isCommissionAgent: z.boolean().optional(),
    creditLimit: safeNumericPreprocess(0).refine(val => val >= 0, 'El límite de crédito debe ser mayor o igual a 0').optional(),
    maxUnpaidInvoices: safeNumericPreprocess(0)
      .refine((val) => val >= 0 && val <= 2, 'El límite de boletas debe estar entre 0 y 2')
      .optional(),
    priceList: z.string().optional().nullable(),
    discount: safeNumericPreprocess(0).refine(val => val >= 0 && val <= 100, 'El descuento debe estar entre 0 y 100').optional(),
    contacts: z.any().optional(),
    sellerId: z.union([z.number(), z.string()]).optional().nullable(),
    paymentTermDays: safeNumericPreprocess(30).refine(val => val >= 0, 'El plazo de pago debe ser mayor o igual a 0').optional(),
    webPin: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    rubro: z.string().optional().nullable(),
    hireDate: z.string().optional().nullable().or(z.literal('')),
    trustTags: z.array(z.string().trim().min(1).max(60)).max(5).optional(),
  }),
});

export const updatePersonaSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser numérico'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    cuit: z.string().optional().nullable(),
    taxCondition: z.enum(['RESPONSABLE_INSCRIPTO', 'MONOTRIBUTO', 'EXENTO', 'CONSUMIDOR_FINAL']).optional().nullable(),
    address: z.string().optional().nullable(),
    city: z.string().optional().nullable(),
    barrio: z.string().optional().nullable(),
    route: z.string().optional().nullable(),
    saleRouteId: safeNullableNumericPreprocess().optional(),
    routeSequence: safeNullableNumericPreprocess().optional(),
    latitude: safeNullableNumericPreprocess()
      .refine((val) => val === null || (val >= -90 && val <= 90), 'Latitud inválida')
      .optional(),
    longitude: safeNullableNumericPreprocess()
      .refine((val) => val === null || (val >= -180 && val <= 180), 'Longitud inválida')
      .optional(),
    phone: z.string().optional().nullable(),
    email: z.string().email('Debe ser un email válido').optional().nullable().or(z.literal('')),
    isClient: z.boolean().optional(),
    isProvider: z.boolean().optional(),
    providerType: z.enum(['MERCADERIA', 'RODADOS', 'SERVICIOS']).optional(),
    isSeller: z.boolean().optional(),
    isCommissionAgent: z.boolean().optional(),
    creditLimit: safeNumericPreprocess(0).refine(val => val >= 0, 'El límite de crédito debe ser mayor o igual a 0').optional(),
    maxUnpaidInvoices: safeNumericPreprocess(0)
      .refine((val) => val >= 0 && val <= 2, 'El límite de boletas debe estar entre 0 y 2')
      .optional(),
    priceList: z.string().optional().nullable(),
    discount: safeNumericPreprocess(0).refine(val => val >= 0 && val <= 100, 'El descuento debe estar entre 0 y 100').optional(),
    contacts: z.any().optional(),
    sellerId: z.union([z.number(), z.string()]).optional().nullable(),
    paymentTermDays: safeNumericPreprocess(30).refine(val => val >= 0, 'El plazo de pago debe ser mayor o igual a 0').optional(),
    webPin: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
    rubro: z.string().optional().nullable(),
    hireDate: z.string().optional().nullable().or(z.literal('')),
    trustTags: z.array(z.string().trim().min(1).max(60)).max(5).optional(),
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
      checkNumber: z.string().trim().max(80).optional().nullable(),
      checkBank: z.string().trim().max(120).optional().nullable(),
      checkDueDate: z.string().trim().max(30).optional().nullable(),
      isEcheq: z.boolean().optional(),
    })).optional(),
    description: z.string().optional(),
    checkNumber: z.string().trim().max(80).optional().nullable(),
    checkBank: z.string().trim().max(120).optional().nullable(),
    checkDueDate: z.string().trim().max(30).optional().nullable(),
    isEcheq: z.boolean().optional(),
    branch: z.enum(['A', 'X']).optional(),
    type: z.enum(['INCOME', 'OUTCOME']).optional(),
    supplierInvoiceId: z.union([z.number(), z.string()]).optional().nullable(),
    orderId: z.number().optional().nullable(),
    orderIds: z.array(z.number().int().positive()).max(50).optional(),
    applyToUnbilledBalance: z.boolean().optional(),
    bankAccountId: z.union([z.number(), z.string()]).optional().nullable(),
    allowCreditOnAccount: z.boolean().optional(),
    isCreditOnAccount: z.boolean().optional(),
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

export const TRUST_TAG_CODES = [
  'CONFIABLE',
  'OBSERVADO',
  'ATRASO_FRECUENTE',
  'SOLO_CONTADO',
  'CONFLICTIVO',
] as const;

export const updateTrustTagsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser numérico'),
  }),
  body: z.object({
    trustTags: z.array(z.enum(TRUST_TAG_CODES)).max(5, 'Máximo 5 etiquetas permitidas'),
  }),
});

export const createPersonaNoteSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser numérico'),
  }),
  body: z.object({
    content: z
      .string()
      .trim()
      .min(1, 'La nota no puede estar vacía')
      .max(1000, 'La nota no puede superar los 1000 caracteres'),
    category: z.enum(['GENERAL', 'COBRANZA', 'INCIDENTE', 'COMERCIAL']).default('GENERAL'),
    isPinned: z.boolean().optional(),
  }),
});

export const personaNoteParamsSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser numérico'),
    noteId: z.string().regex(/^\d+$/, 'El ID de nota debe ser numérico'),
  }),
});
