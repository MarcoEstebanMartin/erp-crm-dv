import { useState, useEffect } from 'react';
import { X, Printer, Calendar } from 'lucide-react';
import { api } from '../../utils/api';

interface ResumenCuentaModalProps {
  client: any;
  onClose: () => void;
}

export default function ResumenCuentaModal({ client, onClose }: ResumenCuentaModalProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState('30days'); // 30days, all, custom
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    fetchTransactions();
  }, [dateRange, customStart, customEnd]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const orders = await api.getOrders();
      const clientOrders = orders.filter((o: any) => 
        (o.personaId === client.id || o.clientId === client.id) &&
        o.status !== 'CANCELLED'
      );
      
      let txs = clientOrders.map((o: any) => ({
        id: o.id,
        date: new Date(o.createdAt),
        type: 'FACTURA',
        description: `Comprobante N° ${o.receiptNumber || o.id}`,
        debit: Number(o.totalAmount),
        credit: 0
      }));

      const allFinTxs = await api.getTransactions({});
      const clientTxs = allFinTxs.filter((t: any) => Number(t.personaId) === Number(client.id) && t.type === 'INCOME');
      
      const receipts = clientTxs.map((t: any) => ({
        id: `tx-${t.id}`,
        date: new Date(t.createdAt),
        type: 'RECIBO / COBRO',
        description: t.description || 'Cobro registrado',
        debit: 0,
        credit: Number(t.amount)
      }));

      let combined = [...txs, ...receipts];

      if (dateRange === '30days') {
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        combined = combined.filter(t => t.date >= thirtyDaysAgo);
      } else if (dateRange === 'custom' && customStart && customEnd) {
        const start = new Date(customStart);
        const end = new Date(customEnd);
        end.setHours(23, 59, 59);
        combined = combined.filter(t => t.date >= start && t.date <= end);
      }

      combined.sort((a, b) => a.date.getTime() - b.date.getTime());

      let currentBalance = 0;
      combined = combined.map(t => {
        currentBalance += (t.debit - t.credit);
        return { ...t, balance: currentBalance };
      });

      setTransactions(combined);
    } catch (err) {
      console.error('Error fetching transactions', err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px', width: '90%' }}>
        
        {/* Header no-print */}
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <div>
            <h2 style={{ margin: 0 }}>Resumen de Cuenta</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)' }}>Cliente: <strong>{client.name}</strong></p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Filters no-print */}
        <div className="no-print" style={{ display: 'flex', gap: '15px', alignItems: 'center', marginBottom: '20px', backgroundColor: 'var(--bg-light)', padding: '15px', borderRadius: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={18} color="var(--text-secondary)" />
            <span style={{ fontSize: '0.9rem', fontWeight: 500 }}>Rango:</span>
          </div>
          <select className="input" style={{ width: 'auto', padding: '6px 12px' }} value={dateRange} onChange={e => setDateRange(e.target.value)}>
            <option value="30days">Últimos 30 días</option>
            <option value="all">Histórico completo</option>
            <option value="custom">Personalizado...</option>
          </select>

          {dateRange === 'custom' && (
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input type="date" className="input" style={{ padding: '6px 12px' }} value={customStart} onChange={e => setCustomStart(e.target.value)} />
              <span>a</span>
              <input type="date" className="input" style={{ padding: '6px 12px' }} value={customEnd} onChange={e => setCustomEnd(e.target.value)} />
            </div>
          )}

          <div style={{ flex: 1 }}></div>

          <button className="btn btn-primary" onClick={handlePrint} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Printer size={16} /> Imprimir Resumen
          </button>
        </div>

        {/* Printable Area */}
        <div className="print-only-container" style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ textAlign: 'center', marginBottom: '30px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
            <h2 style={{ margin: 0 }}>RESUMEN DE CUENTA CORRIENTE</h2>
            <p style={{ margin: '5px 0' }}><strong>{client.name}</strong></p>
            {client.cuit && <p style={{ margin: '0' }}>CUIT: {client.cuit} | Tel: {client.phone}</p>}
          </div>

          <div style={{ marginBottom: '20px', display: 'flex', justifyContent: 'space-between' }}>
            <div>
              <span style={{ color: 'var(--text-secondary)' }}>Fecha de Emisión: </span>
              <strong>{new Date().toLocaleDateString('es-AR')}</strong>
            </div>
            <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Saldo Actual: </span>
              <span style={{ color: Number(client.outstandingBalance) > 0 ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                ${Number(client.outstandingBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Cargando movimientos...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Fecha</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Comprobante</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Debe</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Haber</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '20px' }}>No hay movimientos en el rango seleccionado.</td>
                  </tr>
                ) : (
                  transactions.map((t, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                      <td style={{ padding: '10px' }}>{t.date.toLocaleDateString('es-AR')}</td>
                      <td style={{ padding: '10px' }}>{t.description}</td>
                      <td style={{ padding: '10px', textAlign: 'right', color: t.debit > 0 ? 'var(--color-danger)' : 'inherit' }}>
                        {t.debit > 0 ? `$${t.debit.toLocaleString('es-AR', {minimumFractionDigits: 2})}` : ''}
                      </td>
                      <td style={{ padding: '10px', textAlign: 'right', color: t.credit > 0 ? 'var(--text-primary)' : 'inherit' }}>
                        {t.credit > 0 ? `$${t.credit.toLocaleString('es-AR', {minimumFractionDigits: 2})}` : ''}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>

      </div>
      
      {/* Styles for print mode */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .modal-content, .modal-content * {
            visibility: visible;
          }
          .no-print {
            display: none !important;
          }
          .modal-content {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            border: none !important;
            box-shadow: none !important;
          }
          .print-only-container {
            border: none !important;
            padding: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}
