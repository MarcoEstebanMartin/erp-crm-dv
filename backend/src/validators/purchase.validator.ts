import { z } from 'zod';

export const createPurchaseOrderSchema = z.object({
  body: z.object({
    personaId: z.coerce.number().int().positive('El proveedor es obligatorio.'),
    items: z
      .array(
        z.object({
          productId: z.coerce.number().int().positive('productId inválido.'),
          quantity: z.coerce.number().int().positive('La cantidad debe ser mayor a cero.'),
          costPrice: z.coerce.number().min(0, 'El costo no puede ser negativo.'),
        }),
      )
      .min(1, 'Debe incluir al menos un artículo.'),
  }),
});

export const receivePurchaseOrderSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de orden de compra inválido.'),
  }),
  body: z.object({
    invoiceNumber: z.string().max(100).optional().nullable(),
    lotAssignments: z.record(z.string(), z.any()).optional().nullable(),
    billingType: z.enum(['OFFICIAL', 'INTERNAL']).optional(),
  }),
});

export const confirmDocumentSchema = z.object({
  body: z.object({
    providerId: z.coerce.number().int().positive('El proveedor es obligatorio.'),
    documentType: z.string().trim().min(1, 'El tipo de documento es obligatorio.'),
    documentNumber: z.string().max(100).optional().nullable(),
    issueDate: z.string().optional().nullable(),
    items: z.array(z.any()).min(1, 'El documento debe incluir al menos un ítem.'),
    netAmount: z.coerce.number().min(0).optional().nullable(),
    taxAmount: z.coerce.number().min(0).optional().nullable(),
    percepcionAmount: z.coerce.number().min(0).optional().nullable(),
    percepcionPampa: z.coerce.number().min(0).optional().nullable(),
    percepcionBsAs: z.coerce.number().min(0).optional().nullable(),
    percepcionIva: z.coerce.number().min(0).optional().nullable(),
    percepcionIvaAmount: z.coerce.number().min(0).optional().nullable(),
    percepcionIva5329: z.coerce.number().min(0).optional().nullable(),
    impuestosInternos: z.coerce.number().min(0).optional().nullable(),
    percepcionJurisdiction: z.string().max(30).optional().nullable(),
    totalAmount: z.coerce.number().min(0).optional().nullable(),
    billingType: z.enum(['OFFICIAL', 'INTERNAL']).optional(),
  }),
});
