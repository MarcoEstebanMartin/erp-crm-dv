import { X } from 'lucide-react';
import { NativeModalDialog } from '../../modals/NativeModalDialog';

export interface PendingReceiptGroup {
  label: string;
  transactions: any[];
  totalCash: number;
  totalChecks: number;
  totalTransfers: number;
  totalToCollect: number;
}

interface PendingReceiptsSummaryModalProps {
  group: PendingReceiptGroup | null;
  onClose: () => void;
  onGoToRendiciones: () => void;
}

const formatPeso = (value: number) => `$${Math.round(value).toLocaleString('es-AR')}`;

const PAYMENT_METHOD_LABEL: Record<string, { text: string; bg: string; color: string }> = {
  CASH: { text: 'Efectivo', bg: '#ecfdf5', color: '#047857' },
  CHECK: { text: 'Cheque', bg: '#eff6ff', color: '#1d4ed8' },
  BANK_TRANSFER: { text: 'Transf.', bg: '#f1f5f9', color: '#475569' },
};

/**
 * Modal compacto de lectura para revisar los recibos pendientes de un vendedor o reparto desde Inicio.
 */
export function PendingReceiptsSummaryModal({
  group,
  onClose,
  onGoToRendiciones,
}: PendingReceiptsSummaryModalProps) {
  const transactions = group?.transactions ?? [];
  const count = transactions.length;

  return (
    <NativeModalDialog
      isOpen={Boolean(group)}
      onClose={onClose}
      ariaLabelledBy="pending-receipts-modal-title"
      style={{
        maxWidth: '720px',
        width: '94vw',
        maxHeight: '84vh',
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '14px',
        overflow: 'hidden',
      }}
    >
      {group && (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <h2
                id="pending-receipts-modal-title"
                style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}
              >
                {group.label}
              </h2>
              <span
                style={{
                  color: 'var(--text-secondary)',
                  fontSize: '0.76rem',
                  backgroundColor: 'var(--bg-light, #f9f9fb)',
                  border: '1px solid var(--border-color)',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  fontVariantNumeric: 'tabular-nums',
                }}
              >
                {count} {count === 1 ? 'recibo' : 'recibos'}
              </span>
            </div>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={onClose}
              aria-label="Cerrar"
              style={{ padding: '4px', display: 'inline-flex', alignItems: 'center' }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              flexWrap: 'wrap',
              gap: '12px',
              padding: '10px 14px',
              backgroundColor: 'var(--bg-light, #f9f9fb)',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              fontSize: '0.84rem',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap', color: 'var(--text-secondary)' }}>
              {group.totalCash > 0 && <span>Efectivo {formatPeso(group.totalCash)}</span>}
              {group.totalChecks > 0 && <span>Cheques {formatPeso(group.totalChecks)}</span>}
              {group.totalTransfers > 0 && <span>Transf. {formatPeso(group.totalTransfers)}</span>}
            </div>
            <strong style={{ color: 'var(--text-primary)' }}>
              Total {formatPeso(group.totalToCollect)}
            </strong>
          </div>

          <div
            className="table-container"
            role="region"
            aria-label="Detalle de recibos"
            tabIndex={0}
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: 'auto',
              margin: 0,
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              boxShadow: 'none',
            }}
          >
            {transactions.length === 0 ? (
              <div style={{ padding: '28px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.86rem' }}>
                Sin recibos
              </div>
            ) : (
              <table style={{ width: '100%', fontSize: '0.82rem' }}>
                <thead>
                  <tr>
                    <th scope="col">Recibo</th>
                    <th scope="col">Cliente</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Medio</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.map((tx: any) => {
                    const methodStyle = PAYMENT_METHOD_LABEL[tx.paymentMethod] || {
                      text: tx.paymentMethod || '-',
                      bg: '#f1f5f9',
                      color: '#475569',
                    };

                    return (
                      <tr key={tx.id}>
                        <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
                          {tx.receiptNumber || `Pedido #${tx.orderId || 'S/N'}`}
                        </td>
                        <td style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                          {tx.persona?.name || 'Desconocido'}
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: tx.billingType === 'OFFICIAL' ? '#1e40af' : '#b45309' }}>
                            {tx.billingType === 'OFFICIAL' ? 'A' : 'X'}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              backgroundColor: methodStyle.bg,
                              color: methodStyle.color,
                              whiteSpace: 'nowrap',
                            }}
                          >
                            {methodStyle.text}
                          </span>
                        </td>
                        <td
                          style={{
                            textAlign: 'right',
                            fontWeight: 700,
                            fontVariantNumeric: 'tabular-nums',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {formatPeso(Number(tx.amount || 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: '8px' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose} autoFocus>
              Cerrar
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                onClose();
                onGoToRendiciones();
              }}
            >
              Ir a Caja
            </button>
          </div>
        </>
      )}
    </NativeModalDialog>
  );
}
