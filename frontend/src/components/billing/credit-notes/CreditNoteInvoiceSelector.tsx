import React, { useMemo, useState } from 'react';
import { FileText, X } from 'lucide-react';
import type { EligibleOrderForCreditNote } from '../../../api/billing.api';
import { formatInvoiceShortCode } from './creditNoteCart.helpers';

interface CreditNoteInvoiceSelectorProps {
  eligibleOrders: EligibleOrderForCreditNote[];
  loadingOrders: boolean;
  selectedOrder: EligibleOrderForCreditNote | null;
  lockedOrderId?: string;
  lockInvoiceSelection?: boolean;
  onSelectOrder: (order: EligibleOrderForCreditNote | null) => void;
}

export function CreditNoteInvoiceSelector({
  eligibleOrders,
  loadingOrders,
  selectedOrder,
  lockedOrderId,
  lockInvoiceSelection = false,
  onSelectOrder,
}: CreditNoteInvoiceSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return eligibleOrders.slice(0, 12);
    return eligibleOrders
      .filter((order) => {
        const code = formatInvoiceShortCode(order).toLowerCase();
        const dateStr = new Date(order.invoicedAt || order.createdAt).toLocaleDateString('es-AR');
        const amountStr = String(Math.round(order.totalAmount));
        return (
          code.includes(q) ||
          String(order.id).includes(q) ||
          dateStr.includes(q) ||
          amountStr.includes(q)
        );
      })
      .slice(0, 12);
  }, [eligibleOrders, searchQuery]);

  const formatDate = (iso: string | null | undefined) =>
    iso ? new Date(iso).toLocaleDateString('es-AR') : '';

  if (selectedOrder || lockedOrderId) {
    const code = selectedOrder
      ? formatInvoiceShortCode(selectedOrder)
      : `Factura #${lockedOrderId}`;
    const dateLabel = selectedOrder
      ? formatDate(selectedOrder.invoicedAt || selectedOrder.createdAt)
      : '';
    const isPartial = Boolean(selectedOrder && selectedOrder.alreadyCreditedAmount > 0);

    return (
      <div className="form-group" style={{ margin: 0 }}>
        <label style={{ fontWeight: 600, fontSize: '0.8rem' }}>Factura asociada</label>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #d1d5db',
            backgroundColor: '#f9fafb',
            fontSize: '0.84rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0, flexWrap: 'wrap' }}>
            <FileText size={15} color="#4b5563" aria-hidden="true" />
            <strong className="tabular-nums" style={{ color: '#111827' }}>
              {code}
            </strong>
            {dateLabel && (
              <span className="tabular-nums" style={{ color: '#6b7280' }}>
                · {dateLabel}
              </span>
            )}
            {selectedOrder && (
              <span className="tabular-nums" style={{ color: '#111827', fontWeight: 600 }}>
                · ${Math.round(selectedOrder.totalAmount).toLocaleString('es-AR')}
              </span>
            )}
            {isPartial && selectedOrder && (
              <span
                className="tabular-nums"
                style={{
                  fontSize: '0.75rem',
                  color: '#92400e',
                  backgroundColor: '#fef3c7',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  fontWeight: 600,
                }}
              >
                Restan ${Math.round(selectedOrder.remainingCreditableAmount).toLocaleString('es-AR')}
              </span>
            )}
          </div>
          {!lockInvoiceSelection && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '3px', color: '#6b7280' }}
              onClick={() => {
                onSelectOrder(null);
                setSearchQuery('');
              }}
              aria-label="Cambiar o quitar factura asociada"
              title="Cambiar factura"
            >
              <X size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="form-group" style={{ position: 'relative', margin: 0 }}>
      <label htmlFor="cn-invoice-search" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
        Factura asociada
      </label>
      <input
        id="cn-invoice-search"
        type="search"
        role="combobox"
        aria-expanded={dropdownOpen}
        aria-controls="cn-invoice-listbox"
        aria-autocomplete="list"
        className="input"
        placeholder={
          loadingOrders
            ? 'Cargando facturas...'
            : eligibleOrders.length > 0
              ? 'Buscar por número, fecha o monto... (o dejar libre interna)'
              : 'Sin facturas acreditables (Interna libre)'
        }
        autoComplete="off"
        spellCheck={false}
        value={searchQuery}
        onChange={(e) => {
          setSearchQuery(e.target.value);
          setActiveIdx(0);
          setDropdownOpen(true);
        }}
        onFocus={() => setDropdownOpen(true)}
        onBlur={() => setTimeout(() => setDropdownOpen(false), 200)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            setDropdownOpen(false);
            return;
          }
          if (e.key === 'ArrowDown') {
            e.preventDefault();
            setDropdownOpen(true);
            setActiveIdx((prev) =>
              filteredOrders.length > 0 ? (prev + 1) % filteredOrders.length : 0,
            );
          } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setDropdownOpen(true);
            setActiveIdx((prev) =>
              filteredOrders.length > 0
                ? (prev - 1 + filteredOrders.length) % filteredOrders.length
                : 0,
            );
          } else if (e.key === 'Enter' && dropdownOpen && filteredOrders.length > 0) {
            e.preventDefault();
            const chosen = filteredOrders[activeIdx];
            if (chosen) {
              onSelectOrder(chosen);
              setSearchQuery('');
              setDropdownOpen(false);
            }
          }
        }}
      />

      {dropdownOpen && !loadingOrders && (
        <div
          id="cn-invoice-listbox"
          role="listbox"
          className="suggestions-list"
          style={{
            position: 'absolute',
            zIndex: 110,
            width: '100%',
            maxHeight: '220px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            boxShadow: '0 6px 18px rgba(15, 23, 42, 0.08)',
            marginTop: '4px',
          }}
        >
          {filteredOrders.length === 0 ? (
            <div style={{ padding: '10px 12px', fontSize: '0.82rem', color: '#6b7280' }}>
              Sin facturas acreditables
            </div>
          ) : (
            filteredOrders.map((order, idx) => {
              const isPartial = order.alreadyCreditedAmount > 0;
              return (
                <div
                  key={order.id}
                  role="option"
                  aria-selected={idx === activeIdx}
                  onMouseDown={() => {
                    onSelectOrder(order);
                    setSearchQuery('');
                    setDropdownOpen(false);
                  }}
                  onMouseEnter={() => setActiveIdx(idx)}
                  style={{
                    padding: '9px 12px',
                    cursor: 'pointer',
                    backgroundColor: idx === activeIdx ? '#f3f4f6' : '#ffffff',
                    borderBottom: '1px solid #f3f4f6',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    gap: '10px',
                    fontSize: '0.83rem',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span
                      style={{
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        padding: '1px 5px',
                        borderRadius: '4px',
                        backgroundColor: order.billingType === 'OFFICIAL' ? '#111827' : '#e5e7eb',
                        color: order.billingType === 'OFFICIAL' ? '#ffffff' : '#374151',
                      }}
                    >
                      {order.billingType === 'OFFICIAL' ? 'AFIP' : 'INT'}
                    </span>
                    <strong className="tabular-nums" style={{ color: '#111827' }}>
                      {formatInvoiceShortCode(order)}
                    </strong>
                    <span className="tabular-nums" style={{ color: '#6b7280' }}>
                      {formatDate(order.invoicedAt || order.createdAt)}
                    </span>
                  </div>
                  <div className="tabular-nums" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    <strong style={{ color: '#111827' }}>
                      ${Math.round(order.totalAmount).toLocaleString('es-AR')}
                    </strong>
                    {isPartial && (
                      <span style={{ fontSize: '0.74rem', color: '#92400e', marginLeft: '6px' }}>
                        (Restan ${Math.round(order.remainingCreditableAmount).toLocaleString('es-AR')})
                      </span>
                    )}
                  </div>
                </div>
              );
            })
          )}
          <div
            role="option"
            aria-selected={false}
            onMouseDown={() => {
              onSelectOrder(null);
              setSearchQuery('');
              setDropdownOpen(false);
            }}
            style={{
              padding: '9px 12px',
              cursor: 'pointer',
              backgroundColor: '#f9fafb',
              fontSize: '0.8rem',
              color: '#4b5563',
              fontWeight: 500,
            }}
          >
            Sin factura (Interna libre)
          </div>
        </div>
      )}
    </div>
  );
}
