import { lazy, Suspense, useRef, type KeyboardEvent } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import SalesBillingTab from './billing/SalesBillingTab';
import TaxWithholdingsTab from './billing/TaxWithholdingsTab';
import CreditNotesTab from './billing/CreditNotesTab';
import { BillingFilterBar } from './billing/BillingFilterBar';
import { type BillingSubTab, useBillingDashboard } from './billing/useBillingDashboard';

const AfipExportDashboard = lazy(() => import('../pages/AfipExportDashboard'));

interface BillingDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const SUB_TAB_OPTIONS: Array<{ id: BillingSubTab; label: string }> = [
  { id: 'ventas', label: 'Comprobantes' },
  { id: 'notas-credito', label: 'Notas de Crédito' },
  { id: 'retenciones', label: 'Retenciones' },
  { id: 'libro-iva', label: 'Libro IVA Digital' },
];

export default function BillingDashboard({ activeTab }: BillingDashboardProps) {
  const b = useBillingDashboard(activeTab);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % SUB_TAB_OPTIONS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + SUB_TAB_OPTIONS.length) % SUB_TAB_OPTIONS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = SUB_TAB_OPTIONS.length - 1;
    else return;

    e.preventDefault();
    const target = SUB_TAB_OPTIONS[nextIdx];
    b.setActiveSubTab(target.id);
    tabRefs.current[nextIdx]?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      {b.successMsg && (
        <div
          role="status"
          style={{
            backgroundColor: '#F9FAFB',
            border: '1px solid #E5E7EB',
            borderLeft: '3px solid #111827',
            color: 'var(--text-primary)',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.86rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            animation: 'slideDown 0.25s ease',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} aria-hidden="true" style={{ color: '#111827' }} />
            {b.successMsg}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px', color: 'var(--text-secondary)' }}
            onClick={() => b.setSuccessMsg(null)}
            aria-label="Cerrar notificación"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {b.errorMsg && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FEF2F2',
            border: '1px solid rgba(227, 6, 19, 0.25)',
            borderLeft: '3px solid #E30613',
            color: 'var(--text-primary)',
            padding: '10px 14px',
            borderRadius: '8px',
            fontSize: '0.86rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            animation: 'slideDown 0.25s ease',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} aria-hidden="true" style={{ color: '#E30613' }} />
            {b.errorMsg}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px', color: 'var(--text-secondary)' }}
            onClick={() => b.setErrorMsg(null)}
            aria-label="Cerrar alerta"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <div
        role="tablist"
        aria-label="Subsecciones de Facturación e Impuestos"
        className="linear-tablist"
      >
        {SUB_TAB_OPTIONS.map((tab, idx) => {
          const isActive = b.activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              id={`billing-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isActive}
              tabIndex={isActive ? 0 : -1}
              className="linear-tab"
              onClick={() => b.setActiveSubTab(tab.id)}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {b.activeSubTab !== 'libro-iva' && (
        <BillingFilterBar
          activeSubTab={b.activeSubTab}
          query={b.query}
          setQuery={b.setQuery}
          startDate={b.startDate}
          setStartDate={b.setStartDate}
          endDate={b.endDate}
          setEndDate={b.setEndDate}
          salesInvoiceTypeFilter={b.salesInvoiceTypeFilter}
          setSalesInvoiceTypeFilter={b.setSalesInvoiceTypeFilter}
          statusFilter={b.statusFilter}
          setStatusFilter={b.setStatusFilter}
          onSelectToday={b.handleSelectToday}
          onClearFilters={b.handleClearFilters}
        />
      )}

      <div
        role="tabpanel"
        id={`billing-panel-${b.activeSubTab}`}
        aria-labelledby={`billing-tab-${b.activeSubTab}`}
      >
        {b.activeSubTab === 'ventas' && (
          <SalesBillingTab
            salesInvoices={b.salesInvoices}
            personas={b.personas}
            products={b.products}
            bankAccounts={b.bankAccounts}
            activeDrawers={b.activeDrawers}
            ivaPerceptionAliquot={b.ivaPerceptionAliquot}
            salesInvoiceTypeFilter={b.salesInvoiceTypeFilter}
            requestingCaeOrderId={b.requestingCaeOrderId}
            onRequestOrderCae={b.handleRequestOrderCae}
            loading={b.loading}
            loadData={b.refreshAfterMutation}
            setErrorMsg={b.setErrorMsg}
            setSuccessMsg={b.setSuccessMsg}
            handleCreateCreditNoteFromInvoice={b.handleCreateCreditNoteFromInvoice}
          />
        )}

        {b.activeSubTab === 'retenciones' && (
          <TaxWithholdingsTab
            taxWithholdings={b.taxWithholdings}
            personas={b.personas}
            loading={b.loading}
            loadData={b.refreshAfterMutation}
            setErrorMsg={b.setErrorMsg}
            setSuccessMsg={b.setSuccessMsg}
          />
        )}

        {b.activeSubTab === 'notas-credito' && (
          <CreditNotesTab
            creditNotes={b.creditNotes}
            personas={b.personas}
            products={b.products}
            loading={b.loading}
            loadData={b.refreshAfterMutation}
            setErrorMsg={b.setErrorMsg}
            setSuccessMsg={b.setSuccessMsg}
            showCreditNoteModal={b.showCreditNoteModal}
            setShowCreditNoteModal={b.setShowCreditNoteModal}
            creditNoteForm={b.creditNoteForm}
            setCreditNoteForm={b.setCreditNoteForm}
            creditNoteCart={b.creditNoteCart}
            setCreditNoteCart={b.setCreditNoteCart}
            cnClientSearchQuery={b.cnClientSearchQuery}
            setCnClientSearchQuery={b.setCnClientSearchQuery}
            viewCreditNoteModal={b.viewCreditNoteModal}
            setViewCreditNoteModal={b.setViewCreditNoteModal}
          />
        )}

        {b.activeSubTab === 'libro-iva' && (
          <Suspense
            fallback={
              <div className="card" style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>
                Cargando Libro IVA Digital AFIP...
              </div>
            }
          >
            <AfipExportDashboard />
          </Suspense>
        )}
      </div>

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-8px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
