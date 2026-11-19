import { z } from 'zod';

const optionalPositiveInt = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

const nullableNumber = z.preprocess(
  (v) => (v === '' || v === null || v === undefined ? null : v),
  z.coerce.number().nullable().optional(),
);

export const routeIdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de ruta inválido.'),
  }),
});

export const createDeliveryRouteSchema = z.object({
  body: z
    .object({
      routeName: z.string().trim().max(120).optional().nullable(),
      driverName: z.string().trim().max(120).optional().nullable(),
      driverEmployeeId: optionalPositiveInt,
      companionName: z.string().max(120).optional().nullable(),
      vehiclePlate: z.string().max(30).optional().nullable(),
      vehicleDescription: z.string().max(200).optional().nullable(),
      vehicleId: optionalPositiveInt,
      date: z.string().optional().nullable(),
      orderIds: z.array(z.coerce.number().int().positive()),
    })
    .refine(
      (data) => Boolean((data.driverName && data.driverName.trim().length > 0) || data.driverEmployeeId),
      {
        message: 'El chofer es obligatorio.',
        path: ['driverName'],
      },
    )
    .refine(
      (data) => Boolean((data.vehiclePlate && data.vehiclePlate.trim().length > 0) || data.vehicleId),
      {
        message: 'Chofer, patente (o vehículo de la flota) y listado de pedidos son obligatorios.',
        path: ['vehiclePlate'],
      },
    ),
});

export const updateDeliveryRouteSchema = z.object({
  params: routeIdParamSchema.shape.params,
  body: z.object({
    routeName: z.string().trim().max(120).optional().nullable(),
    driverName: z.string().trim().min(1).max(120).optional(),
    driverEmployeeId: z.preprocess(
      (v) => (v === '' || v === undefined ? undefined : v === null ? null : v),
      z.coerce.number().int().positive().nullable().optional(),
    ),
    companionName: z.string().max(120).optional().nullable(),
    vehiclePlate: z.string().max(30).optional().nullable(),
    vehicleDescription: z.string().max(200).optional().nullable(),
    vehicleId: z.preprocess(
      (v) => (v === '' || v === undefined ? undefined : v === null ? null : v),
      z.coerce.number().int().positive().nullable().optional(),
    ),
    date: z.string().optional().nullable(),
    orderIds: z.array(z.coerce.number().int().positive()).optional(),
  }),
});

export const updateRouteStatusSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de ruta inválido.'),
  }),
  body: z.object({
    status: z.enum(['PENDING', 'IN_TRANSIT', 'COMPLETED'], {
      message: 'Estado inválido.',
    }),
  }),
});

export const transferRouteCustodySchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de ruta inválido.'),
  }),
  body: z.object({
    driverNotes: z.string().max(2000).optional().nullable(),
  }),
});

export const settleDeliveryRouteSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de ruta inválido.'),
  }),
  body: z.object({
    settlements: z.array(
      z
        .object({
          orderId: z.coerce.number().int().positive(),
          paymentMethod: z.string().max(40).optional().nullable(),
          bankAccountId: optionalPositiveInt,
          checkNumber: z.string().max(120).optional().nullable(),
          checkIssuer: z.string().max(200).optional().nullable(),
          isEcheq: z.boolean().optional().default(false),
        })
        .passthrough(),
    ),
    cashDeclared: nullableNumber,
    checksDeclared: nullableNumber,
    transfersDeclared: nullableNumber,
  }),
});

export const recordRouteGpsPingSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de ruta inválido.'),
  }),
  body: z.object({
    latitude: z.coerce.number().min(-90, 'Latitud inválida.').max(90, 'Latitud inválida.'),
    longitude: z.coerce.number().min(-180, 'Longitud inválida.').max(180, 'Longitud inválida.'),
    speed: nullableNumber,
    heading: nullableNumber,
  }),
});
