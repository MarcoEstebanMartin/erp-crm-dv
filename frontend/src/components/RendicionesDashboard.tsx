import React, { useState, useEffect } from 'react';
import { CheckCircle, RefreshCw, AlertCircle, ShieldCheck, X } from 'lucide-react';
import ArqueoCajaModal from './ArqueoCajaModal';
import type { RendicionesTabType, RouteGroup, SellerGroup } from './rendiciones/types';
import { useRendicionesAudit } from './rendiciones/useRendicionesAudit';
import { useDepositDrawers } from './rendiciones/useDepositDrawers';
import PendingRendicionesTabs from './rendiciones/PendingRendicionesTabs';
import RendicionAuditModal from './rendiciones/RendicionAuditModal';
import DrawersHistoryTable from './rendiciones/DrawersHistoryTable';
import CajaOpenModal from './rendiciones/CajaOpenModal';
import InspectDrawerModal from './rendiciones/InspectDrawerModal';
import ArqueoResultModal from './rendiciones/ArqueoResultModal';

export type { SellerGroup, RouteGroup };

const RendicionesDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<RendicionesTabType>('sellers');

  const audit = useRendicionesAudit();
  const deposit = useDepositDrawers();

  useEffect(() => {
    audit.fetchRendiciones();
    deposit.fetchDrawers();
  }, []);

  const topError = (audit.errorMsg && !audit.auditTarget ? audit.errorMsg : null) || deposit.drawerError;

  return (
    <div style={{ padding: '0px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {audit.successMsg && (
        <div
          role="status"
          style={{
            padding: '12px 16px',
            backgroundColor: '#ecfdf5',
            color: '#065f46',
            borderRadius: '8px',
            border: '1px solid #a7f3d0',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={18} color="#10b981" aria-hidden="true" />
            <span>{audit.successMsg}</span>
          </span>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => audit.setSuccessMsg(null)} aria-label="Cerrar notificación">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      {topError && (
        <div
          role="alert"
          style={{
            padding: '12px 16px',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            borderRadius: '8px',
            border: '1px solid #fca5a5',
            fontSize: '0.9rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} color="#ef4444" aria-hidden="true" />
            <span>{topError}</span>
          </span>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px' }}
            onClick={() => {
              audit.setErrorMsg(null);
              deposit.setDrawerError(null);
            }}
            aria-label="Cerrar alerta"
          >
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <div className="card" style={{ padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px', color: 'var(--text-primary)' }}>
            <ShieldCheck size={24} color="var(--color-primary)" aria-hidden="true" />
            Arqueo de Cajas
          </h2>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              audit.fetchRendiciones();
              deposit.fetchDrawers();
            }}
            disabled={audit.loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} className={audit.loading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Actualizar</span>
          </button>
        </div>

        <PendingRendicionesTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          loading={audit.loading}
          sellers={audit.sellers}
          routes={audit.routes}
          drawers={deposit.drawers}
          onOpenAudit={audit.handleOpenAudit}
          onInspectDrawer={deposit.handleInspectDrawer}
          onOpenCloseCaja={(drawerId) => {
            deposit.setDrawerError(null);
            deposit.setAmountInput('');
            deposit.setCajaActionModal({ open: true, branch: 'DEPOSITO', mode: 'close', drawerId });
          }}
          onOpenNewCaja={() => {
            deposit.setDrawerError(null);
            deposit.setAmountInput('');
            deposit.setCajaActionModal({ open: true, branch: 'DEPOSITO', mode: 'open' });
          }}
        />
      </div>

      <RendicionAuditModal
        auditTarget={audit.auditTarget}
        errorMsg={audit.errorMsg}
        actionLoading={audit.actionLoading}
        realCash={audit.realCash}
        onRealCashChange={audit.setRealCash}
        realChecks={audit.realChecks}
        onRealChecksChange={audit.setRealChecks}
        declaredChecksList={audit.declaredChecksList}
        newCheckNumber={audit.newCheckNumber}
        onNewCheckNumberChange={audit.setNewCheckNumber}
        newCheckBank={audit.newCheckBank}
        onNewCheckBankChange={audit.setNewCheckBank}
        newCheckAmount={audit.newCheckAmount}
        onNewCheckAmountChange={audit.setNewCheckAmount}
        onAddCheck={audit.handleAddDeclaredCheck}
        onRemoveCheck={audit.handleRemoveDeclaredCheck}
        auditRouteNote={audit.auditRouteNote}
        onAuditRouteNoteChange={audit.setAuditRouteNote}
        auditNotes={audit.auditNotes}
        onAuditNotesChange={audit.setAuditNotes}
        onDeleteReceipt={audit.handleDeleteReceipt}
        onClose={audit.handleCloseAudit}
        onSubmit={audit.handleVerifySubmit}
      />

      <DrawersHistoryTable
        loadingHistory={deposit.loadingHistory}
        filteredHistory={deposit.filteredHistory}
        filterStartDate={deposit.filterStartDate}
        onFilterStartDateChange={deposit.setFilterStartDate}
        filterEndDate={deposit.filterEndDate}
        onFilterEndDateChange={deposit.setFilterEndDate}
        onInspectDrawer={deposit.handleInspectDrawer}
      />

      <CajaOpenModal
        open={Boolean(deposit.cajaActionModal?.open && deposit.cajaActionModal.mode === 'open')}
        amountInput={deposit.amountInput}
        onAmountChange={deposit.setAmountInput}
        errorMsg={deposit.drawerError}
        onClose={() => {
          deposit.setDrawerError(null);
          deposit.setCajaActionModal(null);
        }}
        onSubmit={deposit.handleCajaActionSubmit}
      />

      {deposit.cajaActionModal?.open && deposit.cajaActionModal.mode === 'close' && (
        <ArqueoCajaModal
          drawer={deposit.drawers.find((d) => d.id === deposit.cajaActionModal?.drawerId)}
          onClose={() => deposit.setCajaActionModal(null)}
          onSuccess={deposit.handleCajaArqueoSubmit}
        />
      )}

      <InspectDrawerModal
        inspectDrawer={deposit.inspectDrawer}
        inspectTxs={deposit.inspectTxs}
        loadingTxs={deposit.loadingTxs}
        onClose={deposit.handleCloseInspect}
      />

      <ArqueoResultModal
        arqueoResult={audit.arqueoResult}
        onClose={() => audit.setArqueoResult(null)}
      />
    </div>
  );
};

export default RendicionesDashboard;
