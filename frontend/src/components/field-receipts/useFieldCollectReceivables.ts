import { useEffect, useState } from 'react';
import {
  fieldReceiptsApi,
  type OfflineBundleClient,
  type SyncFieldReceiptPaymentPayload,
} from '../../api/fieldReceipts.api';
import { type PendingInvoiceOption } from '../admin/AdminPaymentAllocationPreview';
import { type PaymentDraft } from './FieldCollectPaymentRow';

export async function compressFieldReceiptImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer la imagen'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Formato de imagen inválido'));
      img.onload = () => {
        const maxDim = 960;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(img.width * scale);
        canvas.height = Math.round(img.height * scale);
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(String(reader.result));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

export function validateAndMapFieldPayments(
  payments: PaymentDraft[],
): { ok: true; mappedPayments: SyncFieldReceiptPaymentPayload[] } | { ok: false; error: string } {
  const mappedPayments: SyncFieldReceiptPaymentPayload[] = [];
  for (const p of payments) {
    const amt = Math.round(Number(p.amount) || 0);
    if (amt <= 0) {
      return { ok: false, error: 'Todos los medios de pago deben tener importe mayor a $0.' };
    }
    if (
      p.paymentMethod === 'CHECK' &&
      (!p.checkBank.trim() || !p.checkNumber.trim() || !p.checkDueDate)
    ) {
      return { ok: false, error: 'Completá banco, número y fecha de vencimiento del cheque.' };
    }
    mappedPayments.push({
      paymentMethod: p.paymentMethod,
      amount: amt,
      bankAccountId: p.bankAccountId ? Number(p.bankAccountId) : null,
      transferReference: p.transferReference.trim() || null,
      proofImageUrl: p.proofImageUrl || null,
      checkBank: p.checkBank.trim() || null,
      checkNumber: p.checkNumber.trim() || null,
      checkDueDate: p.checkDueDate || null,
      checkFrontImageUrl: p.checkFrontImageUrl || null,
      isEcheq: p.isEcheq,
    });
  }
  return { ok: true, mappedPayments };
}

export interface FieldAllocationPayload {
  orderId?: number;
  orderIds?: number[];
  applyToUnbilledBalance?: boolean;
}

export function buildFieldAllocationPayload(params: {
  hasUnbilled: boolean;
  includeUnbilledBalance: boolean;
  selectedInvoiceIds: number[];
  selectedInvoicesTotal: number;
  totalAmount: number;
}): FieldAllocationPayload {
  const {
    hasUnbilled,
    includeUnbilledBalance,
    selectedInvoiceIds,
    selectedInvoicesTotal,
    totalAmount,
  } = params;
  const applyToUnbilled =
    hasUnbilled && (includeUnbilledBalance || selectedInvoiceIds.length === 0);
  const singleExactOrderId =
    !applyToUnbilled &&
    selectedInvoiceIds.length === 1 &&
    totalAmount > 0 &&
    totalAmount <= selectedInvoicesTotal
      ? selectedInvoiceIds[0]
      : undefined;

  return {
    ...(singleExactOrderId ? { orderId: singleExactOrderId } : {}),
    ...(selectedInvoiceIds.length > 0 ? { orderIds: selectedInvoiceIds } : {}),
    ...(applyToUnbilled ? { applyToUnbilledBalance: true } : {}),
  };
}

interface UseFieldCollectReceivablesParams {
  client: OfflineBundleClient | null;
  onApplySuggestedAmount: (amount: number, fromUserToggle: boolean) => void;
}

export function useFieldCollectReceivables({
  client,
  onApplySuggestedAmount,
}: UseFieldCollectReceivablesParams) {
  const [loading, setLoading] = useState(false);
  const [pendingInvoices, setPendingInvoices] = useState<PendingInvoiceOption[]>([]);
  const [unbilledBalance, setUnbilledBalance] = useState(0);
  const [includeUnbilledBalance, setIncludeUnbilledBalance] = useState(false);
  const [availableCredit, setAvailableCredit] = useState(0);
  const [outstandingBalance, setOutstandingBalance] = useState<number | null>(null);
  const [selectedInvoiceIds, setSelectedInvoiceIds] = useState<number[]>([]);

  useEffect(() => {
    setPendingInvoices([]);
    setUnbilledBalance(0);
    setIncludeUnbilledBalance(false);
    setAvailableCredit(0);
    setSelectedInvoiceIds([]);

    if (!client) {
      setOutstandingBalance(null);
      setLoading(false);
      return;
    }

    setOutstandingBalance(Math.round(Number(client.outstandingBalance || 0)));

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    fieldReceiptsApi
      .getClientPendingInvoices(client.id)
      .then((res) => {
        if (cancelled) return;
        const rawInvoices: PendingInvoiceOption[] = Array.isArray(res?.invoices)
          ? res.invoices.map((inv) => ({
              id: inv.id,
              invoiceNumber: inv.invoiceNumber,
              pendingAmount: inv.pendingAmount,
              status: inv.status,
              createdAt: inv.createdAt,
            }))
          : [];
        const sortedInvoices = [...rawInvoices].sort((a, b) => {
          const ta = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const tb = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return ta !== tb ? ta - tb : a.id - b.id;
        });

        const nextUnbilled = Math.max(0, Math.round(Number(res?.unbilledBalance || 0)));
        setPendingInvoices(sortedInvoices);
        setUnbilledBalance(nextUnbilled);
        setAvailableCredit(Math.max(0, Math.round(Number(res?.totalAvailableCredit || 0))));
        if (res?.outstandingBalance !== undefined && res?.outstandingBalance !== null) {
          setOutstandingBalance(Math.round(Number(res.outstandingBalance)));
        } else if (res?.netBalance !== undefined && res?.netBalance !== null) {
          setOutstandingBalance(Math.round(Number(res.netBalance)));
        }

        if (nextUnbilled > 0) {
          setIncludeUnbilledBalance(true);
          setSelectedInvoiceIds([]);
          onApplySuggestedAmount(nextUnbilled, false);
        } else if (sortedInvoices.length > 0) {
          setIncludeUnbilledBalance(false);
          setSelectedInvoiceIds([sortedInvoices[0].id]);
          onApplySuggestedAmount(
            Math.max(0, Math.round(Number(sortedInvoices[0].pendingAmount))),
            false,
          );
        } else {
          setIncludeUnbilledBalance(false);
          setSelectedInvoiceIds([]);
        }
      })
      .catch(() => {
        if (cancelled) return;
        setPendingInvoices([]);
        setUnbilledBalance(0);
        setIncludeUnbilledBalance(false);
        setAvailableCredit(0);
        setSelectedInvoiceIds([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [client?.id]);

  const hasUnbilled = unbilledBalance > 0;
  const selectedIdSet = new Set(selectedInvoiceIds);
  const selectedInvoicesTotal = pendingInvoices
    .filter((inv) => selectedIdSet.has(inv.id))
    .reduce((sum, inv) => sum + Math.max(0, Math.round(Number(inv.pendingAmount))), 0);

  const computeTotal = (nextIds: number[], nextIncludeUnbilled: boolean) => {
    const idSet = new Set(nextIds);
    const invSum = pendingInvoices
      .filter((inv) => idSet.has(inv.id))
      .reduce((sum, inv) => sum + Math.max(0, Math.round(Number(inv.pendingAmount))), 0);
    return invSum + (hasUnbilled && nextIncludeUnbilled ? unbilledBalance : 0);
  };

  const handleToggleInvoice = (invoiceId: number) => {
    const nextSet = new Set(selectedInvoiceIds);
    if (nextSet.has(invoiceId)) {
      nextSet.delete(invoiceId);
    } else {
      nextSet.add(invoiceId);
    }
    const nextIds = pendingInvoices
      .filter((inv) => nextSet.has(inv.id))
      .map((inv) => inv.id);
    setSelectedInvoiceIds(nextIds);
    onApplySuggestedAmount(computeTotal(nextIds, includeUnbilledBalance), true);
  };

  const handleToggleUnbilledBalance = () => {
    const nextInclude = !includeUnbilledBalance;
    setIncludeUnbilledBalance(nextInclude);
    onApplySuggestedAmount(computeTotal(selectedInvoiceIds, nextInclude), true);
  };

  const handleToggleAllInvoices = () => {
    const totalItems = (hasUnbilled ? 1 : 0) + pendingInvoices.length;
    const currentSelectedCount =
      (hasUnbilled && includeUnbilledBalance ? 1 : 0) + selectedInvoiceIds.length;
    if (currentSelectedCount === totalItems) {
      setIncludeUnbilledBalance(false);
      setSelectedInvoiceIds([]);
      onApplySuggestedAmount(0, true);
    } else {
      const allIds = pendingInvoices.map((inv) => inv.id);
      setIncludeUnbilledBalance(hasUnbilled);
      setSelectedInvoiceIds(allIds);
      onApplySuggestedAmount(computeTotal(allIds, hasUnbilled), true);
    }
  };

  return {
    loading,
    pendingInvoices,
    unbilledBalance,
    hasUnbilled,
    includeUnbilledBalance,
    availableCredit,
    outstandingBalance,
    selectedInvoiceIds,
    selectedInvoicesTotal,
    handleToggleInvoice,
    handleToggleUnbilledBalance,
    handleToggleAllInvoices,
  };
}
