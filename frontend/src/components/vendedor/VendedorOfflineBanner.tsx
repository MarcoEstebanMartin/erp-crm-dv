import React, { useState } from 'react';
import { WifiOff, RefreshCw, CloudUpload, AlertTriangle, Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import type { QueuedOfflineOrder, QueuedOfflineVisit } from '../../utils/offlineSyncManager';

interface VendedorOfflineBannerProps {
  isOnline: boolean;
  isSyncing: boolean;
  usingCachedCatalog: boolean;
  lastCatalogSyncAt: string | null;
  queuedOrders: QueuedOfflineOrder[];
  queuedVisits: QueuedOfflineVisit[];
  onSyncNow: () => void;
  onDiscardOrder: (id: string) => void;
  onRetryOrder: (id: string) => void;
}

function formatSyncTime(iso: string | null): string {
  if (!iso) return '-';
  try {
    return new Date(iso).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
  } catch {
    return '-';
  }
}

export const VendedorOfflineBanner: React.FC<VendedorOfflineBannerProps> = ({
  isOnline, isSyncing, usingCachedCatalog, lastCatalogSyncAt, queuedOrders, queuedVisits, onSyncNow, onDiscardOrder, onRetryOrder,
}) => {
  const [expanded, setExpanded] = useState(false);
  const hasPending = queuedOrders.length > 0 || queuedVisits.length > 0;
  const hasRejected = queuedOrders.some((o) => o.status === 'REJECTED');
  const isOfflineMode = !isOnline || usingCachedCatalog;

  if (!isOfflineMode && !hasPending && !isSyncing) return null;

  return (
    <div style={{ marginBottom: '16px', borderRadius: '8px', border: `1px solid ${hasRejected ? 'rgba(227, 6, 19, 0.28)' : isOfflineMode ? '#E5E7EB' : '#D1FAE5'}`, backgroundColor: hasRejected ? '#FEF2F2' : isOfflineMode ? '#F9FAFB' : '#ECFDF5', padding: '10px 14px', fontSize: '0.84rem', color: '#111827' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {hasRejected ? (
            <AlertTriangle size={16} color="#E30613" aria-hidden="true" />
          ) : isOfflineMode ? (
            <WifiOff size={16} color="#4B5563" aria-hidden="true" />
          ) : (
            <CloudUpload size={16} color="#059669" aria-hidden="true" />
          )}

          <div>
            <span style={{ fontWeight: 600 }}>
              {isOfflineMode ? 'Sin señal · Catálogo local' : isSyncing ? 'Sincronizando...' : 'En línea · Pendientes de envío'}
            </span>
            <span className="tabular-nums" style={{ color: '#6B7280', marginLeft: '8px', fontSize: '0.78rem' }}>
              {isOfflineMode && `(${formatSyncTime(lastCatalogSyncAt)})`}
              {hasPending && ` · ${queuedOrders.length} ped.${queuedVisits.length > 0 ? ` / ${queuedVisits.length} vis.` : ''}`}
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {queuedOrders.length > 0 && (
            <button type="button" className="tabular-nums" onClick={() => setExpanded((v) => !v)} style={{ background: '#FFFFFF', border: '1px solid #D1D5DB', borderRadius: '6px', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 500, color: '#374151', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
              <span>Cola ({queuedOrders.length})</span>
              {expanded ? <ChevronUp size={13} aria-hidden="true" /> : <ChevronDown size={13} aria-hidden="true" />}
            </button>
          )}
          {hasPending && isOnline && (
            <button type="button" disabled={isSyncing} onClick={onSyncNow} style={{ background: '#111827', border: '1px solid #111827', borderRadius: '6px', padding: '5px 12px', fontSize: '0.78rem', fontWeight: 600, color: '#FFFFFF', cursor: isSyncing ? 'wait' : 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', opacity: isSyncing ? 0.7 : 1 }}>
              <RefreshCw size={13} aria-hidden="true" />
              <span>{isSyncing ? 'Enviando...' : 'Sincronizar'}</span>
            </button>
          )}
        </div>
      </div>

      {expanded && queuedOrders.length > 0 && (
        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid #E5E7EB', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {queuedOrders.map((ord) => (
            <div key={ord.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', backgroundColor: '#FFFFFF', border: '1px solid #E5E7EB', borderRadius: '6px', padding: '6px 10px', fontSize: '0.8rem' }}>
              <div>
                <strong>{ord.clientName}</strong>
                <span className="tabular-nums" style={{ color: '#6B7280', marginLeft: '6px' }}>({ord.items.length} ít. · {formatSyncTime(ord.createdAt)})</span>
                {ord.lastError && (<div style={{ color: ord.status === 'REJECTED' ? '#E30613' : '#6B7280', fontSize: '0.75rem', marginTop: '2px' }}>{ord.lastError}</div>)}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                {ord.status === 'REJECTED' && isOnline && (<button type="button" onClick={() => onRetryOrder(ord.id)} style={{ background: '#F3F4F6', border: '1px solid #D1D5DB', borderRadius: '5px', padding: '3px 8px', fontSize: '0.74rem', cursor: 'pointer' }}>Reintentar</button>)}
                <button type="button" title="Descartar" aria-label={`Descartar pedido de ${ord.clientName}`} onClick={() => onDiscardOrder(ord.id)} style={{ background: 'transparent', border: 'none', color: '#9CA3AF', cursor: 'pointer', padding: '4px' }}>
                  <Trash2 size={14} aria-hidden="true" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
