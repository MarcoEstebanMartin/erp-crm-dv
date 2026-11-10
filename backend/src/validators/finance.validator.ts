import { z } from 'zod';

export const openDrawerSchema = z.object({
  body: z.object({
    branch: z.string().max(60).optional(),
    drawerType: z.string().max(40).optional(),
    routeNote: z.string().max(500).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    openingBalance: z.coerce.number().min(0, 'El saldo inicial debe ser mayor o igual a cero.'),
    userId: z.coerce.number().int().positive().optional().nullable(),
  }),
});

export const closeDrawerSchema = z.object({
  body: z.object({
    drawerId: z.coerce.number().int().positive('El ID de la caja es obligatorio.'),
    realBalance: z.coerce.number().min(0, 'El saldo real no puede ser negativo.'),
    routeNote: z.string().max(500).optional().nullable(),
    notes: z.string().max(2000).optional().nullable(),
    receipts: z
      .array(
        z.object({
          clientId: z.coerce.number().int().positive(),
          clientName: z.string().optional(),
          amount: z.coerce.number().positive(),
          billingType: z.string().optional(),
          paymentMethod: z.string().optional(),
          checkNumber: z.string().max(150).optional().nullable(),
          bankAccountId: z.coerce.number().int().positive().optional().nullable(),
        }),
      )
      .optional(),
    checks: z.array(z.any()).optional(),
  }),
});

export const closeJointDrawersSchema = z.object({
  body: z.object({
    realBalanceA: z.coerce.number().min(0).optional().nullable(),
    realBalanceX: z.coerce.number().min(0).optional().nullable(),
  }),
});

export const createBankAccountSchema = z.object({
  body: z.object({
    name: z.string().trim().min(1, 'El nombre del banco es obligatorio.').max(120),
    accountNumber: z.string().max(120).optional().nullable(),
    balance: z.coerce.number().optional(),
  }),
});

export const updateBankAccountSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de cuenta bancaria inválido.'),
  }),
  body: z.object({
    name: z.string().trim().min(1, 'El nombre de la cuenta bancaria es obligatorio.').max(120),
    accountNumber: z.string().max(120).optional().nullable(),
  }),
});

export const transferFundsSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive('El monto de transferencia debe ser mayor a cero.'),
    bankAccountId: z.coerce.number().int().positive('El banco destino es obligatorio.'),
    description: z.string().max(500).optional().nullable(),
  }),
});

export const verifyTransactionSchema = z.object({
  params: z.object({
    id: z.coerce.number().int().positive('ID de transacción inválido.'),
  }),
  body: z.object({
    verified: z.boolean(),
    adjustedAmount: z.coerce.number().positive().optional().nullable(),
  }),
});

export const createCentralExpenseSchema = z.object({
  body: z.object({
    amount: z.coerce.number().positive('El monto del gasto debe ser mayor a 0.'),
    description: z.string().trim().min(1, 'La descripción del gasto es obligatoria.').max(500),
    paymentMethod: z.string().optional(),
    billingType: z.string().optional(),
  }),
});

export const closeCentralDrawerSchema = z.object({
  body: z.object({
    realBalance: z.coerce.number().min(0, 'El saldo declarado no puede ser negativo.').optional(),
    notes: z.string().max(2000).optional().nullable(),
  }),
});
