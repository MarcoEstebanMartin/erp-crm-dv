import { z } from 'zod';

const optionalPromoPrice = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.coerce.number().min(0, 'El precio promocional no puede ser negativo.').nullable().optional(),
);

const promoItemSchema = z.object({
  productId: z.coerce.number().int().positive('Seleccioná un producto válido.'),
  minQuantity: z.coerce.number().int().min(1, 'La cantidad mínima debe ser al menos 1.').default(1),
  freeQuantity: z.coerce.number().int().min(0, 'La cantidad sin cargo no puede ser negativa.').default(0),
  promoUnitPrice: optionalPromoPrice,
});

function parseDateValue(raw?: string | null): Date | null {
  if (!raw || !raw.trim()) return null;
  const trimmed = raw.trim();
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (dateOnlyMatch) {
    const d = new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]), 0, 0, 0, 0);
    return Number.isNaN(d.getTime()) ? null : d;
  }
  const parsed = new Date(trimmed);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const promoIdParamSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de oferta semanal inválido.'),
  }),
});

export const createWeeklyPromoSchema = z.object({
  body: z
    .object({
      type: z.enum(['OFFER_PRICE', 'BUY_X_GET_Y', 'COMBO']),
      name: z.string().trim().max(120, 'El nombre no puede superar 120 caracteres.').optional().nullable(),
      startDate: z.string().trim().min(1, 'La fecha de inicio es obligatoria.'),
      endDate: z.string().trim().optional().nullable(),
      items: z.array(promoItemSchema).min(1, 'Debe incluir al menos un producto.'),
    })
    .superRefine((body, ctx) => {
      const start = parseDateValue(body.startDate);
      if (!start) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['startDate'], message: 'Fecha de inicio inválida.' });
      }
      if (body.endDate && body.endDate.trim() !== '') {
        const end = parseDateValue(body.endDate);
        if (!end) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['endDate'], message: 'Fecha de fin inválida.' });
        } else if (start && end.getTime() < start.getTime()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['endDate'],
            message: 'La fecha Hasta debe ser igual o posterior a Desde.',
          });
        }
      }

      const uniqueIds = new Set(body.items.map((i) => i.productId));
      if (uniqueIds.size !== body.items.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items'],
          message: 'No podés repetir el mismo producto dentro de una misma oferta.',
        });
      }

      if (body.type === 'OFFER_PRICE') {
        if (body.items.length !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items'],
            message: 'Una oferta de precio directo lleva exactamente 1 producto.',
          });
        } else if (body.items[0].promoUnitPrice == null || body.items[0].promoUnitPrice <= 0) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', 0, 'promoUnitPrice'],
            message: 'Ingresá un precio de oferta mayor a $0.',
          });
        }
      } else if (body.type === 'BUY_X_GET_Y') {
        if (body.items.length !== 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items'],
            message: 'Una promoción N+M lleva exactamente 1 producto.',
          });
        } else if (body.items[0].freeQuantity < 1) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', 0, 'freeQuantity'],
            message: 'La cantidad bonificada sin cargo debe ser al menos 1.',
          });
        }
      } else if (body.type === 'COMBO') {
        if (body.items.length < 2) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items'],
            message: 'Un combo requiere al menos 2 productos distintos.',
          });
        }
        body.items.forEach((item, idx) => {
          if (item.promoUnitPrice == null || item.promoUnitPrice <= 0) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['items', idx, 'promoUnitPrice'],
              message: 'Cada producto del combo debe tener un precio promocional mayor a $0.',
            });
          }
        });
      }
    }),
});
