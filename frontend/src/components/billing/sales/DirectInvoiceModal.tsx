import { X } from 'lucide-react';
import { DirectInvoiceClientSelector } from './DirectInvoiceClientSelector';
import { DirectInvoiceProductAdder } from './DirectInvoiceProductAdder';
import { DirectInvoiceCartTable } from './DirectInvoiceCartTable';
import { DirectInvoicePaymentPanel } from './DirectInvoicePaymentPanel';
import { useDirectInvoice } from './useDirectInvoice';

interface DirectInvoiceModalProps {
  directInvoice: ReturnType<typeof useDirectInvoice>;
  products: any[];
  activeDrawers: any[];
  bankAccounts: any[];
}

export function DirectInvoiceModal({
  directInvoice,
  products,
  activeDrawers,
  bankAccounts
}: DirectInvoiceModalProps) {
  if (!directInvoice.showDirectInvoiceModal) return null;

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{
          maxWidth: '1550px',
          width: '96vw',
          height: '92vh',
          maxHeight: '92vh',
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '12px',
            marginBottom: '16px'
          }}
        >
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ color: 'var(--accent-color)' }}>📃</span> Emitir Factura de Venta Directa
          </h2>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px' }}
            onClick={directInvoice.handleCloseResetHeader}
          >
            <X size={18} />
          </button>
        </div>

        <form
          onSubmit={directInvoice.handleCreateDirectInvoiceSubmit}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '24px', flex: 1, overflow: 'hidden', minHeight: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflow: 'hidden', minHeight: 0 }}>
              <DirectInvoiceClientSelector
                clientSearchInputRef={directInvoice.clientSearchInputRef}
                clientSearchQuery={directInvoice.clientSearchQuery}
                setClientSearchQuery={directInvoice.setClientSearchQuery}
                showClientDropdown={directInvoice.showClientDropdown}
                setShowClientDropdown={directInvoice.setShowClientDropdown}
                activeClientSuggestionIdx={directInvoice.activeClientSuggestionIdx}
                setActiveClientSuggestionIdx={directInvoice.setActiveClientSuggestionIdx}
                filteredClients={directInvoice.filteredClients}
                selectedDirectClient={directInvoice.selectedDirectClient}
                handleSelectClient={directInvoice.handleSelectClient}
              />

              {directInvoice.selectedDirectClient && (
                <DirectInvoiceProductAdder
                  products={products}
                  selectedDirectProduct={directInvoice.selectedDirectProduct}
                  productSearchInputRef={directInvoice.productSearchInputRef}
                  productQtyInputRef={directInvoice.productQtyInputRef}
                  productSearchQuery={directInvoice.productSearchQuery}
                  setProductSearchQuery={directInvoice.setProductSearchQuery}
                  showProductDropdown={directInvoice.showProductDropdown}
                  setShowProductDropdown={directInvoice.setShowProductDropdown}
                  activeProductSuggestionIdx={directInvoice.activeProductSuggestionIdx}
                  setActiveProductSuggestionIdx={directInvoice.setActiveProductSuggestionIdx}
                  filteredProducts={directInvoice.filteredProducts}
                  directProductQty={directInvoice.directProductQty}
                  setDirectProductQty={directInvoice.setDirectProductQty}
                  handleSelectProduct={directInvoice.handleSelectProduct}
                  handleAddDirectProduct={directInvoice.handleAddDirectProduct}
                />
              )}

              <DirectInvoiceCartTable
                directCart={directInvoice.directCart}
                setDirectCart={directInvoice.setDirectCart}
                handleRemoveDirectProduct={directInvoice.handleRemoveDirectProduct}
              />
            </div>

            <DirectInvoicePaymentPanel
              directInvoiceForm={directInvoice.directInvoiceForm}
              setDirectInvoiceForm={directInvoice.setDirectInvoiceForm}
              selectedDirectClient={directInvoice.selectedDirectClient}
              activeDrawers={activeDrawers}
              bankAccounts={bankAccounts}
              directBillingTotals={directInvoice.directBillingTotals}
              modalError={directInvoice.modalError}
              isSubmitting={directInvoice.isSubmitting}
              isCartEmpty={directInvoice.directCart.length === 0}
              onCancel={directInvoice.handleCancelFooter}
            />
          </div>
        </form>
      </div>
    </div>
  );
}
