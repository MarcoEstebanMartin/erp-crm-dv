import { z } from 'zod';

export const createSupplierInvoiceSchema = z.object({
  body: z.object({
    personaId: z.coerce.number().int().positive('El proveedor es obligatorio.'),
    invoiceNumber: z.string().trim().min(1, 'El número de factura es obligatorio.').max(100),
    invoiceType: z.string().trim().min(1, 'El tipo de factura es obligatorio.').max(40),
    issueDate: z.string().min(1, 'La fecha de emisión es obligatoria.'),
    dueDate: z.string().optional().nullable(),
    netAmount: z.coerce.number().min(0),
    taxAmount: z.coerce.number().min(0),
    percepcionAmount: z.coerce.number().min(0).optional().nullable(),
    percepcionPampa: z.coerce.number().min(0).optional().nullable(),
    percepcionBsAs: z.coerce.number().min(0).optional().nullable(),
    percepcionIva: z.coerce.number().min(0).optional().nullable(),
    percepcionIva5329: z.coerce.number().min(0).optional().nullable(),
    impuestosInternos: z.coerce.number().min(0).optional().nullable(),
    totalAmount: z.coerce.number().min(0),
    billingType: z.enum(['OFFICIAL', 'INTERNAL']).optional(),
  }),
});

export const supplierInvoiceIdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de factura inválido.'),
  }),
});

export const createTaxWithholdingSchema = z.object({
  body: z.object({
    type: z.string().trim().min(1),
    taxType: z.string().trim().min(1),
    personaId: z.coerce.number().int().positive(),
    number: z.string().trim().min(1).max(100),
    date: z.string().min(1),
    amount: z.coerce.number().positive('El monto debe ser mayor a cero.'),
    jurisdiction: z.string().max(30).optional().nullable(),
  }),
});
