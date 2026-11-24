import React, { useEffect, useRef, useState } from 'react';
import { Printer, Trash2, X } from 'lucide-react';
import { api } from '../../../utils/api';
import { type EmployeeRecord, formatDateAr } from './types';
import { printVacationSheet } from './printVacationSheet';

interface EmployeeVacationsModalProps {
  isOpen: boolean;
  employee: EmployeeRecord | null;
  onClose: () => void;
  onChanged: () => void;
}

function calcInclusiveDays(start: string, end: string): number {
  if (!start || !end) return 0;
  const s = new Date(`${start}T12:00:00Z`).getTime();
  const e = new Date(`${end}T12:00:00Z`).getTime();
  if (Number.isNaN(s) || Number.isNaN(e) || e < s) return 0;
  return Math.round((e - s) / (1000 * 3600 * 24)) + 1;
}

export const EmployeeVacationsModal: React.FC<EmployeeVacationsModalProps> = ({
  isOpen,
  employee,
  onClose,
  onChanged,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const defaultWorkYear = new Date().getFullYear() - 1;
  const [workYear, setWorkYear] = useState(String(defaultWorkYear));
  const [tramo, setTramo] = useState<'1' | '2'>('1');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [daysCount, setDaysCount] = useState('');
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen && employee) {
      setWorkYear(String(new Date().getFullYear() - 1));
      setTramo('1');
      setStartDate('');
      setEndDate('');
      setDaysCount('');
      setError('');
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, employee]);

  const handleDatesChange = (nextStart: string, nextEnd: string) => {
    setStartDate(nextStart);
    setEndDate(nextEnd);
    const calc = calcInclusiveDays(nextStart, nextEnd);
    if (calc > 0) setDaysCount(String(calc));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employee) return;
    setError('');
    if (!startDate || !endDate) {
      setError('Indicá fecha de inicio y fin.');
      return;
    }

    setSaving(true);
    try {
      await api.createVacation({
        employeeId: employee.id,
        year: Number(workYear),
        tramo: Number(tramo),
        startDate: `${startDate}T12:00:00Z`,
        endDate: `${endDate}T12:00:00Z`,
        daysCount: Number(daysCount) || undefined,
      });
      setStartDate('');
      setEndDate('');
      setDaysCount('');
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Error al registrar vacaciones.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: number) => {
    setError('');
    setDeletingId(id);
    try {
      await api.deleteVacation(id);
      onChanged();
    } catch (err: any) {
      setError(err?.message || 'Error al eliminar registro.');
    } finally {
      setDeletingId(null);
    }
  };

  const vacations = (employee?.vacations || []).filter((v) => v.type === 'VACATION');

  return (
    <dialog
      ref={dialogRef}
      className="app-native-dialog"
      aria-labelledby="employee-vacations-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      style={{
        width: 'min(580px, calc(100vw - 32px))',
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', gap: '8px' }}>
          <h2 id="employee-vacations-title" style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700 }}>
            Vacaciones — {employee ? `${employee.firstName} ${employee.lastName}` : ''}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            {employee && (
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => printVacationSheet(employee)}
                style={{ padding: '5px 10px', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Printer size={14} />
                <span>Planilla PDF</span>
              </button>
            )}
            <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost" style={{ padding: '4px' }}>
              <X size={18} />
            </button>
          </div>
        </div>

        {employee && (
          <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', padding: '8px 12px', marginBottom: '14px', backgroundColor: '#f8fafc', border: '1px solid var(--border-color)', borderRadius: '6px', fontSize: '0.82rem' }}>
            <span><strong>Ingreso:</strong> {formatDateAr(employee.hireDate)}</span>
            <span><strong>Corresponden:</strong> {employee.vacationDaysPerYear} días/año</span>
          </div>
        )}

        {error && (
          <div role="alert" style={{ padding: '8px 12px', marginBottom: '12px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.82rem' }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'grid', gap: '10px', paddingBottom: '16px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
            <div>
              <label htmlFor="vac-year" style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Año trabajado
              </label>
              <input id="vac-year" type="number" min={1998} max={2100} className="input" value={workYear} onChange={(e) => setWorkYear(e.target.value)} required />
            </div>
            <div>
              <label htmlFor="vac-tramo" style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Tramo
              </label>
              <select id="vac-tramo" className="select" value={tramo} onChange={(e) => setTramo(e.target.value as '1' | '2')}>
                <option value="1">Tramo 1</option>
                <option value="2">Tramo 2</option>
              </select>
            </div>
            <div>
              <label htmlFor="vac-days" style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Días
              </label>
              <input id="vac-days" type="number" min={1} max={90} className="input" value={daysCount} onChange={(e) => setDaysCount(e.target.value)} required />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto', gap: '8px', alignItems: 'flex-end' }}>
            <div>
              <label htmlFor="vac-start" style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Desde
              </label>
              <input id="vac-start" type="date" className="input" value={startDate} onChange={(e) => handleDatesChange(e.target.value, endDate)} required />
            </div>
            <div>
              <label htmlFor="vac-end" style={{ display: 'block', fontSize: '0.76rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Hasta
              </label>
              <input id="vac-end" type="date" className="input" value={endDate} onChange={(e) => handleDatesChange(startDate, e.target.value)} required />
            </div>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ height: '38px' }}>
              {saving ? 'Guardando...' : 'Agregar'}
            </button>
          </div>
        </form>

        <div style={{ marginTop: '14px' }}>
          {vacations.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.84rem', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>
              Sin vacaciones cargadas
            </div>
          ) : (
            <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)' }}>
                    <th style={{ padding: '7px 10px', fontWeight: 600 }}>Año / Goce</th>
                    <th style={{ padding: '7px 10px', fontWeight: 600 }}>Tramo</th>
                    <th style={{ padding: '7px 10px', fontWeight: 600 }}>Fechas</th>
                    <th style={{ padding: '7px 10px', fontWeight: 600, textAlign: 'right' }}>Días</th>
                    <th style={{ padding: '7px 6px', width: '32px' }} />
                  </tr>
                </thead>
                <tbody>
                  {vacations.map((v) => (
                    <tr key={v.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td className="tabular-nums" style={{ padding: '8px 10px', fontWeight: 600 }}>
                        {v.year} → {v.year + 1}
                      </td>
                      <td style={{ padding: '8px 10px' }}>Tramo {v.tramo || 1}</td>
                      <td className="tabular-nums" style={{ padding: '8px 10px', color: 'var(--text-secondary)' }}>
                        {formatDateAr(v.startDate)} al {formatDateAr(v.endDate)}
                      </td>
                      <td className="tabular-nums" style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>
                        {v.daysCount}
                      </td>
                      <td style={{ padding: '8px 6px', textAlign: 'right' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          aria-label="Eliminar registro"
                          disabled={deletingId === v.id}
                          onClick={() => handleDelete(v.id)}
                          style={{ padding: '4px', color: 'var(--text-secondary)' }}
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
};
