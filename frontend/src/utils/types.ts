export const Role = {
  ADMIN: 'ADMIN',
  FACTURACION: 'FACTURACION',
  VENDEDOR: 'VENDEDOR',
  DEPOSITO: 'DEPOSITO',
} as const;
export type Role = typeof Role[keyof typeof Role];

export const BillingType = {
  OFFICIAL: 'OFFICIAL',
  INTERNAL: 'INTERNAL',
} as const;
export type BillingType = typeof BillingType[keyof typeof BillingType];

export const InvoiceType = {
  FACTURA_A: 'FACTURA_A',
  FACTURA_B: 'FACTURA_B',
  FACTURA_C: 'FACTURA_C',
  PRESUPUESTO: 'PRESUPUESTO',
} as const;
export type InvoiceType = typeof InvoiceType[keyof typeof InvoiceType];

export const OrderStatus = {
  PENDING: 'PENDING',
  PREPARING: 'PREPARING',
  PREPARED: 'PREPARED',
  DELIVERED: 'DELIVERED',
  CANCELLED: 'CANCELLED',
} as const;
export type OrderStatus = typeof OrderStatus[keyof typeof OrderStatus];

export const MovementType = {
  IN: 'IN',
  OUT: 'OUT',
  ADJUSTMENT: 'ADJUSTMENT',
} as const;
export type MovementType = typeof MovementType[keyof typeof MovementType];

export const TransactionType = {
  INCOME: 'INCOME',
  OUTCOME: 'OUTCOME',
} as const;
export type TransactionType = typeof TransactionType[keyof typeof TransactionType];

export const PaymentMethod = {
  CASH: 'CASH',
  BANK_TRANSFER: 'BANK_TRANSFER',
  CHECK: 'CHECK',
  OTHER: 'OTHER',
} as const;
export type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];
