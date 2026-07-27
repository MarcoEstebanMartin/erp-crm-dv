import { z } from 'zod';
import { BillingType, InvoiceType, OrderStatus, PaymentMethod } from '@prisma/client';

export const createOrderSchema = z.object({
  body: z.object({
    personaId: z.number().positive(),
    items: z.array(z.object({
      productId: z.number().positive(),
      quantity: z.number().positive().min(1),
      weight: z.number().positive().optional(),
      isEmergencyOverride: z.boolean().optional(),
    })).min(1, 'El pedido debe tener al menos un item'),
  }),
});

export const updateOrderSchema = z.object({
  body: z.object({
    items: z.array(z.object({
      productId: z.number().positive(),
      quantity: z.number().positive().min(1),
      weight: z.number().positive().nullable().optional(),
      isEmergencyOverride: z.boolean().optional(),
    })).min(1, 'El pedido debe tener al menos un item'),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    status: z.nativeEnum(OrderStatus),
    lotAssignments: z.record(z.string(), z.array(z.object({
      lotId: z.number().or(z.string()),
      quantity: z.number().positive()
    }))).optional(),
    bultosCount: z.number().int().nonnegative().optional(),
    bultosDetails: z.any().optional(),
  }),
});

export const invoiceOrderSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    billingType: z.nativeEnum(BillingType),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    paymentDescription: z.string().optional(),
  }),
});

export const createDirectInvoiceSchema = z.object({
  body: z.object({
    personaId: z.number().positive('El cliente es requerido'),
    billingType: z.nativeEnum(BillingType).optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    paymentDescription: z.string().optional(),
    items: z.array(z.object({
      productId: z.number().positive(),
      quantity: z.number().positive().min(1),
      weight: z.number().positive().optional(),
      isEmergencyOverride: z.boolean().optional(),
    })).min(1, 'El pedido debe tener al menos un item'),
  }),
});

export const updateOrderWeightsSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    itemWeights: z.record(z.string(), z.number().positive('El peso debe ser positivo')),
  }),
});

export const confirmArmadoSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    bultosCount: z.number().int().nonnegative().optional(),
    bultosDetails: z.any().optional(),
    lotAssignments: z.record(z.string(), z.array(z.object({
      lotId: z.number().or(z.string()),
      quantity: z.number().positive()
    }))).optional(),
  }).optional(),
});
