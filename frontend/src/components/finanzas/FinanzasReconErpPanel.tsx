import React from 'react';
import { api } from '../../utils/api';
import { isEcheqTx } from './finanzasHelpers';

interface FinanzasReconErpPanelProps {
  reconTransactions: any[];
  sortedReconTransactions: any[];
  selectedTxs: Set<number>;
  setSelectedTxs: React.Dispatch<React.SetStateAction<Set<number>>>;
  reconLoading: boolean;
  reconBankId: string;
  onVerifySelected: () => void;
  onRefreshMainData: () => void;
  onReload: () => void;
}

export const FinanzasReconErpPanel: React.FC<FinanzasReconErpPanelProps> = ({
  reconTransactions,
  sortedReconTransactions,
  selectedTxs,
  setSelectedTxs,
  reconLoading,
  reconBankId,
  onVerifySelected,
  onRefreshMainData,
  onReload,
}) => (
  <div style={{ flex: '1 1 0', minWidth: '300px', borderLeft: '1px solid var(--border-color)', paddingLeft: '20px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: 0 }}>
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
      <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700 }}>En ERP ({reconTransactions.length})</h4>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {selectedTxs.size > 0 && (
          <button type="button" className="btn btn-primary" disabled={reconLoading} style={{ backgroundColor: '#10b981', borderColor: '#10b981', fontSize: '0.74rem', padding: '4px 10px' }} onClick={onVerifySelected}>
            Verificar ({selectedTxs.size})
          </button>
        )}
        {reconTransactions.some((t) => !t.verified) && (
          <button
            type="button"
            className="btn btn-ghost"
            style={{ fontSize: '0.74rem', padding: '3px 8px' }}
            onClick={() => {
              const unverifiedIds = reconTransactions.filter((t) => !t.verified).map((t) => t.id);
              setSelectedTxs((prev) => (prev.size === unverifiedIds.length ? new Set() : new Set(unverifiedIds)));
            }}
          >
            {selectedTxs.size === reconTransactions.filter((t) => !t.verified).length ? 'Deseleccionar' : 'Todo'}
          </button>
        )}
      </div>
    </div>
    <div style={{ flex: 1, minHeight: 0, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
      {sortedReconTransactions.length === 0 ? (
        <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>Sin transferencias en el período</div>
      ) : (
        sortedReconTransactions.map((t: any) => (
          <div key={t.id} style={{ padding: '9px 12px', borderBottom: '1px solid var(--border-color)', backgroundColor: t.verified ? '#fafafa' : '#fff', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '0.8rem' }}>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center', minWidth: 0 }}>
              {!t.verified && (
                <input
                  type="checkbox"
                  aria-label={`Seleccionar transferencia ${t.persona?.name || t.id}`}
                  checked={selectedTxs.has(t.id)}
                  onChange={() =>
                    setSelectedTxs((prev) => {
                      const n = new Set(prev);
                      if (n.has(t.id)) n.delete(t.id);
                      else n.add(t.id);
                      return n;
                    })
                  }
                />
              )}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {t.persona?.name || 'Mostrador'}
                  {isEcheqTx(t) ? ' · eCheq' : ''}
                </div>
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                  {new Date(t.createdAt).toLocaleDateString('es-AR')}
                  {t.verified && t.verifiedBy?.username ? ` · Concilió: ${t.verifiedBy.username}` : ''}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
              <span className="tabular-nums" style={{ fontFamily: 'monospace', fontWeight: 700 }}>
                ${Math.round(Number(t.amount)).toLocaleString('es-AR')}
              </span>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ fontSize: '0.72rem', padding: '2px 6px', color: t.verified ? '#64748b' : '#10b981', fontWeight: t.verified ? 400 : 600 }}
                onClick={async () => {
                  await api.verifyTransaction(t.id, !t.verified, undefined, !t.verified ? Number(reconBankId) || undefined : undefined);
                  onRefreshMainData();
                  onReload();
                }}
              >
                {t.verified ? 'Verificada' : 'Verificar'}
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  </div>
);
