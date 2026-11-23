import React from 'react';
import { AlertCircle, FileText, Lock, Landmark, X } from 'lucide-react';
import { formatResponsibleName } from '../../utils/formatters';
import { NativeModalDialog } from '../modals/NativeModalDialog';

export const FinanzasExpenseModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  expenseAmount: string;
  setExpenseAmount: (v: string) => void;
  expenseDescription: string;
  setExpenseDescription: (v: string) => void;
  expenseCashSource: 'CAJA_GRANDE' | 'CAJA_OFICINA';
  setExpenseCashSource: (v: 'CAJA_GRANDE' | 'CAJA_OFICINA') => void;
  expensePaymentMethod: string;
  setExpensePaymentMethod: (v: string) => void;
  expenseBillingType: string;
  setExpenseBillingType: (v: string) => void;
  modalError: string | null;
  submitting: boolean;
  onSubmit: (e: React.FormEvent) => void;
}> = ({
  isOpen, onClose, expenseAmount, setExpenseAmount, expenseDescription, setExpenseDescription,
  expenseCashSource, setExpenseCashSource,
  expensePaymentMethod, setExpensePaymentMethod, expenseBillingType, setExpenseBillingType,
  modalError, submitting, onSubmit,
}) => (
  <NativeModalDialog
    isOpen={isOpen}
    onClose={() => !submitting && onClose()}
    ariaLabelledBy="fin-expense-modal-title"
    closeOnBackdrop={!submitting}
    style={{ maxWidth: '450px', width: '92vw', padding: '24px' }}
  >
    <div className="modal-header" style={{ marginBottom: '16px' }}>
      <h3 id="fin-expense-modal-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Registrar Gasto</h3>
      <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} disabled={submitting} aria-label="Cerrar">
        <X size={18} aria-hidden="true" />
      </button>
    </div>
    {modalError && (
      <div role="alert" style={{ padding: '10px 12px', backgroundColor: '#fff5f5', color: '#c53030', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <AlertCircle size={16} aria-hidden="true" />
        <span>{modalError}</span>
      </div>
    )}
    <form onSubmit={onSubmit}>
      <div className="form-group" style={{ marginBottom: '14px' }}>
        <label htmlFor="fin-expense-amount">Monto ($)</label>
        <input id="fin-expense-amount" type="number" className="input tabular-nums" required min="0.01" step="0.01" autoFocus placeholder="0.00" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} style={{ fontSize: '1.15rem', fontFamily: 'monospace' }} />
      </div>
      <div className="form-group" style={{ marginBottom: '14px' }}>
        <label htmlFor="fin-expense-description">Concepto</label>
        <input id="fin-expense-description" type="text" className="input" required placeholder="Concepto del gasto" value={expenseDescription} onChange={(e) => setExpenseDescription(e.target.value)} />
      </div>
      <div className="form-group" style={{ marginBottom: '14px' }}>
        <label htmlFor="fin-expense-source">Caja</label>
        <select
          id="fin-expense-source"
          className="select"
          value={expenseCashSource}
          onChange={(e) => setExpenseCashSource(e.target.value as 'CAJA_GRANDE' | 'CAJA_OFICINA')}
        >
          <option value="CAJA_GRANDE">Caja Grande</option>
          <option value="CAJA_OFICINA">Caja Oficina</option>
        </select>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '20px' }}>
        <div>
          <label htmlFor="fin-expense-method" style={{ display: 'block', marginBottom: '4px' }}>Medio de Pago</label>
          <select id="fin-expense-method" className="select" value={expensePaymentMethod} onChange={(e) => setExpensePaymentMethod(e.target.value)}>
            <option value="CASH">Efectivo</option>
            <option value="CHECK">Cheque</option>
            <option value="BANK_TRANSFER">Transferencia</option>
          </select>
        </div>
        <div>
          <label htmlFor="fin-expense-branch" style={{ display: 'block', marginBottom: '4px' }}>Sucursal</label>
          <select id="fin-expense-branch" className="select" value={expenseBillingType} onChange={(e) => setExpenseBillingType(e.target.value)}>
            <option value="INTERNAL">Sucursal X</option>
            <option value="OFFICIAL">Sucursal A</option>
          </select>
        </div>
      </div>
      <div className="modal-footer">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submitting}>Cancelar</button>
        <button type="submit" className="btn btn-primary" disabled={submitting} style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)' }}>
          {submitting ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  </NativeModalDialog>
);

export const FinanzasDrawerInspectModal: React.FC<{ inspectingDrawer: any | null; onClose: () => void }> = ({ inspectingDrawer, onClose }) => {
  const isCentral = Boolean(inspectingDrawer && (inspectingDrawer.drawerType === 'CENTRAL' || inspectingDrawer.branch === 'CENTRAL' || inspectingDrawer.branch === 'CONSOLIDADA'));
  const openingBal = Number(inspectingDrawer?.openingBalance ?? 0);
  const realBal = Number(inspectingDrawer?.realBalance ?? inspectingDrawer?.closingBalance ?? 0);
  const diffBal = realBal - openingBal;
  const formatPesos = (v: number) => `${v < 0 ? '-' : ''}$${Math.round(Math.abs(v)).toLocaleString('es-AR')}`;

  const summaryCards = isCentral
    ? [
        { label: 'Saldo Declarado', value: formatPesos(realBal), color: realBal < 0 ? '#c53030' : 'var(--text-primary)' },
        { label: 'Saldo Anterior', value: formatPesos(openingBal), color: openingBal < 0 ? '#c53030' : 'var(--text-primary)' },
        { label: 'Diferencia de Arqueo', value: diffBal > 0 ? `+${formatPesos(diffBal)}` : formatPesos(diffBal), color: diffBal === 0 ? 'var(--text-secondary)' : '#b45309' },
      ]
    : [
        { label: 'Total Rendido', value: `+${formatPesos(realBal)}`, color: '#047857' },
        { label: 'Fondo Inicial', value: formatPesos(openingBal), color: 'var(--text-primary)' },
        { label: 'Comprobantes', value: `${inspectingDrawer?.transactions?.length || 0} Recibos`, color: '#1e40af' },
      ];

  return (
    <NativeModalDialog isOpen={Boolean(inspectingDrawer)} onClose={onClose} ariaLabelledBy="fin-inspect-drawer-title" style={{ maxWidth: '850px', width: '95vw', padding: '24px', maxHeight: '90vh', overflowY: 'auto' }}>
      {inspectingDrawer && (
        <>
          <div className="modal-header" style={{ marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
            <div>
              <h3 id="fin-inspect-drawer-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="var(--color-corp-red)" aria-hidden="true" />
                {isCentral ? 'Cierre de Caja Grande' : `Cierre de Caja — ${formatResponsibleName(inspectingDrawer)}`}
              </h3>
              <div style={{ marginTop: '4px', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                {new Date(inspectingDrawer.closedAt || inspectingDrawer.openedAt).toLocaleString('es-AR', { dateStyle: 'full', timeStyle: 'short' })}
              </div>
            </div>
            <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} aria-label="Cerrar"><X size={18} aria-hidden="true" /></button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '18px' }}>
            {summaryCards.map((card) => (
              <div key={card.label} style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{card.label}</span>
                <div className="tabular-nums" style={{ fontSize: '1.2rem', fontWeight: 700, color: card.color, fontFamily: 'monospace' }}>{card.value}</div>
              </div>
            ))}
          </div>

          {isCentral ? (
            inspectingDrawer.notes ? (
              <div style={{ backgroundColor: '#f8fafc', padding: '12px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', fontSize: '0.86rem' }}>
                <div style={{ fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Observaciones</div>
                <div>{inspectingDrawer.notes}</div>
              </div>
            ) : null
          ) : !inspectingDrawer.transactions?.length ? (
            <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)' }}>Sin recibos adjuntos.</div>
          ) : (
            <div className="table-container" role="region" aria-label="Comprobantes del cierre" tabIndex={0}>
              <table style={{ fontSize: '0.84rem' }}>
                <thead>
                  <tr>
                    <th scope="col">Fecha</th><th scope="col">Recibo</th><th scope="col">Cliente</th><th scope="col">Medio</th>
                    <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
                  </tr>
                </thead>
                <tbody>
                  {inspectingDrawer.transactions.map((t: any) => (
                    <tr key={t.id}>
                      <td style={{ fontSize: '0.78rem' }}>{new Date(t.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td style={{ fontWeight: 600 }}>{t.receiptNumber || `Pedido #${t.orderId || 'S/N'}`}</td>
                      <td>{t.persona?.name || 'Varios'}</td>
                      <td>{t.paymentMethod === 'CASH' ? 'Efectivo' : t.paymentMethod === 'CHECK' ? 'Cheque' : 'Transferencia'}</td>
                      <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#047857' }}>
                        +${Math.round(Number(t.amount)).toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </NativeModalDialog>
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
}> = (props) => (
  <>
    <NativeModalDialog
      isOpen={props.centralCloseOpen}
      onClose={() => !props.submittingCentral && props.onCloseCentral()}
      ariaLabelledBy="fin-central-close-title"
      closeOnBackdrop={!props.submittingCentral}
      style={{ maxWidth: '460px', width: '92vw', padding: '24px' }}
    >
      <div className="modal-header" style={{ marginBottom: '14px' }}>
        <h3 id="fin-central-close-title" style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Lock size={18} color="var(--color-corp-red)" aria-hidden="true" /> Cierre de Caja Grande
        </h3>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={props.onCloseCentral} disabled={props.submittingCentral} aria-label="Cerrar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {props.modalError && (
        <div role="alert" style={{ backgroundColor: '#fff5f5', color: '#c53030', padding: '10px', borderRadius: '6px', fontSize: '0.84rem', marginBottom: '12px' }}>
          {props.modalError}
        </div>
      )}
      <form onSubmit={props.onSubmitCentral}>
        <div style={{ backgroundColor: '#f8fafc', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '14px' }}>
          <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Saldo Acumulado Actual</div>
          <div className="tabular-nums" style={{ fontSize: '1.6rem', fontWeight: 700, color: '#047857', fontFamily: 'monospace' }}>
            ${Math.round(props.cajaGrandeBalance).toLocaleString('es-AR')}
          </div>
        </div>
        <div className="form-group">
          <label htmlFor="fin-central-real-balance">Efectivo Inicial Nuevo Ciclo ($)</label>
          <input id="fin-central-real-balance" type="number" className="input tabular-nums" value={props.realBalance} onChange={(e) => props.setRealBalance(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="fin-central-notes">Observaciones</label>
          <input id="fin-central-notes" type="text" className="input" value={props.notes} onChange={(e) => props.setNotes(e.target.value)} placeholder="Opcional" />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={props.onCloseCentral} disabled={props.submittingCentral}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)' }} disabled={props.submittingCentral}>
            {props.submittingCentral ? 'Cerrando...' : 'Confirmar Cierre'}
          </button>
        </div>
      </form>
    </NativeModalDialog>

    <NativeModalDialog
      isOpen={props.editBankOpen}
      onClose={() => !props.submittingBank && props.onCloseEditBank()}
      ariaLabelledBy="fin-edit-bank-title"
      closeOnBackdrop={!props.submittingBank}
      style={{ maxWidth: '440px', width: '92vw', padding: '24px' }}
    >
      <div className="modal-header" style={{ marginBottom: '14px' }}>
        <h3 id="fin-edit-bank-title" style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <Landmark size={18} aria-hidden="true" /> Editar Cuenta Bancaria
        </h3>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={props.onCloseEditBank} disabled={props.submittingBank} aria-label="Cerrar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>
      {props.modalError && (
        <div role="alert" style={{ backgroundColor: '#fff5f5', color: '#c53030', padding: '10px', borderRadius: '6px', fontSize: '0.84rem', marginBottom: '12px' }}>
          {props.modalError}
        </div>
      )}
      <form onSubmit={props.onSubmitBank}>
        <div className="form-group">
          <label htmlFor="edit-bank-name">Nombre de Cuenta</label>
          <input id="edit-bank-name" type="text" className="input" value={props.bankName} onChange={(e) => props.setBankName(e.target.value)} required />
        </div>
        <div className="form-group">
          <label htmlFor="edit-bank-account-number">Cuenta / CBU / Alias</label>
          <input
            id="edit-bank-account-number"
            type="text"
            className="input"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={props.bankAccountNumber}
            onChange={(e) => props.setBankAccountNumber(e.target.value)}
          />
        </div>
        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={props.onCloseEditBank} disabled={props.submittingBank}>Cancelar</button>
          <button type="submit" className="btn btn-primary" style={{ backgroundColor: '#10b981', borderColor: '#10b981' }} disabled={props.submittingBank}>
            {props.submittingBank ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </NativeModalDialog>
  </>
);
