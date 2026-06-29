import { z } from 'zod';
import { BillingType, InvoiceType, OrderStatus, PaymentMethod } from '@prisma/client';

export const createOrderSchema = z.object({
  body: z.object({
    personaId: z.number().positive(),
    items: z.array(z.object({
      productId: z.number().positive(),
      quantity: z.number().positive().min(1),
      weight: z.number().positive().optional(),
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
  }),
});

export const invoiceOrderSchema = z.object({
  params: z.object({
    id: z.string(),
  }),
  body: z.object({
    billingType: z.nativeEnum(BillingType),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
  }),
});
