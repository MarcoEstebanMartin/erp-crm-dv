import React from 'react';
import { Trash2 } from 'lucide-react';

interface ResumenCuentaDetailModalsProps {
  selectedOrder: any | null;
  setSelectedOrder: (o: any | null) => void;
  selectedCreditNote: any | null;
  setSelectedCreditNote: (cn: any | null) => void;
  selectedTransaction: any | null;
  setSelectedTransaction: (tx: any | null) => void;
  selectedWithholding: any | null;
  setSelectedWithholding: (w: any | null) => void;
  isAdminOrFacturacion: boolean;
  onDeleteReceipt: (txId: number, receiptDesc: string, creditAmount: number) => void;
}

export const ResumenCuentaDetailModals: React.FC<ResumenCuentaDetailModalsProps> = ({
  selectedOrder,
  setSelectedOrder,
  selectedCreditNote,
  setSelectedCreditNote,
  selectedTransaction,
  setSelectedTransaction,
  selectedWithholding,
  setSelectedWithholding,
  isAdminOrFacturacion,
  onDeleteReceipt,
}) => {
  return (
    <>
      {selectedOrder && (
        <div className="modal-overlay no-print" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%', padding: '24px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Factura {selectedOrder.invoiceNumber || `INT-${selectedOrder.id.toString().padStart(5, '0')}`}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSelectedOrder(null)}>✕</button>
            </div>
            <div style={{ fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.6', backgroundColor: 'var(--bg-light)', padding: '12px', borderRadius: '6px' }}>
              <p style={{ margin: '4px 0' }}><strong>ID Movimiento:</strong> {selectedOrder.movementId || '-'}</p>
              <p style={{ margin: '4px 0' }}><strong>ID Operación Interna:</strong> {selectedOrder.id}</p>
              <p style={{ margin: '4px 0' }}><strong>Fecha Emisión:</strong> {new Date(selectedOrder.createdAt).toLocaleString('es-AR')}</p>
              <p style={{ margin: '4px 0' }}><strong>Tipo Emisión:</strong> {selectedOrder.billingType === 'AFIP' || selectedOrder.billingType === 'OFFICIAL' ? 'Comprobante Oficial AFIP' : 'Interno / Presupuesto'}</p>
              {selectedOrder.cae && <p style={{ margin: '4px 0' }}><strong>CAE:</strong> {selectedOrder.cae} (Vence: {new Date(selectedOrder.caeDueDate).toLocaleDateString('es-AR')})</p>}
            </div>
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
                  {(selectedOrder.items || []).map((item: any, idx: number) => {
                    const price = Number(item.unitPrice ?? item.price ?? 0);
                    const subtotal = Number(item.subtotal ?? 0);
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                        <td style={{ padding: '10px' }}>{item.product?.name || `Producto #${item.productId}`}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>{item.quantity} {item.weight ? `(${Number(item.weight).toFixed(2)} kg)` : 'u.'}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>${Math.round(price).toLocaleString('es-AR')}</td>
                        <td style={{ padding: '10px', textAlign: 'right' }}>${Math.round(subtotal).toLocaleString('es-AR')}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              {(selectedOrder.billingType === 'AFIP' || selectedOrder.billingType === 'OFFICIAL') && (
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                  <span>Neto: ${Math.round(Number(selectedOrder.netAmount)).toLocaleString('es-AR')}</span>
                  <span style={{ marginLeft: '12px' }}>IVA: ${Math.round(Number(selectedOrder.taxAmount)).toLocaleString('es-AR')}</span>
                </div>
              )}
              <div style={{ fontSize: '1.2rem', fontWeight: 'bold' }}>Total: ${Math.round(Number(selectedOrder.totalAmount)).toLocaleString('es-AR')}</div>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setSelectedOrder(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {selectedCreditNote && (
        <div className="modal-overlay no-print" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '600px', width: '90%', padding: '24px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Nota de Crédito {selectedCreditNote.creditNoteNumber || `INT-${selectedCreditNote.id.toString().padStart(5, '0')}`}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSelectedCreditNote(null)}>✕</button>
            </div>
            <div style={{ fontSize: '0.85rem', marginBottom: '16px', lineHeight: '1.6', backgroundColor: 'var(--bg-light)', padding: '12px', borderRadius: '6px' }}>
              <p style={{ margin: '4px 0' }}><strong>ID Movimiento:</strong> {selectedCreditNote.movementId || '-'}</p>
              <p style={{ margin: '4px 0' }}><strong>Fecha Emisión:</strong> {new Date(selectedCreditNote.createdAt).toLocaleString('es-AR')}</p>
              <p style={{ margin: '4px 0' }}><strong>Motivo:</strong> {selectedCreditNote.reason === 'DEVOLUCION' ? 'Devolución de mercadería' : selectedCreditNote.reason === 'DESCUENTO' ? 'Descuento / Bonificación' : 'Error de Facturación'}</p>
              {selectedCreditNote.comments && <p style={{ margin: '4px 0' }}><strong>Observaciones:</strong> {selectedCreditNote.comments}</p>}
              {selectedCreditNote.cae && <p style={{ margin: '4px 0' }}><strong>CAE:</strong> {selectedCreditNote.cae}</p>}
            </div>
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
                  {(selectedCreditNote.items || []).map((item: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '10px' }}>{item.product?.name || `Producto #${item.productId}`}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>{item.quantity} {item.weight ? `(${Number(item.weight).toFixed(2)} kg)` : 'u.'}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>${Math.round(Number(item.unitPrice ?? item.price ?? 0)).toLocaleString('es-AR')}</td>
                      <td style={{ padding: '10px', textAlign: 'right' }}>${Math.round(Number(item.subtotal ?? 0)).toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '1.2rem', fontWeight: 'bold', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
              Total: ${Math.round(Number(selectedCreditNote.totalAmount)).toLocaleString('es-AR')}
            </div>
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setSelectedCreditNote(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {selectedTransaction && (
        <div className="modal-overlay no-print" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '500px', width: '90%', padding: '24px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>{selectedTransaction.type === 'INCOME' ? 'Detalle de Recibo' : 'Detalle de Pago'}</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSelectedTransaction(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}><span style={{ color: 'var(--text-secondary)' }}>ID Movimiento:</span><strong>{selectedTransaction.movementId || '-'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}><span style={{ color: 'var(--text-secondary)' }}>Número de Recibo:</span><strong>{selectedTransaction.receiptNumber || `INT-${selectedTransaction.id.toString().padStart(5, '0')}`}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}><span style={{ color: 'var(--text-secondary)' }}>Fecha / Hora:</span><span>{new Date(selectedTransaction.createdAt).toLocaleString('es-AR')}</span></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}><span style={{ color: 'var(--text-secondary)' }}>Método de Pago:</span><span className="badge badge-secondary" style={{ fontWeight: 600 }}>{selectedTransaction.paymentMethod === 'CASH' ? 'EFECTIVO' : selectedTransaction.paymentMethod === 'CHECK' ? 'CHEQUE' : selectedTransaction.paymentMethod === 'BANK_TRANSFER' ? 'TRANSFERENCIA' : selectedTransaction.paymentMethod}</span></div>
              {selectedTransaction.description && (
                <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
                  <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Observaciones:</span>
                  <p style={{ margin: 0, fontSize: '0.85rem', backgroundColor: 'var(--bg-light)', padding: '8px', borderRadius: '4px' }}>{selectedTransaction.description}</p>
                </div>
              )}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '1.2rem' }}>
                <strong>Monto Total:</strong>
                <strong style={{ color: 'var(--color-success)' }}>${Math.round(Number(selectedTransaction.amount)).toLocaleString('es-AR')}</strong>
              </div>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
              {isAdminOrFacturacion && selectedTransaction.type === 'INCOME' ? (
                <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#DC2626', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '8px 14px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.85rem' }} onClick={() => onDeleteReceipt(selectedTransaction.id, selectedTransaction.receiptNumber || `REC-${selectedTransaction.id}`, Number(selectedTransaction.amount))}>
                  <Trash2 size={16} /> Anular / Eliminar Recibo
                </button>
              ) : <div />}
              <button className="btn btn-primary" onClick={() => setSelectedTransaction(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {selectedWithholding && (
        <div className="modal-overlay no-print" style={{ zIndex: 1100 }}>
          <div className="modal-content" style={{ maxWidth: '400px', width: '90%', padding: '24px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0 }}>Detalle de Retención</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSelectedWithholding(null)}>✕</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.9rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}><span style={{ color: 'var(--text-secondary)' }}>Tipo de Impuesto:</span><strong>{selectedWithholding.taxType === 'IIBB' ? 'Ingresos Brutos (IIBB)' : 'Ganancias'}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}><span style={{ color: 'var(--text-secondary)' }}>Número Certificado:</span><strong>{selectedWithholding.number}</strong></div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '10px', fontSize: '1.2rem' }}>
                <strong>Monto Retenido:</strong>
                <strong style={{ color: 'var(--color-success)' }}>${Number(selectedWithholding.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
              </div>
            </div>
            <div style={{ marginTop: '24px', display: 'flex', justifyContent: 'flex-end' }}>
              <button className="btn btn-primary" onClick={() => setSelectedWithholding(null)}>Cerrar</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
