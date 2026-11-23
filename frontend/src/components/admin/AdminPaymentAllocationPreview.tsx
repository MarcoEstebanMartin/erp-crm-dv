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
  selectedInvoiceId: number | null;
}

export const AdminPaymentAllocationPreview: React.FC<AdminPaymentAllocationPreviewProps> = ({
  paymentAmount,
  pendingInvoices,
  selectedInvoiceId,
}) => {
  const lines = useMemo<PreviewLine[]>(() => {
    const parsed = Math.round(Number(paymentAmount));
    if (!Number.isFinite(parsed) || parsed <= 0 || pendingInvoices.length === 0) return [];

    const ordered = selectedInvoiceId
      ? [
          ...pendingInvoices.filter((i) => i.id === selectedInvoiceId),
          ...pendingInvoices.filter((i) => i.id !== selectedInvoiceId),
        ]
      : pendingInvoices;

    let remaining = parsed;
    const result: PreviewLine[] = [];

    for (const inv of ordered) {
      if (remaining <= 0) break;
      const pending = Math.round(Number(inv.pendingAmount));
      if (pending <= 0) continue;
      const applied = Math.min(remaining, pending);
      const leftAfter = pending - applied;
      remaining -= applied;
      const dateStr = formatInvoiceShortDate(inv.createdAt);
      result.push({
        key: String(inv.id),
        label: dateStr ? `${inv.invoiceNumber} · ${dateStr}` : inv.invoiceNumber,
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
  }, [paymentAmount, pendingInvoices, selectedInvoiceId]);

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
