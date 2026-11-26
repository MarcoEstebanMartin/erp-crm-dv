import React from 'react';
import { formatInvoiceShortDate, type PendingInvoiceOption } from './AdminPaymentAllocationPreview';

interface AdminPaymentInvoiceSelectorProps {
  pendingInvoices: PendingInvoiceOption[];
  selectedInvoiceIds: number[];
  unbilledBalance: number;
  includeUnbilledBalance: boolean;
  disabled?: boolean;
  onToggleInvoice: (invoiceId: number) => void;
  onToggleUnbilledBalance: () => void;
  onToggleAll: () => void;
}

export const AdminPaymentInvoiceSelector: React.FC<AdminPaymentInvoiceSelectorProps> = ({
  pendingInvoices,
  selectedInvoiceIds,
  unbilledBalance,
  includeUnbilledBalance,
  disabled = false,
  onToggleInvoice,
  onToggleUnbilledBalance,
  onToggleAll,
}) => {
  const hasUnbilled = unbilledBalance > 0;
  const totalItems = (hasUnbilled ? 1 : 0) + pendingInvoices.length;
  if (totalItems === 0) return null;

  const selectedSet = new Set(selectedInvoiceIds);
  const selectedCount = (hasUnbilled && includeUnbilledBalance ? 1 : 0) + selectedInvoiceIds.length;
  const allSelected = selectedCount === totalItems;

  return (
    <fieldset
      className="form-group"
      style={{ border: 0, padding: 0, margin: '0 0 14px 0', minWidth: 0 }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '6px',
        }}
      >
        <legend
          style={{
            padding: 0,
            margin: 0,
            fontSize: '0.84rem',
            fontWeight: 500,
            color: 'var(--text-secondary)',
          }}
        >
          Imputar{selectedCount > 1 ? ` (${selectedCount})` : ''}
        </legend>
        {totalItems > 1 && (
          <button
            type="button"
            className="btn btn-ghost"
            disabled={disabled}
            onClick={onToggleAll}
            style={{
              padding: '2px 6px',
              fontSize: '0.76rem',
              fontWeight: 600,
              minHeight: '22px',
              color: 'var(--text-secondary)',
            }}
          >
            {allSelected ? 'Ninguna' : 'Todas'}
          </button>
        )}
      </div>

      <div
        style={{
          border: '1px solid var(--border-color)',
          borderRadius: 'var(--radius-md)',
          maxHeight: '164px',
          overflowY: 'auto',
          background: 'var(--bg-surface, #ffffff)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {hasUnbilled && (
          <label
            htmlFor="payment-invoice-unbilled"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '10px',
              padding: '8px 10px',
              cursor: disabled ? 'not-allowed' : 'pointer',
              background: includeUnbilledBalance ? 'var(--bg-subtle, #f8fafc)' : 'transparent',
              fontSize: '0.82rem',
              marginBottom: 0,
            }}
          >
            <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <input
                id="payment-invoice-unbilled"
                type="checkbox"
                checked={includeUnbilledBalance}
                disabled={disabled}
                onChange={onToggleUnbilledBalance}
                style={{
                  width: '15px',
                  height: '15px',
                  accentColor: '#111827',
                  cursor: disabled ? 'not-allowed' : 'pointer',
                  flexShrink: 0,
                }}
              />
              <span
                style={{
                  color: 'var(--text-primary)',
                  fontWeight: includeUnbilledBalance ? 600 : 400,
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
              >
                Saldo anterior
              </span>
            </span>
            <strong
              style={{
                color: includeUnbilledBalance ? 'var(--text-primary)' : 'var(--text-secondary)',
                fontWeight: includeUnbilledBalance ? 700 : 500,
                whiteSpace: 'nowrap',
              }}
            >
              ${unbilledBalance.toLocaleString('es-AR')}
            </strong>
          </label>
        )}

        {pendingInvoices.map((inv, idx) => {
          const checked = selectedSet.has(inv.id);
          const dateStr = formatInvoiceShortDate(inv.createdAt);
          const pending = Math.round(Number(inv.pendingAmount));
          const inputId = `payment-invoice-${inv.id}`;

          return (
            <label
              key={inv.id}
              htmlFor={inputId}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '10px',
                padding: '8px 10px',
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: checked ? 'var(--bg-subtle, #f8fafc)' : 'transparent',
                borderTop: hasUnbilled || idx > 0 ? '1px solid var(--border-color)' : 'none',
                fontSize: '0.82rem',
                marginBottom: 0,
              }}
            >
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                <input
                  id={inputId}
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={() => onToggleInvoice(inv.id)}
                  style={{
                    width: '15px',
                    height: '15px',
                    accentColor: '#111827',
                    cursor: disabled ? 'not-allowed' : 'pointer',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    color: 'var(--text-primary)',
                    fontWeight: checked ? 600 : 400,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                  }}
                >
                  {inv.invoiceNumber}
                  {dateStr ? ` · ${dateStr}` : ''}
                  {inv.status === 'PARTIAL' ? ' · Parcial' : ''}
                </span>
              </span>
              <strong
                style={{
                  color: checked ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: checked ? 700 : 500,
                  whiteSpace: 'nowrap',
                }}
              >
                ${pending.toLocaleString('es-AR')}
              </strong>
            </label>
          );
        })}
      </div>
    </fieldset>
  );
};
