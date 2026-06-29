import { z } from 'zod';
import { Role } from '@prisma/client';

export const createUserSchema = z.object({
  body: z.object({
    username: z.string().min(4, 'El nombre de usuario debe tener al menos 4 caracteres'),
    password: z.string().min(6, 'La contraseña debe tener al menos 6 caracteres'),
    role: z.nativeEnum(Role),
  }),
});

export const toggleUserStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser numérico'),
  }),
});
