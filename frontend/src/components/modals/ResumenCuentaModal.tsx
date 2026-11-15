import { useState, useEffect } from 'react';
import { X, Printer, Calendar } from 'lucide-react';
import { api } from '../../utils/api';
import { formatCompanyPhone, getCompanyProfile } from '../../utils/companyProfile';
import { useConfirm } from '../../context/ConfirmContext';
import { NativeModalDialog } from './NativeModalDialog';
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
  const confirm = useConfirm();

  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedCreditNote, setSelectedCreditNote] = useState<any | null>(null);
  const [selectedTransaction, setSelectedTransaction] = useState<any | null>(null);
  const [selectedWithholding, setSelectedWithholding] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);
  const [actionBanner, setActionBanner] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const company = getCompanyProfile();
  const companyName = company.nombreFantasia.toUpperCase();
  const companyCuit = company.cuit;
  const companyDireccion = company.direccion;
  const companyTelefono = formatCompanyPhone(company.telefono);
  const companyEmail = company.email;

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
    } catch {
      setActionBanner({ type: 'error', text: 'Error al cargar movimientos.' });
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
      setActionBanner({ type: 'error', text: 'No se pudo cargar el detalle.' });
    } finally {
      setViewLoading(false);
    }
  };

  const handleDeleteReceipt = async (txId: number, receiptDesc: string, creditAmount: number) => {
    if (!(await confirm(`¿Anular recibo "${receiptDesc}" por $${creditAmount.toLocaleString('es-AR')}?`))) return;
    try {
      const res = await api.deleteReceipt(txId);
      setActionBanner({ type: 'success', text: res.message || 'Recibo anulado.' });
      setSelectedTransaction(null);
      fetchTransactions();
    } catch (err: any) {
      setActionBanner({ type: 'error', text: err?.response?.data?.error || err?.message || 'Error al anular recibo.' });
    }
  };

  return (
    <NativeModalDialog
      isOpen={Boolean(client)}
      onClose={onClose}
      ariaLabelledBy="resumen-cuenta-title"
      className="print-modal"
      style={{ maxWidth: '920px', width: '95vw', maxHeight: '92vh', padding: '22px', borderRadius: '12px' }}
    >
      <div className="print-content-box" style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div className="no-print" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 id="resumen-cuenta-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>
            Resumen de cuenta · {client.name}
          </h2>
          <button type="button" className="btn btn-ghost" aria-label="Cerrar" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {actionBanner && (
          <div
            className="no-print"
            role={actionBanner.type === 'error' ? 'alert' : 'status'}
            style={{
              padding: '9px 12px',
              borderRadius: '6px',
              fontSize: '0.82rem',
              backgroundColor: actionBanner.type === 'error' ? '#fef2f2' : '#f0fdf4',
              border: `1px solid ${actionBanner.type === 'error' ? '#fecaca' : '#bbf7d0'}`,
              color: actionBanner.type === 'error' ? '#991b1b' : '#166534',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{actionBanner.text}</span>
            <button type="button" className="btn btn-ghost" style={{ padding: '2px 6px', fontSize: '0.75rem' }} onClick={() => setActionBanner(null)}>Cerrar</button>
          </div>
        )}

        <div className="no-print" style={{ display: 'flex', gap: '10px', alignItems: 'center', backgroundColor: '#f8fafc', padding: '10px 14px', borderRadius: '8px', flexWrap: 'wrap', border: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="var(--text-secondary)" />
            <select aria-label="Rango de fechas" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.84rem' }} value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="7days">7 días</option>
              <option value="30days">30 días</option>
              <option value="90days">90 días</option>
              <option value="all">Histórico</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          <select aria-label="Sucursal" className="input" style={{ width: 'auto', padding: '6px 10px', fontSize: '0.84rem' }} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value as any)}>
            <option value="ALL">Todas (A + X)</option>
            <option value="OFFICIAL">Sucursal A</option>
            <option value="INTERNAL">Sucursal X</option>
          </select>

          {dateRange === 'custom' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input aria-label="Desde" type="date" className="input" style={{ padding: '5px 8px', fontSize: '0.82rem' }} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span>-</span>
              <input aria-label="Hasta" type="date" className="input" style={{ padding: '5px 8px', fontSize: '0.82rem' }} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}

          <div style={{ flex: 1 }} />
          <button type="button" className="btn btn-primary" onClick={() => window.print()} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.84rem' }}>
            <Printer size={15} /> Imprimir
          </button>
        </div>

        <div className="print-modal-scroll" style={{ maxHeight: '64vh', overflowY: 'auto' }}>
          <div id="print-area" className="print-only-container" style={{ backgroundColor: '#fff', padding: '20px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #111827', paddingBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img src="/logo.png" alt="Logo Distribuidora" style={{ height: '42px', width: 'auto', objectFit: 'contain' }} />
                <div style={{ textAlign: 'left', lineHeight: '1.3' }}>
                  <strong style={{ fontSize: '1.02rem', color: '#111827' }}>{companyName}</strong>
                  {companyDireccion && <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{companyDireccion}</div>}
                  <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                    {companyCuit && <span>CUIT: {companyCuit}</span>}
                    {companyCuit && (companyTelefono || companyEmail) && <span style={{ margin: '0 6px' }}>|</span>}
                    {companyTelefono && <span>{companyTelefono}</span>}
                    {companyTelefono && companyEmail && <span style={{ margin: '0 6px' }}>|</span>}
                    {companyEmail && <span>{companyEmail}</span>}
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right', lineHeight: '1.3' }}>
                <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#111827' }}>RESUMEN DE CUENTA</h2>
                <div className="tabular-nums" style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '2px' }}>{new Date().toLocaleDateString('es-AR')}</div>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '6px', padding: '12px 16px', marginBottom: '18px' }}>
              <div>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Cliente</div>
                <strong style={{ fontSize: '1.05rem', color: '#111827' }}>{client.name}</strong>
                {(client.cuit || client.phone) && (
                  <div className="tabular-nums" style={{ fontSize: '0.78rem', color: '#4b5563', marginTop: '2px' }}>
                    {client.cuit && <span>CUIT: {client.cuit}</span>}
                    {client.cuit && client.phone && <span style={{ margin: '0 6px' }}>|</span>}
                    {client.phone && <span>{client.phone}</span>}
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 600 }}>Saldo</div>
                <strong className="tabular-nums" style={{ fontSize: '1.25rem', color: Number(client.outstandingBalance) > 0 ? 'var(--color-corp-red)' : '#111827' }}>
                  ${Math.round(Number(client.outstandingBalance || 0)).toLocaleString('es-AR')}
                </strong>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '32px' }}>Cargando...</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                    <th scope="col" className="no-print" style={{ padding: '9px', textAlign: 'left' }}>ID</th>
                    <th scope="col" style={{ padding: '9px', textAlign: 'left' }}>Fecha</th>
                    <th scope="col" style={{ padding: '9px', textAlign: 'left' }}>Comprobante</th>
                    <th scope="col" style={{ padding: '9px', textAlign: 'right' }}>Debe</th>
                    <th scope="col" style={{ padding: '9px', textAlign: 'right' }}>Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '20px', color: 'var(--text-secondary)' }}>Sin movimientos</td></tr>
                  ) : (
                    transactions.map((t, idx) => {
                      const isClickable = t.id && (t.id.startsWith('order-') || t.id.startsWith('credit-note-') || t.id.startsWith('transaction-') || t.id.startsWith('withholding-'));
                      const movId = t?.movementId ? String(t.movementId) : '-';
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                          <td className="no-print tabular-nums" style={{ padding: '9px' }}>
                            {isClickable ? (
                              <button type="button" style={{ background: 'none', border: 'none', color: 'var(--text-primary)', textDecoration: 'underline', cursor: 'pointer', fontWeight: 600, padding: 0 }} disabled={viewLoading} onClick={() => handleViewDetail(t.id)}>{movId}</button>
                            ) : <span style={{ color: 'var(--text-secondary)' }}>{movId}</span>}
                          </td>
                          <td className="tabular-nums" style={{ padding: '9px' }}>{t.isPureDate ? t.date.toLocaleDateString('es-AR', { timeZone: 'UTC' }) : t.date.toLocaleDateString('es-AR')}</td>
                          <td style={{ padding: '9px' }}>
                            {isClickable ? (
                              <>
                                <button type="button" className="no-print" style={{ background: 'none', border: 'none', color: 'var(--text-primary)', textDecoration: 'underline', cursor: 'pointer', padding: 0, textAlign: 'left' }} disabled={viewLoading} onClick={() => handleViewDetail(t.id)}>{t.description}</button>
                                <span className="resumen-print-inline">{t.description}</span>
                              </>
                            ) : t.description}
                          </td>
                          <td className="tabular-nums" style={{ padding: '9px', textAlign: 'right', color: t.debit > 0 ? 'var(--color-danger)' : 'inherit' }}>{t.debit > 0 ? `$${Math.round(t.debit).toLocaleString('es-AR')}` : ''}</td>
                          <td className="tabular-nums" style={{ padding: '9px', textAlign: 'right', color: t.credit > 0 ? '#059669' : 'inherit', fontWeight: t.credit > 0 ? 600 : 400 }}>{t.credit > 0 ? `$${Math.round(t.credit).toLocaleString('es-AR')}` : ''}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            )}
          </div>
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
        .resumen-print-inline { display: none; }
        @media print {
          .no-print { display: none !important; }
          .resumen-print-inline { display: inline !important; position: static !important; }
          .print-only-container { border: none !important; padding: 0 !important; }
        }
      `}</style>
    </NativeModalDialog>
  );
}
