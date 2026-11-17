import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw, Search, Send, Wifi, WifiOff } from 'lucide-react';
import {
  CollectorSettlementDTO,
  fieldReceiptsApi,
  OfflineBundleBankAccount,
  OfflineBundleClient,
} from '../../api/fieldReceipts.api';
import {
  flushOfflineReceiptQueue,
  getPendingOfflineReceipts,
  loadOfflineBundle,
  QueuedFieldReceipt,
  saveOfflineBundle,
  startOfflineSyncListener,
} from '../../utils/offlineReceiptQueue';
import { FieldCollectModal } from './FieldCollectModal';

export const FieldCollectionPage: React.FC = () => {
  const [online, setOnline] = useState(() => (typeof navigator !== 'undefined' ? navigator.onLine : true));
  const [clients, setClients] = useState<OfflineBundleClient[]>([]);
  const [bankAccounts, setBankAccounts] = useState<OfflineBundleBankAccount[]>([]);
  const [collectorUserId, setCollectorUserId] = useState<number>(0);
  const [pendingQueue, setPendingQueue] = useState<QueuedFieldReceipt[]>([]);
  const [settlements, setSettlements] = useState<CollectorSettlementDTO[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedClient, setSelectedClient] = useState<OfflineBundleClient | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const refreshQueue = useCallback(async () => {
    const queued = await getPendingOfflineReceipts();
    setPendingQueue(queued);
  }, []);

  const refreshAll = useCallback(async () => {
    setLoading(true);
    try {
      const cached = await loadOfflineBundle();
      if (cached) {
        setClients(cached.clients);
        setBankAccounts(cached.bankAccounts);
        setCollectorUserId(cached.collectorUserId);
      }
      if (navigator.onLine) {
        await flushOfflineReceiptQueue();
        const [bundle, mySettlements] = await Promise.all([
          fieldReceiptsApi.getOfflineBundle(),
          fieldReceiptsApi.listMySettlements(),
        ]);
        await saveOfflineBundle(bundle);
        setClients(bundle.clients);
        setBankAccounts(bundle.bankAccounts);
        setCollectorUserId(bundle.collectorUserId);
        setSettlements(mySettlements);
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
      void refreshAll();
    });
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
      stopSync();
    };
  }, [refreshAll]);

  const filteredClients = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients.slice(0, 60);
    return clients
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          (c.city && c.city.toLowerCase().includes(q)) ||
          (c.cuit && c.cuit.includes(q)),
      )
      .slice(0, 60);
  }, [clients, search]);

  const openSettlement = settlements.find((s) => s.status === 'OPEN');

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '820px', margin: '0 auto' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '12px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              padding: '4px 10px',
              borderRadius: '999px',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: online ? '#dcfce7' : '#fef3c7',
              color: online ? '#166534' : '#92400e',
            }}
          >
            {online ? <Wifi size={14} /> : <WifiOff size={14} />}
            {online ? 'En línea' : 'Sin señal (Offline)'}
          </span>
          {pendingQueue.length > 0 && (
            <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#b45309' }}>
              {pendingQueue.length} pendiente{pendingQueue.length > 1 ? 's' : ''} de señal
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={() => void refreshAll()}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
        >
          <RefreshCw size={14} />
          {loading ? 'Sincronizando...' : 'Actualizar ruta'}
        </button>
      </div>

      {feedback && (
        <div style={{ padding: '10px 14px', borderRadius: '10px', background: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', fontSize: '0.88rem', fontWeight: 600 }}>
          {feedback}
        </div>
      )}

      {openSettlement && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
          <div style={{ padding: '12px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Efectivo en tránsito</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>${Math.round(Number(openSettlement.expectedCash)).toLocaleString('es-AR')}</div>
          </div>
          <div style={{ padding: '12px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Cheques ({openSettlement.expectedChecksCount})</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>${Math.round(Number(openSettlement.expectedChecksAmount)).toLocaleString('es-AR')}</div>
          </div>
          <div style={{ padding: '12px 14px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px' }}>
            <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Transferencias a verificar</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 700 }}>${Math.round(Number(openSettlement.pendingTransfersAmount)).toLocaleString('es-AR')}</div>
          </div>
        </div>
      )}

      <div style={{ position: 'relative' }}>
        <Search size={17} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#9ca3af' }} />
        <input
          type="search"
          placeholder="Buscar cliente, localidad o CUIT..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ width: '100%', padding: '10px 12px 10px 38px', borderRadius: '10px', border: '1px solid #d1d5db', fontSize: '0.95rem', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {filteredClients.map((client) => (
          <div
            key={client.id}
            style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px 16px', background: '#fff', border: '1px solid #e5e7eb', borderRadius: '10px' }}
          >
            <div>
              <div style={{ fontWeight: 700, color: '#111827', fontSize: '0.95rem' }}>{client.name}</div>
              <div style={{ fontSize: '0.8rem', color: '#6b7280' }}>
                {[client.city, client.address].filter(Boolean).join(' · ') || 'Sin dirección'}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>Saldo</div>
                <div style={{ fontWeight: 700, color: client.outstandingBalance > 0 ? '#dc2626' : '#059669' }}>
                  ${Math.round(client.outstandingBalance).toLocaleString('es-AR')}
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedClient(client)}
                style={{ padding: '8px 14px', borderRadius: '8px', border: 'none', background: '#111827', color: '#fff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Cobrar
              </button>
            </div>
          </div>
        ))}
      </div>

      {openSettlement && openSettlement.receipts.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '14px 16px' }}>
          <h4 style={{ margin: '0 0 10px 0', fontSize: '0.95rem', fontWeight: 700 }}>Recibos de hoy</h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {openSettlement.receipts.slice(0, 10).map((r) => (
              <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.85rem', paddingBottom: '6px', borderBottom: '1px solid #f3f4f6' }}>
                <div>
                  <strong>{r.receiptNumber || r.provisionalCode}</strong> · {r.persona?.name}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontWeight: 700 }}>${Math.round(Number(r.totalAmount)).toLocaleString('es-AR')}</span>
                  {r.whatsappStatus === 'FAILED' && (
                    <button
                      type="button"
                      onClick={() => void fieldReceiptsApi.resendWhatsApp(r.id).then(refreshAll)}
                      title="Reenviar WhatsApp"
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.75rem', cursor: 'pointer' }}
                    >
                      <Send size={12} /> Reenviar
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <FieldCollectModal
        client={selectedClient}
        collectorUserId={collectorUserId}
        bankAccounts={bankAccounts}
        onClose={() => setSelectedClient(null)}
        onSuccess={(info) => {
          setSelectedClient(null);
          setFeedback(
            info.offline
              ? `Guardado offline (${info.provisionalCode}) por $${info.totalAmount.toLocaleString('es-AR')}. Se enviará al volver la señal.`
              : `Recibo ${info.receiptNumber} emitido por $${info.totalAmount.toLocaleString('es-AR')}.`,
          );
          void refreshAll();
        }}
      />
    </div>
  );
};
