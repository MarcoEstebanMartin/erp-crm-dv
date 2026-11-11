import { BillingType, LedgerEntryType, LedgerSourceType, Prisma } from '@prisma/client';
import { roundToIntegerPeso, roundToTwoDecimals } from '../../core/money';

/**
 * Fuentes comerciales de clientes donde el comprobante se contabiliza en Cuenta Corriente
 * en Pesos Enteros exactos (0 centavos fantasma), mientras que el registro fiscal (`Order` / `CreditNote`)
 * preserva los 2 decimales legales exigidos por ARCA/AFIP.
 */
const CLIENT_INTEGER_LEDGER_SOURCES = new Set<LedgerSourceType>([
  LedgerSourceType.ORDER_INVOICE,
  LedgerSourceType.ORDER_CANCELLATION,
  LedgerSourceType.CREDIT_NOTE,
]);

export interface RecordLedgerMovementParams {
  personaId: number;
  entryType: LedgerEntryType;
  sourceType: LedgerSourceType;
  billingType?: BillingType;
  amount: string | number;
  reference: string;
  description: string;
  metadata?: Prisma.InputJsonValue;
  orderId?: number | null;
  transactionId?: number | null;
  creditNoteId?: number | null;
  supplierInvoiceId?: number | null;
  purchaseOrderId?: number | null;
  taxWithholdingId?: number | null;
  userId?: number | null;
  occurredAt?: Date;
}

/**
 * Servicio Central e Inmutable del Libro Mayor Físico (AccountLedger).
 *
 * ÚNICO punto autorizado para modificar `Persona.outstandingBalance` en operaciones de negocio:
 *  1. Actualiza atómicamente `Persona.outstandingBalance` con bloqueo de fila en PostgreSQL (`increment` en DEBIT, `decrement` en CREDIT).
 *  2. Lee el saldo resultante exacto (`balanceAfter`) devuelto por PostgreSQL.
 *  3. Inserta el asiento auditable e inmutable en `AccountLedger` dentro de la misma transacción `tx`.
 */
export async function recordLedgerMovement(
  tx: Prisma.TransactionClient | any,
  params: RecordLedgerMovementParams,
) {
  const normalizedAmount = CLIENT_INTEGER_LEDGER_SOURCES.has(params.sourceType)
    ? roundToIntegerPeso(params.amount).toNumber()
    : roundToTwoDecimals(params.amount).toNumber();
  if (normalizedAmount <= 0) {
    return null;
  }

  const updatedPersona = await tx.persona.update({
    where: { id: params.personaId },
    data: {
      outstandingBalance:
        params.entryType === LedgerEntryType.DEBIT
          ? { increment: normalizedAmount }
          : { decrement: normalizedAmount },
    },
  });

  const balanceAfter = roundToTwoDecimals(
    updatedPersona?.outstandingBalance !== undefined && updatedPersona?.outstandingBalance !== null
      ? updatedPersona.outstandingBalance.toString()
      : 0,
  ).toNumber();

  const entry = await tx.accountLedger.create({
    data: {
      personaId: params.personaId,
      entryType: params.entryType,
      sourceType: params.sourceType,
      billingType: params.billingType ?? BillingType.INTERNAL,
      amount: normalizedAmount,
      balanceAfter,
      reference: params.reference,
      description: params.description,
      metadata: params.metadata ?? undefined,
      orderId: params.orderId ?? null,
      transactionId: params.transactionId ?? null,
      creditNoteId: params.creditNoteId ?? null,
      supplierInvoiceId: params.supplierInvoiceId ?? null,
      purchaseOrderId: params.purchaseOrderId ?? null,
      taxWithholdingId: params.taxWithholdingId ?? null,
      userId: params.userId ?? null,
      occurredAt: params.occurredAt ?? new Date(),
    },
  });

  return { entry, updatedPersona, balanceAfter };
}

/**
 * Mapea una fila física de `AccountLedger` al contrato JSON consumido por el Frontend
 * (`ResumenCuentaModal`, `FinanzasDashboard`, `ComprasDashboard`), preservando IDs clicables
 * únicos y evitando colisiones de `key` en React cuando existen anulaciones/ajustes.
 */
export function mapLedgerEntryToViewItem(entry: any, seenUiIds: Set<string>) {
  let uiId = `ledger-${entry.id}`;

  if (entry.sourceType === LedgerSourceType.ORDER_INVOICE && entry.orderId) {
    uiId = `order-${entry.orderId}`;
  } else if (
    (entry.sourceType === LedgerSourceType.COLLECTION_RECEIPT ||
      entry.sourceType === LedgerSourceType.SUPPLIER_PAYMENT) &&
    entry.transactionId
  ) {
    uiId = `transaction-${entry.transactionId}`;
  } else if (entry.sourceType === LedgerSourceType.CREDIT_NOTE && entry.creditNoteId) {
    uiId = `credit-note-${entry.creditNoteId}`;
  } else if (entry.sourceType === LedgerSourceType.SUPPLIER_INVOICE && entry.supplierInvoiceId) {
    uiId = `supplier-invoice-${entry.supplierInvoiceId}`;
  } else if (entry.sourceType === LedgerSourceType.TAX_WITHHOLDING && entry.taxWithholdingId) {
    uiId = `withholding-${entry.taxWithholdingId}`;
  }

  if (seenUiIds.has(uiId)) {
    uiId = `ledger-${entry.id}`;
  }
  seenUiIds.add(uiId);

  return {
    id: uiId,
    ledgerId: entry.id,
    movementId: entry.movementId,
    date: entry.occurredAt,
    type: entry.entryType,
    sourceType: entry.sourceType,
    billingType: entry.billingType,
    reference: entry.reference,
    description: entry.description,
    amount: roundToTwoDecimals(entry.amount.toString()).toNumber(),
    balance: roundToTwoDecimals(entry.balanceAfter.toString()).toNumber(),
    metadata: entry.metadata ?? undefined,
  };
}
