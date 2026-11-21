import { z } from 'zod';
import { Role } from '@prisma/client';

const userPermissionsSchema = z
  .object({
    canSell: z.boolean().optional(),
    canPick: z.boolean().optional(),
    canDeliver: z.boolean().optional(),
    canCollect: z.boolean().optional(),
    canManageStock: z.boolean().optional(),
  })
  .nullable()
  .optional();

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
      .min(4, 'La contraseña debe tener al menos 4 caracteres')
      .max(100, 'Contraseña demasiado larga'),
    role: z.nativeEnum(Role),
    permissions: userPermissionsSchema,
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
    permissions: userPermissionsSchema,
    password: z
      .string()
      .trim()
      .min(4, 'La contraseña debe tener al menos 4 caracteres')
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

export const AUDIT_MODULE_KEYS = [
  'ACCESS',
  'STAFF',
  'STOCK_WMS',
  'CATALOG',
  'CLIENTS',
  'SALES',
  'PURCHASES',
  'FINANCE',
  'LOGISTICS',
  'SYSTEM',
] as const;

export type AuditModuleKey = (typeof AUDIT_MODULE_KEYS)[number];

export const AUDIT_STATUS_KEYS = ['SUCCESS', 'WARNING', 'ERROR'] as const;

export type AuditStatusKey = (typeof AUDIT_STATUS_KEYS)[number];

export const getAuditLogsQuerySchema = z.object({
  query: z.object({
    page: z.string().regex(/^\d+$/, 'Página inválida').optional(),
    limit: z.string().regex(/^\d+$/, 'Límite inválido').optional(),
    search: z.string().trim().max(120, 'Búsqueda demasiado larga').optional(),
    userId: z.string().regex(/^\d+$/, 'Usuario inválido').optional(),
    module: z.enum(AUDIT_MODULE_KEYS).optional().or(z.literal('')),
    status: z.enum(AUDIT_STATUS_KEYS).optional().or(z.literal('')),
    startDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha desde inválida (YYYY-MM-DD)')
      .optional()
      .or(z.literal('')),
    endDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha hasta inválida (YYYY-MM-DD)')
      .optional()
      .or(z.literal('')),
  }),
});

export const updateSystemConfigSchema = z.object({
  body: z.object({
    ignoreStockCheck: z.boolean().optional(),
    afipMockMode: z.boolean().optional(),
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


