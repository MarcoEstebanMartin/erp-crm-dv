import { FileText, X } from 'lucide-react';
import { DirectInvoiceClientSelector } from './DirectInvoiceClientSelector';
import { DirectInvoiceProductAdder } from './DirectInvoiceProductAdder';
import { DirectInvoiceCartTable } from './DirectInvoiceCartTable';
import { DirectInvoicePaymentPanel } from './DirectInvoicePaymentPanel';
import { useDirectInvoice } from './useDirectInvoice';
import { NativeModalDialog } from '../../modals/NativeModalDialog';

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
  bankAccounts,
}: DirectInvoiceModalProps) {
  return (
    <NativeModalDialog
      isOpen={directInvoice.showDirectInvoiceModal}
      onClose={directInvoice.handleCloseResetHeader}
      ariaLabelledBy="direct-invoice-modal-title"
      closeOnBackdrop={false}
      style={{
        maxWidth: '1550px',
        width: '96vw',
        height: '92vh',
        maxHeight: '92vh',
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
        <h2
          id="direct-invoice-modal-title"
          style={{
            fontSize: '1.18rem',
            fontWeight: 700,
            margin: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <FileText size={18} aria-hidden="true" />
          Venta directa
        </h2>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '4px' }}
          onClick={directInvoice.handleCloseResetHeader}
          aria-label="Cerrar"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <form
        onSubmit={directInvoice.handleCreateDirectInvoiceSubmit}
        style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden', minHeight: 0 }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.4fr 1fr',
            gap: '24px',
            flex: 1,
            overflow: 'hidden',
            minHeight: 0,
          }}
        >
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
              promoEval={directInvoice.promoEval}
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
    </NativeModalDialog>
  );
}
