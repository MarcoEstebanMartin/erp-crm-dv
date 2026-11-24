import React, { useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../../utils/api';
import { EmployeeRecord } from './types';

interface EmployeeFormModalProps {
  isOpen: boolean;
  employee: EmployeeRecord | null;
  onClose: () => void;
  onSaved: () => void;
}

function toInputDate(iso?: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

export const EmployeeFormModal: React.FC<EmployeeFormModalProps> = ({
  isOpen,
  employee,
  onClose,
  onSaved,
}) => {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [cuil, setCuil] = useState('');
  const [employmentType, setEmploymentType] = useState<'DEPENDENCIA' | 'MONOTRIBUTISTA'>('DEPENDENCIA');
  const [hireDate, setHireDate] = useState('');
  const [vacationDaysPerYear, setVacationDaysPerYear] = useState('14');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (isOpen) {
      if (employee) {
        setFirstName(employee.firstName || '');
        setLastName(employee.lastName || '');
        setDni(employee.dni || '');
        setCuil(employee.cuil || '');
        setEmploymentType(employee.employmentType === 'MONOTRIBUTISTA' ? 'MONOTRIBUTISTA' : 'DEPENDENCIA');
        setHireDate(toInputDate(employee.hireDate));
        setVacationDaysPerYear(String(employee.vacationDaysPerYear ?? 0));
        setIsActive(employee.isActive !== false);
      } else {
        setFirstName('');
        setLastName('');
        setDni('');
        setCuil('');
        setEmploymentType('DEPENDENCIA');
        setHireDate(new Date().toISOString().slice(0, 10));
        setVacationDaysPerYear('14');
        setIsActive(true);
      }
      setError('');
      if (!dialog.open) dialog.showModal();
    } else if (dialog.open) {
      dialog.close();
    }
  }, [isOpen, employee]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const cleanFirst = firstName.trim();
    const cleanLast = lastName.trim();
    const cleanCuil = cuil.trim();
    const derivedDni = dni.trim() || cleanCuil.replace(/\D/g, '').slice(2, 10) || cleanCuil;

    if (!cleanFirst || !cleanLast || !derivedDni) {
      setError('Nombre, apellido y CUIT/DNI son obligatorios.');
      return;
    }

    setSaving(true);
    try {
      const payload = {
        firstName: cleanFirst,
        lastName: cleanLast,
        dni: derivedDni,
        cuil: cleanCuil || null,
        employmentType,
        vacationDaysPerYear: employmentType === 'MONOTRIBUTISTA' ? 0 : Math.max(0, Number(vacationDaysPerYear) || 0),
        hireDate: employmentType === 'DEPENDENCIA' && hireDate ? `${hireDate}T12:00:00Z` : undefined,
        isActive,
      };
      if (employee) {
        await api.updateEmployee(employee.id, payload);
      } else {
        await api.createEmployee(payload);
      }
      onSaved();
      onClose();
    } catch (err: any) {
      setError(err?.message || 'Error al guardar empleado.');
    } finally {
      setSaving(false);
    }
  };

  const isMonotributista = employmentType === 'MONOTRIBUTISTA';

  return (
    <dialog
      ref={dialogRef}
      className="app-native-dialog"
      aria-labelledby="employee-form-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      style={{
        width: 'min(460px, calc(100vw - 32px))',
        padding: 0,
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        backgroundColor: 'var(--background-card)',
        color: 'var(--text-primary)',
        boxShadow: '0 20px 50px rgba(0,0,0,0.18)',
        overscrollBehavior: 'contain',
      }}
    >
      <form onSubmit={handleSubmit} style={{ padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 id="employee-form-title" style={{ margin: 0, fontSize: '1.02rem', fontWeight: 700 }}>
            {employee ? 'Editar empleado' : 'Nuevo empleado'}
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

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label htmlFor="emp-first-name" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
              Nombre
            </label>
            <input id="emp-first-name" className="input" value={firstName} onChange={(e) => setFirstName(e.target.value)} required autoFocus />
          </div>
          <div>
            <label htmlFor="emp-last-name" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
              Apellido
            </label>
            <input id="emp-last-name" className="input" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
          <div>
            <label htmlFor="emp-cuil" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
              CUIT / CUIL
            </label>
            <input id="emp-cuil" className="input" value={cuil} onChange={(e) => setCuil(e.target.value)} placeholder="20-12345678-9" />
          </div>
          <div>
            <label htmlFor="emp-dni" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
              DNI
            </label>
            <input id="emp-dni" className="input" value={dni} onChange={(e) => setDni(e.target.value)} placeholder="12345678" />
          </div>
        </div>

        <div style={{ marginBottom: '12px' }}>
          <label htmlFor="emp-type" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
            Condición
          </label>
          <select
            id="emp-type"
            className="select"
            value={employmentType}
            onChange={(e) => setEmploymentType(e.target.value as 'DEPENDENCIA' | 'MONOTRIBUTISTA')}
          >
            <option value="DEPENDENCIA">En blanco</option>
            <option value="MONOTRIBUTISTA">Monotributista</option>
          </select>
        </div>

        {!isMonotributista && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '12px' }}>
            <div>
              <label htmlFor="emp-hire-date" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Fecha de ingreso
              </label>
              <input id="emp-hire-date" type="date" className="input" value={hireDate} onChange={(e) => setHireDate(e.target.value)} />
            </div>
            <div>
              <label htmlFor="emp-vac-days" style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>
                Días vacaciones / año
              </label>
              <input
                id="emp-vac-days"
                type="number"
                min={0}
                max={90}
                className="input"
                value={vacationDaysPerYear}
                onChange={(e) => setVacationDaysPerYear(e.target.value)}
              />
            </div>
          </div>
        )}

        {employee && (
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', fontSize: '0.84rem', marginBottom: '16px', cursor: 'pointer' }}>
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>Activo</span>
          </label>
        )}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button type="submit" className="btn btn-primary" disabled={saving}>
            {saving ? 'Guardando...' : 'Guardar'}
          </button>
        </div>
      </form>
    </dialog>
  );
};
