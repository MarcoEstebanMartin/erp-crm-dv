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
  }),
});

export const adjustStockSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser un número'),
  }),
  body: z.object({
    quantityChange: z.number().refine(val => val !== 0, 'El cambio de stock no puede ser cero'),
    reason: z.string().optional(),
    lotNumber: z.string().optional(),
    expirationDate: z.string().optional(),
  }),
});

export const importPricesSchema = z.object({
  body: z.object({
    products: z.array(
      z.object({
        sku: z.string().min(1),
        name: z.string().optional(),
        costPrice: z.number().min(0).optional(),
        listPrice: z.number().min(0).optional(),
        listPriceB: z.number().min(0).optional().nullable(),
        listPriceC: z.number().min(0).optional().nullable(),
        profitMargin: z.number().min(1).optional().nullable(),
        barcode: z.string().optional().nullable(),
      })
    ).min(1, 'Debe proveer al menos un producto'),
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
