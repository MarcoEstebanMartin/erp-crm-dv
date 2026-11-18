import { formatResponsibleName } from '../../utils/formatters';

export const isEcheqTx = (t: any): boolean =>
  t?.paymentMethod === 'CHECK' && /\(echeq\)|e-?cheq/i.test(String(t?.description || ''));

export const isBankReconcilableTx = (t: any): boolean =>
  t?.type === 'INCOME' && (t?.paymentMethod === 'BANK_TRANSFER' || isEcheqTx(t));

const PAYMENT_METHOD_LABELS: Record<string, string> = {
  CASH: 'Efectivo',
  CHECK: 'Cheque',
  BANK_TRANSFER: 'Transferencia',
};

/** Normaliza los nombres de medios de pago con capitalización uniforme para tablas y modales. */
export const formatPaymentMethodLabel = (method?: string | null): string =>
  PAYMENT_METHOD_LABELS[method || ''] || 'Otro';

/** Parsea montos de CSV en formato argentino ($18.224,50) o internacional (18224.50 / 18,224.50). */
export const parseCsvAmount = (raw: string): number => {
  const cleaned = String(raw || '').replace(/[^\d.,-]/g, '').trim();
  if (!cleaned) return 0;

  const lastDot = cleaned.lastIndexOf('.');
  const lastComma = cleaned.lastIndexOf(',');
  let normalized = cleaned;

  if (lastDot !== -1 && lastComma !== -1) {
    normalized = lastDot > lastComma
      ? cleaned.replace(/,/g, '')
      : cleaned.replace(/\./g, '').replace(',', '.');
  } else if (lastComma !== -1) {
    const commaCount = (cleaned.match(/,/g) || []).length;
    if (commaCount > 1 || /^-?\d{1,3}(,\d{3})+$/.test(cleaned)) {
      normalized = cleaned.replace(/,/g, '');
    } else {
      normalized = cleaned.replace(',', '.');
    }
  } else if (lastDot !== -1) {
    const dotCount = (cleaned.match(/\./g) || []).length;
    if (dotCount > 1 || /^-?\d{1,3}(\.\d{3})+$/.test(cleaned)) {
      normalized = cleaned.replace(/\./g, '');
    }
  }

  const parsed = parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
};

export const parseMercadoPagoCsv = (text: string): any[] => {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length < 2) return [];

  const firstLine = lines[0];
  const separator = firstLine.includes(';') ? ';' : ',';
  const headers = firstLine.split(separator).map((h) => h.trim().replace(/^"|"$/g, '').toLowerCase());

  let amountIdx = headers.indexOf('transaction_amount');
  if (amountIdx === -1) amountIdx = headers.findIndex((h) => h.includes('amount') || h.includes('monto') || h.includes('neto') || h.includes('total') || h.includes('valor'));

  let dateIdx = headers.indexOf('transaction_date');
  if (dateIdx === -1) dateIdx = headers.findIndex((h) => h.includes('date') || h.includes('fecha') || h.includes('creacion') || h.includes('liberado') || h.includes('hora'));

  let idIdx = headers.indexOf('source_id');
  if (idIdx === -1) idIdx = headers.findIndex((h) => h.includes('id') || h.includes('operacion') || h.includes('transaccion') || h.includes('referencia') || h.includes('codigo'));

  const payerNameIdx = headers.indexOf('payer_name');
  const payerCuitIdx = headers.indexOf('payer_id_number');
  const extRefIdx = headers.indexOf('external_reference');
  if (amountIdx === -1) return [];

  return lines
    .slice(1)
    .map((line, rowIdx) => {
      let cells: string[] = [];
      if (separator === ',') {
        const matches = line.match(/(".*?"|[^",\s]+)(?=\s*,|\s*$)/g) || line.split(',');
        cells = matches.map((c) => c.replace(/^"|"$/g, '').trim());
      } else {
        cells = line.split(';').map((c) => c.replace(/^"|"$/g, '').trim());
      }
      if (cells.length <= Math.max(amountIdx, dateIdx, idIdx)) return null;
      const rawAmount = cells[amountIdx] ? parseCsvAmount(cells[amountIdx]) : 0;
      return {
        id: idIdx !== -1 && cells[idIdx] ? cells[idIdx] : `row-${rowIdx}`,
        amount: Math.abs(rawAmount),
        isIncome: rawAmount > 0,
        date: dateIdx !== -1 && cells[dateIdx] ? new Date(cells[dateIdx]) : new Date(),
        payerName: payerNameIdx !== -1 && cells[payerNameIdx] ? cells[payerNameIdx] : '',
        payerCuit: payerCuitIdx !== -1 && cells[payerCuitIdx] ? cells[payerCuitIdx].replace(/\D/g, '') : '',
        externalReference: extRefIdx !== -1 && cells[extRefIdx] ? cells[extRefIdx] : '',
      };
    })
    .filter((r): r is any => r !== null && r.amount > 0 && r.isIncome);
};

export const resolveMpRowMatchStatus = (
  row: any,
  reconciledRows: Set<string>,
  manualMatches: Record<string, any>,
  reconTransactions: any[],
  clients: any[],
) => {
  if (reconciledRows.has(row.id)) return { status: 'reconciled' };
  if (manualMatches[row.id]) return { status: 'unregistered', client: manualMatches[row.id], manual: true };

  const exactMatch = reconTransactions.find((tx: any) => {
    if (tx.verified) return false;
    if (Math.round(Number(tx.amount)) !== Math.round(row.amount)) return false;
    return Math.abs(new Date(tx.createdAt).getTime() - row.date.getTime()) < 3 * 24 * 60 * 60 * 1000;
  });
  if (exactMatch) return { status: 'exact', tx: exactMatch };

  const roundingMatch = reconTransactions.find((tx: any) => {
    if (tx.verified) return false;
    const diff = Math.abs(Number(tx.amount) - row.amount);
    const pctDiff = (diff / row.amount) * 100;
    if (diff > 1500 && pctDiff > 2) return false;
    return Math.abs(new Date(tx.createdAt).getTime() - row.date.getTime()) < 5 * 24 * 60 * 60 * 1000;
  });
  if (roundingMatch) return { status: 'rounding', tx: roundingMatch, diff: Number(roundingMatch.amount) - row.amount };

  if (row.payerCuit) {
    const clientByCuit = clients.find((c: any) => c.cuit && c.cuit.replace(/\D/g, '') === row.payerCuit);
    if (clientByCuit) return { status: 'unregistered', client: clientByCuit };
  }

  if (row.payerName && row.payerName.length > 3) {
    const cleanPayer = row.payerName.toLowerCase();
    const clientByName = clients.find((c: any) => {
      const cleanName = c.name.toLowerCase();
      return cleanName.includes(cleanPayer) || cleanPayer.includes(cleanName);
    });
    if (clientByName) return { status: 'unregistered', client: clientByName };
  }

  return { status: 'no_match' };
};

export const computeFilteredMetricsAndLedger = (
  drawers: any[],
  transactions: any[],
  filterStartDate: string,
  filterEndDate: string,
) => {
  const [sYear, sMonth, sDay] = filterStartDate.split('-').map(Number);
  const start = new Date(sYear, sMonth - 1, sDay, 0, 0, 0, 0);
  const [eYear, eMonth, eDay] = filterEndDate.split('-').map(Number);
  const end = new Date(eYear, eMonth - 1, eDay, 23, 59, 59, 999);

  const closedInPeriod = drawers.filter((d: any) => d.status === 'CLOSED' && new Date(d.closedAt) >= start && new Date(d.closedAt) <= end);

  let cashIncome = 0, checkIncome = 0;
  closedInPeriod.forEach((d: any) => {
    d.transactions?.forEach((t: any) => {
      if (t.type === 'INCOME') {
        if (t.paymentMethod === 'CASH') cashIncome += Number(t.amount);
        else if (t.paymentMethod === 'CHECK') checkIncome += Number(t.amount);
      } else if (t.type === 'OUTCOME') {
        if (t.paymentMethod === 'CASH') cashIncome -= Number(t.amount);
        else if (t.paymentMethod === 'CHECK') checkIncome -= Number(t.amount);
      }
    });
  });

  const directChecksInPeriod = transactions.filter((t: any) => {
    if (t.paymentMethod !== 'CHECK' || t.cashDrawerId !== null) return false;
    const txDate = new Date(t.createdAt);
    return txDate >= start && txDate <= end;
  });
  directChecksInPeriod.forEach((t: any) => {
    if (t.type === 'INCOME') checkIncome += Number(t.amount || 0);
    else if (t.type === 'OUTCOME') checkIncome -= Number(t.amount || 0);
  });

  const expensesInPeriod = transactions.filter((t: any) => {
    if (t.type !== 'OUTCOME' || t.cashDrawerId !== null || t.bankAccountId !== null) return false;
    const txDate = new Date(t.createdAt);
    return txDate >= start && txDate <= end;
  });
  const totalExpenses = expensesInPeriod.reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const transfersInPeriod = transactions.filter((t: any) => {
    if (t.paymentMethod !== 'BANK_TRANSFER' || t.type !== 'INCOME') return false;
    const txDate = new Date(t.createdAt);
    return txDate >= start && txDate <= end;
  });
  const reconcilableInPeriod = transactions.filter((t: any) => {
    if (!isBankReconcilableTx(t)) return false;
    const txDate = new Date(t.createdAt);
    return txDate >= start && txDate <= end;
  });
  const totalTransfers = transfersInPeriod.reduce((acc, t) => acc + Number(t.amount || 0), 0);

  const detailedCashItems: any[] = [];
  const detailedCheckItems: any[] = [];
  closedInPeriod.forEach((d: any) => {
    const branchLabel = d.branch ? (d.branch.toLowerCase().startsWith('caja:') ? d.branch : `Caja: ${d.branch}`) : `Caja: ${d.user?.username || 'Central'}`;
    if (d.transactions?.length > 0) {
      d.transactions.forEach((t: any) => {
        const isInc = t.type === 'INCOME';
        const item = {
          id: `tx-drawer-${t.id || Math.random()}`,
          date: t.createdAt || d.closedAt,
          type: isInc ? 'INGRESO' : 'EGRESO',
          origin: branchLabel,
          description: t.description || (isInc ? 'Cobro en cierre de caja' : 'Salida en cierre de caja'),
          paymentMethod: formatPaymentMethodLabel(t.paymentMethod),
          reference: t.receiptNumber || undefined,
          amount: Number(t.amount || 0),
          orderId: t.orderId || undefined,
          personaName: t.persona?.name || undefined,
        };
        if (t.paymentMethod === 'CASH') detailedCashItems.push(item);
        else if (t.paymentMethod === 'CHECK') detailedCheckItems.push(item);
      });
    } else {
      const netAmount = Number(d.realBalance || 0) - Number(d.openingBalance || 0);
      if (netAmount > 0) detailedCashItems.push({ id: `drawer-summary-${d.id}`, date: d.closedAt, type: 'INGRESO', origin: branchLabel, description: branchLabel, paymentMethod: 'Efectivo', amount: netAmount });
    }
  });

  directChecksInPeriod.forEach((t: any) => {
    const isInc = t.type === 'INCOME';
    detailedCheckItems.push({
      id: `check-direct-${t.id}`, date: t.createdAt, type: isInc ? 'INGRESO' : 'EGRESO',
      origin: t.persona?.name || (t.bankAccount ? `Banco: ${t.bankAccount.bankName || t.bankAccount.name || 'Cta Bancaria'}` : 'Mostrador'),
      description: t.description || (isInc ? 'Ingreso por cheque' : 'Salida por cheque'),
      paymentMethod: 'Cheque', reference: t.receiptNumber || undefined,
      amount: Number(t.amount || 0), orderId: t.orderId || undefined, personaName: t.persona?.name || undefined,
    });
  });
  detailedCheckItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const detailedTransferItems = transfersInPeriod.map((t: any) => ({
    id: `transfer-${t.id}`, date: t.createdAt, type: 'INGRESO',
    origin: t.bankAccount ? `Banco: ${t.bankAccount.bankName || t.bankAccount.name || 'Cta Bancaria'}` : 'Transferencia Bancaria',
    description: t.description || 'Ingreso por transferencia bancaria', paymentMethod: 'Transferencia',
    reference: t.receiptNumber || undefined, amount: Number(t.amount || 0),
    orderId: t.orderId || undefined, personaName: t.persona?.name || undefined,
  }));

  const detailedExpenseItems = expensesInPeriod.map((t: any) => ({
    id: `expense-${t.id}`, date: t.createdAt, type: 'EGRESO',
    origin: 'Gastos Generales (Tesorería)', description: t.description || 'Gasto registrado',
    paymentMethod: formatPaymentMethodLabel(t.paymentMethod), reference: t.receiptNumber || undefined, amount: Number(t.amount || 0),
  }));

  const detailedNetItems = [...detailedCashItems, ...detailedCheckItems, ...detailedTransferItems, ...detailedExpenseItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const ledgerItems: any[] = [];
  closedInPeriod.forEach((d: any) => {
    const netAmount = Number(d.realBalance || 0) - Number(d.openingBalance || 0);
    const methodsSet = new Set<string>();
    (d.transactions || []).forEach((t: any) => {
      if (t.paymentMethod) methodsSet.add(formatPaymentMethodLabel(t.paymentMethod));
    });
    const methods = Array.from(methodsSet);
    ledgerItems.push({
      id: `drawer-${d.id}`, date: d.closedAt, type: 'INGRESO', description: formatResponsibleName(d),
      paymentMethod: methods.length === 1 ? methods[0] : methods.length > 1 ? 'Varios' : 'Efectivo',
      amount: netAmount, drawer: d,
    });
  });

  expensesInPeriod.forEach((t: any) => {
    ledgerItems.push({
      id: `tx-${t.id}`, date: t.createdAt, type: 'EGRESO',
      description: `Gasto: ${t.description}`, paymentMethod: formatPaymentMethodLabel(t.paymentMethod), amount: Number(t.amount),
    });
  });
  ledgerItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    cashIncome, checkIncome, totalExpenses, totalTransfers,
    netIncome: cashIncome + checkIncome + totalTransfers - totalExpenses,
    ledger: ledgerItems, transfers: reconcilableInPeriod,
    detailedCashItems, detailedCheckItems, detailedTransferItems, detailedExpenseItems, detailedNetItems,
  };
};

export const computeCajaGrandeBalance = (allDrawers: any[], allTxs: any[]): number => {
  const centralClosed = (allDrawers || [])
    .filter((d: any) => d.status === 'CLOSED' && d.drawerType === 'CENTRAL')
    .sort((a: any, b: any) => new Date(b.closedAt).getTime() - new Date(a.closedAt).getTime());
  const lastCentral = centralClosed[0] || null;
  const cutoffDate = lastCentral ? new Date(lastCentral.closedAt) : null;
  const baseBalance = lastCentral ? Number(lastCentral.realBalance || 0) : 0;

  const closed = (allDrawers || []).filter(
    (d: any) => d.status === 'CLOSED' && d.drawerType !== 'CENTRAL' && (!cutoffDate || new Date(d.closedAt) > cutoffDate)
  );
  const netDrawersCash = closed.reduce(
    (acc: number, curr: any) => acc + (Number(curr.realBalance || 0) - Number(curr.openingBalance || 0)),
    0
  );
  const overallExpenses = (allTxs || []).filter(
    (t: any) => t.type === 'OUTCOME' && t.cashDrawerId === null && t.bankAccountId === null && (!cutoffDate || new Date(t.createdAt) > cutoffDate)
  );
  const totalExpensesOverall = overallExpenses.reduce((acc: number, curr: any) => acc + Number(curr.amount || 0), 0);
  return baseBalance + netDrawersCash - totalExpensesOverall;
};
