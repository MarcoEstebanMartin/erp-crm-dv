import { formatResponsibleName } from '../../utils/formatters';

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
      const rawAmount = cells[amountIdx] ? parseFloat(cells[amountIdx].replace(/[$.]/g, '').replace(',', '.')) : 0;
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
          paymentMethod: t.paymentMethod === 'CASH' ? 'EFECTIVO' : t.paymentMethod === 'CHECK' ? 'CHEQUE' : t.paymentMethod,
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
      if (netAmount > 0) detailedCashItems.push({ id: `drawer-summary-${d.id}`, date: d.closedAt, type: 'INGRESO', origin: branchLabel, description: branchLabel, paymentMethod: 'EFECTIVO', amount: netAmount });
    }
  });

  const detailedTransferItems = transfersInPeriod.map((t: any) => ({
    id: `transfer-${t.id}`,
    date: t.createdAt,
    type: 'INGRESO',
    origin: t.bankAccount ? `Banco: ${t.bankAccount.bankName || t.bankAccount.name || 'Cta Bancaria'}` : 'Transferencia Bancaria',
    description: t.description || 'Ingreso por transferencia bancaria',
    paymentMethod: 'TRANSFERENCIA',
    reference: t.receiptNumber || undefined,
    amount: Number(t.amount || 0),
    orderId: t.orderId || undefined,
    personaName: t.persona?.name || undefined,
  }));

  const detailedExpenseItems = expensesInPeriod.map((t: any) => ({
    id: `expense-${t.id}`,
    date: t.createdAt,
    type: 'EGRESO',
    origin: 'Gastos Generales (Tesorería)',
    description: t.description || 'Gasto registrado',
    paymentMethod: t.paymentMethod === 'CASH' ? 'EFECTIVO' : t.paymentMethod === 'CHECK' ? 'CHEQUE' : 'OTRO',
    reference: t.receiptNumber || undefined,
    amount: Number(t.amount || 0),
  }));

  const detailedNetItems = [...detailedCashItems, ...detailedCheckItems, ...detailedTransferItems, ...detailedExpenseItems].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  const ledgerItems: any[] = [];
  closedInPeriod.forEach((d: any) => {
    const netAmount = Number(d.realBalance || 0) - Number(d.openingBalance || 0);
    const methodsSet = new Set<string>();
    (d.transactions || []).forEach((t: any) => {
      if (t.paymentMethod === 'CASH') methodsSet.add('Efectivo');
      else if (t.paymentMethod === 'CHECK') methodsSet.add('Cheque');
      else if (t.paymentMethod === 'BANK_TRANSFER') methodsSet.add('Transferencia');
    });
    const methods = Array.from(methodsSet);
    ledgerItems.push({
      id: `drawer-${d.id}`,
      date: d.closedAt,
      type: 'INGRESO',
      description: formatResponsibleName(d),
      paymentMethod: methods.length === 1 ? methods[0] : methods.length > 1 ? 'Varios' : 'Efectivo',
      amount: netAmount,
      drawer: d,
    });
  });

  expensesInPeriod.forEach((t: any) => {
    ledgerItems.push({
      id: `tx-${t.id}`,
      date: t.createdAt,
      type: 'EGRESO',
      description: `Gasto: ${t.description}`,
      paymentMethod: t.paymentMethod === 'CASH' ? 'EFECTIVO' : t.paymentMethod === 'CHECK' ? 'CHEQUE' : 'OTRO',
      amount: Number(t.amount),
    });
  });
  ledgerItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  return {
    cashIncome, checkIncome, totalExpenses, totalTransfers,
    netIncome: cashIncome + checkIncome + totalTransfers - totalExpenses,
    ledger: ledgerItems, transfers: transfersInPeriod,
    detailedCashItems, detailedCheckItems, detailedTransferItems, detailedExpenseItems, detailedNetItems,
  };
};
