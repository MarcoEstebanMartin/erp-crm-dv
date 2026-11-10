import React from 'react';
import { AlertCircle } from 'lucide-react';
import type { AuditTarget, DeclaredCheckItem } from './types';
import AuditLeftPanel from './AuditLeftPanel';
import AuditReceiptsPanel from './AuditReceiptsPanel';

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
  onDeleteReceipt: (tx: any) => void;
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
  onSubmit
}: RendicionAuditModalProps) {
  if (!auditTarget) return null;

  const totalExpected =
    Number(auditTarget.data.totalCash || 0) + Number(auditTarget.data.totalChecks || 0);

  return (
    <div className="modal-overlay">
      <div
        className="modal-content"
        style={{
          maxWidth: '1380px',
          width: '96vw',
          height: '88vh',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: '24px',
          borderRadius: '12px',
          overflow: 'hidden'
        }}
      >
        <div className="modal-header" style={{ marginBottom: '16px', flexShrink: 0 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>
              Arqueo y Rendición:{' '}
              {auditTarget.type === 'seller'
                ? `Vendedor ${auditTarget.data.user.username.toUpperCase()}`
                : `Repartidor ${auditTarget.data.driverName} (Ruta #${auditTarget.data.routeId})`}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
              Estás auditando los cobros realizados en calle. Ingresá el conteo físico entregado y la Caja Central donde se guardará el dinero.
            </p>
          </div>
          <button
            type="button"
            className="btn btn-ghost"
            style={{ padding: '4px' }}
            onClick={onClose}
            disabled={actionLoading}
          >
            ✕
          </button>
        </div>

        {errorMsg && (
          <div
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
              flexShrink: 0
            }}
          >
            <AlertCircle size={16} color="#ef4444" />
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
              onDeleteReceipt={onDeleteReceipt}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '12px', flexShrink: 0 }}>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onClose}
              disabled={actionLoading}
              style={{ padding: '10px 18px', fontSize: '0.88rem' }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              className="btn"
              disabled={actionLoading}
              style={{
                padding: '10px 22px',
                fontSize: '0.88rem',
                fontWeight: 600,
                backgroundColor: 'var(--color-corp-red)',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                cursor: actionLoading ? 'default' : 'pointer',
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                transition: 'background-color 0.2s'
              }}
              onMouseOver={(e) => (e.currentTarget.style.backgroundColor = '#b90510')}
              onMouseOut={(e) => (e.currentTarget.style.backgroundColor = 'var(--color-corp-red)')}
            >
              {actionLoading ? 'Verificando Arqueo...' : 'Confirmar y Cerrar Rendición'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
