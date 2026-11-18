import { useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { api } from '../utils/api';
import { PurchaseScannerModal } from './PurchaseScannerModal';
import { ComprasOrdenesRecepcionesTabs } from './compras/ComprasOrdenesRecepcionesTabs';
import { ComprasFacturasTab, ComprasProveedoresTab } from './compras/ComprasFacturasProveedoresTabs';
import { ComprasIngresosTab } from './compras/ComprasIngresosTab';
import { ComprasCreateReceiveModals } from './compras/ComprasCreateReceiveModals';
import { ComprasSupplierInvoiceAndPayModals } from './compras/ComprasSupplierInvoiceAndPayModals';
import { ComprasProviderModals } from './compras/ComprasProviderModals';
import { buildEmptyProviderDraft } from './compras/providersHelpers';
import { useComprasController } from './compras/useComprasController';

export type ComprasSubTab = 'proveedores' | 'facturas' | 'compras' | 'recepciones';

export interface ComprasDashboardProps {
  initialSubTab?: ComprasSubTab;
  refreshKey?: number;
  onProvidersChanged?: () => void;
}

export default function ComprasDashboard({
  initialSubTab = 'proveedores',
  refreshKey,
  onProvidersChanged,
}: ComprasDashboardProps = {}) {
  const isAdmin = api.getCurrentUser()?.role === 'ADMIN';
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [activeSubTab, setActiveSubTab] = useState<ComprasSubTab>(initialSubTab);

  const c = useComprasController(activeSubTab, refreshKey, onProvidersChanged);

  const subTabs = useMemo<Array<{ id: ComprasSubTab; label: string }>>(
    () => [
      { id: 'proveedores', label: 'Padrón' },
      { id: 'facturas', label: 'Cuentas Corrientes' },
      { id: 'compras', label: 'Compras' },
      { id: 'recepciones', label: c.inTransitCount > 0 ? `Recepciones (${c.inTransitCount})` : 'Recepciones' },
    ],
    [c.inTransitCount],
  );

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % subTabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + subTabs.length) % subTabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = subTabs.length - 1;
    else return;
    e.preventDefault();
    setActiveSubTab(subTabs[nextIdx].id);
    tabRefs.current[nextIdx]?.focus();
    tabRefs.current[nextIdx]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const hasFormModalOpen =
    c.showCreateModal ||
    Boolean(c.showReceiveModal) ||
    c.showSupplierModal ||
    c.payInvoiceModal.open ||
    Boolean(c.providerModal?.open);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {c.successMsg && (
        <div role="status" className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} aria-hidden="true" />{c.successMsg}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => c.setSuccessMsg(null)} aria-label="Cerrar notificación"><X size={15} aria-hidden="true" /></button>
        </div>
      )}
      {c.errorMsg && !hasFormModalOpen && (
        <div role="alert" className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} aria-hidden="true" />{c.errorMsg}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => c.setErrorMsg(null)} aria-label="Cerrar alerta"><X size={15} aria-hidden="true" /></button>
        </div>
      )}

      <div role="tablist" aria-label="Secciones de Compras" className="linear-tablist">
        {subTabs.map((tab, idx) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id} ref={(el) => { tabRefs.current[idx] = el; }} id={`compras-tab-${tab.id}`}
              type="button" role="tab" aria-selected={isActive} tabIndex={isActive ? 0 : -1} className="linear-tab"
              onClick={() => { setActiveSubTab(tab.id); tabRefs.current[idx]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-labelledby={`compras-tab-${activeSubTab}`}>
        {activeSubTab === 'proveedores' && (
          <ComprasProveedoresTab
            isAdmin={isAdmin} providers={c.allProviders} providerSearch={c.providerSearch} setProviderSearch={c.setProviderSearch}
            onOpenCreateProvider={() => { c.setErrorMsg(null); c.setProviderModal({ open: true, mode: 'create', data: buildEmptyProviderDraft() }); }}
            onOpenAccountSummary={c.handleOpenAccountSummary}
            onOpenEditProvider={(p) => { c.setErrorMsg(null); c.setProviderModal({ open: true, mode: 'edit', data: { ...p, rubro: p.rubro || '', contacts: Array.isArray(p.contacts) ? p.contacts : [] } }); }}
            onDeleteProvider={c.handleDeleteProvider}
          />
        )}

        {activeSubTab === 'facturas' && (
          <ComprasFacturasTab
            isAdmin={isAdmin} supplierMetrics={c.supplierMetrics} filteredInvoices={c.baseBranchInvoices}
            supplierQuery={c.supplierQuery} setSupplierQuery={c.setSupplierQuery}
            branchFilter={c.branchFilter} setBranchFilter={c.setBranchFilter}
            onOpenAccountSummary={c.handleOpenAccountSummary}
            onOpenPayInvoice={c.handleOpenPayInvoice}
            onDeleteInvoice={c.handleDeleteInvoice}
          />
        )}

        {activeSubTab === 'compras' && (
          <ComprasIngresosTab
            filteredInvoices={c.filteredInvoices}
            supplierQuery={c.supplierQuery} setSupplierQuery={c.setSupplierQuery}
            supplierStartDate={c.supplierStartDate} setSupplierStartDate={c.setSupplierStartDate}
            supplierEndDate={c.supplierEndDate} setSupplierEndDate={c.setSupplierEndDate}
            branchFilter={c.branchFilter} setBranchFilter={c.setBranchFilter}
            invoiceReceptionFilter={c.invoiceReceptionFilter} setInvoiceReceptionFilter={c.setInvoiceReceptionFilter}
            onOpenSupplierModal={() => { c.setErrorMsg(null); c.setShowSupplierModal(true); }}
            onSelectScannerFile={(file) => { c.setErrorMsg(null); c.setScannerFile(file); c.setShowScannerModal(true); }}
            onOpenReceiveInvoice={c.handleOpenReceiveModal}
            onDeleteInvoice={c.handleDeleteInvoice}
          />
        )}

        {activeSubTab === 'recepciones' && (
          <ComprasOrdenesRecepcionesTabs
            purchaseOrders={c.purchaseOrders}
            onOpenCreateModal={() => { c.setErrorMsg(null); c.setShowCreateModal(true); }}
            onOpenReceiveModal={c.handleOpenReceiveModal}
            onViewDetailsModal={c.setViewDetailsModal}
          />
        )}
      </div>

      <ComprasCreateReceiveModals
        showCreateModal={c.showCreateModal} setShowCreateModal={c.setShowCreateModal} providers={c.providers} products={c.products}
        selectedProviderId={c.selectedProviderId} setSelectedProviderId={c.setSelectedProviderId} cart={c.cart} setCart={c.setCart} onCreateSubmit={c.handleCreateOrderSubmit}
        showReceiveModal={c.showReceiveModal} setShowReceiveModal={c.setShowReceiveModal} invoiceNumber={c.invoiceNumber} setInvoiceNumber={c.setInvoiceNumber}
        receiveForm={c.receiveForm} setReceiveForm={c.setReceiveForm} receivedQuantities={c.receivedQuantities} setReceivedQuantities={c.setReceivedQuantities}
        lotAssignments={c.lotAssignments} onLotAssignmentChange={(pid, f, v) => c.setLotAssignments((prev) => ({ ...prev, [pid]: { ...prev[pid], [f]: v } }))}
        onReceiveSubmit={c.handleReceiveOrderSubmit} viewDetailsModal={c.viewDetailsModal} setViewDetailsModal={c.setViewDetailsModal}
        errorMsg={c.errorMsg} setErrorMsg={c.setErrorMsg}
      />

      <ComprasSupplierInvoiceAndPayModals
        showSupplierModal={c.showSupplierModal} setShowSupplierModal={c.setShowSupplierModal}
        providers={c.providers} products={c.products}
        supplierForm={c.supplierForm} setSupplierForm={c.setSupplierForm}
        onSupplierFieldChange={c.handleSupplierFieldChange}
        manualInvoiceItems={c.manualInvoiceItems} setManualInvoiceItems={c.setManualInvoiceItems}
        autoCalculatedTotal={c.autoCalculatedTotal} onNetChange={c.handleSupplierNetChange}
        onSupplierInvoiceSubmit={c.handleCreateSupplierInvoiceSubmit}
        payInvoiceModal={c.payInvoiceModal} setPayInvoiceModal={c.setPayInvoiceModal}
        paymentForm={c.paymentForm} setPaymentForm={c.setPaymentForm} paymentItems={c.paymentItems} setPaymentItems={c.setPaymentItems}
        bankAccounts={c.bankAccounts} onPayInvoiceSubmit={c.handlePayInvoiceSubmit}
        errorMsg={c.errorMsg} setErrorMsg={c.setErrorMsg}
      />

      <ComprasProviderModals
        providerModal={c.providerModal} setProviderModal={c.setProviderModal} onProviderSubmit={c.handleProviderSubmit}
        providers={c.allProviders} savingProvider={c.savingProvider}
        accountSummaryModal={c.accountSummaryModal} setAccountSummaryModal={c.setAccountSummaryModal} ledgerData={c.ledgerData}
        summaryLoading={c.summaryLoading} summaryError={c.summaryError}
        errorMsg={c.errorMsg} setErrorMsg={c.setErrorMsg}
      />

      <PurchaseScannerModal
        isOpen={c.showScannerModal} onClose={() => c.setShowScannerModal(false)} file={c.scannerFile}
        providers={c.providers}
        onSuccess={() => { c.setSuccessMsg('Documento procesado.'); c.loadData(); onProvidersChanged?.(); }}
      />
    </div>
  );
}
