import { FileText, Trash2 } from 'lucide-react';
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
  onDeleteReceipt
}: AuditReceiptsPanelProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: '#fff' }}>
      <div style={{ padding: '12px 16px', backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <span style={{ fontSize: '0.88rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <FileText size={18} color="var(--color-primary)" />
          Recibos y Cobros Incluidos ({transactions.length})
        </span>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Total Recaudado:{' '}
          <strong style={{ color: 'var(--color-primary)', fontFamily: 'monospace' }}>
            {formatCurrency(totalExpected)}
          </strong>
        </span>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: 0 }}>
        {transactions.length === 0 ? (
          <div style={{ padding: '40px 20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
            No hay recibos asociados registrados en esta rendición.
          </div>
        ) : (
          <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ position: 'sticky', top: 0, backgroundColor: '#f1f5f9', zIndex: 1, boxShadow: '0 1px 2px rgba(0,0,0,0.05)' }}>
              <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                <th style={{ padding: '10px 12px' }}>Recibo / Pedido</th>
                <th style={{ padding: '10px 12px' }}>Cliente</th>
                <th style={{ padding: '10px 12px' }}>Sucursal</th>
                <th style={{ padding: '10px 12px' }}>Medio</th>
                <th style={{ padding: '10px 12px', textAlign: 'right' }}>Monto</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', width: '80px' }}>Acción</th>
              </tr>
            </thead>
            <tbody>
              {transactions.map((tx: any) => (
                <tr key={tx.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                  <td style={{ padding: '10px 12px', fontWeight: 600 }}>
                    {tx.receiptNumber || `Pedido #${tx.orderId || 'S/N'}`}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{tx.persona?.name || 'Desconocido'}</div>
                    {(tx.persona?.city || tx.persona?.route || tx.persona?.saleRoute?.name) && (
                      <div style={{ fontSize: '0.72rem', color: '#64748b', display: 'flex', alignItems: 'center', gap: '3px', marginTop: '2px' }}>
                        <span>📍 {tx.persona?.city || tx.persona?.route || tx.persona?.saleRoute?.name}</span>
                      </div>
                    )}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontWeight: 600, color: tx.billingType === 'OFFICIAL' ? '#1e40af' : '#b45309' }}>
                      {tx.billingType === 'OFFICIAL' ? 'A (Oficial)' : 'X (Interna)'}
                    </span>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '4px',
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        backgroundColor: tx.paymentMethod === 'CASH' ? '#ecfdf5' : tx.paymentMethod === 'CHECK' ? '#eff6ff' : '#f1f5f9',
                        color: tx.paymentMethod === 'CASH' ? '#047857' : tx.paymentMethod === 'CHECK' ? '#1d4ed8' : '#475569'
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
                  <td style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                    {formatCurrency(Number(tx.amount))}
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      onClick={() => onDeleteReceipt(tx)}
                      disabled={actionLoading}
                      style={{ padding: '4px 6px', color: '#ef4444', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      title="Eliminar recibo y restaurar saldo del cliente"
                    >
                      <Trash2 size={14} color="#ef4444" />
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
