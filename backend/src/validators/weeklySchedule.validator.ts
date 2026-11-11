import { z } from 'zod';

export const toggleWeekSchema = z.object({
  body: z.object({
    weekType: z.enum(['SEMANA_1', 'SEMANA_2'], {
      message: 'Debe especificar una semana válida (SEMANA_1 o SEMANA_2)',
    }),
  }),
});
