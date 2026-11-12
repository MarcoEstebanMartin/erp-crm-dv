import { z } from 'zod';

export const updateLotSchema = z.object({
  params: z.object({
    lotId: z.string().regex(/^\d+$/, 'El ID del lote debe ser un número'),
  }),
  body: z.object({
    lotNumber: z.string().min(1, 'El código de lote es requerido').optional(),
    expirationDate: z.string().optional(),
    location: z.string().optional(),
  }),
});

export const transferLotStockSchema = z.object({
  params: z.object({
    productId: z.string().regex(/^\d+$/, 'El ID del producto debe ser un número'),
  }),
  body: z.object({
    fromLotId: z.number().int().positive('El lote de origen es requerido'),
    toLotNumber: z.string().min(1, 'El código de lote de destino es requerido'),
    toExpirationDate: z.string().optional(),
    toLocation: z.string().optional(),
    quantity: z
      .number()
      .int('La cantidad a transferir debe ser un número entero')
      .positive('La cantidad a transferir debe ser mayor a cero'),
  }),
});

export const deleteLotSchema = z.object({
  params: z.object({
    lotId: z.string().regex(/^\d+$/, 'El ID del lote debe ser un número'),
  }),
});
