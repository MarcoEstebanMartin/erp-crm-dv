import React from 'react';
import { AlertCircle, FileText, Lock, Landmark } from 'lucide-react';
import { formatResponsibleName } from '../../utils/formatters';

export const FinanzasExpenseModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  expenseAmount: string;
  setExpenseAmount: (v: string) => void;
  expenseDescription: string;
  setExpenseDescription: (v: string) => void;
  expensePaymentMethod: string;
  setExpensePaymentMethod: (v: string) => void;
  expenseBillingType: string;
  setExpenseBillingType: (v: string) => void;
  modalError: string | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}> = ({
  isOpen, onClose, expenseAmount, setExpenseAmount, expenseDescription, setExpenseDescription,
  expensePaymentMethod, setExpensePaymentMethod, expenseBillingType, setExpenseBillingType,
  modalError, submitting, onSubmit,
}) => {
  if (!isOpen) return null;
  return (
    <div className="modal-overlay" onClick={() => !submitting && onClose()}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '450px', padding: '24px' }}>
        <div className="modal-header" style={{ marginBottom: '16px' }}>
          <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Registrar Gasto / Egreso</h3>
          <button type="button" className="btn btn-ghost" onClick={onClose} disabled={submitting}>✕</button>
        </div>
        {modalError && <div style={{ padding: '10px 12px', backgroundColor: '#fff5f5', color: '#c53030', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}><AlertCircle size={16} /><span>{modalError}</span></div>}
        <form onSubmit={onSubmit}>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Monto del Gasto ($)</label>
            <input type="number" className="input" required min="0.01" step="0.01" autoFocus placeholder="0.00" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} style={{ fontSize: '1.15rem', fontFamily: 'monospace', width: '100%' }} />
          </div>
          <div className="form-group" style={{ marginBottom: '14px' }}>
            <label style={{ fontWeight: 500, fontSize: '0.85rem', marginBottom: '6px', display: 'block' }}>Concepto / Descripción</label>
            <input type="text" className="input" required placeholder="Ej: Flete Villegas, Artículos de oficina..." value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} style={{ width: '100%' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
            <div>
              <label style={{ fontWeight: 500, fontSize: '0.82rem', marginBottom: '4px', display: 'block' }}>Medio de Pago</label>
              <select className="select" value={expensePaymentMethod} onChange={(e) => setExpensePaymentMethod(e.target.value)}>
                <option value="CASH">Efectivo</option>
                <option value="CHECK">Cheque</option>
                <option value="BANK_TRANSFER">Transferencia</option>
              </select>
            </div>
            <div>
              <label style={{ fontWeight: 500, fontSize: '0.82rem', marginBottom: '4px', display: 'block' }}>Sucursal</label>
              <select className="select" value={expenseBillingType} onChange={(e) => setExpenseBillingType(e.target.value)}>
                <option value="INTERNAL">Sucursal X</option>
                <option value="OFFICIAL">Sucursal A</option>
              </select>
            </div>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
            <button type="submit" className="btn btn-primary" disabled={submitting} style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)' }}>{submitting ? 'Guardando...' : 'Confirmar Gasto'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export const FinanzasDrawerInspectModal: React.FC<{ inspectingDrawer: any | null; onClose: () => void }> = ({ inspectingDrawer, onClose }) => {
  if (!inspectingDrawer) return null;
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" style={{ maxWidth: '850px', width: '95%', padding: '24px', borderRadius: '12px', maxHeight: '90vh', overflowY: 'auto' }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} color="var(--color-corp-red)" /> Cierre de Caja — {formatResponsibleName(inspectingDrawer)}
            </h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              {new Date(inspectingDrawer.closedAt || inspectingDrawer.openedAt).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' })}
            </p>
          </div>
          <button type="button" className="btn btn-ghost" onClick={onClose}>✕</button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '18px' }}>
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>TOTAL RENDIDO</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#047857', fontFamily: 'monospace' }}>+${Math.round(Number(inspectingDrawer.realBalance || inspectingDrawer.closingBalance || 0)).toLocaleString('es-AR')}</div>
          </div>
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>FONDO INICIAL</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, fontFamily: 'monospace' }}>${Math.round(Number(inspectingDrawer.openingBalance || 0)).toLocaleString('es-AR')}</div>
          </div>
          <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 600 }}>COMPROBANTES</span>
            <div style={{ fontSize: '1.2rem', fontWeight: 700, color: '#1e40af', fontFamily: 'monospace' }}>{inspectingDrawer.transactions?.length || 0} Recibos</div>
          </div>
        </div>

        {!inspectingDrawer.transactions?.length ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Sin recibos adjuntos.</div>
        ) : (
          <div className="table-responsive card">
            <table className="table" style={{ width: '100%', fontSize: '0.84rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '8px' }}>Fecha</th>
                  <th style={{ padding: '8px' }}>Recibo</th>
                  <th style={{ padding: '8px' }}>Cliente</th>
                  <th style={{ padding: '8px' }}>Medio</th>
                  <th style={{ padding: '8px', textAlign: 'right' }}>Monto</th>
                </tr>
              </thead>
              <tbody>
                {inspectingDrawer.transactions.map((t: any) => (
                  <tr key={t.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '8px', fontSize: '0.78rem' }}>{new Date(t.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td style={{ padding: '8px', fontWeight: 600 }}>{t.receiptNumber || `Pedido #${t.orderId || 'S/N'}`}</td>
                    <td style={{ padding: '8px' }}>{t.persona?.name || 'Cliente Varios'}</td>
                    <td style={{ padding: '8px' }}>{t.paymentMethod === 'CASH' ? 'Efectivo' : t.paymentMethod === 'CHECK' ? 'Cheque' : 'Transferencia'}</td>
                    <td style={{ padding: '8px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#047857' }}>+${Math.round(Number(t.amount)).toLocaleString('es-AR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export const FinanzasCentralCloseAndBankModals: React.FC<{
  centralCloseOpen: boolean;
  onCloseCentral: () => void;
  cajaGrandeBalance: number;
  realBalance: string;
  setRealBalance: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  modalError: string | null;
  submittingCentral: boolean;
  onSubmitCentral: (e: React.FormEvent) => void;
  editBankOpen: boolean;
  onCloseEditBank: () => void;
  bankName: string;
  setBankName: (v: string) => void;
  bankAccountNumber: string;
  setBankAccountNumber: (v: string) => void;
  submittingBank: boolean;
  onSubmitBank: (e: React.FormEvent) => void;
}> = (props) => {
  return (
    <>
      {props.centralCloseOpen && (
        <div className="modal-overlay" onClick={props.onCloseCentral}>
          <div className="modal-content" style={{ maxWidth: '460px', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-header" style={{ marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Lock size={18} color="var(--color-corp-red)" /> Cierre de Caja Grande</h3>
              <button type="button" className="btn btn-ghost" onClick={props.onCloseCentral}>✕</button>
            </div>
            {props.modalError && <div style={{ backgroundColor: '#fff5f5', color: '#c53030', padding: '10px', borderRadius: '6px', fontSize: '0.84rem', marginBottom: '12px' }}>{props.modalError}</div>}
            <form onSubmit={props.onSubmitCentral}>
              <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Saldo Acumulado Actual</div>
                <div style={{ fontSize: '1.6rem', fontWeight: 700, color: '#047857', fontFamily: 'monospace' }}>${Math.round(props.cajaGrandeBalance).toLocaleString('es-AR')}</div>
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.84rem' }}>Efectivo Real Inicial del Nuevo Ciclo ($)</label>
                <input type="number" className="input" value={props.realBalance} onChange={(e) => props.setRealBalance(e.target.value)} required />
              </div>
              <div className="form-group">
                <label style={{ fontWeight: 600, fontSize: '0.84rem' }}>Observaciones</label>
                <input type="text" className="input" value={props.notes} onChange={(e) => props.setNotes(e.target.value)} placeholder="Ej: Cierre mensual" />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={props.onCloseCentral}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)' }} disabled={props.submittingCentral}>Confirmar Cierre</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {props.editBankOpen && (
        <div className="modal-overlay" onClick={props.onCloseEditBank}>
          <div className="modal-content" style={{ maxWidth: '440px', padding: '24px' }} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 14px 0', fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}><Landmark size={18} /> Editar Cuenta Bancaria</h3>
            <form onSubmit={props.onSubmitBank}>
              <div className="form-group">
                <label>Nombre de la Cuenta</label>
                <input type="text" className="input" value={props.bankName} onChange={(e) => props.setBankName(e.target.value)} required />
              </div>
              <div className="form-group">
                <label>Número de Cuenta / CBU / Alias</label>
                <input type="text" className="input" value={props.bankAccountNumber} onChange={(e) => props.setBankAccountNumber(e.target.value)} />
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={props.onCloseEditBank}>Cancelar</button>
                <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }} disabled={props.submittingBank}>Guardar</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
};
