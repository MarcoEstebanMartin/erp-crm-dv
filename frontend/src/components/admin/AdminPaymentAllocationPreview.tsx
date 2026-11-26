import React, { useMemo } from 'react';

export interface PendingInvoiceOption {
  id: number;
  invoiceNumber: string;
  pendingAmount: number;
  status?: 'PENDING' | 'PARTIAL' | 'PAID';
  createdAt?: string | Date;
}

export function formatInvoiceShortDate(value?: string | Date): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

interface PreviewLine {
  key: string;
  label: string;
  amount: number;
  badge: string;
  isCredit?: boolean;
}

interface AdminPaymentAllocationPreviewProps {
  paymentAmount: string;
  pendingInvoices: PendingInvoiceOption[];
  selectedInvoiceIds: number[];
  unbilledBalance?: number;
  includeUnbilledBalance?: boolean;
}

export const AdminPaymentAllocationPreview: React.FC<AdminPaymentAllocationPreviewProps> = ({
  paymentAmount,
  pendingInvoices,
  selectedInvoiceIds,
  unbilledBalance = 0,
  includeUnbilledBalance = false,
}) => {
  const lines = useMemo<PreviewLine[]>(() => {
    const parsed = Math.round(Number(paymentAmount));
    const hasUnbilled = unbilledBalance > 0;
    if (!Number.isFinite(parsed) || parsed <= 0 || (pendingInvoices.length === 0 && !hasUnbilled)) {
      return [];
    }

    const selectedSet = new Set(selectedInvoiceIds);
    const orderedInvoices =
      selectedInvoiceIds.length > 0
        ? [
            ...selectedInvoiceIds
              .map((id) => pendingInvoices.find((i) => i.id === id))
              .filter((i): i is PendingInvoiceOption => Boolean(i)),
            ...pendingInvoices.filter((i) => !selectedSet.has(i.id)),
          ]
        : pendingInvoices;

    type PreviewTarget = { key: string; label: string; pending: number };
    const unbilledTarget: PreviewTarget | null = hasUnbilled
      ? { key: 'unbilled', label: 'Saldo anterior', pending: unbilledBalance }
      : null;

    const invoiceTargets: PreviewTarget[] = orderedInvoices.map((inv) => {
      const dateStr = formatInvoiceShortDate(inv.createdAt);
      return {
        key: String(inv.id),
        label: dateStr ? `${inv.invoiceNumber} · ${dateStr}` : inv.invoiceNumber,
        pending: Math.round(Number(inv.pendingAmount)),
      };
    });

    const prioritizeUnbilled =
      hasUnbilled && (includeUnbilledBalance || selectedInvoiceIds.length === 0);
    const targets: PreviewTarget[] = unbilledTarget
      ? prioritizeUnbilled
        ? [unbilledTarget, ...invoiceTargets]
        : [...invoiceTargets, unbilledTarget]
      : invoiceTargets;

    let remaining = parsed;
    const result: PreviewLine[] = [];

    for (const target of targets) {
      if (remaining <= 0) break;
      if (target.pending <= 0) continue;
      const applied = Math.min(remaining, target.pending);
      const leftAfter = target.pending - applied;
      remaining -= applied;
      result.push({
        key: target.key,
        label: target.label,
        amount: applied,
        badge: leftAfter === 0 ? 'Saldada' : `Resta $${leftAfter.toLocaleString('es-AR')}`,
      });
    }

    if (remaining > 0) {
      result.push({
        key: 'credit',
        label: 'Saldo a favor',
        amount: remaining,
        badge: 'Próxima factura',
        isCredit: true,
      });
    }

    return result;
  }, [paymentAmount, pendingInvoices, selectedInvoiceIds, unbilledBalance, includeUnbilledBalance]);

  if (lines.length === 0) return null;

  return (
    <output
      htmlFor="payment-amount payment-invoice"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '5px',
        marginBottom: '14px',
        padding: '8px 10px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--border-color)',
        background: 'var(--bg-subtle, #f8fafc)',
        fontSize: '0.8rem',
        fontVariantNumeric: 'tabular-nums',
      }}
    >
      {lines.map((line) => (
        <div
          key={line.key}
          style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}
        >
          <span style={{ color: line.isCredit ? '#15803d' : 'var(--text-primary)', fontWeight: 500 }}>
            {line.label}
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <strong>${line.amount.toLocaleString('es-AR')}</strong>
            <span style={{ color: line.badge === 'Saldada' || line.isCredit ? '#15803d' : 'var(--text-secondary)', fontSize: '0.75rem' }}>
              {line.badge}
            </span>
          </span>
        </div>
      ))}
    </output>
  );
};
