import React, { useCallback, useEffect, useState } from 'react';
import { Check, Eye, RefreshCw, Send, X } from 'lucide-react';
import {
  buildManualWhatsAppUrl,
  fieldReceiptsApi,
  type CollectorSettlementDTO,
  type OfflineBundleBankAccount,
} from '../../api/fieldReceipts.api';

export const FieldSettlementsTab: React.FC = () => {
  const [settlements, setSettlements] = useState<CollectorSettlementDTO[]>([]);
  const [banks, setBanks] = useState<OfflineBundleBankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [declaredCashById, setDeclaredCashById] = useState<Record<number, string>>({});
  const [bankByPaymentId, setBankByPaymentId] = useState<Record<number, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, bundle] = await Promise.all([
        fieldReceiptsApi.listAllSettlements(),
        fieldReceiptsApi.getOfflineBundle(),
      ]);
      setSettlements(list);
      setBanks(bundle.bankAccounts);
    } catch (err: any) {
      setMessage(err?.message || 'Error al cargar rendiciones');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const handleApproveSettlement = async (s: CollectorSettlementDTO) => {
    const raw = declaredCashById[s.id] ?? String(Math.round(Number(s.expectedCash)));
    const declared = Math.round(Number(raw) || 0);
    await fieldReceiptsApi.approveSettlement(s.id, declared);
    setMessage(`Rendición #${s.id} procesada.`);
    await loadData();
  };

  const handleVerifyTransfer = async (paymentId: number, action: 'CLEAR' | 'REJECT', currentBankId: number | null) => {
    if (action === 'CLEAR') {
      const selectedBank = Number(bankByPaymentId[paymentId] || currentBankId || banks[0]?.id || 0);
      if (!selectedBank) {
        setMessage('Seleccioná una cuenta bancaria para acreditar.');
        return;
      }
      await fieldReceiptsApi.verifyTransfer(paymentId, 'CLEAR', selectedBank);
      setMessage('Transferencia acreditada.');
    } else {
      const reason = window.prompt('Motivo del rechazo de la transferencia:');
      if (!reason || reason.trim().length < 3) return;
      await fieldReceiptsApi.verifyTransfer(paymentId, 'REJECT', undefined, reason.trim());
      setMessage('Transferencia rechazada y deuda restituida al cliente.');
    }
    await loadData();
  };

  const handleRejectCheck = async (paymentId: number) => {
    const reason = window.prompt('Motivo del rechazo del cheque:');
    if (!reason || reason.trim().length < 3) return;
    await fieldReceiptsApi.rejectCheck(paymentId, reason.trim());
    setMessage('Cheque rechazado y deuda restituida al cliente.');
    await loadData();
  };

  const handleVoidReceipt = async (receiptId: number) => {
    const reason = window.prompt('Motivo de anulación del recibo:');
    if (!reason || reason.trim().length < 3) return;
    await fieldReceiptsApi.voidReceipt(receiptId, reason.trim());
    setMessage('Recibo anulado con contra-asiento en Cuenta Corriente.');
    await loadData();
  };

  const pendingTransfers = settlements.flatMap((s) =>
    s.receipts
      .filter((r) => r.status !== 'VOIDED')
      .flatMap((r) =>
        r.payments
          .filter((p) => p.paymentMethod === 'BANK_TRANSFER' && p.status === 'PENDING_BANK')
          .map((p) => ({ settlement: s, receipt: r, payment: p })),
      ),
  );

  const allReceipts = settlements.flatMap((s) =>
    s.receipts.map((r) => ({ collectorName: s.collector?.username ?? `#${s.collectorUserId}`, receipt: r })),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Recibos Digitales y Rendiciones en Calle</h2>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <RefreshCw size={14} /> {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {message && (
        <div style={{ padding: '10px 14px', borderRadius: '8px', background: '#f3f4f6', border: '1px solid #d1d5db', fontSize: '0.85rem', fontWeight: 600 }}>
          {message}
        </div>
      )}

      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700 }}>Rendiciones de Cobradores</h3>
        {settlements.length === 0 ? (
          <div style={{ fontSize: '0.85rem', color: '#6b7280' }}>Sin rendiciones registradas.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {settlements.map((s) => (
              <div key={s.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px', padding: '12px', border: '1px solid #f1f5f9', borderRadius: '10px' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '0.92rem' }}>
                    {s.collector?.username ?? `Cobrador #${s.collectorUserId}`} · <span style={{ fontSize: '0.78rem', color: '#6b7280' }}>{s.status}</span>
                  </div>
                  <div style={{ fontSize: '0.82rem', color: '#4b5563' }}>
                    Efectivo: <strong>${Math.round(Number(s.expectedCash)).toLocaleString('es-AR')}</strong> · Cheques ({s.expectedChecksCount}): <strong>${Math.round(Number(s.expectedChecksAmount)).toLocaleString('es-AR')}</strong> · Transf. pend.: <strong>${Math.round(Number(s.pendingTransfersAmount)).toLocaleString('es-AR')}</strong>
                  </div>
                </div>
                {s.status === 'OPEN' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <input
                      type="number"
                      placeholder="Efectivo contado"
                      value={declaredCashById[s.id] ?? String(Math.round(Number(s.expectedCash)))}
                      onChange={(e) => setDeclaredCashById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                      style={{ width: '130px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', textAlign: 'right' }}
                    />
                    <button
                      type="button"
                      onClick={() => void handleApproveSettlement(s)}
                      style={{ padding: '7px 14px', borderRadius: '8px', border: 'none', background: '#111827', color: '#fff', fontWeight: 600, fontSize: '0.82rem', cursor: 'pointer' }}
                    >
                      Aprobar Rendición
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {pendingTransfers.length > 0 && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700 }}>Transferencias Pendientes de Banco ({pendingTransfers.length})</h3>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {pendingTransfers.map(({ receipt, payment }) => (
              <div key={payment.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid #f1f5f9', borderRadius: '10px' }}>
                <div style={{ fontSize: '0.85rem' }}>
                  <strong>{receipt.receiptNumber}</strong> · {receipt.persona?.name} · <strong>${Math.round(Number(payment.amount)).toLocaleString('es-AR')}</strong>
                  {payment.transferReference && <span style={{ color: '#6b7280' }}> (Ref: {payment.transferReference})</span>}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  {payment.proofImageUrl && (
                    <button
                      type="button"
                      onClick={() => setPreviewImage(payment.proofImageUrl)}
                      style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.8rem', cursor: 'pointer' }}
                    >
                      <Eye size={14} /> Foto
                    </button>
                  )}
                  <select
                    value={bankByPaymentId[payment.id] ?? String(payment.bankAccountId || banks[0]?.id || '')}
                    onChange={(e) => setBankByPaymentId((prev) => ({ ...prev, [payment.id]: e.target.value }))}
                    style={{ padding: '6px 8px', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.8rem' }}
                  >
                    {banks.map((b) => (
                      <option key={b.id} value={b.id}>{b.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => void handleVerifyTransfer(payment.id, 'CLEAR', payment.bankAccountId)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <Check size={14} /> Acreditar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleVerifyTransfer(payment.id, 'REJECT', payment.bankAccountId)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: 'none', background: '#E30613', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <X size={14} /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
        <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700 }}>Últimos Recibos en Calle</h3>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {allReceipts.slice(0, 25).map(({ collectorName, receipt }) => (
            <div key={receipt.id} style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '8px', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.84rem' }}>
              <div>
                <strong>{receipt.receiptNumber || receipt.provisionalCode}</strong> · {receipt.persona?.name} · <span style={{ color: '#6b7280' }}>{collectorName}</span>
                {receipt.status === 'VOIDED' && <span style={{ marginLeft: '6px', color: '#E30613', fontWeight: 700 }}>[ANULADO]</span>}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <strong>${Math.round(Number(receipt.totalAmount)).toLocaleString('es-AR')}</strong>
                <span style={{ fontSize: '0.75rem', padding: '2px 7px', borderRadius: '999px', background: receipt.whatsappStatus === 'FAILED' ? '#fee2e2' : '#f3f4f6', color: receipt.whatsappStatus === 'FAILED' ? '#991b1b' : '#374151' }}>
                  WA: {receipt.whatsappStatus}
                </span>
                {receipt.pdfUrl && (
                  <a
                    href={receipt.pdfUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', color: '#374151', fontSize: '0.75rem', textDecoration: 'none' }}
                  >
                    PDF
                  </a>
                )}
                {receipt.status !== 'VOIDED' && (
                  <a
                    href={buildManualWhatsAppUrl(receipt)}
                    target="_blank"
                    rel="noreferrer"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #16a34a', color: '#15803d', fontSize: '0.75rem', fontWeight: 600, textDecoration: 'none' }}
                  >
                    <Send size={12} /> WA Manual
                  </a>
                )}
                {receipt.whatsappStatus !== 'DELIVERED' && receipt.status !== 'VOIDED' && (
                  <button
                    type="button"
                    onClick={() => void fieldReceiptsApi.resendWhatsApp(receipt.id).then(loadData)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    <Send size={12} /> Enviar API
                  </button>
                )}
                {receipt.status !== 'VOIDED' && receipt.payments.some((p) => p.paymentMethod === 'CHECK' && p.status !== 'REJECTED') && (
                  <button
                    type="button"
                    onClick={() => {
                      const chk = receipt.payments.find((p) => p.paymentMethod === 'CHECK' && p.status !== 'REJECTED');
                      if (chk) void handleRejectCheck(chk.id);
                    }}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #fca5a5', background: '#fff', color: '#b91c1c', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Rechazar Cheque
                  </button>
                )}
                {receipt.status !== 'VOIDED' && (
                  <button
                    type="button"
                    onClick={() => void handleVoidReceipt(receipt.id)}
                    style={{ padding: '4px 8px', borderRadius: '6px', border: '1px solid #d1d5db', background: '#fff', color: '#374151', fontSize: '0.75rem', cursor: 'pointer' }}
                  >
                    Anular
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>

      {previewImage && (
        <dialog open style={{ position: 'fixed', inset: 0, margin: 'auto', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', maxWidth: '90vw', maxHeight: '90vh', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button type="button" onClick={() => setPreviewImage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} />
            </button>
          </div>
          <img src={previewImage} alt="Comprobante adjunto" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '8px' }} />
        </dialog>
      )}
    </div>
  );
};
