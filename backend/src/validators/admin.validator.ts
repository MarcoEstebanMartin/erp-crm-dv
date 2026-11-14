import { z } from 'zod';
import { Role } from '@prisma/client';

export const createUserSchema = z.object({
  body: z.object({
    username: z
      .string()
      .trim()
      .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
      .max(50, 'El nombre de usuario no puede superar 50 caracteres'),
    password: z
      .string()
      .trim()
      .min(6, 'La contraseña debe tener al menos 6 caracteres')
      .max(100, 'Contraseña demasiado larga'),
    role: z.nativeEnum(Role),
  }),
});

export const toggleUserStatusSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser numérico'),
  }),
});

export const updateUserSchema = z.object({
  params: z.object({
    id: z.string().regex(/^\d+$/, 'El ID debe ser numérico'),
  }),
  body: z.object({
    username: z
      .string()
      .trim()
      .min(3, 'El nombre de usuario debe tener al menos 3 caracteres')
      .max(50, 'El nombre de usuario no puede superar 50 caracteres')
      .optional(),
    role: z.nativeEnum(Role).optional(),
    password: z
      .string()
      .trim()
      .min(6, 'La contraseña debe tener al menos 6 caracteres')
      .max(100, 'Contraseña demasiado larga')
      .optional()
      .or(z.literal('')),
  }),
});

export const deleteUserSchema = z.object({
  params: z.object({
    username: z.string().min(1, 'El usuario es requerido'),
  }),
});

export const updateSystemConfigSchema = z.object({
  body: z.object({
    ignoreStockCheck: z.boolean().optional(),
    company: z
      .object({
        razonSocial: z.string().trim().min(2, 'La razón social es requerida').max(120).optional(),
        nombreFantasia: z.string().trim().min(2, 'El nombre de fantasía es requerido').max(120).optional(),
        cuit: z.string().trim().min(11, 'El CUIT debe tener 11 dígitos').max(15).optional(),
        direccion: z.string().trim().max(180).optional(),
        telefono: z.string().trim().max(50).optional(),
        email: z.string().trim().email('Email inválido').or(z.literal('')).optional(),
        puntoVenta: z.coerce.number().int().min(1).max(99999).optional(),
        iibb: z.string().trim().max(40).optional(),
        inicioActividades: z.string().trim().max(20).optional(),
      })
      .optional(),
  }),
});


