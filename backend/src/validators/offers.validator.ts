import { z } from 'zod';

const optionalPrice = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.coerce.number().min(0, 'El precio anterior no puede ser negativo.').nullable().optional(),
);

export const campaignIdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de campaña inválido.'),
  }),
});

export const createCampaignSchema = z.object({
  body: z.object({
    title: z.string().trim().min(1, 'El título de la campaña es obligatorio.').max(200),
    startDate: z.string().optional().nullable(),
    endDate: z.string().optional().nullable(),
    isActive: z.boolean().optional(),
  }),
});

export const updateCampaignSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de campaña inválido.'),
  }),
  body: z
    .object({
      title: z.string().trim().min(1).max(200).optional(),
      startDate: z.string().optional().nullable(),
      endDate: z.string().optional().nullable(),
      isActive: z.boolean().optional(),
      customRubroOrder: z.any().optional(),
    })
    .passthrough(),
});

export const upsertCampaignItemSchema = z.object({
  params: z.object({
    campaignId: z.coerce.number().int().positive('ID de campaña inválido.'),
  }),
  body: z.object({
    productId: z.coerce.number().int().positive('El producto es obligatorio.'),
    offerPrice: z.coerce.number().min(0, 'El precio de oferta no puede ser negativo.'),
    previousPrice: optionalPrice,
    specialTag: z.string().max(150).optional().nullable(),
    showListPrice: z.boolean().optional(),
    campaignGroup: z.string().max(100).optional().nullable(),
  }),
});

export const bulkCampaignItemsSchema = z.object({
  params: z.object({
    campaignId: z.coerce.number().int().positive('ID de campaña inválido.'),
  }),
  body: z.object({
    items: z
      .array(
        z.object({
          productId: z.coerce.number().int().positive('ID de producto inválido.'),
          offerPrice: z.coerce.number().min(0, 'El precio de oferta no puede ser negativo.'),
          previousPrice: optionalPrice,
          specialTag: z.string().max(150).optional().nullable(),
          showListPrice: z.boolean().optional(),
          campaignGroup: z.string().max(100).optional().nullable(),
        }),
      )
      .min(1, 'Debe enviar al menos un artículo.'),
  }),
});

export const removeCampaignItemSchema = z.object({
  params: z.object({
    campaignId: z.coerce.number().int().positive().optional(),
    itemId: z.coerce.number().int().positive('ID de ítem inválido.'),
  }),
});
