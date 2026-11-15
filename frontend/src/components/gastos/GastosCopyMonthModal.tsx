import { AlertCircle, CheckCircle, Copy, RefreshCw, X } from 'lucide-react';
import { type CopySourceExpenseItem, getMonthName } from './gastos.types';
import { NativeModalDialog } from '../modals/NativeModalDialog';

interface GastosCopyMonthModalProps {
  isOpen: boolean;
  onClose: () => void;
  errorMsg: string | null;
  selectedYear: number;
  selectedMonth: number;
  copySourceYear: number;
  setCopySourceYear: (y: number) => void;
  copySourceMonth: number;
  setCopySourceMonth: (m: number) => void;
  copyTargetDate: string;
  setCopyTargetDate: (d: string) => void;
  sourceExpenses: CopySourceExpenseItem[];
  setSourceExpenses: (items: CopySourceExpenseItem[]) => void;
  loadingSource: boolean;
  submittingCopy: boolean;
  onFetchSource: (year: number, month: number) => void;
  onExecuteCopy: () => void;
}

export function GastosCopyMonthModal({
  isOpen, onClose, errorMsg, selectedYear, selectedMonth, copySourceYear, setCopySourceYear,
  copySourceMonth, setCopySourceMonth, copyTargetDate, setCopyTargetDate,
  sourceExpenses, setSourceExpenses, loadingSource, submittingCopy, onFetchSource, onExecuteCopy,
}: GastosCopyMonthModalProps) {
  const selectedCount = sourceExpenses.filter((s) => s.selected).length;
  const totalBatch = sourceExpenses.filter((s) => s.selected).reduce((sum, s) => sum + (Number(s.amount) || 0), 0);
  const allSelected = sourceExpenses.length > 0 && sourceExpenses.every((s) => s.selected);

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={() => !submittingCopy && onClose()}
      ariaLabelledBy="gasto-copy-title"
      closeOnBackdrop={!submittingCopy}
      style={{ maxWidth: '900px', width: '95vw', maxHeight: '90vh', padding: 0, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}
    >
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-hover)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ padding: '8px', backgroundColor: 'rgba(227, 6, 19, 0.1)', color: 'var(--color-corp-red)', borderRadius: '8px', display: 'flex' }}>
            <Copy size={18} aria-hidden="true" />
          </div>
          <h3 id="gasto-copy-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            Copiar Gastos de {getMonthName(copySourceMonth)} {copySourceYear}
          </h3>
        </div>
        <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} disabled={submittingCopy} aria-label="Cerrar">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div style={{ padding: '14px 24px', backgroundColor: 'var(--bg-hover)', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <label htmlFor="copy-src-month" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Origen:</label>
          <select
            id="copy-src-month"
            value={copySourceMonth}
            onChange={(e) => {
              const m = Number(e.target.value);
              setCopySourceMonth(m);
              onFetchSource(copySourceYear, m);
            }}
            className="select"
            style={{ width: 'auto', padding: '6px 10px', fontSize: '0.85rem' }}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((m) => (<option key={m} value={m}>{getMonthName(m)}</option>))}
          </select>
          <select
            id="copy-src-year"
            aria-label="Año origen"
            value={copySourceYear}
            onChange={(e) => {
              const y = Number(e.target.value);
              setCopySourceYear(y);
              onFetchSource(y, copySourceMonth);
            }}
            className="select"
            style={{ width: 'auto', padding: '6px 10px', fontSize: '0.85rem' }}
          >
            <option value={2026}>2026</option>
            <option value={2025}>2025</option>
          </select>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: 'auto' }}>
          <label htmlFor="copy-target-date" style={{ fontSize: '0.82rem', fontWeight: 600 }}>Fecha Destino:</label>
          <input id="copy-target-date" type="date" value={copyTargetDate} onChange={(e) => setCopyTargetDate(e.target.value)} className="input" style={{ padding: '6px 10px', fontSize: '0.85rem', width: '150px' }} />
        </div>
      </div>

      {errorMsg && (
        <div role="alert" style={{ margin: '12px 24px 0 24px', padding: '10px 12px', backgroundColor: '#fef2f2', color: '#b91c1c', border: '1px solid #fecaca', borderRadius: '6px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={15} aria-hidden="true" />
          <span>{errorMsg}</span>
        </div>
      )}

      <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
        {loadingSource ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <RefreshCw size={24} className="animate-spin" aria-hidden="true" style={{ margin: '0 auto 10px' }} />
            <span>Cargando gastos...</span>
          </div>
        ) : sourceExpenses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>
            <AlertCircle size={30} aria-hidden="true" style={{ margin: '0 auto 10px', color: '#f59e0b' }} />
            <div style={{ fontWeight: 600 }}>Sin gastos en {getMonthName(copySourceMonth)} {copySourceYear}</div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', gap: '12px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => setSourceExpenses(sourceExpenses.map((s) => ({ ...s, selected: !allSelected })))}
                  style={{ padding: '4px 10px', fontSize: '0.8rem' }}
                >
                  {allSelected ? 'Desmarcar Todos' : 'Marcar Todos'}
                </button>
                <span className="tabular-nums" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                  {selectedCount} / {sourceExpenses.length}
                </span>
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                Total: <span style={{ color: 'var(--color-corp-red)' }}>${totalBatch.toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
              </div>
            </div>

            <div className="table-container" role="region" aria-label="Gastos a copiar" tabIndex={0} style={{ marginTop: 0 }}>
              <table>
                <thead>
                  <tr>
                    <th scope="col" style={{ width: '40px' }}><span className="visually-hidden">Seleccionar</span></th>
                    <th scope="col">Descripción</th>
                    <th scope="col">Categoría</th>
                    <th scope="col" style={{ width: '160px' }}>Monto ($)</th>
                    <th scope="col" style={{ width: '140px' }}>Pago</th>
                  </tr>
                </thead>
                <tbody>
                  {sourceExpenses.map((item, index) => (
                    <tr key={item.id || index} style={{ backgroundColor: item.selected ? 'transparent' : 'var(--bg-hover)', opacity: item.selected ? 1 : 0.5 }}>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          aria-label={`Seleccionar ${item.description}`}
                          checked={item.selected}
                          onChange={(e) => {
                            const updated = [...sourceExpenses];
                            updated[index] = { ...updated[index], selected: e.target.checked };
                            setSourceExpenses(updated);
                          }}
                          style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                        />
                      </td>
                      <td>
                        <input
                          type="text"
                          aria-label={`Descripción ${index + 1}`}
                          value={item.description}
                          disabled={!item.selected}
                          onChange={(e) => {
                            const updated = [...sourceExpenses];
                            updated[index] = { ...updated[index], description: e.target.value };
                            setSourceExpenses(updated);
                          }}
                          className="input"
                          style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        />
                      </td>
                      <td>
                        <span style={{ padding: '2px 8px', backgroundColor: 'var(--bg-hover)', borderRadius: '4px', border: '1px solid var(--border-color)', fontSize: '0.78rem' }}>
                          {item.categoryName}
                        </span>
                      </td>
                      <td>
                        <input
                          type="number"
                          aria-label={`Monto de ${item.description}`}
                          step="0.01"
                          value={item.amount}
                          disabled={!item.selected}
                          onChange={(e) => {
                            const updated = [...sourceExpenses];
                            updated[index] = { ...updated[index], amount: e.target.value };
                            setSourceExpenses(updated);
                          }}
                          className="input tabular-nums"
                          style={{ padding: '4px 8px', fontSize: '0.88rem', fontWeight: 600, textAlign: 'right' }}
                        />
                      </td>
                      <td>
                        <select
                          aria-label={`Medio de pago de ${item.description}`}
                          value={item.paymentMethod}
                          disabled={!item.selected}
                          onChange={(e) => {
                            const updated = [...sourceExpenses];
                            updated[index] = { ...updated[index], paymentMethod: e.target.value };
                            setSourceExpenses(updated);
                          }}
                          className="select"
                          style={{ padding: '4px 6px', fontSize: '0.8rem' }}
                        >
                          <option value="CASH">Efectivo</option>
                          <option value="BANK_TRANSFER">Transferencia</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: 'var(--bg-hover)' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={submittingCopy}>Cancelar</button>
        <button
          type="button"
          className="btn btn-primary"
          onClick={onExecuteCopy}
          disabled={submittingCopy || loadingSource || selectedCount === 0}
          style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)', display: 'flex', alignItems: 'center', gap: '8px' }}
        >
          {submittingCopy ? (
            <>
              <RefreshCw size={15} className="animate-spin" aria-hidden="true" />
              <span>Copiando...</span>
            </>
          ) : (
            <>
              <CheckCircle size={15} aria-hidden="true" />
              <span className="tabular-nums">Copiar ({selectedCount}) a {getMonthName(selectedMonth)} {selectedYear}</span>
            </>
          )}
        </button>
      </div>
    </NativeModalDialog>
  );
}
