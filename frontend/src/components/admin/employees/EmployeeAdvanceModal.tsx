import React, { useEffect, useRef, useState } from 'react';
import { Trash2, X } from 'lucide-react';
import { api } from '../../../utils/api';
import {
  BankAccountOption,
  EmployeeRecord,
  MONTH_NAMES,
  OpenCashDrawerOption,
  formatDateAr,
  formatMoneyAr,
} from './types';

interface EmployeeAdvanceModalProps {
  isOpen: boolean;
  employee: EmployeeRecord | null;
  month: number;
  year: number;
  openDrawers: OpenCashDrawerOption[];
  bankAccounts: BankAccountOption[];
  onClose: () => void;
  onChanged: () => void;
}

export const EmployeeAdvanceModal: React.FC<EmployeeAdvanceModalProps> = ({
  isOpen,
  employee,
  month,
  year,
  openDrawers,
  bankAccounts,
  onClose,
  onChanged,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [sourceKey, setSourceKey] = useState('');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && employee) {
      setAmount('');
      setDate(new Date().toISOString().slice(0, 10));
      setReason('');
      setError('');
      if (openDrawers.length > 0) {
        setSourceKey(`drawer:${openDrawers[0].id}`);
      } else if (bankAccounts.length > 0) {
        setSourceKey(`bank:${bankAccounts[0].id}`);
      } else {
        setSourceKey('');
      }
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, employee, openDrawers, bankAccounts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setError('');

    const parsedAmount = Math.round(Number(amount));
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) {
      setError('Ingresá un monto válido mayor a cero.');
      return;
    }
    if (!sourceKey) {
      setError('Seleccioná una Caja abierta o una Cuenta Bancaria.');
      return;
    }

    const [kind, rawId] = sourceKey.split(':');
    const sourceId = Number(rawId);

    setSaving(true);
    try {
      await api.createAdvance({
        employeeId: employee.id,
        amount: parsedAmount,
        date: `${date}T12:00:00Z`,
        reason: reason.trim() || undefined,
        paymentMethod: kind === 'bank' ? 'BANK_TRANSFER' : 'CASH',
        cashDrawerId: kind === 'drawer' ? sourceId : undefined,
        bankAccountId: kind === 'bank' ? sourceId : undefined,
      });
      setAmount('');
      setReason('');
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Error al registrar el retiro.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (advanceId: number) => {
    setError('');
    setDeletingId(advanceId);
    try {
      await api.deleteAdvance(advanceId);
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'No se pudo eliminar el retiro.');
    } finally {
      setDeletingId(null);
    }
  };

  const advances = employee?.advances || [];
  const totalMonth = employee?.monthlyAdvancesTotal ?? 0;

  return (
    <dialog
      ref={dialogRef}
      className="app-native-dialog"
      aria-labelledby="employee-advance-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      style={{
        width: 'min(520px, calc(100vw - 32px))',
        padding: 0,
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        backgroundColor: 'var(--background-card)',
        color: 'var(--text-primary)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
        overscrollBehavior: 'contain',
      }}
    >
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <h2 id="employee-advance-title" style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700 }}>
            Retiros — {employee ? `${employee.firstName} ${employee.lastName}` : ''}
          </h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost" style={{ padding: '4px' }}>
            <X size={18} />
          </button>
        </div>

        {error && (
          <div role="alert" style={{ padding: '8px 12px', marginBottom: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.82rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label htmlFor="adv-amount" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Monto ($)
              </label>
              <input
                id="adv-amount"
                type="number"
                min={1}
                step={1}
                className="input"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="50000"
                required
                autoFocus
              />
            </div>
            <div>
              <label htmlFor="adv-date" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Fecha
              </label>
              <input id="adv-date" type="date" className="input" value={date} onChange={(e) => setDate(e.target.value)} required />
            </div>
          </div>

          <div>
            <label htmlFor="adv-source" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
              Descontar de
            </label>
            <select id="adv-source" className="select" value={sourceKey} onChange={(e) => setSourceKey(e.target.value)} required>
              {openDrawers.length === 0 && bankAccounts.length === 0 && (
                <option value="">Sin cajas abiertas ni cuentas bancarias</option>
              )}
              {openDrawers.length > 0 && (
                <optgroup label="Cajas abiertas (Efectivo)">
                  {openDrawers.map((d) => (
                    <option key={`drawer:${d.id}`} value={`drawer:${d.id}`}>
                      Caja #{d.id}{d.branch ? ` — ${d.branch}` : ''}
                    </option>
                  ))}
                </optgroup>
              )}
              {bankAccounts.length > 0 && (
                <optgroup label="Cuentas bancarias (Transferencia)">
                  {bankAccounts.map((b) => (
                    <option key={`bank:${b.id}`} value={`bank:${b.id}`}>
                      {b.name}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label htmlFor="adv-reason" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Nota (opcional)
              </label>
              <input id="adv-reason" className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Adelanto quincena" />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving || !sourceKey} style={{ height: '38px', whiteSpace: 'nowrap' }}>
              {saving ? 'Guardando...' : 'Registrar'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '14px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', fontSize: '0.84rem' }}>
            <span style={{ fontWeight: 600, color: 'var(--text-secondary)' }}>
              {MONTH_NAMES[month - 1]} {year}
            </span>
            <span className="tabular-nums" style={{ fontWeight: 700 }}>
              Total: {formatMoneyAr(totalMonth)}
            </span>
          </div>

          {advances.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.84rem', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
              Sin retiros en este mes
            </div>
          ) : (
            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <tbody>
                  {advances.map((adv) => {
                    const sourceLabel = adv.bankAccount?.name
                      ? adv.bankAccount.name
                      : adv.cashDrawer
                        ? `Caja #${adv.cashDrawer.id}`
                        : 'Efectivo';
                    return (
                      <tr key={adv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '8px 10px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {formatDateAr(adv.date)}
                        </td>
                        <td style={{ padding: '8px 10px' }}>
                          <div style={{ fontWeight: 500 }}>{adv.reason || 'Retiro'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{sourceLabel}</div>
                        </td>
                        <td className="tabular-nums" style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700, whiteSpace: 'nowrap' }}>
                          {formatMoneyAr(adv.amount)}
                        </td>
                        <td style={{ padding: '8px 6px', textAlign: 'right', width: '32px' }}>
                          <button
                            type="button"
                            className="btn btn-ghost"
                            aria-label="Eliminar retiro"
                            title="Eliminar y devolver saldo"
                            disabled={deletingId === adv.id}
                            onClick={() => handleDelete(adv.id)}
                            style={{ padding: '4px', color: 'var(--text-secondary)' }}
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
