import { useState, useEffect } from 'react';
import { X, Printer, Calendar } from 'lucide-react';
import { api } from '../../utils/api';
import { ResumenCuentaDetailModals } from './ResumenCuentaDetailModals';

interface ResumenCuentaModalProps {
  client: any;
  onClose: () => void;
}

export default function ResumenCuentaModal({ client, onClose }: ResumenCuentaModalProps) {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [dateRange, setDateRange] = useState('30days');
  const [branchFilter, setBranchFilter] = useState<'ALL' | 'OFFICIAL' | 'INTERNAL'>('ALL');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  const userRole = localStorage.getItem('user_role') || '';
  const isAdminOrFacturacion = userRole === 'ADMIN' || userRole === 'FACTURACION';

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedCreditNote, setSelectedCreditNote] = useState<any | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [selectedWithholding, setSelectedWithholding] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  const companyName = (localStorage.getItem('company_nombre_fantasia') || localStorage.getItem('company_razon_social') || 'Distribuidora Don Venancio').toUpperCase();
  const companyCuit = localStorage.getItem('company_cuit') || '';
  const companyDireccion = localStorage.getItem('company_direccion') || '';
  const companyTelefono = localStorage.getItem('company_telefono') || '';
  const companyEmail = localStorage.getItem('company_email') || '';

  useEffect(() => {
    fetchTransactions();
  }, [dateRange, branchFilter, customStart, customEnd]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.getPersonaLedger(client.id);
      const ledger = res.ledger || [];

      let combined = ledger.map((item: any) => {
        const isDebit = item.type === 'DEBIT';
        const isPureDate = item.id.startsWith('withholding-') || item.id.startsWith('supplier-invoice-') || (typeof item.date === 'string' && item.date.includes('T00:00:00.000Z'));
        return {
          id: item.id,
          movementId: item.movementId,
          date: new Date(item.date),
          isPureDate,
          reference: item.reference,
          description: item.description,
          billingType: item.billingType || item.metadata?.billingType || 'ALL',
          debit: isDebit ? Number(item.amount) : 0,
          credit: !isDebit ? Number(item.amount) : 0,
          metadata: item.metadata ? { ...item.metadata, movementId: item.movementId } : { movementId: item.movementId },
        };
      });

      if (branchFilter !== 'ALL') {
        combined = combined.filter((t: any) => {
          if (branchFilter === 'OFFICIAL') return t.billingType === 'OFFICIAL' || t.billingType === 'AFIP' || String(t.description || '').includes('Factura A') || String(t.description || '').includes('Factura B');
          return t.billingType === 'INTERNAL' || (!String(t.description || '').includes('Factura A') && !String(t.description || '').includes('Factura B'));
        });
      }

      if (dateRange === '7days' || dateRange === '30days' || dateRange === '90days') {
        const days = dateRange === '7days' ? 7 : dateRange === '30days' ? 30 : 90;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);
        combined = combined.filter((t: any) => t.date >= cutoff);
      } else if (dateRange === 'custom' && customStart && customEnd) {
        const start = new Date(customStart);
        const end = new Date(customEnd);
        end.setHours(23, 59, 59);
        combined = combined.filter((t: any) => t.date >= start && t.date <= end);
      }

      combined.sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

      let currentBalance = 0;
      combined = combined.map((t: any) => {
        currentBalance += t.debit - t.credit;
        return { ...t, balance: currentBalance };
      });

      setTransactions(combined);
    } catch (err) {
      console.error('Error fetching transactions', err);
    } finally {
      setLoading(false);
    }
  };

  const handleViewDetail = async (fullId: string) => {
    if (viewLoading) return;
    if (fullId.startsWith('withholding-')) {
      const tx = transactions.find((t) => t.id === fullId);
      if (tx?.metadata) setSelectedWithholding(tx.metadata);
      return;
    }
    setViewLoading(true);
    try {
      if (fullId.startsWith('order-')) setSelectedOrder(await api.getOrderById(Number(fullId.split('-').pop())));
      else if (fullId.startsWith('credit-note-')) setSelectedCreditNote(await api.getCreditNoteById(Number(fullId.split('-').pop())));
      else if (fullId.startsWith('transaction-')) setSelectedTransaction(await api.getTransactionById(Number(fullId.split('-').pop())));
    } catch {
      alert('No se pudo cargar el detalle del comprobante.');
    } finally {
      setViewLoading(false);
    }
  };

  const handleDeleteReceipt = async (txId: number, receiptDesc: string, creditAmount: number) => {
    if (!window.confirm(`¿Estás seguro de que deseas anular y eliminar el recibo "${receiptDesc}"? Esto devolverá $${creditAmount.toLocaleString('es-AR')} al saldo pendiente del cliente.`)) return;
    try {
      const res = await api.deleteReceipt(txId);
      alert(res.message || 'Recibo anulado y eliminado correctamente.');
      setSelectedTransaction(null);
      fetchTransactions();
    } catch (err: any) {
      alert(err?.response?.data?.error || err?.message || 'Error al anular recibo.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '920px', width: '95%' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem' }}>Resumen de Cuenta A4</h2>
            <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Cliente: <strong>{client.name}</strong></p>
          </div>
          <button className="btn btn-ghost" onClick={onClose}><X size={20} /></button>
        </div>

        <div className="no-print" style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '20px', backgroundColor: 'var(--bg-light)', padding: '12px 16px', borderRadius: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={16} color="var(--text-secondary)" />
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Rango:</span>
          </div>
          <select className="input" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.84rem' }} value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
            <option value="7days">Últimos 7 días</option>
            <option value="30days">Últimos 30 días</option>
            <option value="90days">Últimos 90 días</option>
            <option value="all">Histórico completo</option>
            <option value="custom">Rango personalizado...</option>
          </select>

          <select className="input" style={{ width: 'auto', padding: '6px 12px', fontSize: '0.84rem' }} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value as any)}>
            <option value="ALL">Todas las Sucursales (A + X)</option>
            <option value="OFFICIAL">Sucursal A (Oficial)</option>
            <option value="INTERNAL">Sucursal X (Interno)</option>
          </select>

          {dateRange === 'custom' && (
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input type="date" className="input" style={{ padding: '5px 10px', fontSize: '0.82rem' }} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span>a</span>
              <input type="date" className="input" style={{ padding: '5px 10px', fontSize: '0.82rem' }} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}

          <div style={{ flex: 1 }} />
          <button className="btn btn-primary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}>
            <Printer size={16} /> Imprimir Resumen A4
          </button>
        </div>

        <div className="print-only-container" style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '22px', borderBottom: '2px solid #111827', paddingBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
              <img src="/logo.png" alt="Logo Distribuidora" style={{ height: '44px', width: 'auto', objectFit: 'contain' }} />
              <div style={{ textAlign: 'left', lineHeight: '1.3' }}>
                <strong style={{ fontSize: '1.05rem', color: '#111827' }}>{companyName}</strong>
                {companyDireccion && <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{companyDireccion}</div>}
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                  {companyCuit && <span>CUIT: {companyCuit}</span>}
                  {companyCuit && (companyTelefono || companyEmail) && <span style={{ margin: '0 6px' }}>|</span>}
                  {companyTelefono && <span>Tel: {companyTelefono}</span>}
                </div>
              </div>
            </div>
            <div style={{ textAlign: 'right', lineHeight: '1.3' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 800, color: '#111827' }}>RESUMEN DE CUENTA</h2>
              <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>Emisión: <strong>{new Date().toLocaleDateString('es-AR')}</strong></div>
            </div>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px 16px', marginBottom: '20px' }}>
            <div>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Cliente</div>
              <strong style={{ fontSize: '1.08rem', color: '#111827' }}>{client.name}</strong>
              {(client.cuit || client.phone) && (
                <div style={{ fontSize: '0.78rem', color: '#4b5563', marginTop: '2px' }}>
                  {client.cuit && <span>CUIT: {client.cuit}</span>}
                  {client.cuit && client.phone && <span style={{ margin: '0 6px' }}>|</span>}
                  {client.phone && <span>Tel: {client.phone}</span>}
                </div>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Saldo Actual</div>
              <strong style={{ fontSize: '1.25rem', color: Number(client.outstandingBalance) > 0 ? 'var(--color-corp-red)' : '#111827' }}>
                ${Math.round(Number(client.outstandingBalance || 0)).toLocaleString('es-AR')}
              </strong>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Cargando movimientos...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                  <th className="no-print" style={{ padding: '10px', textAlign: 'left' }}>ID</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Fecha</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Comprobante</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Debe</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Haber</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No hay movimientos en el rango seleccionado.</td></tr>
                ) : (
                  transactions.map((t, idx) => {
                    const isClickable = t.id && (t.id.startsWith('order-') || t.id.startsWith('credit-note-') || t.id.startsWith('transaction-') || t.id.startsWith('withholding-'));
                    const movId = t?.movementId ? String(t.movementId) : '-';
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        <td className="no-print" style={{ padding: '10px' }}>
                          {isClickable ? (
                            <button style={{ background: 'none', border: 'none', color: 'var(--text-primary)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600, padding: 0 }} disabled={viewLoading} onClick={() => handleViewDetail(t.id)}>{movId}</button>
                          ) : <span style={{ color: 'var(--text-secondary)' }}>{movId}</span>}
                        </td>
                        <td style={{ padding: '10px' }}>{t.isPureDate ? t.date.toLocaleDateString('es-AR', { timeZone: 'UTC' }) : t.date.toLocaleDateString('es-AR')}</td>
                        <td style={{ padding: '10px' }}>
                          {isClickable ? (
                            <>
                              <button className="no-print" style={{ background: 'none', border: 'none', color: 'var(--text-primary)', textDecoration: 'underline', cursor: 'pointer', padding: 0, textAlign: 'left' }} disabled={viewLoading} onClick={() => handleViewDetail(t.id)}>{t.description}</button>
                              <span className="print-only">{t.description}</span>
                            </>
                          ) : t.description}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: t.debit > 0 ? 'var(--color-danger)' : 'inherit' }}>{t.debit > 0 ? `$${Math.round(t.debit).toLocaleString('es-AR')}` : ''}</td>
                        <td style={{ padding: '10px', textAlign: 'right', color: t.credit > 0 ? '#059669' : 'inherit', fontWeight: t.credit > 0 ? 600 : 400 }}>{t.credit > 0 ? `$${Math.round(t.credit).toLocaleString('es-AR')}` : ''}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
      </div>

      <ResumenCuentaDetailModals
        selectedOrder={selectedOrder}
        setSelectedOrder={setSelectedOrder}
        selectedCreditNote={selectedCreditNote}
        setSelectedCreditNote={setSelectedCreditNote}
        selectedTransaction={selectedTransaction}
        setSelectedTransaction={setSelectedTransaction}
        selectedWithholding={selectedWithholding}
        setSelectedWithholding={setSelectedWithholding}
        isAdminOrFacturacion={isAdminOrFacturacion}
        onDeleteReceipt={handleDeleteReceipt}
      />

      <style>{`
        .print-only { display: none; }
        @media print {
          body * { visibility: hidden; }
          .modal-content, .modal-content * { visibility: visible; }
          .no-print { display: none !important; }
          .print-only { display: inline !important; }
          .modal-content { position: absolute; left: 0; top: 0; width: 100% !important; max-width: 100% !important; padding: 0 !important; border: none !important; box-shadow: none !important; }
          .print-only-container { border: none !important; padding: 0 !important; }
        }
      `}</style>
    </div>
  );
}
