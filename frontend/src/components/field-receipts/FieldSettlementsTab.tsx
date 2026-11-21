import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import {
  fieldReceiptsApi,
  type ClientWhatsAppCoverageDTO,
  type CollectorSettlementDTO,
  type OfficeReceiptDTO,
} from '../../api/fieldReceipts.api';
import { useConfirm } from '../../context/ConfirmContext';
import { resolveFieldReceiptChannel } from '../rendiciones/fieldSettlementChannel';
import { UnifiedReceiptsList } from './UnifiedReceiptsList';

export const FieldSettlementsTab: React.FC = () => {
  const confirm = useConfirm();
  const [settlements, setSettlements] = useState<CollectorSettlementDTO[]>([]);
  const [officeReceipts, setOfficeReceipts] = useState<OfficeReceiptDTO[]>([]);
  const [waCoverage, setWaCoverage] = useState<ClientWhatsAppCoverageDTO | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const refreshCoverage = useCallback(async () => {
    try {
      const cov = await fieldReceiptsApi.getWhatsAppCoverage();
      setWaCoverage(cov);
    } catch {
      // No bloquear la tabla de recibos si falla el indicador
    }
  }, []);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [list, office, cov] = await Promise.all([
        fieldReceiptsApi.listAllSettlements(),
        fieldReceiptsApi.listOfficeReceipts(200),
        fieldReceiptsApi.getWhatsAppCoverage().catch(() => null),
      ]);
      setSettlements(list);
      setOfficeReceipts(office);
      if (cov) setWaCoverage(cov);
    } catch (err: any) {
      setMessage(err?.message || 'Error al cargar recibos');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadData();
  }, [loadData]);

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

  const allFieldReceipts = settlements.flatMap((s) =>
    s.receipts
      .filter((r) => Boolean(r.receiptNumber))
      .map((r) => ({
        collectorName: s.collector?.username ?? `#${s.collectorUserId}`,
        channel: resolveFieldReceiptChannel(r, s),
        receipt: r,
      })),
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '12px' }}>
          <h2 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Recibos</h2>
          {waCoverage && waCoverage.totalActiveClients > 0 && (
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '8px',
                padding: '4px 10px',
                borderRadius: '999px',
                border: '1px solid #e5e7eb',
                background: '#ffffff',
                fontSize: '0.78rem',
                color: '#374151',
              }}
            >
              <span>WhatsApp</span>
              <strong className="tabular-nums" style={{ color: '#111827' }}>
                {waCoverage.verifiedCount}/{waCoverage.totalActiveClients} ({waCoverage.verifiedPct}%)
              </strong>
              <progress
                value={waCoverage.verifiedCount}
                max={waCoverage.totalActiveClients}
                aria-label="Cobertura de WhatsApp verificados"
                style={{
                  width: '56px',
                  height: '6px',
                  accentColor: waCoverage.readyForApi ? '#16a34a' : '#111827',
                }}
              />
              {waCoverage.readyForApi && (
                <span
                  style={{
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    padding: '1px 7px',
                    borderRadius: '999px',
                    background: '#ecfdf5',
                    color: '#047857',
                  }}
                >
                  Listo API
                </span>
              )}
            </div>
          )}
        </div>
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
        onClientWhatsAppSaved={() => void refreshCoverage()}
      />
    </div>
  );
};
