import React, { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw, Search, Send, WifiOff, X } from 'lucide-react';
import {
  fieldReceiptsApi,
  type CollectorSettlementDTO,
  type FieldReceiptDTO,
  type OfflineBundleBankAccount,
  type OfflineBundleClient,
} from '../../api/fieldReceipts.api';
import {
  flushOfflineReceiptQueue,
  getPendingOfflineReceipts,
  loadOfflineBundle,
  saveOfflineBundle,
  startOfflineSyncListener,
  type QueuedFieldReceipt,
} from '../../utils/offlineReceiptQueue';
import { buildFieldReceiptWhatsAppMessage } from '../../utils/receiptWhatsApp';
import { FieldCollectModal } from './FieldCollectModal';
import { FieldTodayReceiptsCard } from './FieldTodayReceiptsCard';
import {
  ReceiptWhatsAppSendModal,
  type ReceiptWhatsAppTarget,
} from './ReceiptWhatsAppSendModal';
import { buildSearchIndex, filterIndexedItems } from '../vendedor/vendedorHelpers';

interface FieldCollectionPageProps {
  isActive?: boolean;
  initialClientId?: number | null;
  onInitialClientHandled?: () => void;
}

export const FieldCollectionPage: React.FC<FieldCollectionPageProps> = ({
  isActive = true,
  initialClientId = null,
  onInitialClientHandled,
}) => {
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [clients, setClients] = useState<OfflineBundleClient[]>([]);
  const [bankAccounts, setBankAccounts] = useState<OfflineBundleBankAccount[]>([]);
  const [collectorUserId, setCollectorUserId] = useState<number>(0);
  const [pendingQueue, setPendingQueue] = useState<QueuedFieldReceipt[]>([]);
  const [settlements, setSettlements] = useState<CollectorSettlementDTO[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<OfflineBundleClient | null>(null);
  const [feedback, setFeedback] = useState<{ text: string; receipt?: FieldReceiptDTO } | null>(null);
  const [waTarget, setWaTarget] = useState<ReceiptWhatsAppTarget | null>(null);
  const lastFetchedAtRef = useRef(0);
  const hasClientsRef = useRef(false);
  hasClientsRef.current = clients.length > 0;

  const refreshQueue = useCallback(async () => {
    const queued = await getPendingOfflineReceipts();
    setPendingQueue(queued);
  }, []);

  const refreshAll = useCallback(async (options?: { silent?: boolean }) => {
    const isSilent = options?.silent === true;
    if (!isSilent || !hasClientsRef.current) {
      setLoading(true);
    }
    try {
      const cached = await loadOfflineBundle();
      if (cached) {
        setClients(cached.clients);
        setBankAccounts(cached.bankAccounts);
        setCollectorUserId(cached.collectorUserId);
      }
      if (navigator.onLine) {
        const flushResult = await flushOfflineReceiptQueue();
        const [bundle, mySettlements] = await Promise.all([
          fieldReceiptsApi.getOfflineBundle(),
          fieldReceiptsApi.listMySettlements(),
        ]);
        void saveOfflineBundle(bundle).catch(() => {});
        setClients(bundle.clients);
        setBankAccounts(bundle.bankAccounts);
        setCollectorUserId(bundle.collectorUserId);
        setSettlements(mySettlements);
        if (flushResult.syncedCount > 0) {
          const synced = flushResult.lastSyncedReceipt;
          const syncedAmount = synced ? Math.round(Number(synced.totalAmount)) : 0;
          setFeedback({
            text: synced?.receiptNumber
              ? `Recibo ${synced.receiptNumber} sincronizado por $${syncedAmount.toLocaleString('es-AR')}.`
              : `${flushResult.syncedCount} cobro${flushResult.syncedCount > 1 ? 's' : ''} sincronizado${flushResult.syncedCount > 1 ? 's' : ''}.`,
            receipt: synced,
          });
        }
        lastFetchedAtRef.current = Date.now();
      }
    } catch {
      // Si falla red, conserva caché local sin interrumpir el cobro
    } finally {
      await refreshQueue();
      setLoading(false);
    }
  }, [refreshQueue]);

  useEffect(() => {
    void refreshAll();
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    const stopSync = startOfflineSyncListener(() => {
      void refreshAll({ silent: true });
    });
    const onManualSync = () => {
      void refreshAll();
    };
    window.addEventListener('dv:vendedor-sync', onManualSync);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      window.removeEventListener('dv:vendedor-sync', onManualSync);
      stopSync();
    };
  }, [refreshAll]);

  useEffect(() => {
    if (!isActive) return;
    if (Date.now() - lastFetchedAtRef.current > 30_000) {
      void refreshAll({ silent: true });
    }
  }, [isActive, refreshAll]);

  useEffect(() => {
    if (!initialClientId || clients.length === 0) return;
    const match = clients.find((c) => c.id === initialClientId);
    if (match) {
      setSelectedClient(match);
      onInitialClientHandled?.();
    }
  }, [initialClientId, clients, onInitialClientHandled]);

  const deferredSearch = useDeferredValue(search);

  const indexedClients = useMemo(
    () => buildSearchIndex(clients, (c) => [c.name, c.city, c.cuit, c.address]),
    [clients],
  );

  const filteredClients = useMemo(() => {
    if (!deferredSearch.trim()) return clients.slice(0, 60);
    return filterIndexedItems(indexedClients, deferredSearch).slice(0, 60);
  }, [clients, indexedClients, deferredSearch]);

  const openSettlement = settlements.find((s) => s.status === 'OPEN');

  const handleFeedbackWhatsApp = (receipt: FieldReceiptDTO) => {
    setWaTarget({
      personaId: receipt.persona?.id ?? receipt.personaId,
      clientName: receipt.persona?.name || 'Cliente',
      phone: receipt.persona?.phone ?? null,
      whatsappVerifiedAt: receipt.persona?.whatsappVerifiedAt ?? null,
      receiptLabel: receipt.receiptNumber || receipt.provisionalCode,
      amount: receipt.totalAmount,
      messageText: buildFieldReceiptWhatsAppMessage(receipt, window.location.origin),
      fieldReceiptId: receipt.id,
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxWidth: '820px', margin: '0 auto' }}>
      {(!online || pendingQueue.length > 0) && (
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 14px', background: !online ? '#fef3c7' : '#fff', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', fontWeight: 600, color: !online ? '#92400e' : '#b45309' }}>
            {!online && <WifiOff size={14} aria-hidden="true" />}
            <span>
              {!online ? 'Sin señal' : `${pendingQueue.length} pendiente${pendingQueue.length > 1 ? 's' : ''}`}
              {!online && pendingQueue.length > 0 ? ` · ${pendingQueue.length} pend.` : ''}
            </span>
          </div>
          {online && pendingQueue.length > 0 && (
            <button
              type="button"
              onClick={() => void refreshAll()}
              disabled={loading}
              style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
            >
              <RefreshCw size={13} aria-hidden="true" />
              {loading ? 'Enviando...' : 'Sincronizar'}
            </button>
          )}
        </div>
      )}

      {pendingQueue.some((item) => item.lastError) && (() => {
        const rawError = pendingQueue.find((item) => item.lastError)?.lastError || '';
        const cleanError = /^error al sincronizar/i.test(rawError)
          ? rawError
          : `Error al sincronizar: ${rawError}`;
        return (
          <div role="alert" style={{ padding: '10px 14px', borderRadius: '10px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', fontSize: '0.84rem' }}>
            {cleanError}
          </div>
        );
      })()}

      {feedback && (
        <div
          role="status"
          style={{
            padding: '12px 14px',
            borderRadius: '10px',
            background: '#ecfdf5',
            border: '1px solid #a7f3d0',
            color: '#065f46',
            fontSize: '0.86rem',
            fontWeight: 600,
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
            <span>{feedback.text}</span>
            <button
              type="button"
              aria-label="Cerrar aviso"
              onClick={() => setFeedback(null)}
              style={{ background: 'transparent', border: 'none', color: '#065f46', cursor: 'pointer', padding: '2px', flexShrink: 0 }}
            >
              <X size={15} aria-hidden="true" />
            </button>
          </div>
          {feedback.receipt?.receiptNumber && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <button
                type="button"
                onClick={() => void handleFeedbackWhatsApp(feedback.receipt!)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                  minHeight: '34px',
                  padding: '0 12px',
                  borderRadius: '8px',
                  border: '1px solid #16a34a',
                  background: '#16a34a',
                  color: '#ffffff',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <Send size={14} aria-hidden="true" />
                <span>Enviar WhatsApp</span>
              </button>
            </div>
          )}
        </div>
      )}

      {openSettlement && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px' }}>
          <div style={{ padding: '10px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Efectivo</div>
            <div className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 700 }}>${Math.round(Number(openSettlement.expectedCash)).toLocaleString('es-AR')}</div>
          </div>
          <div style={{ padding: '10px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Cheques ({openSettlement.expectedChecksCount})</div>
            <div className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 700 }}>${Math.round(Number(openSettlement.expectedChecksAmount)).toLocaleString('es-AR')}</div>
          </div>
          <div style={{ padding: '10px 12px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Transferencias</div>
            <div className="tabular-nums" style={{ fontSize: '1rem', fontWeight: 700 }}>${Math.round(Number(openSettlement.pendingTransfersAmount)).toLocaleString('es-AR')}</div>
          </div>
        </div>
      )}

      {openSettlement && openSettlement.receipts.length > 0 && (
        <FieldTodayReceiptsCard
          receipts={openSettlement.receipts}
          onRefresh={() => void refreshAll()}
        />
      )}

      <search style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <Search size={17} aria-hidden="true" style={{ position: 'absolute', left: '12px', color: '#9ca3af', pointerEvents: 'none' }} />
        <label htmlFor="vendedor-collect-search" className="sr-only">Buscar cliente</label>
        <input
          id="vendedor-collect-search"
          type="search"
          placeholder="Buscar cliente..."
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 36px 10px 38px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '16px', boxSizing: 'border-box', background: '#fff' }}
        />
        {search && (
          <button
            type="button"
            aria-label="Limpiar búsqueda"
            onClick={() => setSearch('')}
            style={{ position: 'absolute', right: '8px', background: 'transparent', border: 'none', boxShadow: 'none', padding: '4px', color: '#9ca3af', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
          >
            <X size={16} aria-hidden="true" />
          </button>
        )}
      </search>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {loading && clients.length === 0 && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#6b7280', fontSize: '0.88rem' }}>
            Cargando...
          </div>
        )}
        {filteredClients.map((client, idx) => {
          const locationText = [client.city, client.address].filter(Boolean).join(' · ');
          const deferredStyle = idx >= 8 ? { contentVisibility: 'auto' as const, containIntrinsicSize: 'auto none auto 68px' } : undefined;
          return (
            <div
              key={client.id}
              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '11px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px', ...deferredStyle }}
            >
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.94rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</div>
                {locationText && (
                  <div style={{ fontSize: '0.76rem', color: '#6b7280', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {locationText}
                  </div>
                )}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <span className="tabular-nums" style={{ fontWeight: 700, fontSize: '0.92rem', color: client.outstandingBalance > 0 ? '#dc2626' : '#059669' }}>
                  ${Math.round(client.outstandingBalance).toLocaleString('es-AR')}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedClient(client)}
                  style={{ padding: '7px 13px', minHeight: '36px', borderRadius: '8px', border: 'none', background: '#111827', color: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer', touchAction: 'manipulation', flexShrink: 0 }}
                >
                  Cobrar
                </button>
              </div>
            </div>
          );
        })}
      </div>

      <FieldCollectModal
        client={selectedClient}
        collectorUserId={collectorUserId}
        bankAccounts={bankAccounts}
        onClose={() => setSelectedClient(null)}
        onSuccess={(info) => {
          setSelectedClient(null);
          setFeedback({
            text: info.offline
              ? `Guardado offline (${info.provisionalCode}) por $${info.totalAmount.toLocaleString('es-AR')}. Se enviará al volver la señal.`
              : info.receiptNumber
                ? `Recibo ${info.receiptNumber} emitido por $${info.totalAmount.toLocaleString('es-AR')}.`
                : `Transferencia registrada por $${info.totalAmount.toLocaleString('es-AR')}. Pendiente de acreditación.`,
            receipt: info.receipt,
          });
          void refreshAll();
        }}
      />

      <ReceiptWhatsAppSendModal
        target={waTarget}
        onClose={() => setWaTarget(null)}
        onSaved={(saved) => {
          setFeedback((prev) =>
            prev?.receipt && prev.receipt.personaId === saved.id
              ? {
                  ...prev,
                  receipt: {
                    ...prev.receipt,
                    persona: {
                      ...(prev.receipt.persona ?? { id: saved.id, name: saved.name }),
                      phone: saved.phone,
                      whatsappVerifiedAt: saved.whatsappVerifiedAt,
                    },
                  },
                }
              : prev,
          );
          void refreshAll({ silent: true });
        }}
      />
    </div>
  );
};
