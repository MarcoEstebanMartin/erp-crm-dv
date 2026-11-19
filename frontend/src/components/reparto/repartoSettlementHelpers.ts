export interface ClientFieldReceiptSummary {
  personaId: number;
  receiptNumbers: string[];
  total: number;
  cash: number;
  transfer: number;
  check: number;
}

export interface RouteSettlementRow {
  orderId: number;
  personaId: number;
  clientName: string;
  invoiceNumber: string;
  amount: number;
  paymentMethod: 'FIELD_RECEIPT' | 'CREDITO' | 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'NOT_DELIVERED';
  lockedByFieldReceipt: boolean;
  fieldReceipts: ClientFieldReceiptSummary | null;
  bankAccountId: string | number;
  checkNumber: string;
  checkIssuer: string;
  isEcheq: boolean;
  checkAmount: number;
}

export interface RouteSettlementTotals {
  totalOrders: number;
  totalCash: number;
  totalTransfer: number;
  totalCheck: number;
  totalCredit: number;
  totalNotDelivered: number;
  notDeliveredCount: number;
  fieldReceiptOrdersCount: number;
}

export function buildFieldReceiptsByClientMap(route: any): Record<number, ClientFieldReceiptSummary> {
  const map: Record<number, ClientFieldReceiptSummary> = {};
  const receipts = Array.isArray(route?.fieldReceipts) ? route.fieldReceipts : [];

  for (const r of receipts) {
    if (String(r?.status || '').toUpperCase() === 'VOIDED') continue;
    const personaId = Number(r.personaId);
    if (!personaId) continue;

    if (!map[personaId]) {
      map[personaId] = {
        personaId,
        receiptNumbers: [],
        total: 0,
        cash: 0,
        transfer: 0,
        check: 0,
      };
    }

    const entry = map[personaId];
    entry.receiptNumbers.push(String(r.receiptNumber || r.provisionalCode || `#${r.id}`));

    let paymentSum = 0;
    const payments = Array.isArray(r.payments) ? r.payments : [];
    for (const p of payments) {
      if (String(p?.status || '').toUpperCase() === 'REJECTED') continue;
      const amt = Math.round(Number(p.amount) || 0);
      paymentSum += amt;
      if (p.paymentMethod === 'CASH') entry.cash += amt;
      else if (p.paymentMethod === 'BANK_TRANSFER') entry.transfer += amt;
      else if (p.paymentMethod === 'CHECK') entry.check += amt;
    }

    entry.total += paymentSum > 0 ? paymentSum : Math.round(Number(r.totalAmount) || 0);
  }

  return map;
}

export function buildInitialRouteSettlements(
  route: any,
  bankAccounts: any[],
): RouteSettlementRow[] {
  const receiptsByClient = buildFieldReceiptsByClientMap(route);
  const defaultBankId = bankAccounts[0]?.id || '';
  const orders = Array.isArray(route?.orders) ? route.orders : [];

  return orders.map((o: any) => {
    const personaId = Number(o.personaId || o.persona?.id || 0);
    const amount = Math.round(Number(o.totalAmount) || 0);
    const summary = receiptsByClient[personaId] ?? null;
    const hasFieldReceipt = Boolean(summary && summary.total > 0);

    return {
      orderId: Number(o.id),
      personaId,
      clientName: o.persona?.name || 'Cliente',
      invoiceNumber: o.invoiceNumber || `Pedido #${o.id}`,
      amount,
      paymentMethod: hasFieldReceipt ? 'FIELD_RECEIPT' : 'CREDITO',
      lockedByFieldReceipt: hasFieldReceipt,
      fieldReceipts: hasFieldReceipt ? summary : null,
      bankAccountId: defaultBankId,
      checkNumber: '',
      checkIssuer: '',
      isEcheq: false,
      checkAmount: amount,
    };
  });
}

export function computeRouteSettlementTotals(
  settlements: RouteSettlementRow[],
): RouteSettlementTotals {
  let totalOrders = 0;
  let totalCash = 0;
  let totalTransfer = 0;
  let totalCheck = 0;
  let totalCredit = 0;
  let totalNotDelivered = 0;
  let notDeliveredCount = 0;
  let fieldReceiptOrdersCount = 0;
  const countedFieldClients = new Set<number>();

  for (const row of settlements) {
    const amt = Math.round(Number(row.amount) || 0);
    totalOrders += amt;

    if (row.paymentMethod === 'FIELD_RECEIPT' && row.fieldReceipts) {
      fieldReceiptOrdersCount += 1;
      if (!countedFieldClients.has(row.personaId)) {
        countedFieldClients.add(row.personaId);
        totalCash += row.fieldReceipts.cash;
        totalTransfer += row.fieldReceipts.transfer;
        totalCheck += row.fieldReceipts.check;
      }
    } else if (row.paymentMethod === 'CASH') {
      totalCash += amt;
    } else if (row.paymentMethod === 'BANK_TRANSFER') {
      totalTransfer += amt;
    } else if (row.paymentMethod === 'CHECK') {
      totalCheck += amt;
    } else if (row.paymentMethod === 'NOT_DELIVERED') {
      totalNotDelivered += amt;
      notDeliveredCount += 1;
    } else {
      totalCredit += amt;
    }
  }

  return {
    totalOrders,
    totalCash,
    totalTransfer,
    totalCheck,
    totalCredit,
    totalNotDelivered,
    notDeliveredCount,
    fieldReceiptOrdersCount,
  };
}

export function formatFieldReceiptBreakdown(summary: ClientFieldReceiptSummary): string {
  const parts: string[] = [];
  if (summary.cash > 0) parts.push(`Efectivo $${summary.cash.toLocaleString('es-AR')}`);
  if (summary.transfer > 0) parts.push(`Transf. $${summary.transfer.toLocaleString('es-AR')}`);
  if (summary.check > 0) parts.push(`Cheque $${summary.check.toLocaleString('es-AR')}`);
  return parts.join(' · ') || `$${summary.total.toLocaleString('es-AR')}`;
}
