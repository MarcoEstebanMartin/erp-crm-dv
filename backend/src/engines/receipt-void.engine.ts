import { Role } from '@prisma/client';

const ARGENTINA_TZ = 'America/Argentina/Buenos_Aires';

const argentinaDateFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: ARGENTINA_TZ,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/**
 * Convierte una fecha a clave calendario local de Argentina (`YYYY-MM-DD`).
 */
export function toArgentinaDateKey(date: Date): string {
  return argentinaDateFormatter.format(date);
}

export function isSameArgentinaDay(dateA: Date, dateB: Date): boolean {
  return toArgentinaDateKey(dateA) === toArgentinaDateKey(dateB);
}

export interface ReceiptVoidPermissionInput {
  userRole: Role | string;
  createdAt: Date;
  now?: Date;
  verified: boolean;
  alreadyVoided: boolean;
  isFieldReceipt: boolean;
  fieldReceiptLabel?: string | null;
  cashDrawerStatus?: string | null;
}

export interface ReceiptVoidPermissionResult {
  allowed: boolean;
  statusCode?: number;
  reason?: string;
}

/**
 * Motor puro de política de anulación de recibos de oficina (Opción 1 - Híbrida):
 * - Nunca se borra un recibo; solo se anula dejando rastro.
 * - ADMIN puede anular cualquier recibo de oficina no anulado.
 * - FACTURACION solo puede anular recibos del mismo día calendario (AR),
 *   no verificados/rendidos y cuya caja (si existe) no esté cerrada.
 * - Recibos emitidos en calle deben anularse desde Recibos en Calle / Rendiciones.
 */
export function evaluateReceiptVoidPermission(
  input: ReceiptVoidPermissionInput,
): ReceiptVoidPermissionResult {
  if (input.alreadyVoided) {
    return {
      allowed: false,
      statusCode: 409,
      reason: 'Este recibo ya fue anulado.',
    };
  }

  if (input.isFieldReceipt) {
    const labelSuffix = input.fieldReceiptLabel ? ` (${input.fieldReceiptLabel})` : '';
    return {
      allowed: false,
      statusCode: 409,
      reason: `Este recibo${labelSuffix} fue emitido en calle. Anulalo desde Recibos en Calle / Rendiciones.`,
    };
  }

  if (input.userRole === Role.ADMIN) {
    return { allowed: true };
  }

  if (input.userRole !== Role.FACTURACION) {
    return {
      allowed: false,
      statusCode: 403,
      reason: 'No tienes permisos para anular recibos.',
    };
  }

  if (input.verified) {
    return {
      allowed: false,
      statusCode: 403,
      reason:
        'Este recibo ya fue verificado en una rendición o conciliación. Solo un Administrador puede anularlo.',
    };
  }

  if (input.cashDrawerStatus === 'CLOSED') {
    return {
      allowed: false,
      statusCode: 403,
      reason:
        'La caja asociada a este recibo ya fue cerrada. Solo un Administrador puede anularlo.',
    };
  }

  const now = input.now ?? new Date();
  if (!isSameArgentinaDay(input.createdAt, now)) {
    return {
      allowed: false,
      statusCode: 403,
      reason:
        'Facturación solo puede anular recibos emitidos en el mismo día. Pedile a un Administrador que lo anule.',
    };
  }

  return { allowed: true };
}
