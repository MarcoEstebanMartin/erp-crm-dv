import React from 'react';
import { Trash2, X } from 'lucide-react';
import { NativeModalDialog } from './NativeModalDialog';

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
  onStartCreditNote?: (order: any) => void;
  startingCreditNote?: boolean;
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
  onStartCreditNote,
  startingCreditNote = false,
}) => {
  const canEmitCreditNote = Boolean(
    selectedOrder &&
      isAdminOrFacturacion &&
      onStartCreditNote &&
      selectedOrder.status !== 'CANCELLED' &&
      (selectedOrder.billingType !== 'OFFICIAL' || Boolean(selectedOrder.cae)),
  );
  return (
    <>
      {selectedOrder && (
        <NativeModalDialog isOpen={true} onClose={() => setSelectedOrder(null)} ariaLabel="Detalle de factura" className="no-print" style={{ maxWidth: '600px', width: '92vw', padding: '22px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Factura {selectedOrder.invoiceNumber || `INT-${selectedOrder.id.toString().padStart(5, '0')}`}</h3>
            <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '4px' }} onClick={() => setSelectedOrder(null)}><X size={18} /></button>
          </div>
          <div style={{ fontSize: '0.84rem', marginBottom: '14px', lineHeight: '1.6', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
            <p className="tabular-nums" style={{ margin: '3px 0' }}><strong>Movimiento:</strong> {selectedOrder.movementId || '-'}</p>
            <p className="tabular-nums" style={{ margin: '3px 0' }}><strong>Operación:</strong> {selectedOrder.id}</p>
            <p className="tabular-nums" style={{ margin: '3px 0' }}><strong>Fecha:</strong> {new Date(selectedOrder.createdAt).toLocaleString('es-AR')}</p>
            <p style={{ margin: '3px 0' }}><strong>Tipo:</strong> {selectedOrder.billingType === 'AFIP' || selectedOrder.billingType === 'OFFICIAL' ? 'Oficial AFIP' : 'Interno'}</p>
            {selectedOrder.cae && <p className="tabular-nums" style={{ margin: '3px 0' }}><strong>CAE:</strong> {selectedOrder.cae} · Vence {new Date(selectedOrder.caeDueDate).toLocaleDateString('es-AR')}</p>}
          </div>
          <div className="table-container" style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid var(--border-color)' }}>
                  <th scope="col" style={{ padding: '9px', textAlign: 'left' }}>Artículo</th>
                  <th scope="col" style={{ padding: '9px', textAlign: 'right' }}>Cant.</th>
                  <th scope="col" style={{ padding: '9px', textAlign: 'right' }}>P. Unit</th>
                  <th scope="col" style={{ padding: '9px', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(selectedOrder.items || []).map((item: any, idx: number) => {
                  const price = Number(item.unitPrice ?? item.price ?? 0);
                  const subtotal = Number(item.subtotal ?? 0);
                  return (
                    <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                      <td style={{ padding: '9px' }}>{item.product?.name || `#${item.productId}`}</td>
                      <td className="tabular-nums" style={{ padding: '9px', textAlign: 'right' }}>{item.quantity} {item.weight ? `(${Number(item.weight).toFixed(2)} kg)` : 'u.'}</td>
                      <td className="tabular-nums" style={{ padding: '9px', textAlign: 'right' }}>${Math.round(price).toLocaleString('es-AR')}</td>
                      <td className="tabular-nums" style={{ padding: '9px', textAlign: 'right' }}>${Math.round(subtotal).toLocaleString('es-AR')}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="tabular-nums" style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px', borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            {(selectedOrder.billingType === 'AFIP' || selectedOrder.billingType === 'OFFICIAL') && (
              <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                <span>Neto: ${Math.round(Number(selectedOrder.netAmount)).toLocaleString('es-AR')}</span>
                <span style={{ marginLeft: '12px' }}>IVA: ${Math.round(Number(selectedOrder.taxAmount)).toLocaleString('es-AR')}</span>
              </div>
            )}
            <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>Total: ${Math.round(Number(selectedOrder.totalAmount)).toLocaleString('es-AR')}</div>
          </div>
          <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
            {canEmitCreditNote && (
              <button
                type="button"
                className="btn btn-primary"
                disabled={startingCreditNote}
                onClick={() => onStartCreditNote?.(selectedOrder)}
              >
                {startingCreditNote ? 'Preparando...' : 'Emitir NC'}
              </button>
            )}
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Cerrar</button>
          </div>
        </NativeModalDialog>
      )}

      {selectedCreditNote && (
        <NativeModalDialog isOpen={true} onClose={() => setSelectedCreditNote(null)} ariaLabel="Detalle de nota de crédito" className="no-print" style={{ maxWidth: '600px', width: '92vw', padding: '22px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Nota de Crédito {selectedCreditNote.creditNoteNumber || `INT-${selectedCreditNote.id.toString().padStart(5, '0')}`}</h3>
            <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '4px' }} onClick={() => setSelectedCreditNote(null)}><X size={18} /></button>
          </div>
          <div style={{ fontSize: '0.84rem', marginBottom: '14px', lineHeight: '1.6', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
            <p className="tabular-nums" style={{ margin: '3px 0' }}><strong>Movimiento:</strong> {selectedCreditNote.movementId || '-'}</p>
            <p className="tabular-nums" style={{ margin: '3px 0' }}><strong>Fecha:</strong> {new Date(selectedCreditNote.createdAt).toLocaleString('es-AR')}</p>
            <p style={{ margin: '3px 0' }}><strong>Motivo:</strong> {selectedCreditNote.reason === 'DEVOLUCION' ? 'Devolución' : selectedCreditNote.reason === 'DESCUENTO' ? 'Bonificación' : 'Error de facturación'}</p>
            {selectedCreditNote.comments && <p style={{ margin: '3px 0' }}><strong>Notas:</strong> {selectedCreditNote.comments}</p>}
            {selectedCreditNote.cae && <p className="tabular-nums" style={{ margin: '3px 0' }}><strong>CAE:</strong> {selectedCreditNote.cae}</p>}
          </div>
          <div className="table-container" style={{ maxHeight: '240px', overflowY: 'auto', marginBottom: '16px' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ backgroundColor: '#f9f9f9', borderBottom: '1px solid var(--border-color)' }}>
                  <th scope="col" style={{ padding: '9px', textAlign: 'left' }}>Artículo</th>
                  <th scope="col" style={{ padding: '9px', textAlign: 'right' }}>Cant.</th>
                  <th scope="col" style={{ padding: '9px', textAlign: 'right' }}>P. Unit</th>
                  <th scope="col" style={{ padding: '9px', textAlign: 'right' }}>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(selectedCreditNote.items || []).map((item: any, idx: number) => (
                  <tr key={idx} style={{ borderBottom: '1px solid #f3f4f6' }}>
                    <td style={{ padding: '9px' }}>{item.product?.name || `#${item.productId}`}</td>
                    <td className="tabular-nums" style={{ padding: '9px', textAlign: 'right' }}>{item.quantity} {item.weight ? `(${Number(item.weight).toFixed(2)} kg)` : 'u.'}</td>
                    <td className="tabular-nums" style={{ padding: '9px', textAlign: 'right' }}>${Math.round(Number(item.unitPrice ?? item.price ?? 0)).toLocaleString('es-AR')}</td>
                    <td className="tabular-nums" style={{ padding: '9px', textAlign: 'right' }}>${Math.round(Number(item.subtotal ?? 0)).toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'flex-end', fontSize: '1.15rem', fontWeight: 700, borderTop: '1px solid var(--border-color)', paddingTop: '10px' }}>
            Total: ${Math.round(Number(selectedCreditNote.totalAmount)).toLocaleString('es-AR')}
          </div>
          <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedCreditNote(null)}>Cerrar</button>
          </div>
        </NativeModalDialog>
      )}

      {selectedTransaction && (
        <NativeModalDialog isOpen={true} onClose={() => setSelectedTransaction(null)} ariaLabel="Detalle de movimiento" className="no-print" style={{ maxWidth: '500px', width: '92vw', padding: '22px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>{selectedTransaction.type === 'INCOME' ? 'Recibo' : 'Pago'}</h3>
            <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '4px' }} onClick={() => setSelectedTransaction(null)}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}><span style={{ color: 'var(--text-secondary)' }}>Movimiento</span><strong className="tabular-nums">{selectedTransaction.movementId || '-'}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
              <span style={{ color: 'var(--text-secondary)' }}>Comprobante</span>
              <strong className="tabular-nums">
                {selectedTransaction.receiptNumber ||
                  (selectedTransaction.movementId
                    ? `REC-${String(selectedTransaction.movementId).padStart(5, '0')}`
                    : `REC-${String(selectedTransaction.id).padStart(5, '0')}`)}
              </strong>
            </div>
            {(selectedTransaction.user?.employee || selectedTransaction.user?.username) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)' }}>Cobrado por</span>
                <strong>
                  {selectedTransaction.user?.employee
                    ? `${selectedTransaction.user.employee.firstName || ''} ${selectedTransaction.user.employee.lastName || ''}`.trim() || selectedTransaction.user.username
                    : selectedTransaction.user.username}
                </strong>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}><span style={{ color: 'var(--text-secondary)' }}>Fecha</span><span className="tabular-nums">{new Date(selectedTransaction.createdAt).toLocaleString('es-AR')}</span></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}><span style={{ color: 'var(--text-secondary)' }}>Método</span><span className="badge badge-secondary" style={{ fontWeight: 600 }}>{selectedTransaction.paymentMethod === 'CASH' ? 'Efectivo' : selectedTransaction.paymentMethod === 'CHECK' ? 'Cheque' : selectedTransaction.paymentMethod === 'BANK_TRANSFER' ? 'Transferencia' : selectedTransaction.paymentMethod}</span></div>
            {selectedTransaction.description && (
              <div style={{ borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}>
                <span style={{ color: 'var(--text-secondary)', display: 'block', marginBottom: '2px' }}>Notas</span>
                <p style={{ margin: 0, fontSize: '0.84rem', backgroundColor: '#f8fafc', padding: '8px', borderRadius: '4px' }}>{selectedTransaction.description}</p>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '1.15rem' }}>
              <strong>Monto</strong>
              <strong className="tabular-nums" style={{ color: 'var(--color-success)' }}>${Math.round(Number(selectedTransaction.amount)).toLocaleString('es-AR')}</strong>
            </div>
          </div>
          <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
            {isAdminOrFacturacion && selectedTransaction.type === 'INCOME' ? (
              <button type="button" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', color: '#DC2626', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', padding: '7px 12px', borderRadius: '6px', fontWeight: 600, cursor: 'pointer', fontSize: '0.84rem' }} onClick={() => onDeleteReceipt(selectedTransaction.id, selectedTransaction.receiptNumber || `REC-${selectedTransaction.id}`, Number(selectedTransaction.amount))}>
                <Trash2 size={15} /> Anular recibo
              </button>
            ) : <div />}
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedTransaction(null)}>Cerrar</button>
          </div>
        </NativeModalDialog>
      )}

      {selectedWithholding && (
        <NativeModalDialog isOpen={true} onClose={() => setSelectedWithholding(null)} ariaLabel="Detalle de retención" className="no-print" style={{ maxWidth: '400px', width: '92vw', padding: '22px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '1.05rem' }}>Retención</h3>
            <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '4px' }} onClick={() => setSelectedWithholding(null)}><X size={18} /></button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', fontSize: '0.88rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}><span style={{ color: 'var(--text-secondary)' }}>Impuesto</span><strong>{selectedWithholding.taxType === 'IIBB' ? 'IIBB' : 'Ganancias'}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f3f4f6', paddingBottom: '6px' }}><span style={{ color: 'var(--text-secondary)' }}>Certificado</span><strong className="tabular-nums">{selectedWithholding.number}</strong></div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '6px', fontSize: '1.15rem' }}>
              <strong>Monto</strong>
              <strong className="tabular-nums" style={{ color: 'var(--color-success)' }}>${Number(selectedWithholding.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</strong>
            </div>
          </div>
          <div style={{ marginTop: '18px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setSelectedWithholding(null)}>Cerrar</button>
          </div>
        </NativeModalDialog>
      )}
    </>
  );
};
