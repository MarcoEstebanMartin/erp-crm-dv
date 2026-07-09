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

  // Estados para ver el detalle de un comprobante
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  const [selectedCreditNote, setSelectedCreditNote] = useState<any | null>(null);
  const [viewLoading, setViewLoading] = useState(false);

  useEffect(() => {
    fetchTransactions();
  }, [dateRange, customStart, customEnd]);

  const fetchTransactions = async () => {
    setLoading(true);
    try {
      const res = await api.getPersonaLedger(client.id);
      const ledger = res.ledger || [];

      // Mapear los ítems del ledger del backend a la estructura que requiere el modal
      let txs = ledger.map((item: any) => {
        const isDebit = item.type === 'DEBIT';
        return {
          id: item.id, // e.g., 'order-12', 'credit-note-5', 'transaction-45'
          date: new Date(item.date),
          reference: item.reference,
          description: item.description,
          debit: isDebit ? Number(item.amount) : 0,
          credit: !isDebit ? Number(item.amount) : 0,
        };
      });

      let combined = [...txs];

      // Aplicar filtros de fecha en el frontend
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

      // Ordenar cronológicamente
      combined.sort((a, b) => a.date.getTime() - b.date.getTime());

      // Recalcular saldo acumulado sobre la lista filtrada
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

  // Formatear el identificador del movimiento para mostrarlo en la tabla
  const formatMovementId = (fullId: string) => {
    if (!fullId) return '-';
    if (fullId.startsWith('order-')) {
      return `FC-${fullId.replace('order-', '')}`;
    }
    if (fullId.startsWith('transaction-')) {
      return `RC-${fullId.replace('transaction-', '')}`;
    }
    if (fullId.startsWith('credit-note-')) {
      return `NC-${fullId.replace('credit-note-', '')}`;
    }
    if (fullId.startsWith('supplier-invoice-')) {
      return `FAC-SUP-${fullId.replace('supplier-invoice-', '')}`;
    }
    return fullId;
  };

  // Cargar y mostrar detalle del comprobante seleccionado
  const handleViewDetail = async (fullId: string) => {
    if (viewLoading) return;
    setViewLoading(true);
    try {
      if (fullId.startsWith('order-')) {
        const orderId = Number(fullId.replace('order-', ''));
        const order = await api.getOrderById(orderId);
        setSelectedOrder(order);
      } else if (fullId.startsWith('credit-note-')) {
        const cnId = Number(fullId.replace('credit-note-', ''));
        const cn = await api.getCreditNoteById(cnId);
        setSelectedCreditNote(cn);
      }
    } catch (err) {
      console.error('Error fetching detail:', err);
      alert('No se pudo cargar el detalle del comprobante.');
    } finally {
      setViewLoading(false);
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '900px', width: '95%' }}>
        
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
                ${Number(client.outstandingBalance || 0).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>

          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px' }}>Cargando movimientos...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f5f5f5', borderBottom: '1px solid #ddd' }}>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Ref / ID</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Fecha</th>
                  <th style={{ padding: '10px', textAlign: 'left' }}>Comprobante</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Debe</th>
                  <th style={{ padding: '10px', textAlign: 'right' }}>Haber</th>
                </tr>
              </thead>
              <tbody>
                {transactions.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '20px' }}>No hay movimientos en el rango seleccionado.</td>
                  </tr>
                ) : (
                  transactions.map((t, idx) => {
                    const isClickable = t.id && (t.id.startsWith('order-') || t.id.startsWith('credit-note-'));
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                        {/* Columna Ref / ID interactiva */}
                        <td style={{ padding: '10px' }}>
                          {isClickable ? (
                            <>
                              <button
                                className="no-print"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-primary)',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  fontWeight: 600,
                                  padding: 0,
                                  textAlign: 'left'
                                }}
                                disabled={viewLoading}
                                onClick={() => handleViewDetail(t.id)}
                              >
                                {formatMovementId(t.id)}
                              </button>
                              <span className="print-only" style={{ fontWeight: 600 }}>
                                {formatMovementId(t.id)}
                              </span>
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>{formatMovementId(t.id)}</span>
                          )}
                        </td>
                        <td style={{ padding: '10px' }}>{t.date.toLocaleDateString('es-AR')}</td>
                        <td style={{ padding: '10px' }}>
                          {isClickable ? (
                            <>
                              <button
                                className="no-print"
                                style={{
                                  background: 'none',
                                  border: 'none',
                                  color: 'var(--text-primary)',
                                  textDecoration: 'underline',
                                  cursor: 'pointer',
                                  padding: 0,
                                  textAlign: 'left'
                                }}
                                disabled={viewLoading}
                                onClick={() => handleViewDetail(t.id)}
                              >
                                {t.description}
                              </button>
                              <span className="print-only">
                                {t.description}
                              </span>
                            </>
                          ) : (
                            t.description
                          )}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: t.debit > 0 ? 'var(--color-danger)' : 'inherit' }}>
                          {t.debit > 0 ? `$${t.debit.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}` : ''}
                        </td>
                        <td style={{ padding: '10px', textAlign: 'right', color: t.credit > 0 ? 'var(--text-primary)' : 'inherit' }}>
                          {t.credit > 0 ? `$${t.credit.toLocaleString('es-AR', {minimumFractionDigits: 0, maximumFractionDigits: 0})}` : ''}
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

      {/* Modal flotante secundario para visualizar el desglose del comprobante */}
      {(selectedOrder || selectedCreditNote) && (
        <div className="modal-overlay no-print" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%', padding: '24px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>
                {selectedOrder 
                  ? `Factura ${selectedOrder.invoiceNumber || 'INT-' + selectedOrder.id.toString().padStart(8, '0')}` 
                  : `Nota de Crédito ${selectedCreditNote.creditNoteNumber || 'INT-' + selectedCreditNote.id.toString().padStart(8, '0')}`}
              </h3>
              <button
                className="btn btn-ghost"
                style={{ padding: '4px' }}
                onClick={() => {
                  setSelectedOrder(null);
                  setSelectedCreditNote(null);
                }}
              >
                ✕
              </button>
            </div>

            {/* Datos Informativos */}
            <div style={{ fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.6', backgroundColor: 'var(--bg-light)', padding: '12px', borderRadius: '6px' }}>
              {selectedOrder && (
                <>
                  <p style={{ margin: '4px 0' }}><strong>Fecha Emisión:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString('es-AR')} {new Date(selectedOrder.createdAt).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</p>
                  <p style={{ margin: '4px 0' }}><strong>Tipo Emisión:</strong> {selectedOrder.billingType === 'AFIP' ? 'Comprobante Oficial AFIP' : 'Interno / Presupuesto'}</p>
                  {selectedOrder.cae && <p style={{ margin: '4px 0' }}><strong>CAE:</strong> {selectedOrder.cae} (Vence: {new Date(selectedOrder.caeDueDate).toLocaleDateString('es-AR')})</p>}
                </>
              )}
              {selectedCreditNote && (
                <>
                  <p style={{ margin: '4px 0' }}><strong>Fecha Emisión:</strong> {new Date(selectedCreditNote.createdAt).toLocaleDateString('es-AR')} {new Date(selectedCreditNote.createdAt).toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})}</p>
                  <p style={{ margin: '4px 0' }}><strong>Motivo:</strong> {selectedCreditNote.reason === 'DEVOLUCION' ? 'Devolución de mercadería' : selectedCreditNote.reason === 'DESCUENTO' ? 'Descuento / Bonificación' : 'Error de Facturación'}</p>
                  {selectedCreditNote.comments && <p style={{ margin: '4px 0' }}><strong>Observaciones:</strong> {selectedCreditNote.comments}</p>}
                  {selectedCreditNote.cae && <p style={{ margin: '4px 0' }}><strong>CAE:</strong> {selectedCreditNote.cae}</p>}
                </>
              )}
            </div>

            {/* Tabla de Artículos */}
            <div style={{ maxHeight: '250px', overflowY: 'auto', marginBottom: '20px', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid var(--border-color)' }}>
                    <th style={{ padding: '10px', textAlign: 'left' }}>Artículo</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Cant.</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>P. Unit</th>
                    <th style={{ padding: '10px', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {(selectedOrder?.items || selectedCreditNote?.items || []).map((item: any, idx: number) => {
                    const price = Number(item.unitPrice ?? item.price ?? 0);
                    const subtotal = Number(item.subtotal ?? 0);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px' }}>{item.product?.name || `Producto #${item.productId}`}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>{item.quantity} {item.weight ? `(${Number(item.weight).toFixed(1)} kg)` : 'u.'}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>${Math.round(price).toLocaleString('es-AR')}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>${Math.round(subtotal).toLocaleString('es-AR')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Desglose de Totales */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              {selectedOrder && selectedOrder.billingType === 'AFIP' && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Neto: ${Math.round(Number(selectedOrder.netAmount)).toLocaleString('es-AR')}</span>
                  <span style={{ marginLeft: '12px' }}>IVA: ${Math.round(Number(selectedOrder.taxAmount)).toLocaleString('es-AR')}</span>
                </div>
              )}
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>
                Total: ${Math.round(Number(selectedOrder?.totalAmount || selectedCreditNote?.totalAmount || 0)).toLocaleString('es-AR')}
              </div>
            </div>

            {/* Botón de cierre */}
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button
                className="btn btn-primary"
                onClick={() => {
                  setSelectedOrder(null);
                  setSelectedCreditNote(null);
                }}
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Styles for print mode */}
      <style>{`
        .print-only {
          display: none;
        }
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
          .print-only {
            display: inline !important;
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

