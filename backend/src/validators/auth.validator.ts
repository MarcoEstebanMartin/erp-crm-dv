import { z } from 'zod';

export const loginSchema = z.object({
  body: z.object({
    username: z.string().min(1, 'Username is required'),
    password: z.string().min(1, 'Password is required'),
  }),
});

export const changeOwnPasswordSchema = z.object({
  body: z.object({
    currentPassword: z.string().min(1, 'La contraseña actual es requerida.'),
    newPassword: z
      .string()
      .transform((v) => v.trim())
      .refine((v) => v.length >= 6, 'La nueva contraseña debe tener al menos 6 caracteres.')
      .refine((v) => v.length <= 128, 'La nueva contraseña no puede superar 128 caracteres.'),
  }),
});
