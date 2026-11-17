import { z } from 'zod';

export const fieldReceiptPaymentSchema = z
  .object({
    paymentMethod: z.enum(['CASH', 'BANK_TRANSFER', 'CHECK']),
    amount: z.coerce.number().positive('El importe debe ser mayor a $0'),
    bankAccountId: z.coerce.number().int().positive().nullable().optional(),
    transferReference: z.string().trim().max(120).nullable().optional(),
    proofImageUrl: z.string().trim().max(2_000_000).nullable().optional(),
    checkBank: z.string().trim().max(100).nullable().optional(),
    checkNumber: z.string().trim().max(60).nullable().optional(),
    checkIssuerCuit: z.string().trim().max(20).nullable().optional(),
    checkDueDate: z.string().datetime({ offset: true }).or(z.string().min(8)).nullable().optional(),
    checkFrontImageUrl: z.string().trim().max(2_000_000).nullable().optional(),
    checkBackImageUrl: z.string().trim().max(2_000_000).nullable().optional(),
    isEcheq: z.boolean().optional().default(false),
  })
  .superRefine((val, ctx) => {
    if (val.paymentMethod === 'CHECK') {
      if (!val.checkBank || !val.checkNumber || !val.checkDueDate) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'El cheque requiere banco, número y fecha de vencimiento.',
          path: ['checkNumber'],
        });
      }
    }
  });

export const syncFieldReceiptSchema = z.object({
  provisionalCode: z.string().trim().min(6, 'Código provisorio inválido').max(120),
  personaId: z.coerce.number().int().positive('Cliente inválido'),
  deliveryRouteId: z.coerce.number().int().positive().nullable().optional(),
  billingType: z.enum(['INTERNAL', 'OFFICIAL']).optional().default('INTERNAL'),
  notes: z.string().trim().max(500).nullable().optional(),
  gpsLat: z.coerce.number().nullable().optional(),
  gpsLng: z.coerce.number().nullable().optional(),
  capturedAt: z.string().datetime({ offset: true }).or(z.string().min(10)),
  payments: z.array(fieldReceiptPaymentSchema).min(1, 'Debe ingresar al menos un medio de pago'),
});

export const verifyTransferSchema = z
  .object({
    action: z.enum(['CLEAR', 'REJECT']),
    bankAccountId: z.coerce.number().int().positive().optional(),
    rejectionReason: z.string().trim().max(300).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.action === 'REJECT' && (!val.rejectionReason || val.rejectionReason.length < 3)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Debe indicar el motivo del rechazo de la transferencia.',
        path: ['rejectionReason'],
      });
    }
  });

export const rejectCheckSchema = z.object({
  rejectionReason: z.string().trim().min(3, 'Debe indicar el motivo del rechazo del cheque').max(300),
});

export const voidFieldReceiptSchema = z.object({
  voidReason: z.string().trim().min(3, 'Debe indicar el motivo de anulación').max(300),
});

export const approveSettlementSchema = z.object({
  declaredCash: z.coerce.number().min(0, 'El efectivo declarado no puede ser negativo'),
  notes: z.string().trim().max(500).optional(),
});

export type SyncFieldReceiptInput = z.infer<typeof syncFieldReceiptSchema>;
export type VerifyTransferInput = z.infer<typeof verifyTransferSchema>;
export type ApproveSettlementInput = z.infer<typeof approveSettlementSchema>;
