import { z } from 'zod';
import { BillingType, DeliveryMethod, OrderStatus, PaymentMethod, SalesChannel } from '@prisma/client';

const positiveIdParamsSchema = z.object({
  id: z.string().regex(/^\d+$/, 'ID de pedido inválido'),
});

const orderItemInputSchema = z.object({
  productId: z.number().int().positive('ID de producto inválido'),
  quantity: z.number().positive().min(1, 'La cantidad mínima es 1'),
  weight: z.number().positive('El peso debe ser positivo').nullable().optional(),
  isEmergencyOverride: z.boolean().optional(),
});

export const createOrderSchema = z.object({
  body: z
    .object({
      personaId: z.number().int().positive().optional(),
      clientId: z.number().int().positive().optional(),
      billingType: z.nativeEnum(BillingType).optional(),
      salesChannel: z.nativeEnum(SalesChannel).optional(),
      deliveryMethod: z.nativeEnum(DeliveryMethod).optional(),
      deliveryRouteId: z.number().int().positive().nullable().optional(),
      notes: z.string().max(1000).nullable().optional(),
      items: z.array(orderItemInputSchema).min(1, 'El pedido debe tener al menos un item'),
    })
    .refine((data) => Boolean(data.personaId || data.clientId), {
      message: 'Debe especificar el cliente (personaId o clientId).',
      path: ['personaId'],
    }),
});

export const updateOrderSchema = z.object({
  params: positiveIdParamsSchema,
  body: z.object({
    items: z.array(orderItemInputSchema).min(1, 'El pedido debe tener al menos un item'),
  }),
});

export const updateOrderStatusSchema = z.object({
  params: positiveIdParamsSchema,
  body: z.object({
    status: z.nativeEnum(OrderStatus),
    lotAssignments: z
      .record(
        z.string(),
        z.array(
          z.object({
            lotId: z.number().or(z.string()),
            quantity: z.number().positive(),
          }),
        ),
      )
      .optional(),
    bultosCount: z.number().int().nonnegative().optional(),
    bultosDetails: z.any().optional(),
  }),
});

export const invoiceOrderSchema = z.object({
  params: positiveIdParamsSchema,
  body: z.object({
    billingType: z.nativeEnum(BillingType),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    paymentDescription: z.string().max(500).nullable().optional(),
    bankAccountId: z.number().int().positive().nullable().optional(),
    deferCae: z.boolean().optional(),
    markPickedUp: z.boolean().optional(),
    deliveryMethod: z.nativeEnum(DeliveryMethod).optional(),
  }),
});

export const createDirectInvoiceSchema = z.object({
  body: z.object({
    personaId: z.number().int().positive('El cliente es requerido'),
    billingType: z.nativeEnum(BillingType).optional(),
    salesChannel: z.nativeEnum(SalesChannel).optional(),
    deliveryMethod: z.nativeEnum(DeliveryMethod).optional(),
    deliveryRouteId: z.number().int().positive().nullable().optional(),
    markDelivered: z.boolean().optional(),
    paymentMethod: z.nativeEnum(PaymentMethod).optional(),
    paymentDescription: z.string().max(500).nullable().optional(),
    bankAccountId: z.number().int().positive().nullable().optional(),
    cashDrawerId: z.number().int().positive().nullable().optional(),
    checkNumber: z.string().max(100).nullable().optional(),
    checkIssuer: z.string().max(200).nullable().optional(),
    checkAmount: z.number().nonnegative().nullable().optional(),
    items: z.array(orderItemInputSchema).min(1, 'El pedido debe tener al menos un item'),
  }),
});

export const updateOrderWeightsSchema = z.object({
  params: positiveIdParamsSchema,
  body: z.object({
    items: z
      .array(
        z.object({
          orderItemId: z.number().int().positive('ID de renglón inválido'),
          weight: z.number().positive('El peso debe ser positivo'),
        }),
      )
      .min(1, 'Debe enviar al menos un renglón para actualizar su peso'),
  }),
});

export const confirmArmadoSchema = z.object({
  params: positiveIdParamsSchema,
  body: z
    .object({
      items: z
        .array(
          z.object({
            orderItemId: z.number().int().positive('ID de renglón inválido'),
            quantity: z.number().int().min(0, 'La cantidad no puede ser negativa').optional(),
            weight: z.number().min(0, 'El peso no puede ser negativo').optional(),
          }),
        )
        .optional(),
      bultosCount: z.number().int().nonnegative().optional(),
      bultosDetails: z.any().optional(),
      lotAssignments: z
        .record(
          z.string(),
          z.array(
            z.object({
              lotId: z.number().or(z.string()),
              quantity: z.number().positive(),
            }),
          ),
        )
        .optional(),
    })
    .optional(),
});

export const updateOrderDeliverySchema = z.object({
  params: positiveIdParamsSchema,
  body: z.object({
    deliveryMethod: z.nativeEnum(DeliveryMethod),
    deliveryRouteId: z.number().int().positive().nullable().optional(),
    deliverySequence: z.number().int().positive().nullable().optional(),
    markPickedUp: z.boolean().optional(),
  }),
});

export const bulkUpdateOrdersDeliverySchema = z.object({
  body: z.object({
    orderIds: z.array(z.coerce.number().int().positive()).min(1, 'Seleccione al menos un pedido.').max(200),
    deliveryMethod: z.nativeEnum(DeliveryMethod),
    deliveryRouteId: z.number().int().positive().nullable().optional(),
  }),
});
