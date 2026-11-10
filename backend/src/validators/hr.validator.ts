import { z } from 'zod';

const optionalPositiveInt = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? null : val),
  z.coerce.number().int().positive().nullable().optional(),
);

const optionalNonNegativeAmount = z.preprocess(
  (val) => (val === '' || val === null || val === undefined ? 0 : val),
  z.coerce.number().min(0, 'El monto no puede ser negativo.'),
);

export const employeeIdParamSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive('ID de empleado inválido.') }),
});

export const createEmployeeSchema = z.object({
  body: z.object({
    firstName: z.string().trim().min(1, 'El nombre es obligatorio.').max(120),
    lastName: z.string().trim().min(1, 'El apellido es obligatorio.').max(120),
    dni: z.string().trim().min(1, 'El DNI es obligatorio.').max(30),
    cuil: z.string().max(30).optional().nullable(),
    email: z.string().max(150).optional().nullable(),
    phone: z.string().max(60).optional().nullable(),
    address: z.string().max(250).optional().nullable(),
    position: z.string().trim().min(1, 'El puesto es obligatorio.').max(120),
    department: z.string().max(80).optional().nullable(),
    hireDate: z.string().min(1, 'La fecha de ingreso es obligatoria.'),
    baseSalary: z.coerce.number().min(0, 'El sueldo básico no puede ser negativo.'),
    paymentMethod: z.string().max(40).optional().nullable(),
    cbuAlias: z.string().max(120).optional().nullable(),
    bankName: z.string().max(120).optional().nullable(),
    birthDate: z.string().optional().nullable(),
    emergencyContact: z.string().max(200).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    userId: optionalPositiveInt,
  }),
});

export const updateEmployeeSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive('ID de empleado inválido.') }),
  body: z
    .object({
      firstName: z.string().trim().min(1).max(120).optional(),
      lastName: z.string().trim().min(1).max(120).optional(),
      dni: z.string().trim().min(1).max(30).optional(),
      position: z.string().trim().min(1).max(120).optional(),
      baseSalary: z.coerce.number().min(0).optional(),
      isActive: z.boolean().optional(),
      userId: optionalPositiveInt,
    })
    .passthrough(),
});

export const createAdvanceSchema = z.object({
  body: z.object({
    employeeId: z.coerce.number().int().positive('El empleado es obligatorio.'),
    amount: z.coerce.number().positive('El monto del adelanto debe ser mayor a cero.'),
    reason: z.string().max(500).optional().nullable(),
    paymentMethod: z.string().max(40).optional().nullable(),
    cashDrawerId: optionalPositiveInt,
    bankAccountId: optionalPositiveInt,
  }),
});

export const calculatePayrollQuerySchema = z.object({
  query: z.object({
    employeeId: z.coerce.number().int().positive('employeeId es requerido.'),
    periodMonth: z.coerce.number().int().min(1).max(12),
    periodYear: z.coerce.number().int().min(2000).max(2100),
  }),
});

export const createPayrollSchema = z.object({
  body: z.object({
    employeeId: z.coerce.number().int().positive('El empleado es obligatorio.'),
    periodMonth: z.coerce.number().int().min(1).max(12),
    periodYear: z.coerce.number().int().min(2000).max(2100),
    baseSalary: z.coerce.number().min(0, 'El sueldo básico es obligatorio.'),
    commissions: optionalNonNegativeAmount.optional(),
    overtimeAmount: optionalNonNegativeAmount.optional(),
    bonuses: optionalNonNegativeAmount.optional(),
    advancesDeduction: optionalNonNegativeAmount.optional(),
    otherDeductions: optionalNonNegativeAmount.optional(),
    paymentMethod: z.string().max(40).optional().nullable(),
    cashDrawerId: optionalPositiveInt,
    bankAccountId: optionalPositiveInt,
    notes: z.string().max(2000).optional().nullable(),
  }),
});

export const createVacationSchema = z.object({
  body: z.object({
    employeeId: z.coerce.number().int().positive('El empleado es obligatorio.'),
    year: z.coerce.number().int().min(2000).max(2100).optional(),
    type: z.string().max(50).optional().nullable(),
    startDate: z.string().min(1, 'La fecha de inicio es obligatoria.'),
    endDate: z.string().min(1, 'La fecha de fin es obligatoria.'),
    daysCount: z.coerce.number().int().positive().optional(),
    comments: z.string().max(1000).optional().nullable(),
  }),
});

export const updateVacationStatusSchema = z.object({
  params: z.object({ id: z.coerce.number().int().positive('ID inválido.') }),
  body: z.object({ status: z.string().trim().min(1, 'El estado es obligatorio.').max(40) }),
});

export const createDocumentSchema = z.object({
  body: z.object({
    employeeId: z.coerce.number().int().positive('El empleado es obligatorio.'),
    type: z.string().trim().min(1, 'El tipo de documento es obligatorio.').max(80),
    description: z.string().trim().min(1, 'La descripción es obligatoria.').max(500),
    expirationDate: z.string().min(1, 'La fecha de vencimiento es obligatoria.'),
  }),
});
