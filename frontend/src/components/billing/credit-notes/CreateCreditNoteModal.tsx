import React from 'react';
import { X } from 'lucide-react';
import { SCALE, divRoundHalfUp } from '../../../utils/exactStockMath';
import { CreditNoteCartSection } from './CreditNoteCartSection';
import { NativeModalDialog } from '../../modals/NativeModalDialog';

interface CreateCreditNoteModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
  loading: boolean;
  creditNoteForm: any;
  setCreditNoteForm: React.Dispatch<React.SetStateAction<any>>;
  creditNoteCart: any[];
  setCreditNoteCart: React.Dispatch<React.SetStateAction<any[]>>;
  selectedCNClient: any;
  cnClientSearchQuery: string;
  setCnClientSearchQuery: (q: string) => void;
  filteredCNClients: any[];
  showCNClientDropdown: boolean;
  setShowCNClientDropdown: (open: boolean) => void;
  activeCNClientSuggestionIdx: number;
  setActiveCNClientSuggestionIdx: React.Dispatch<React.SetStateAction<number>>;
  onSelectCNClient: (client: any) => void;
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
  const subtotal = creditNoteCart.reduce((sum, item) => sum + Number(item.subtotal || 0), 0);
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

  const currentBalance = Number(selectedCNClient?.outstandingBalance || 0);
  const projectedBalance = Math.round(((currentBalance - subtotal) * Number(SCALE)) / Number(SCALE));

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="create-cn-modal-title"
      closeOnBackdrop={false}
      style={{
        maxWidth: '1200px',
        width: '92vw',
        height: '88vh',
        maxHeight: '90vh',
        padding: '24px',
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
        }}
      >
        <h3 id="create-cn-modal-title">
          Emitir Nota de Crédito{' '}
          {creditNoteForm.orderId ? `para Factura #${creditNoteForm.orderId}` : '(Libre)'}
        </h3>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '4px' }}
          onClick={onClose}
          aria-label="Cerrar emisión de Nota de Crédito"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

        <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '20px', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden' }}>
              <div className="form-group" style={{ position: 'relative', margin: 0 }}>
                <label htmlFor="cn-client-search">Buscar Cliente</label>
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
                  disabled={!!creditNoteForm.orderId}
                  onFocus={() => setShowCNClientDropdown(true)}
                  onBlur={() => setTimeout(() => setShowCNClientDropdown(false), 250)}
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
                {showCNClientDropdown && filteredCNClients.length > 0 && (
                  <div
                    className="suggestions-list"
                    style={{
                      position: 'absolute',
                      zIndex: 100,
                      width: '100%',
                      maxHeight: '180px',
                      overflowY: 'auto',
                      backgroundColor: '#fff',
                      border: '1px solid var(--border-color)',
                      borderRadius: '4px',
                    }}
                  >
                    {filteredCNClients.map((c, idx) => (
                      <div
                        key={c.id}
                        className={`suggestion-item ${idx === activeCNClientSuggestionIdx ? 'active' : ''}`}
                        onMouseDown={() => onSelectCNClient(c)}
                        onMouseEnter={() => setActiveCNClientSuggestionIdx(idx)}
                        style={{
                          padding: '8px',
                          cursor: 'pointer',
                          backgroundColor: idx === activeCNClientSuggestionIdx ? '#e8f0fe' : '#fff',
                        }}
                      >
                        {c.name} (CUIT: {c.cuit || 'S/D'})
                      </div>
                    ))}
                  </div>
                )}
              </div>

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
                padding: '20px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '20px',
              }}
            >
              <h3
                style={{
                  fontSize: '1.05rem',
                  fontWeight: 700,
                  margin: 0,
                  paddingBottom: '10px',
                  borderBottom: '1px solid var(--border-color)',
                }}
              >
                Resumen y Parámetros
              </h3>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="cn-reason" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  Motivo de la Emisión
                </label>
                <select
                  id="cn-reason"
                  className="input"
                  value={creditNoteForm.reason}
                  onChange={(e) =>
                    setCreditNoteForm((prev: any) => ({ ...prev, reason: e.target.value }))
                  }
                >
                  <option value="DEVOLUCION">Devolución física de mercadería</option>
                  <option value="DESCUENTO">Diferencia de precio / Bonificación</option>
                  <option value="ERROR_FACTURACION">Error impositivo / Facturación</option>
                </select>
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="cn-billing-type" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  Tipo de Comprobante
                </label>
                <select
                  id="cn-billing-type"
                  className="input"
                  value={creditNoteForm.billingType}
                  onChange={(e) =>
                    setCreditNoteForm((prev: any) => ({ ...prev, billingType: e.target.value }))
                  }
                  disabled={!!creditNoteForm.orderId || Boolean(selectedCNClient && !selectedCNClient.cuit)}
                >
                  <option value="INTERNAL">Interno (Presupuesto / Sin AFIP)</option>
                  {selectedCNClient?.cuit && (
                    <option value="OFFICIAL">Oficial (AFIP - Nota de Crédito A o B)</option>
                  )}
                </select>
                {creditNoteForm.orderId && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '4px', display: 'block' }}>
                    La sucursal está determinada automáticamente por la factura seleccionada.
                  </span>
                )}
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="cn-comments" style={{ fontWeight: 600, fontSize: '0.8rem' }}>
                  Comentarios / Notas
                </label>
                <textarea
                  id="cn-comments"
                  className="input"
                  rows={3}
                  value={creditNoteForm.comments}
                  onChange={(e) =>
                    setCreditNoteForm((prev: any) => ({ ...prev, comments: e.target.value }))
                  }
                  placeholder="Ingresar comentarios internos o motivos detallados..."
                  style={{ resize: 'none', fontSize: '0.85rem' }}
                />
              </div>

              <div
                style={{
                  marginTop: 'auto',
                  backgroundColor: '#ffffff',
                  padding: '16px',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Subtotal Neto:</span>
                  <span style={{ fontWeight: 600 }}>${netDisplay.toLocaleString('es-AR', decimalOptions)}</span>
                </div>
                {creditNoteForm.billingType === 'OFFICIAL' && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem' }}>
                    <span style={{ color: 'var(--text-secondary)' }}>IVA Débito Revertido (21%):</span>
                    <span style={{ fontWeight: 600 }}>${taxDisplay.toLocaleString('es-AR', decimalOptions)}</span>
                  </div>
                )}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '1.05rem',
                    borderTop: '1px solid var(--border-color)',
                    paddingTop: '10px',
                    marginTop: '4px',
                  }}
                >
                  <span style={{ fontWeight: 700 }}>Total a Acreditar:</span>
                  <span className="tabular-nums" style={{ fontWeight: 700, color: '#111827' }}>
                    -${subtotal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                  </span>
                </div>

                {selectedCNClient && (
                  <div
                    className="tabular-nums"
                    style={{
                      fontSize: '0.78rem',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      backgroundColor: '#F3F4F6',
                      border: '1px solid #E5E7EB',
                      color: '#111827',
                      marginTop: '10px',
                      fontWeight: 500,
                      textAlign: 'center',
                    }}
                  >
                    El saldo de C/C bajará a: ${projectedBalance.toLocaleString('es-AR')}
                  </div>
                )}

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={loading || subtotal === 0}
                  style={{ width: '100%', padding: '12px', marginTop: '10px', fontSize: '0.9rem', fontWeight: 600 }}
                >
                  {loading ? 'Procesando emisión...' : 'Confirmar y Emitir Nota de Crédito'}
                </button>
              </div>
            </div>
          </div>
        </form>
    </NativeModalDialog>
  );
}
