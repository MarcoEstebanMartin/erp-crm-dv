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

function formatInvoiceNumberShort(text: string): string {
  return text.replace(/\b(\d{4,5})[-–—](\d{6,8})\b/g, (_match, pv, num) => {
    const shortPv = String(Number(pv)).padStart(4, '0');
    const shortNum = String(Number(num)).padStart(4, '0');
    return `${shortPv}-${shortNum}`;
  });
}

function formatMovementLabel(rawDescription: string): string {
  const text = String(rawDescription || '').trim();

  const receiptMatch = text.match(/^Recibo\s+(?:N°\s*)?([A-Z0-9-]+)(?:\s*[-–—].*)?$/i);
  if (receiptMatch) {
    return `Recibo ${receiptMatch[1]}`;
  }

  const cobroDirectoMatch = text.match(/^Cobro en el acto de factura directa #(\d+)/i);
  if (cobroDirectoMatch) {
    return `Cobro Factura #${cobroDirectoMatch[1]}`;
  }

  const cobroCajaMatch = text.match(/^Cobro en caja de pedido #(\d+)/i);
  if (cobroCajaMatch) {
    return `Cobro Pedido #${cobroCajaMatch[1]}`;
  }

  const mainPart = text.split(/\s+[-–—]\s+(?![\d])/)[0] || text;
  return formatInvoiceNumberShort(mainPart.trim());
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

  const outstandingBalance = Math.round(Number(client.outstandingBalance || 0));

  return (
    <NativeModalDialog
      isOpen={Boolean(client)}
      onClose={onClose}
      ariaLabelledBy="resumen-cuenta-title"
      className="print-modal"
      style={{ maxWidth: '880px', width: '95vw', maxHeight: '90vh', padding: '24px', borderRadius: '12px' }}
    >
      <div className="print-content-box" style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div
          className="no-print"
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'flex-start',
            gap: '16px',
            paddingBottom: '14px',
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <h2 id="resumen-cuenta-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.01em' }}>
              {client.name}
            </h2>
            {(client.cuit || client.phone) && (
              <div className="tabular-nums" style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: '3px' }}>
                {client.cuit && <span>CUIT {client.cuit}</span>}
                {client.cuit && client.phone && <span style={{ margin: '0 6px' }}>·</span>}
                {client.phone && <span>{client.phone}</span>}
              </div>
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#6b7280', fontWeight: 600 }}>
                Saldo
              </div>
              <strong
                className="tabular-nums"
                style={{
                  fontSize: '1.2rem',
                  fontWeight: 700,
                  color: outstandingBalance > 0 ? 'var(--color-corp-red)' : '#111827',
                }}
              >
                ${outstandingBalance.toLocaleString('es-AR')}
              </strong>
            </div>
            <div style={{ width: '1px', height: '28px', backgroundColor: '#e5e7eb' }} />
            <button type="button" className="btn btn-ghost" aria-label="Cerrar" onClick={onClose} style={{ padding: '6px' }}>
              <X size={18} />
            </button>
          </div>
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

        <div className="no-print" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={14} color="#6b7280" />
            <select aria-label="Rango de fechas" className="input" style={{ width: 'auto', padding: '5px 10px', fontSize: '0.82rem', height: '32px' }} value={dateRange} onChange={(e) => setDateRange(e.target.value)}>
              <option value="7days">7 días</option>
              <option value="30days">30 días</option>
              <option value="90days">90 días</option>
              <option value="all">Histórico</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          <select aria-label="Sucursal" className="input" style={{ width: 'auto', padding: '5px 10px', fontSize: '0.82rem', height: '32px' }} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value as any)}>
            <option value="ALL">Todas (A + X)</option>
            <option value="OFFICIAL">Sucursal A</option>
            <option value="INTERNAL">Sucursal X</option>
          </select>

          {dateRange === 'custom' && (
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input aria-label="Desde" type="date" className="input" style={{ padding: '4px 8px', fontSize: '0.8rem', height: '32px' }} value={customStart} onChange={(e) => setCustomStart(e.target.value)} />
              <span style={{ color: '#9ca3af' }}>-</span>
              <input aria-label="Hasta" type="date" className="input" style={{ padding: '4px 8px', fontSize: '0.8rem', height: '32px' }} value={customEnd} onChange={(e) => setCustomEnd(e.target.value)} />
            </div>
          )}

          <div style={{ flex: 1 }} />
          <button
            type="button"
            className="btn btn-primary"
            onClick={() => window.print()}
            style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px', height: '32px' }}
          >
            <Printer size={14} /> Imprimir
          </button>
        </div>

        <div className="print-modal-scroll" tabIndex={0} role="region" aria-label="Movimientos de cuenta" style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          <div id="print-area" className="print-only-container" style={{ backgroundColor: '#fff' }}>
            <div className="resumen-print-header">
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
                  <strong className="tabular-nums" style={{ fontSize: '1.25rem', color: outstandingBalance > 0 ? 'var(--color-corp-red)' : '#111827' }}>
                    ${outstandingBalance.toLocaleString('es-AR')}
                  </strong>
                </div>
              </div>
            </div>

            {loading ? (
              <div style={{ textAlign: 'center', padding: '36px', color: '#6b7280', fontSize: '0.86rem' }}>Cargando...</div>
            ) : (
              <table className="resumen-ledger-table" style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid #e5e7eb' }}>
                    <th scope="col" className="no-print" style={{ padding: '8px 10px', textAlign: 'left', width: '64px' }}>ID</th>
                    <th scope="col" style={{ padding: '8px 10px', textAlign: 'left', width: '96px' }}>Fecha</th>
                    <th scope="col" style={{ padding: '8px 10px', textAlign: 'left' }}>Comprobante</th>
                    <th scope="col" style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Debe</th>
                    <th scope="col" style={{ padding: '8px 10px', textAlign: 'right', width: '110px' }}>Haber</th>
                  </tr>
                </thead>
                <tbody>
                  {transactions.length === 0 ? (
                    <tr><td colSpan={5} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-secondary)' }}>Sin movimientos</td></tr>
                  ) : (
                    transactions.map((t, idx) => {
                      const isClickable = t.id && (t.id.startsWith('order-') || t.id.startsWith('credit-note-') || t.id.startsWith('transaction-') || t.id.startsWith('withholding-'));
                      const movId = t?.movementId ? String(t.movementId) : '-';
                      const label = formatMovementLabel(t.description);
                      const isHaber = t.credit > 0 && t.debit === 0;
                      return (
                        <tr
                          key={t.id || idx}
                          className={isClickable ? 'resumen-row-clickable' : undefined}
                          onClick={isClickable && !viewLoading ? () => handleViewDetail(t.id) : undefined}
                          style={{ borderBottom: '1px solid #f1f5f9' }}
                        >
                          <td className="no-print tabular-nums" style={{ padding: '9px 10px', color: '#9ca3af', fontSize: '0.78rem', verticalAlign: 'middle' }}>
                            {movId !== '-' ? `#${movId}` : '-'}
                          </td>
                          <td className="tabular-nums" style={{ padding: '9px 10px', color: '#4b5563', fontSize: '0.82rem', whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            {t.isPureDate ? t.date.toLocaleDateString('es-AR', { timeZone: 'UTC' }) : t.date.toLocaleDateString('es-AR')}
                          </td>
                          <td className={isHaber ? 'resumen-cell-haber' : 'resumen-cell-debe'} style={{ verticalAlign: 'middle' }}>
                            {isClickable ? (
                              <>
                                <button
                                  type="button"
                                  className="no-print resumen-desc-btn"
                                  disabled={viewLoading}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleViewDetail(t.id);
                                  }}
                                >
                                  <span className="resumen-desc-title">{label}</span>
                                </button>
                                <span className="resumen-print-inline">{t.description}</span>
                              </>
                            ) : (
                              <span style={{ color: '#111827', fontWeight: 500 }}>{label}</span>
                            )}
                          </td>
                          <td className="tabular-nums" style={{ padding: '9px 10px', textAlign: 'right', color: t.debit > 0 ? '#dc2626' : 'inherit', fontWeight: t.debit > 0 ? 500 : 400, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            {t.debit > 0 ? `$${Math.round(t.debit).toLocaleString('es-AR')}` : ''}
                          </td>
                          <td className="tabular-nums" style={{ padding: '9px 10px', textAlign: 'right', color: t.credit > 0 ? '#059669' : 'inherit', fontWeight: t.credit > 0 ? 600 : 400, whiteSpace: 'nowrap', verticalAlign: 'middle' }}>
                            {t.credit > 0 ? `$${Math.round(t.credit).toLocaleString('es-AR')}` : ''}
                          </td>
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
    </NativeModalDialog>
  );
}
