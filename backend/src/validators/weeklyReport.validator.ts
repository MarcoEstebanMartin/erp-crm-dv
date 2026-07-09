import { z } from 'zod';

export const saveWeeklyReportSchema = z.object({
  body: z.object({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'El inicio de semana debe tener formato YYYY-MM-DD'),
    purchases: z.array(z.object({
      company: z.string().min(1, 'El nombre de la empresa es obligatorio'),
      date: z.string().optional().nullable(),
      amount: z.number().or(z.string().transform((val) => Number(val)))
    })),
    sales: z.array(z.object({
      locality: z.string().min(1, 'La localidad es obligatoria'),
      date: z.string().optional().nullable(),
      amountA: z.number().or(z.string().transform((val) => Number(val))),
      amountX: z.number().or(z.string().transform((val) => Number(val)))
    })),
    credit: z.number().or(z.string().transform((val) => Number(val))),
    buffer: z.number().or(z.string().transform((val) => Number(val)))
  })
});

export const deleteWeeklyReportSchema = z.object({
  params: z.object({
    weekStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'El inicio de semana debe tener formato YYYY-MM-DD')
  })
});
