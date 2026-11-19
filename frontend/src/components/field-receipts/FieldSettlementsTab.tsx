import React, { useCallback, useEffect, useState } from 'react';
import { Check, Eye, RefreshCw, X } from 'lucide-react';
import {
  fieldReceiptsApi,
  type CollectorSettlementDTO,
  type OfficeReceiptDTO,
  type OfflineBundleBankAccount,
} from '../../api/fieldReceipts.api';
import { useConfirm } from '../../context/ConfirmContext';
import { UnifiedReceiptsList } from './UnifiedReceiptsList';

export const FieldSettlementsTab: React.FC = () => {
  const confirm = useConfirm();
  const [settlements, setSettlements] = useState<CollectorSettlementDTO[]>([]);
  const [officeReceipts, setOfficeReceipts] = useState<OfficeReceiptDTO[]>([]);
  const [banks, setBanks] = useState<OfflineBundleBankAccount[]>([]);
  const [loading, setLoading] = useState(false);
  const [declaredCashById, setDeclaredCashById] = useState<Record<number, string>>({});
  const [bankByPaymentId, setBankByPaymentId] = useState<Record<number, string>>({});
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, bundle, office] = await Promise.all([
        fieldReceiptsApi.listAllSettlements(),
        fieldReceiptsApi.getOfflineBundle(),
        fieldReceiptsApi.listOfficeReceipts(200),
      ]);
      setSettlements(list);
      setBanks(bundle.bankAccounts);
      setOfficeReceipts(office);
    } catch (err: any) {
      setMessage(err?.message || 'Error al cargar recibos');
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

  const handleVoidFieldReceipt = async (receiptId: number) => {
    const reason = window.prompt('Motivo de anulación del recibo:');
    if (!reason || reason.trim().length < 3) return;
    await fieldReceiptsApi.voidReceipt(receiptId, reason.trim());
    setMessage('Recibo anulado con contra-asiento en Cuenta Corriente.');
    await loadData();
  };

  const handleDeleteOfficeReceipt = async (receipt: OfficeReceiptDTO) => {
    const nro = receipt.receiptNumber || `REC-${String(receipt.id).padStart(5, '0')}`;
    const ok = await confirm({
      title: `¿Anular ${nro}?`,
      message: `Se revertirá el pago de $${Math.round(Number(receipt.amount)).toLocaleString('es-AR')} en la cuenta corriente de ${receipt.persona?.name || 'este cliente'}.`,
      confirmText: 'Anular',
      cancelText: 'Cancelar',
      type: 'danger',
    });
    if (!ok) return;
    try {
      const res = await fieldReceiptsApi.deleteOfficeReceipt(receipt.id);
      setMessage(res.message || `Recibo ${nro} anulado.`);
      await loadData();
    } catch (err: any) {
      setMessage(err?.message || 'Error al anular recibo.');
    }
  };

  const handleResendWhatsApp = async (receiptId: number) => {
    await fieldReceiptsApi.resendWhatsApp(receiptId);
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

  const allFieldReceipts = settlements.flatMap((s) =>
    s.receipts.map((r) => ({ collectorName: s.collector?.username ?? `#${s.collectorUserId}`, receipt: r })),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Recibos</h2>
        <button
          type="button"
          onClick={() => void loadData()}
          disabled={loading}
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '7px 12px', borderRadius: '8px', border: '1px solid #d1d5db', background: '#fff', fontSize: '0.85rem', cursor: 'pointer' }}
        >
          <RefreshCw size={14} aria-hidden="true" /> {loading ? 'Cargando...' : 'Actualizar'}
        </button>
      </div>

      {message && (
        <div role="status" style={{ padding: '10px 14px', borderRadius: '8px', background: '#f3f4f6', border: '1px solid #d1d5db', fontSize: '0.85rem', fontWeight: 600 }}>
          {message}
        </div>
      )}

      <UnifiedReceiptsList
        officeReceipts={officeReceipts}
        fieldReceipts={allFieldReceipts}
        onDeleteOfficeReceipt={handleDeleteOfficeReceipt}
        onVoidFieldReceipt={handleVoidFieldReceipt}
        onRejectCheck={handleRejectCheck}
        onResendWhatsApp={handleResendWhatsApp}
      />

      {pendingTransfers.length > 0 && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700 }}>Transferencias Pendientes en Calle ({pendingTransfers.length})</h3>
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
                      <Eye size={14} aria-hidden="true" /> Foto
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
                    <Check size={14} aria-hidden="true" /> Acreditar
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleVerifyTransfer(payment.id, 'REJECT', payment.bankAccountId)}
                    style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: 'none', background: '#E30613', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    <X size={14} aria-hidden="true" /> Rechazar
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {settlements.length > 0 && (
        <section style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: '12px', padding: '16px' }}>
          <h3 style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700 }}>Rendiciones en Calle</h3>
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
        </section>
      )}

      {previewImage && (
        <dialog
          open
          aria-label="Vista previa de comprobante"
          style={{ position: 'fixed', inset: 0, margin: 'auto', padding: '16px', borderRadius: '12px', border: '1px solid #e5e7eb', maxWidth: '90vw', maxHeight: '90vh', boxShadow: '0 20px 50px rgba(0,0,0,0.3)' }}
        >
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
            <button type="button" aria-label="Cerrar vista previa" onClick={() => setPreviewImage(null)} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <img src={previewImage} alt="Comprobante adjunto" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '8px' }} />
        </dialog>
      )}
    </div>
  );
};
