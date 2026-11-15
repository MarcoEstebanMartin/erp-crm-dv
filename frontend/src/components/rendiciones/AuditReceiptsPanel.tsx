import { FileText, MapPin, Trash2 } from 'lucide-react';
import { formatCurrency } from './types';

interface AuditReceiptsPanelProps {
  transactions: any[];
  totalExpected: number;
  actionLoading: boolean;
  onDeleteReceipt: (tx: any) => void;
}

export default function AuditReceiptsPanel({
  transactions,
  totalExpected,
  actionLoading,
  onDeleteReceipt,
}: AuditReceiptsPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
      <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span className="tabular-nums" style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="var(--color-primary)" aria-hidden="true" />
          Recibos ({transactions.length})
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Total:{' '}
          <strong className="tabular-nums" style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>
            {formatCurrency(totalExpected)}
          </strong>
        </span>
      </div>

      <div className="table-container" role="region" aria-label="Recibos incluidos" tabIndex={0} style={{ flex: 1, margin: 0, border: 'none', borderRadius: 0, boxShadow: 'none' }}>
        {transactions.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            Sin recibos en esta rendición.
          </div>
        ) : (
          <table style={{ fontSize: '0.8rem' }}>
            <thead>
              <tr>
                <th scope="col">Recibo / Pedido</th>
                <th scope="col">Cliente</th>
                <th scope="col">Sucursal</th>
                <th scope="col">Medio</th>
                <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
                <th scope="col" style={{ textAlign: 'center', width: '80px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: any) => (
                <tr key={tx.id}>
                  <td style={{ fontWeight: 600 }}>
                    {tx.receiptNumber || `Pedido #${tx.orderId || 'S/N'}`}
                  </td>
                  <td>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tx.persona?.name || 'Desconocido'}</div>
                    {(tx.persona?.city || tx.persona?.route || tx.persona?.saleRoute?.name) && (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        <MapPin size={11} aria-hidden="true" />
                        <span>{tx.persona?.city || tx.persona?.route || tx.persona?.saleRoute?.name}</span>
                      </div>
                    )}
                  </td>
                  <td>
                    <span style={{ fontWeight: 600, color: tx.billingType === 'OFFICIAL' ? '#1e40af' : '#b45309' }}>
                      {tx.billingType === 'OFFICIAL' ? 'A (Oficial)' : 'X (Interna)'}
                    </span>
                  </td>
                  <td>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor: tx.paymentMethod === 'CASH' ? '#ecfdf5' : tx.paymentMethod === 'CHECK' ? '#eff6ff' : '#f1f5f9',
                        color: tx.paymentMethod === 'CASH' ? '#047857' : tx.paymentMethod === 'CHECK' ? '#1d4ed8' : '#475569',
                      }}
                    >
                      {tx.paymentMethod === 'CASH'
                        ? 'EFECTIVO'
                        : tx.paymentMethod === 'CHECK'
                        ? 'CHEQUE'
                        : tx.paymentMethod === 'BANK_TRANSFER'
                        ? 'TRANSFERENCIA'
                        : tx.paymentMethod}
                    </span>
                  </td>
                  <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                    {formatCurrency(Number(tx.amount))}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => onDeleteReceipt(tx)}
                      disabled={actionLoading}
                      style={{ padding: '4px 6px', color: '#ef4444', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      aria-label={`Eliminar recibo ${tx.receiptNumber || tx.id}`}
                    >
                      <Trash2 size={14} color="#ef4444" aria-hidden="true" />
                      <span>Eliminar</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
