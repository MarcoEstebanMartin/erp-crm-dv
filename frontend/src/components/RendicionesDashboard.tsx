import React, { useState, useEffect, useRef } from 'react';
import { CheckCircle, RefreshCw, AlertCircle, ShieldCheck, Printer, X } from 'lucide-react';
import ArqueoCajaModal from './ArqueoCajaModal';
import type { RendicionesTabType, RouteGroup, SellerGroup } from './rendiciones/types';
import { useRendicionesAudit } from './rendiciones/useRendicionesAudit';
import { useDepositDrawers } from './rendiciones/useDepositDrawers';
import { useFieldRendiciones } from './rendiciones/useFieldRendiciones';
import PendingRendicionesTabs from './rendiciones/PendingRendicionesTabs';
import { PendingFieldTransfersCard } from './rendiciones/FieldSettlementCards';
import { RecentApprovedSettlementsCard } from './rendiciones/RecentApprovedSettlementsCard';
import RendicionAuditModal from './rendiciones/RendicionAuditModal';
import CajaOpenModal from './rendiciones/CajaOpenModal';
import InspectDrawerModal from './rendiciones/InspectDrawerModal';
import ArqueoResultModal from './rendiciones/ArqueoResultModal';
import { printHandoverTicket80mm } from '../utils/print/printHandoverTicket80mm';

export type { SellerGroup, RouteGroup };

const RendicionesDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState<RendicionesTabType>('sellers');
  const hasAutoSelectedTab = useRef(false);

  const audit = useRendicionesAudit();
  const deposit = useDepositDrawers();
  const field = useFieldRendiciones();

  useEffect(() => {
    audit.fetchRendiciones();
    deposit.fetchDrawers();
    void field.fetchFieldRendiciones();
  }, []);

  const sellersTotalCount = audit.sellers.length + field.sellerFieldSettlements.length;
  const driversTotalCount = audit.routes.length + field.driverFieldSettlements.length;

  useEffect(() => {
    if (hasAutoSelectedTab.current || audit.loading || field.loading) return;
    if (sellersTotalCount > 0 || driversTotalCount > 0) {
      hasAutoSelectedTab.current = true;
      if (sellersTotalCount === 0 && driversTotalCount > 0) {
        setActiveTab('routes');
      }
    }
  }, [audit.loading, field.loading, sellersTotalCount, driversTotalCount]);

  const topSuccess = audit.successMsg || field.statusMsg;
  const topError = (audit.errorMsg && !audit.auditTarget ? audit.errorMsg : null) || deposit.drawerError || field.errorMsg;

  return (
    <div style={{ padding: '0px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {topSuccess && (
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
            <span>{topSuccess}</span>
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {field.lastApprovedTicket && (
              <button
                type="button"
                className="btn btn-secondary"
                style={{ padding: '4px 10px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
                onClick={() => printHandoverTicket80mm(field.lastApprovedTicket!)}
              >
                <Printer size={14} aria-hidden="true" /> Imprimir Ticket
              </button>
            )}
            <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => { audit.setSuccessMsg(null); field.setStatusMsg(null); field.setLastApprovedTicket(null); }} aria-label="Cerrar notificación">
              <X size={15} aria-hidden="true" />
            </button>
          </div>
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
              field.setErrorMsg(null);
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
            Rendiciones
          </h2>
          <button
            type="button"
            className="btn btn-ghost"
            onClick={() => {
              audit.fetchRendiciones();
              deposit.fetchDrawers();
              void field.fetchFieldRendiciones();
            }}
            disabled={audit.loading || field.loading}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={16} className={audit.loading || field.loading ? 'animate-spin' : ''} aria-hidden="true" />
            <span>Actualizar</span>
          </button>
        </div>

        <PendingRendicionesTabs
          activeTab={activeTab}
          onTabChange={setActiveTab}
          loading={audit.loading || field.loading}
          sellers={audit.sellers}
          routes={audit.routes}
          sellerFieldSettlements={field.sellerFieldSettlements}
          driverFieldSettlements={field.driverFieldSettlements}
          fieldBusyId={field.busyId}
          declaredCashById={field.declaredCashById}
          setDeclaredCashById={field.setDeclaredCashById}
          onApproveFieldSettlement={(s) => {
            void field.handleApproveSettlement(s).then(() => {
              deposit.fetchDrawers();
            });
          }}
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

      <PendingFieldTransfersCard
        pendingTransfers={field.pendingTransfers}
        banks={field.banks}
        bankByPaymentId={field.bankByPaymentId}
        setBankByPaymentId={field.setBankByPaymentId}
        previewImage={field.previewImage}
        setPreviewImage={field.setPreviewImage}
        onVerifyTransfer={(pid, action, bankId) => void field.handleVerifyTransfer(pid, action, bankId)}
      />

      <RecentApprovedSettlementsCard settlements={field.approvedSettlements} />

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
