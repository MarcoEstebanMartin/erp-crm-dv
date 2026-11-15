import { AlertTriangle, CheckCircle } from 'lucide-react';
import SalesBillingTab from './billing/SalesBillingTab';
import TaxWithholdingsTab from './billing/TaxWithholdingsTab';
import CreditNotesTab from './billing/CreditNotesTab';
import { BillingFilterBar } from './billing/BillingFilterBar';
import { type BillingSubTab, useBillingDashboard } from './billing/useBillingDashboard';

interface BillingDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

const SUB_TAB_OPTIONS: Array<{ id: BillingSubTab; label: string }> = [
  { id: 'ventas', label: 'Comprobantes Venta' },
  { id: 'notas-credito', label: 'Notas de Crédito' },
  { id: 'retenciones', label: 'Retenciones' },
];

export default function BillingDashboard({ activeTab }: BillingDashboardProps) {
  const b = useBillingDashboard(activeTab);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {b.successMsg && (
        <div
          role="status"
          style={{
            backgroundColor: 'var(--color-success-bg)',
            borderLeft: '4px solid var(--color-success)',
            color: 'var(--text-primary)',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '0.88rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            animation: 'slideDown 0.3s ease',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
            {b.successMsg}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '2px', color: 'var(--text-secondary)' }}
            onClick={() => b.setSuccessMsg(null)}
            aria-label="Cerrar notificación"
          >
            ✕
          </button>
        </div>
      )}

      {b.errorMsg && (
        <div
          role="alert"
          style={{
            backgroundColor: '#FFF2F2',
            borderLeft: '4px solid var(--color-danger)',
            color: 'var(--text-primary)',
            padding: '12px 16px',
            borderRadius: '8px',
            fontSize: '0.88rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            animation: 'slideDown 0.3s ease',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
            {b.errorMsg}
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '2px', color: 'var(--text-secondary)' }}
            onClick={() => b.setErrorMsg(null)}
            aria-label="Cerrar alerta"
          >
            ✕
          </button>
        </div>
      )}

      <div
        style={{
          display: 'flex',
          gap: '4px',
          backgroundColor: '#EAEAEA',
          padding: '4px',
          borderRadius: '8px',
          width: 'fit-content',
        }}
      >
        {SUB_TAB_OPTIONS.map((tab) => {
          const isActive = b.activeSubTab === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              className="btn"
              onClick={() => b.setActiveSubTab(tab.id)}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                transition: 'var(--transition-fast)',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

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

      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}
