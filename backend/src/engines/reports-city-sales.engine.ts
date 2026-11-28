import { Decimal } from 'decimal.js';
import { NumericInput, roundToIntegerPeso } from '../core/money';
import {
  normalizeCity,
  ReportLineItemInput,
  resolveCreditNoteCommercialRevenueDec,
  resolveOrderCommercialRevenueDec,
} from './reports-core.engine';

export interface CitySaleOrderInput {
  id: number;
  movementId?: number | null;
  createdAt: Date;
  billingType: string;
  invoiceType?: string | null;
  invoiceNumber?: string | null;
  totalAmount: NumericInput;
  persona?: { id?: number; name?: string | null; city?: string | null } | null;
  items: ReportLineItemInput[];
}

export interface CitySaleCreditNoteInput {
  id: number;
  movementId?: number | null;
  createdAt: Date;
  billingType: string;
  creditNoteType?: string | null;
  creditNoteNumber?: string | null;
  totalAmount: NumericInput;
  persona?: { id?: number; name?: string | null; city?: string | null } | null;
  order?: {
    persona?: { id?: number; name?: string | null; city?: string | null } | null;
  } | null;
  items: ReportLineItemInput[];
}

export interface CitySaleDetailItem {
  id: number;
  movementId: number;
  kind: 'ORDER' | 'CREDIT_NOTE';
  date: string;
  clientName: string;
  voucher: string;
  billingType: 'OFFICIAL' | 'INTERNAL';
  branch: 'A' | 'X';
  amount: number;
}

export interface CitySalesDetailResult {
  city: string;
  summary: {
    official: number;
    internal: number;
    total: number;
    officialCount: number;
    internalCount: number;
    count: number;
    creditNotesCount: number;
  };
  items: CitySaleDetailItem[];
}

export function normalizeTargetCity(city: string): string {
  const trimmed = String(city || '').trim();
  if (!trimmed || trimmed.toLowerCase() === 'sin localidad') {
    return 'Sin Localidad';
  }
  return normalizeCity(trimmed);
}

export function formatSaleVoucherLabel(params: {
  kind: 'ORDER' | 'CREDIT_NOTE';
  type?: string | null;
  number?: string | null;
  movementId?: number | null;
  id: number;
}): string {
  const rawNumber = String(params.number || '').trim();
  const type = String(params.type || '').toUpperCase();

  let prefix = 'VTA';
  if (params.kind === 'ORDER') {
    if (type === 'FACTURA_A') prefix = 'FAC A';
    else if (type === 'FACTURA_B') prefix = 'FAC B';
    else if (type === 'FACTURA_C') prefix = 'FAC C';
    else if (type === 'PRESUPUESTO') prefix = 'PRES';
  } else {
    if (type === 'NOTA_CREDITO_A') prefix = 'NC A';
    else if (type === 'NOTA_CREDITO_B') prefix = 'NC B';
    else if (type === 'NOTA_CREDITO_C') prefix = 'NC C';
    else if (type === 'NOTA_CREDITO_INTERNA') prefix = 'NC X';
    else prefix = 'NC';
  }

  if (rawNumber) {
    if (rawNumber.toUpperCase().startsWith(prefix)) {
      return rawNumber;
    }
    return `${prefix} ${rawNumber}`;
  }

  const ref = params.movementId && params.movementId > 0 ? params.movementId : params.id;
  return `${prefix} #${ref}`;
}

export function buildCitySalesDetail(input: {
  city: string;
  orders: CitySaleOrderInput[];
  creditNotes: CitySaleCreditNoteInput[];
}): CitySalesDetailResult {
  const targetCity = normalizeTargetCity(input.city);
  let officialDec = new Decimal(0);
  let internalDec = new Decimal(0);
  let officialCount = 0;
  let internalCount = 0;
  let creditNotesCount = 0;
  const items: CitySaleDetailItem[] = [];

  for (const order of input.orders) {
    if (normalizeCity(order.persona?.city) !== targetCity) continue;
    const amountDec = resolveOrderCommercialRevenueDec(order);
    const isOfficial = order.billingType === 'OFFICIAL';

    if (isOfficial) {
      officialDec = officialDec.plus(amountDec);
      officialCount += 1;
    } else {
      internalDec = internalDec.plus(amountDec);
      internalCount += 1;
    }

    items.push({
      id: order.id,
      movementId: Number(order.movementId || order.id),
      kind: 'ORDER',
      date: order.createdAt.toISOString(),
      clientName: order.persona?.name?.trim() || 'Sin Cliente',
      voucher: formatSaleVoucherLabel({
        kind: 'ORDER',
        type: order.invoiceType,
        number: order.invoiceNumber,
        movementId: order.movementId,
        id: order.id,
      }),
      billingType: isOfficial ? 'OFFICIAL' : 'INTERNAL',
      branch: isOfficial ? 'A' : 'X',
      amount: roundToIntegerPeso(amountDec).toNumber(),
    });
  }

  for (const cn of input.creditNotes) {
    if (normalizeCity(cn.persona?.city ?? cn.order?.persona?.city) !== targetCity) continue;
    const cnAmountDec = resolveCreditNoteCommercialRevenueDec(cn);
    const isOfficial = cn.billingType === 'OFFICIAL';

    if (isOfficial) {
      officialDec = officialDec.minus(cnAmountDec);
    } else {
      internalDec = internalDec.minus(cnAmountDec);
    }
    creditNotesCount += 1;

    items.push({
      id: cn.id,
      movementId: Number(cn.movementId || cn.id),
      kind: 'CREDIT_NOTE',
      date: cn.createdAt.toISOString(),
      clientName: cn.persona?.name?.trim() || cn.order?.persona?.name?.trim() || 'Sin Cliente',
      voucher: formatSaleVoucherLabel({
        kind: 'CREDIT_NOTE',
        type: cn.creditNoteType,
        number: cn.creditNoteNumber,
        movementId: cn.movementId,
        id: cn.id,
      }),
      billingType: isOfficial ? 'OFFICIAL' : 'INTERNAL',
      branch: isOfficial ? 'A' : 'X',
      amount: roundToIntegerPeso(cnAmountDec.negated()).toNumber(),
    });
  }

  items.sort((a, b) => {
    const timeDiff = Date.parse(b.date) - Date.parse(a.date);
    if (timeDiff !== 0) return timeDiff;
    if (b.movementId !== a.movementId) return b.movementId - a.movementId;
    return b.id - a.id;
  });

  const totalDec = officialDec.plus(internalDec);
  return {
    city: targetCity,
    summary: {
      official: roundToIntegerPeso(officialDec).toNumber(),
      internal: roundToIntegerPeso(internalDec).toNumber(),
      total: roundToIntegerPeso(totalDec).toNumber(),
      officialCount,
      internalCount,
      count: officialCount + internalCount,
      creditNotesCount,
    },
    items,
  };
}
