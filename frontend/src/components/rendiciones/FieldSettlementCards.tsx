import type { Dispatch, SetStateAction } from 'react';
import { Check, Eye, Truck, User, X } from 'lucide-react';
import type {
  CollectorSettlementDTO,
  FieldReceiptDTO,
  FieldReceiptPaymentDTO,
  OfflineBundleBankAccount,
} from '../../api/fieldReceipts.api';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { formatCurrency } from './types';

interface FieldSettlementCardsProps {
  settlements: CollectorSettlementDTO[];
  channel: 'SELLER' | 'DRIVER';
  busyId: number | null;
  declaredCashById: Record<number, string>;
  setDeclaredCashById: Dispatch<SetStateAction<Record<number, string>>>;
  onApprove: (s: CollectorSettlementDTO) => void;
}

export function FieldSettlementCards({
  settlements,
  channel,
  busyId,
  declaredCashById,
  setDeclaredCashById,
  onApprove,
}: FieldSettlementCardsProps) {
  if (settlements.length === 0) return null;
  const isDriver = channel === 'DRIVER';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {settlements.map((s) => {
        const activeReceipts = (s.receipts || []).filter((r) => r.status !== 'VOIDED');
        const cash = Math.round(Number(s.expectedCash || 0));
        const checks = Math.round(Number(s.expectedChecksAmount || 0));
        const transfers = Math.round(Number(s.pendingTransfersAmount || 0));
        const total = cash + checks + transfers;
        const routeId = (s as CollectorSettlementDTO & { deliveryRouteId?: number | null }).deliveryRouteId;

        return (
          <div
            key={`field-settle-${s.id}`}
            className="list-card-item"
            style={{
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              padding: '16px 20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: '#fff',
              gap: '16px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ backgroundColor: 'var(--bg-light)', padding: '10px', borderRadius: '50%', color: 'var(--color-primary)' }}>
                {isDriver ? <Truck size={20} aria-hidden="true" /> : <User size={20} aria-hidden="true" />}
              </div>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
                    {(s.collector?.username || `Cobrador #${s.collectorUserId}`).toUpperCase()}
                  </h4>
                  {routeId != null && (
                    <span className="tabular-nums" style={{ fontSize: '0.74rem', fontWeight: 600, padding: '1px 7px', borderRadius: '8px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe' }}>
                      Viaje #{routeId}
                    </span>
                  )}
                </div>
                <div className="tabular-nums" style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <span>{activeReceipts.length} {activeReceipts.length === 1 ? 'recibo' : 'recibos'}</span>
                  <span>Efectivo {formatCurrency(cash)}</span>
                  {checks > 0 && <span>Cheques ({s.expectedChecksCount}) {formatCurrency(checks)}</span>}
                  {transfers > 0 && <span>Transf. pend. {formatCurrency(transfers)}</span>}
                </div>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ textAlign: 'right', marginRight: '8px' }}>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>A rendir</div>
                <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
                  {formatCurrency(total)}
                </div>
              </div>
              <input
                type="number"
                aria-label={`Efectivo contado de ${s.collector?.username || s.collectorUserId}`}
                placeholder="Efectivo contado"
                value={declaredCashById[s.id] ?? String(cash)}
                onChange={(e) => setDeclaredCashById((prev) => ({ ...prev, [s.id]: e.target.value }))}
                className="input tabular-nums"
                style={{ width: '125px', padding: '6px 10px', textAlign: 'right', fontSize: '0.85rem' }}
              />
              <button
                type="button"
                disabled={busyId === s.id}
                onClick={() => onApprove(s)}
                style={{
                  padding: '8px 14px',
                  borderRadius: '8px',
                  border: 'none',
                  background: '#111827',
                  color: '#fff',
                  fontWeight: 600,
                  fontSize: '0.82rem',
                  cursor: busyId === s.id ? 'wait' : 'pointer',
                }}
              >
                {busyId === s.id ? 'Aprobando...' : 'Aprobar Rendición'}
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

interface PendingFieldTransfersCardProps {
  pendingTransfers: Array<{
    settlement: CollectorSettlementDTO;
    receipt: FieldReceiptDTO;
    payment: FieldReceiptPaymentDTO;
  }>;
  banks: OfflineBundleBankAccount[];
  bankByPaymentId: Record<number, string>;
  setBankByPaymentId: Dispatch<SetStateAction<Record<number, string>>>;
  previewImage: string | null;
  setPreviewImage: (url: string | null) => void;
  onVerifyTransfer: (paymentId: number, action: 'CLEAR' | 'REJECT', currentBankId: number | null) => void;
}

export function PendingFieldTransfersCard({
  pendingTransfers,
  banks,
  bankByPaymentId,
  setBankByPaymentId,
  previewImage,
  setPreviewImage,
  onVerifyTransfer,
}: PendingFieldTransfersCardProps) {
  if (pendingTransfers.length === 0) return null;

  return (
    <section className="card" style={{ padding: '20px 24px' }}>
      <h3 className="tabular-nums" style={{ margin: '0 0 12px 0', fontSize: '0.95rem', fontWeight: 700 }}>
        Transferencias por acreditar ({pendingTransfers.length})
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {pendingTransfers.map(({ receipt, payment }) => (
          <div
            key={payment.id}
            style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '10px 12px', border: '1px solid #f1f5f9', borderRadius: '10px' }}
          >
            <div className="tabular-nums" style={{ fontSize: '0.85rem' }}>
              <strong>{receipt.receiptNumber || receipt.provisionalCode}</strong> · {receipt.persona?.name} ·{' '}
              <strong>{formatCurrency(Math.round(Number(payment.amount || 0)))}</strong>
              {payment.transferReference && <span style={{ color: '#6b7280' }}> (Ref: {payment.transferReference})</span>}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              {payment.proofImageUrl && (
                <button
                  type="button"
                  onClick={() => setPreviewImage(payment.proofImageUrl)}
                  className="btn btn-secondary"
                  style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', fontSize: '0.8rem' }}
                >
                  <Eye size={14} aria-hidden="true" /> Foto
                </button>
              )}
              <select
                aria-label={`Cuenta bancaria ${receipt.receiptNumber || receipt.id}`}
                value={bankByPaymentId[payment.id] ?? String(payment.bankAccountId || banks[0]?.id || '')}
                onChange={(e) => setBankByPaymentId((prev) => ({ ...prev, [payment.id]: e.target.value }))}
                className="input"
                style={{ padding: '6px 8px', fontSize: '0.8rem', height: '32px' }}
              >
                {banks.map((b) => (
                  <option key={b.id} value={b.id}>{b.name}</option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => onVerifyTransfer(payment.id, 'CLEAR', payment.bankAccountId)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: 'none', background: '#059669', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <Check size={14} aria-hidden="true" /> Acreditar
              </button>
              <button
                type="button"
                onClick={() => onVerifyTransfer(payment.id, 'REJECT', payment.bankAccountId)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '6px 10px', borderRadius: '8px', border: 'none', background: '#E30613', color: '#fff', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
              >
                <X size={14} aria-hidden="true" /> Rechazar
              </button>
            </div>
          </div>
        ))}
      </div>

      <NativeModalDialog
        isOpen={Boolean(previewImage)}
        onClose={() => setPreviewImage(null)}
        ariaLabel="Vista previa de comprobante"
        style={{ maxWidth: '90vw', width: 'auto', padding: '16px' }}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
          <button type="button" className="btn btn-ghost" aria-label="Cerrar" onClick={() => setPreviewImage(null)}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        {previewImage && (
          <img src={previewImage} alt="Comprobante adjunto" style={{ maxWidth: '100%', maxHeight: '75vh', borderRadius: '8px' }} />
        )}
      </NativeModalDialog>
    </section>
  );
}
