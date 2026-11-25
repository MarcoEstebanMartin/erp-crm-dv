import { z } from 'zod';

const comboSideSchema = z.object({
  productId: z.coerce.number().int().positive().nullable().optional(),
  sku: z.string().trim().max(40).nullable().optional(),
  name: z.string().trim().min(1, 'El nombre del producto es obligatorio.').max(180),
  price: z.coerce.number().min(0, 'El precio no puede ser negativo.'),
  uxb: z.string().trim().max(40).nullable().optional(),
  condition: z.string().trim().min(1, 'La condición es obligatoria.').max(60),
  imageUrl: z.string().trim().max(300).nullable().optional(),
  isFree: z.boolean().optional().default(false),
  freeLabel: z.string().trim().max(40).nullable().optional(),
});

const catalogComboSchema = z.object({
  id: z.string().trim().min(1).max(80),
  comboNum: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().max(60).optional().default('COMBOS'),
  product1: comboSideSchema,
  product2: comboSideSchema,
});

export const updateCatalogStudioStateSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'El título es obligatorio.').max(120).optional(),
    subtitle: z.string().trim().max(80).nullable().optional(),
    hideOutOfStock: z.boolean().optional(),
    categoryOrder: z.array(z.string().trim().min(1).max(80)).max(50).nullable().optional(),
    itemOrder: z.array(z.string().trim().min(1).max(60)).max(2000).nullable().optional(),
    combos: z.array(catalogComboSchema).max(50).nullable().optional(),
  }),
});

const optionalOldPrice = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.coerce.number().min(0, 'El precio tachado no puede ser negativo.').nullable().optional(),
);

export const patchCatalogProductSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de producto inválido.'),
  }),
  body: z.object({
    catalogBadge: z.enum(['OFERTON', 'DESTACADO']).nullable().optional(),
    catalogVarieties: z.string().trim().max(220).nullable().optional(),
    catalogMinQtyLabel: z.string().trim().max(40).nullable().optional(),
    catalogShowOldPrice: z.boolean().optional(),
    catalogOldPrice: optionalOldPrice,
    catalogVisible: z.boolean().optional(),
    commercialCategory: z.string().trim().max(80).nullable().optional(),
  }),
});
