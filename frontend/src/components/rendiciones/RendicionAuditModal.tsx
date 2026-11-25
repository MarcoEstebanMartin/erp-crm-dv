import React, { useState } from 'react';
import { AlertCircle, X } from 'lucide-react';
import type { AuditTarget, DeclaredCheckItem } from './types';
import AuditLeftPanel from './AuditLeftPanel';
import AuditReceiptsPanel from './AuditReceiptsPanel';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { VoidReceiptModal } from '../modals/VoidReceiptModal';

interface RendicionAuditModalProps {
  auditTarget: AuditTarget | null;
  errorMsg: string | null;
  actionLoading: boolean;
  realCash: string;
  onRealCashChange: (val: string) => void;
  realChecks: string;
  onRealChecksChange: (val: string) => void;
  declaredChecksList: DeclaredCheckItem[];
  newCheckNumber: string;
  onNewCheckNumberChange: (val: string) => void;
  newCheckBank: string;
  onNewCheckBankChange: (val: string) => void;
  newCheckAmount: string;
  onNewCheckAmountChange: (val: string) => void;
  onAddCheck: () => void;
  onRemoveCheck: (index: number) => void;
  auditRouteNote: string;
  onAuditRouteNoteChange: (val: string) => void;
  auditNotes: string;
  onAuditNotesChange: (val: string) => void;
  onDeleteReceipt: (tx: any, reason?: string) => Promise<void> | void;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export default function RendicionAuditModal({
  auditTarget,
  errorMsg,
  actionLoading,
  realCash,
  onRealCashChange,
  realChecks,
  onRealChecksChange,
  declaredChecksList,
  newCheckNumber,
  onNewCheckNumberChange,
  newCheckBank,
  onNewCheckBankChange,
  newCheckAmount,
  onNewCheckAmountChange,
  onAddCheck,
  onRemoveCheck,
  auditRouteNote,
  onAuditRouteNoteChange,
  auditNotes,
  onAuditNotesChange,
  onDeleteReceipt,
  onClose,
  onSubmit,
}: RendicionAuditModalProps) {
  const [voidTx, setVoidTx] = useState<any | null>(null);
  const totalExpected = auditTarget
    ? Number(auditTarget.data.totalCash || 0) + Number(auditTarget.data.totalChecks || 0)
    : 0;

  return (
    <NativeModalDialog
      isOpen={Boolean(auditTarget)}
      onClose={onClose}
      ariaLabelledBy="rendicion-audit-title"
      closeOnBackdrop={!actionLoading}
      style={{
        maxWidth: '1380px',
        width: '96vw',
        height: '88vh',
        maxHeight: '92vh',
        display: 'flex',
        flexDirection: 'column',
        padding: '24px',
        overflow: 'hidden',
      }}
    >
      {auditTarget && (
        <>
          <div className="modal-header" style={{ marginBottom: '16px', flexShrink: 0 }}>
            <h3 id="rendicion-audit-title" style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>
              Rendición:{' '}
              {auditTarget.type === 'seller'
                ? auditTarget.data.user.username.toUpperCase()
                : `${auditTarget.data.driverName} (Ruta #${auditTarget.data.routeId})`}
            </h3>
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '4px' }}
              onClick={onClose}
              disabled={actionLoading}
              aria-label="Cerrar"
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          {errorMsg && (
            <div
              role="alert"
              style={{
                padding: '12px 16px',
                backgroundColor: '#fef2f2',
                color: '#991b1b',
                borderRadius: '6px',
                border: '1px solid #fca5a5',
                marginBottom: '16px',
                fontSize: '0.88rem',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                flexShrink: 0,
              }}
            >
              <AlertCircle size={16} color="#ef4444" aria-hidden="true" />
              <span>{errorMsg}</span>
            </div>
          )}

          <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(380px, 440px) 1fr', gap: '20px', flex: 1, overflow: 'hidden', minHeight: 0 }}>
              <AuditLeftPanel
                auditTarget={auditTarget}
                realCash={realCash}
                onRealCashChange={onRealCashChange}
                realChecks={realChecks}
                onRealChecksChange={onRealChecksChange}
                declaredChecksList={declaredChecksList}
                newCheckNumber={newCheckNumber}
                onNewCheckNumberChange={onNewCheckNumberChange}
                newCheckBank={newCheckBank}
                onNewCheckBankChange={onNewCheckBankChange}
                newCheckAmount={newCheckAmount}
                onNewCheckAmountChange={onNewCheckAmountChange}
                onAddCheck={onAddCheck}
                onRemoveCheck={onRemoveCheck}
                auditRouteNote={auditRouteNote}
                onAuditRouteNoteChange={onAuditRouteNoteChange}
                auditNotes={auditNotes}
                onAuditNotesChange={onAuditNotesChange}
              />

              <AuditReceiptsPanel
                transactions={auditTarget.data.transactions}
                totalExpected={totalExpected}
                actionLoading={actionLoading}
                onDeleteReceipt={(tx) => setVoidTx(tx)}
              />
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '12px', flexShrink: 0 }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={onClose}
                disabled={actionLoading}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                disabled={actionLoading}
                style={{
                  backgroundColor: 'var(--color-corp-red)',
                  borderColor: 'var(--color-corp-red)',
                }}
              >
                {actionLoading ? 'Procesando...' : 'Confirmar Rendición'}
              </button>
            </div>
          </form>
        </>
      )}
      <VoidReceiptModal
        isOpen={Boolean(voidTx)}
        receiptLabel={voidTx?.receiptNumber || `N° ${voidTx?.id || ''}`}
        clientName={voidTx?.persona?.name || 'Cliente'}
        amount={Number(voidTx?.amount || 0)}
        submitting={actionLoading}
        onClose={() => setVoidTx(null)}
        onConfirm={async (reason) => {
          if (!voidTx) return;
          await onDeleteReceipt(voidTx, reason);
          setVoidTx(null);
        }}
      />
    </NativeModalDialog>
  );
}
