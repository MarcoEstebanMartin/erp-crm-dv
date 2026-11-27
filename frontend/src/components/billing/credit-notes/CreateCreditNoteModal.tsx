import React from 'react';
import { X } from 'lucide-react';
import { SCALE, divRoundHalfUp } from '../../../utils/exactStockMath';
import type { EligibleOrderForCreditNote } from '../../../api/billing.api';
import { CreditNoteCartSection } from './CreditNoteCartSection';
import { CreditNoteInvoiceSelector } from './CreditNoteInvoiceSelector';
import {
  computeCreditNoteCartTotal,
  formatInvoiceShortCode,
  type CreditNoteCartItem,
} from './creditNoteCart.helpers';
import { NativeModalDialog } from '../../modals/NativeModalDialog';

export interface CreateCreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  creditNoteForm: any;
  setCreditNoteForm: React.Dispatch<React.SetStateAction<any>>;
  creditNoteCart: CreditNoteCartItem[];
  setCreditNoteCart: React.Dispatch<React.SetStateAction<CreditNoteCartItem[]>>;
  selectedCNClient: any;
  cnClientSearchQuery: string;
  setCnClientSearchQuery: (q: string) => void;
  filteredCNClients: any[];
  showCNClientDropdown: boolean;
  setShowCNClientDropdown: (open: boolean) => void;
  activeCNClientSuggestionIdx: number;
  setActiveCNClientSuggestionIdx: React.Dispatch<React.SetStateAction<number>>;
  onSelectCNClient: (client: any) => void;
  eligibleOrders: EligibleOrderForCreditNote[];
  loadingEligibleOrders: boolean;
  selectedEligibleOrder: EligibleOrderForCreditNote | null;
  onSelectEligibleOrder: (order: EligibleOrderForCreditNote | null) => void;
  lockClient?: boolean;
  lockInvoiceSelection?: boolean;
  cnProductSearchQuery: string;
  setCnProductSearchQuery: (q: string) => void;
  filteredCNProducts: any[];
  showCNProductDropdown: boolean;
  setShowCNProductDropdown: (open: boolean) => void;
  activeCNProductSuggestionIdx: number;
  setActiveCNProductSuggestionIdx: React.Dispatch<React.SetStateAction<number>>;
  onSelectCNProduct: (product: any) => void;
  cnProductPrice: string;
  setCnProductPrice: (val: string) => void;
  cnProductQty: string;
  setCnProductQty: (val: string) => void;
  cnProductWeight: string;
  setCnProductWeight: (val: string) => void;
  onAddCNProduct: () => void;
  onRemoveCNProduct: (productId: number) => void;
}

export function CreateCreditNoteModal({
  isOpen,
  onClose,
  onSubmit,
  loading,
  creditNoteForm,
  setCreditNoteForm,
  creditNoteCart,
  setCreditNoteCart,
  selectedCNClient,
  cnClientSearchQuery,
  setCnClientSearchQuery,
  filteredCNClients,
  showCNClientDropdown,
  setShowCNClientDropdown,
  activeCNClientSuggestionIdx,
  setActiveCNClientSuggestionIdx,
  onSelectCNClient,
  eligibleOrders,
  loadingEligibleOrders,
  selectedEligibleOrder,
  onSelectEligibleOrder,
  lockClient = false,
  lockInvoiceSelection = false,
  cnProductSearchQuery,
  setCnProductSearchQuery,
  filteredCNProducts,
  showCNProductDropdown,
  setShowCNProductDropdown,
  activeCNProductSuggestionIdx,
  setActiveCNProductSuggestionIdx,
  onSelectCNProduct,
  cnProductPrice,
  setCnProductPrice,
  cnProductQty,
  setCnProductQty,
  cnProductWeight,
  setCnProductWeight,
  onAddCNProduct,
  onRemoveCNProduct,
}: CreateCreditNoteModalProps) {
  const subtotal = computeCreditNoteCartTotal(creditNoteCart);
  const cleanCuit = selectedCNClient?.cuit ? String(selectedCNClient.cuit).replace(/-/g, '') : '';
  const isOfficialA = creditNoteForm.billingType === 'OFFICIAL' && cleanCuit.length === 11;
  const totalCents = BigInt(Math.max(0, Math.round(subtotal))) * 100n;
  const netCents = divRoundHalfUp(totalCents * 100n, 121n);
  const taxCents = totalCents - netCents;
  const netDisplay = isOfficialA ? Number(netCents) / 100 : Math.round(Number(divRoundHalfUp(netCents, 100n)));
  const taxDisplay = isOfficialA ? Number(taxCents) / 100 : subtotal - netDisplay;
  const decimalOptions = isOfficialA
    ? { minimumFractionDigits: 2, maximumFractionDigits: 2 }
    : { minimumFractionDigits: 0, maximumFractionDigits: 0 };

  const currentBalance = Math.round(Number(selectedCNClient?.outstandingBalance || 0));
  const projectedBalance = Math.round(((currentBalance - subtotal) * Number(SCALE)) / Number(SCALE));
  const exceedsRemaining = Boolean(
    selectedEligibleOrder && subtotal > Math.round(selectedEligibleOrder.remainingCreditableAmount),
  );

  const headerPill = selectedEligibleOrder
    ? formatInvoiceShortCode(selectedEligibleOrder)
    : creditNoteForm.orderId
      ? `Factura #${creditNoteForm.orderId}`
      : 'Interna libre';

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="create-cn-modal-title"
      closeOnBackdrop={false}
      style={{
        maxWidth: '1160px',
        width: '93vw',
        height: '86vh',
        maxHeight: '90vh',
        padding: '22px 24px',
        borderRadius: '12px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          marginBottom: '16px',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <h3 id="create-cn-modal-title" style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700 }}>
            Nota de Crédito
          </h3>
          <span
            className="tabular-nums"
            style={{
              fontSize: '0.76rem',
              fontWeight: 600,
              padding: '2px 8px',
              borderRadius: '999px',
              backgroundColor: creditNoteForm.billingType === 'OFFICIAL' ? '#111827' : '#f3f4f6',
              color: creditNoteForm.billingType === 'OFFICIAL' ? '#ffffff' : '#374151',
              border: '1px solid #e5e7eb',
            }}
          >
            {headerPill}
          </span>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '4px' }}
          onClick={onClose}
          aria-label="Cerrar"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1.45fr 1fr', gap: '20px', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflow: 'hidden' }}>
            <div className="form-group" style={{ position: 'relative', margin: 0 }}>
              <label htmlFor="cn-client-search" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                Cliente
              </label>
              <input
                id="cn-client-search"
                type="search"
                className="input"
                placeholder="Buscar por nombre o CUIT..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={cnClientSearchQuery}
                onChange={(e) => {
                  setCnClientSearchQuery(e.target.value);
                  setShowCNClientDropdown(true);
                }}
                disabled={lockClient}
                onFocus={() => setShowCNClientDropdown(true)}
                onBlur={() => setTimeout(() => setShowCNClientDropdown(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    setShowCNClientDropdown(true);
                    setActiveCNClientSuggestionIdx((prev) =>
                      filteredCNClients.length > 0 ? (prev + 1) % filteredCNClients.length : 0,
                    );
                  } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    setShowCNClientDropdown(true);
                    setActiveCNClientSuggestionIdx((prev) =>
                      filteredCNClients.length > 0
                        ? (prev - 1 + filteredCNClients.length) % filteredCNClients.length
                        : 0,
                    );
                  } else if (e.key === 'Enter') {
                    if (e.nativeEvent.isComposing || (e as any).keyCode === 229) return;
                    if (showCNClientDropdown && filteredCNClients.length > 0) {
                      e.preventDefault();
                      onSelectCNClient(filteredCNClients[activeCNClientSuggestionIdx]);
                    }
                  }
                }}
              />
              {showCNClientDropdown && !lockClient && filteredCNClients.length > 0 && (
                <div
                  className="suggestions-list"
                  style={{
                    position: 'absolute',
                    zIndex: 120,
                    width: '100%',
                    maxHeight: '180px',
                    overflowY: 'auto',
                    backgroundColor: '#fff',
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    marginTop: '2px',
                  }}
                >
                  {filteredCNClients.map((c, idx) => (
                    <div
                      key={c.id}
                      className={`suggestion-item ${idx === activeCNClientSuggestionIdx ? 'active' : ''}`}
                      onMouseDown={() => onSelectCNClient(c)}
                      onMouseEnter={() => setActiveCNClientSuggestionIdx(idx)}
                      style={{
                        padding: '8px 10px',
                        cursor: 'pointer',
                        fontSize: '0.84rem',
                        backgroundColor: idx === activeCNClientSuggestionIdx ? '#f3f4f6' : '#fff',
                      }}
                    >
                      {c.name} {c.cuit ? `· ${c.cuit}` : ''}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {selectedCNClient && (
              <CreditNoteInvoiceSelector
                eligibleOrders={eligibleOrders}
                loadingOrders={loadingEligibleOrders}
                selectedOrder={selectedEligibleOrder}
                lockedOrderId={creditNoteForm.orderId || undefined}
                lockInvoiceSelection={lockInvoiceSelection}
                onSelectOrder={onSelectEligibleOrder}
              />
            )}

            <CreditNoteCartSection
              creditNoteForm={creditNoteForm}
              creditNoteCart={creditNoteCart}
              setCreditNoteCart={setCreditNoteCart}
              selectedCNClient={selectedCNClient}
              cnProductSearchQuery={cnProductSearchQuery}
              setCnProductSearchQuery={setCnProductSearchQuery}
              filteredCNProducts={filteredCNProducts}
              showCNProductDropdown={showCNProductDropdown}
              setShowCNProductDropdown={setShowCNProductDropdown}
              activeCNProductSuggestionIdx={activeCNProductSuggestionIdx}
              setActiveCNProductSuggestionIdx={setActiveCNProductSuggestionIdx}
              onSelectCNProduct={onSelectCNProduct}
              cnProductPrice={cnProductPrice}
              setCnProductPrice={setCnProductPrice}
              cnProductQty={cnProductQty}
              setCnProductQty={setCnProductQty}
              cnProductWeight={cnProductWeight}
              setCnProductWeight={setCnProductWeight}
              onAddCNProduct={onAddCNProduct}
              onRemoveCNProduct={onRemoveCNProduct}
            />
          </div>

          <div
            style={{
              backgroundColor: '#f8f8fa',
              borderRadius: '8px',
              padding: '18px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
            }}
          >
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="cn-reason" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                Motivo
              </label>
              <select
                id="cn-reason"
                className="input"
                value={creditNoteForm.reason}
                onChange={(e) =>
                  setCreditNoteForm((prev: any) => ({ ...prev, reason: e.target.value }))
                }
              >
                <option value="DEVOLUCION">Devolución de mercadería</option>
                <option value="DESCUENTO">Bonificación / Dif. de precio</option>
                <option value="ERROR_FACTURACION">Error de facturación</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="cn-billing-type" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                Comprobante
              </label>
              <select
                id="cn-billing-type"
                className="input"
                value={creditNoteForm.billingType}
                disabled
              >
                <option value="INTERNAL">Presupuesto</option>
                <option value="OFFICIAL">Oficial (AFIP · NC A/B)</option>
              </select>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="cn-comments" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                Notas
              </label>
              <textarea
                id="cn-comments"
                className="input"
                rows={2}
                value={creditNoteForm.comments}
                onChange={(e) =>
                  setCreditNoteForm((prev: any) => ({ ...prev, comments: e.target.value }))
                }
                placeholder="Opcional..."
                style={{ resize: 'none', fontSize: '0.84rem' }}
              />
            </div>

            <div
              style={{
                marginTop: 'auto',
                backgroundColor: '#ffffff',
                padding: '16px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
              }}
            >
              {creditNoteForm.billingType === 'OFFICIAL' && (
                <>
                  <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <span>Neto</span>
                    <span style={{ fontWeight: 600, color: '#111827' }}>${netDisplay.toLocaleString('es-AR', decimalOptions)}</span>
                  </div>
                  <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                    <span>IVA (21%)</span>
                    <span style={{ fontWeight: 600, color: '#111827' }}>${taxDisplay.toLocaleString('es-AR', decimalOptions)}</span>
                  </div>
                </>
              )}

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '1.05rem',
                  borderTop: creditNoteForm.billingType === 'OFFICIAL' ? '1px solid var(--border-color)' : 'none',
                  paddingTop: creditNoteForm.billingType === 'OFFICIAL' ? '8px' : 0,
                }}
              >
                <span style={{ fontWeight: 700 }}>Total a acreditar</span>
                <span className="tabular-nums" style={{ fontWeight: 700, color: '#111827' }}>
                  -${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                </span>
              </div>

              {exceedsRemaining && selectedEligibleOrder && (
                <div
                  role="alert"
                  className="tabular-nums"
                  style={{
                    fontSize: '0.76rem',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#fef2f2',
                    border: '1px solid #fecaca',
                    color: '#991b1b',
                    fontWeight: 500,
                  }}
                >
                  Supera el saldo acreditable (${Math.round(selectedEligibleOrder.remainingCreditableAmount).toLocaleString('es-AR')})
                </div>
              )}

              {selectedCNClient && (
                <div
                  className="tabular-nums"
                  style={{
                    fontSize: '0.78rem',
                    padding: '7px 10px',
                    borderRadius: '6px',
                    backgroundColor: '#f3f4f6',
                    border: '1px solid #e5e7eb',
                    color: '#111827',
                    fontWeight: 500,
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <span style={{ color: '#4b5563' }}>Saldo C/C</span>
                  <span>
                    ${currentBalance.toLocaleString('es-AR')} → <strong>${projectedBalance.toLocaleString('es-AR')}</strong>
                  </span>
                </div>
              )}

              <button
                type="submit"
                className="btn btn-primary"
                disabled={loading || subtotal === 0 || exceedsRemaining}
                style={{ width: '100%', padding: '11px', marginTop: '6px', fontSize: '0.9rem', fontWeight: 600 }}
              >
                {loading ? 'Emitiendo...' : 'Emitir NC'}
              </button>
            </div>
          </div>
        </div>
      </form>
    </NativeModalDialog>
  );
}
