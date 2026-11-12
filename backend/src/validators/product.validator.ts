import { z } from 'zod';

export const createProductSchema = z.object({
  body: z.object({
    sku: z.string().min(1, 'El SKU es requerido'),
    name: z.string().min(1, 'El nombre es requerido'),
    description: z.string().optional(),
    barcode: z.string().optional().nullable(),
    costPrice: z.number().min(0, 'El costo no puede ser negativo'),
    listPrice: z.number().min(0, 'El precio de lista no puede ser negativo'),
    listPriceB: z.number().min(0).optional().nullable(),
    listPriceC: z.number().min(0).optional().nullable(),
    profitMargin: z.number().min(1).optional().nullable(),
    minStock: z.number().min(0).optional().nullable(),
    rubroId: z.number().int().positive().optional().nullable(),
    providerId: z.number().int().positive().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const updateProductSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser un número'),
  }),
  body: z.object({
    name: z.string().min(1).optional(),
    description: z.string().optional(),
    barcode: z.string().optional().nullable(),
    costPrice: z.number().min(0).optional(),
    listPrice: z.number().min(0).optional(),
    listPriceB: z.number().min(0).optional().nullable(),
    listPriceC: z.number().min(0).optional().nullable(),
    profitMargin: z.number().min(1).optional().nullable(),
    minStock: z.number().min(0).optional().nullable(),
    rubroId: z.number().int().positive().optional().nullable(),
    providerId: z.number().int().positive().optional().nullable(),
    defaultLocation: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const adjustStockSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser un número'),
  }),
  body: z
    .object({
      quantityChange: z
        .number()
        .int('El ajuste de stock debe ser un número entero')
        .optional(),
      targetStock: z
        .number()
        .int('El stock objetivo debe ser un número entero')
        .min(0, 'El stock objetivo no puede ser negativo')
        .optional(),
      mode: z.enum(['DELTA', 'VACATE_LOT']).optional(),
      reason: z.string().optional(),
      lotNumber: z.string().optional(),
      expirationDate: z.string().optional(),
      location: z.string().optional().nullable(),
      lotId: z.number().int().positive().optional().nullable(),
    })
    .refine(
      (data) => {
        if (data.mode === 'VACATE_LOT') {
          return Boolean(data.lotId || (data.lotNumber && data.lotNumber.trim()));
        }
        if (data.targetStock !== undefined) {
          return true;
        }
        return data.quantityChange !== undefined && data.quantityChange !== 0;
      },
      {
        message:
          'Debe indicar un cambio de stock distinto de cero, targetStock (>= 0) o mode="VACATE_LOT" con lote.',
      },
    ),
});

export const adjustStockBatchSchema = z.object({
  body: z.object({
    items: z
      .array(
        z
          .object({
            productId: z.number().int().positive('El ID del producto es requerido'),
            quantityChange: z
              .number()
              .int('Cada ajuste de stock debe ser un número entero')
              .optional(),
            targetStock: z
              .number()
              .int('El stock objetivo debe ser un número entero')
              .min(0, 'El stock objetivo no puede ser negativo')
              .optional(),
            mode: z.enum(['DELTA', 'VACATE_LOT']).optional(),
            reason: z.string().optional(),
            lotNumber: z.string().optional(),
            expirationDate: z.string().optional(),
            location: z.string().optional().nullable(),
            lotId: z.number().int().positive().optional().nullable(),
          })
          .refine(
            (item) =>
              item.targetStock !== undefined ||
              (item.mode === 'VACATE_LOT' && Boolean(item.lotId || item.lotNumber?.trim())) ||
              (item.quantityChange !== undefined && item.quantityChange !== 0),
            {
              message:
                'Cada ajuste debe indicar targetStock (>= 0) o un quantityChange entero distinto de cero.',
            },
          ),
      )
      .min(1, 'Debe enviar al menos un ajuste de stock')
      .max(250, 'Máximo 250 ajustes por bloque transaccional'),
  }),
});

export const assignWmsLocationSchema = z.object({
  body: z.object({
    productId: z.number().int().positive('El ID de producto es obligatorio'),
    locationCode: z
      .string()
      .trim()
      .min(1, 'El código de ubicación WMS es obligatorio')
      .max(40, 'Código de ubicación inválido'),
    quantity: z
      .number()
      .int('La cantidad debe ser un número entero')
      .positive('La cantidad debe ser mayor a cero'),
    lotNumber: z.string().optional(),
    sourceLotId: z.number().int().positive().optional().nullable(),
    expirationDate: z.string().optional(),
    reason: z.string().max(200).optional(),
    mode: z.enum(['RELOCATE', 'STOCK_IN']).optional(),
  }),
});

export const clearWmsLocationSchema = z.object({
  body: z.object({
    locationCode: z
      .string()
      .trim()
      .min(1, 'El código de ubicación WMS es obligatorio')
      .max(40, 'Código de ubicación inválido'),
    productId: z.number().int().positive().optional().nullable(),
    lotId: z.number().int().positive().optional().nullable(),
    mode: z.enum(['UNASSIGN', 'WRITE_OFF']).optional(),
    reason: z.string().max(200).optional(),
  }),
});

export const importPricesSchema = z.object({
  body: z.object({
    products: z
      .array(
        z.object({
          sku: z.string().min(1),
          name: z.string().optional(),
          costPrice: z.number().min(0).optional(),
          listPrice: z.number().min(0).optional(),
          listPriceB: z.number().min(0).optional().nullable(),
          listPriceC: z.number().min(0).optional().nullable(),
          profitMargin: z.number().min(1).optional().nullable(),
          barcode: z.string().optional().nullable(),
        }),
      )
      .min(1, 'Debe proveer al menos un producto'),
  }),
});

export const bulkUpdatePricesSchema = z.object({
  body: z.object({
    rubroId: z.number().int().positive().optional().nullable(),
    providerId: z.number().int().positive().optional().nullable(),
    type: z.enum(['margin', 'percentage', 'fixed']),
    basis: z.enum(['cost', 'current']).optional(),
    value: z.number(),
    priceList: z.enum(['all', 'listPrice', 'listPriceB', 'listPriceC']),
  }),
});
