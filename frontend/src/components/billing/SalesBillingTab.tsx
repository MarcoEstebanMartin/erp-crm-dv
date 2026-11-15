import { useState } from 'react';
import type { SalesBillingTabProps } from './sales/sales.types';
import { useDirectInvoice } from './sales/useDirectInvoice';
import { SalesInvoicesTable } from './sales/SalesInvoicesTable';
import { DirectInvoiceModal } from './sales/DirectInvoiceModal';
import { InvoicePreviewModal } from './sales/InvoicePreviewModal';

export type { SalesBillingTabProps };

export default function SalesBillingTab({
  salesInvoices,
  personas,
  products,
  bankAccounts,
  activeDrawers,
  ivaPerceptionAliquot,
  salesInvoiceTypeFilter,
  requestingCaeOrderId,
  onRequestOrderCae,
  loading,
  loadData,
  setErrorMsg,
  setSuccessMsg,
  handleCreateCreditNoteFromInvoice,
}: SalesBillingTabProps) {
  const [viewInvoiceModal, setViewInvoiceModal] = useState<any | null>(null);

  const directInvoice = useDirectInvoice({
    personas,
    products,
    bankAccounts,
    activeDrawers,
    ivaPerceptionAliquotOverride: ivaPerceptionAliquot,
    loadData,
    setErrorMsg,
    setSuccessMsg,
    onInvoiceCreated: (inv) => setViewInvoiceModal(inv),
  });

  return (
    <>
      <SalesInvoicesTable
        salesInvoices={salesInvoices}
        loading={loading}
        salesInvoiceTypeFilter={salesInvoiceTypeFilter}
        requestingCaeOrderId={requestingCaeOrderId}
        onRequestOrderCae={onRequestOrderCae}
        onOpenDirectInvoiceModal={() => directInvoice.setShowDirectInvoiceModal(true)}
        onViewInvoice={(inv) => setViewInvoiceModal(inv)}
        handleCreateCreditNoteFromInvoice={handleCreateCreditNoteFromInvoice}
      />

      <DirectInvoiceModal
        directInvoice={directInvoice}
        products={products}
        activeDrawers={activeDrawers}
        bankAccounts={bankAccounts}
      />

      <InvoicePreviewModal
        invoice={viewInvoiceModal}
        onClose={() => setViewInvoiceModal(null)}
      />
    </>
  );
}
