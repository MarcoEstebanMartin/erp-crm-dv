import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Calendar, ChevronLeft, ChevronRight, DollarSign, Pencil, Printer, UserPlus } from 'lucide-react';
import { api } from '../../../utils/api';
import {
  type BankAccountOption,
  type EmployeeRecord,
  MONTH_NAMES,
  type OpenCashDrawerOption,
  formatDateAr,
  formatMoneyAr,
} from './types';
import { EmployeeFormModal } from './EmployeeFormModal';
import { EmployeeAdvanceModal } from './EmployeeAdvanceModal';
import { EmployeeVacationsModal } from './EmployeeVacationsModal';
import { printVacationSheet } from './printVacationSheet';

export const EmployeesTab: React.FC = () => {
  const now = new Date();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [search, setSearch] = useState('');
  const [showInactive, setShowInactive] = useState(false);

  const [employees, setEmployees] = useState<EmployeeRecord[]>([]);
  const [openDrawers, setOpenDrawers] = useState<OpenCashDrawerOption[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccountOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [formEmployee, setFormEmployee] = useState<EmployeeRecord | null>(null);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [advanceEmpId, setAdvanceEmpId] = useState<number | null>(null);
  const [vacationsEmpId, setVacationsEmpId] = useState<number | null>(null);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const [empRes, drawersRes, banksRes] = await Promise.all([
        api.getEmployees({ active: showInactive ? undefined : true, month, year }),
        api.getActiveDrawers().catch(() => []),
        api.getBankAccounts().catch(() => []),
      ]);
      const list: EmployeeRecord[] = Array.isArray(empRes?.data) ? empRes.data : Array.isArray(empRes) ? empRes : [];
      setEmployees(list);
      setOpenDrawers(Array.isArray(drawersRes) ? drawersRes.filter((d: any) => d.status === 'OPEN') : []);
      const banksList = Array.isArray(banksRes?.accounts) ? banksRes.accounts : Array.isArray(banksRes) ? banksRes : [];
      setBankAccounts(banksList);
    } catch (err: any) {
      setError(err?.message || 'Error al cargar empleados.');
    } finally {
      setLoading(false);
    }
  }, [month, year, showInactive]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  const filteredEmployees = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = !q
      ? [...employees]
      : employees.filter((e) => {
          const full = `${e.firstName} ${e.lastName} ${e.cuil || ''} ${e.dni || ''}`.toLowerCase();
          return full.includes(q);
        });
    return list.sort((a, b) => {
      const aMono = a.employmentType === 'MONOTRIBUTISTA' ? 1 : 0;
      const bMono = b.employmentType === 'MONOTRIBUTISTA' ? 1 : 0;
      if (aMono !== bMono) return aMono - bMono;
      const lastCmp = a.lastName.localeCompare(b.lastName, 'es-AR', { sensitivity: 'base' });
      return lastCmp !== 0 ? lastCmp : a.firstName.localeCompare(b.firstName, 'es-AR', { sensitivity: 'base' });
    });
  }, [employees, search]);

  const totalMonthWithdrawals = useMemo(
    () => filteredEmployees.reduce((sum, e) => sum + (Number(e.monthlyAdvancesTotal) || 0), 0),
    [filteredEmployees],
  );

  const selectedAdvanceEmployee = useMemo(
    () => employees.find((e) => e.id === advanceEmpId) || null,
    [employees, advanceEmpId],
  );

  const selectedVacationsEmployee = useMemo(
    () => employees.find((e) => e.id === vacationsEmpId) || null,
    [employees, vacationsEmpId],
  );

  const shiftMonth = (delta: number) => {
    let nextMonth = month + delta;
    let nextYear = year;
    if (nextMonth < 1) {
      nextMonth = 12;
      nextYear -= 1;
    } else if (nextMonth > 12) {
      nextMonth = 1;
      nextYear += 1;
    }
    setMonth(nextMonth);
    setYear(nextYear);
  };

  return (
    <div>
      {error && (
        <div role="alert" style={{ padding: '10px 14px', marginBottom: '14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.84rem' }}>
          {error}
        </div>
      )}

      <div className="actions-bar" style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
        <search className="search-input-wrapper" style={{ flex: '1 1 200px', maxWidth: '300px', minWidth: '180px' }}>
          <label htmlFor="employees-search" className="sr-only">Buscar empleado</label>
          <input
            id="employees-search"
            type="text"
            className="input"
            placeholder="Buscar..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            autoCorrect="off"
            spellCheck={false}
          />
        </search>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', border: '1px solid var(--border-color)', borderRadius: '6px', height: '38px', padding: '0 4px', backgroundColor: 'var(--background-card)' }}>
          <button type="button" className="btn btn-ghost" aria-label="Mes anterior" onClick={() => shiftMonth(-1)} style={{ padding: '4px' }}>
            <ChevronLeft size={16} />
          </button>
          <span style={{ fontSize: '0.84rem', fontWeight: 600, minWidth: '116px', textAlign: 'center' }}>
            {MONTH_NAMES[month - 1]} {year}
          </span>
          <button type="button" className="btn btn-ghost" aria-label="Mes siguiente" onClick={() => shiftMonth(1)} style={{ padding: '4px' }}>
            <ChevronRight size={16} />
          </button>
        </div>

        <div className="tabular-nums" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
          <span style={{ color: '#64748b', fontWeight: 500 }}>Retiros del mes</span>
          <span style={{ fontWeight: 700, fontSize: '0.94rem', color: '#0f172a' }}>{formatMoneyAr(totalMonthWithdrawals)}</span>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
          <label htmlFor="emp-show-inactive" style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
            <input id="emp-show-inactive" type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
            <span>Inactivos</span>
          </label>

          <button
            type="button"
            className="btn btn-primary"
            style={{ whiteSpace: 'nowrap' }}
            onClick={() => {
              setFormEmployee(null);
              setIsFormOpen(true);
            }}
          >
            <UserPlus size={16} />
            <span>Nuevo empleado</span>
          </button>
        </div>
      </div>

      <div className="table-responsive" style={{ backgroundColor: 'var(--background-card)', border: '1px solid var(--border-color)', borderRadius: '8px', overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.86rem' }}>
          <thead>
            <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)', textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.78rem' }}>
              <th scope="col" style={{ padding: '10px 14px', fontWeight: 600 }}>Empleado</th>
              <th scope="col" style={{ padding: '10px 12px', fontWeight: 600 }}>Condición</th>
              <th scope="col" style={{ padding: '10px 12px', fontWeight: 600 }}>Ingreso</th>
              <th scope="col" style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'right' }}>Retiros ({MONTH_NAMES[month - 1].slice(0, 3)})</th>
              <th scope="col" style={{ padding: '10px 12px', fontWeight: 600, textAlign: 'center' }}>Vacaciones</th>
              <th scope="col" style={{ padding: '10px 14px', fontWeight: 600, textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Cargando...
                </td>
              </tr>
            ) : filteredEmployees.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ padding: '28px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                  Sin empleados
                </td>
              </tr>
            ) : (
              filteredEmployees.map((emp) => {
                const isMono = emp.employmentType === 'MONOTRIBUTISTA';
                const totalAdv = Number(emp.monthlyAdvancesTotal) || 0;
                const advCount = emp.advances?.length || 0;
                const lastWorkYear = new Date().getFullYear() - 1;
                const takenDays = (emp.vacations || [])
                  .filter((v) => v.type === 'VACATION' && v.year === lastWorkYear)
                  .reduce((acc, v) => acc + (Number(v.daysCount) || 0), 0);

                return (
                  <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-color)', opacity: emp.isActive ? 1 : 0.55 }}>
                    <td style={{ padding: '11px 14px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                        {emp.lastName}, {emp.firstName}
                      </div>
                      <div className="tabular-nums" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                        {emp.cuil || emp.dni}
                      </div>
                    </td>

                    <td style={{ padding: '11px 12px' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '2px 8px',
                          borderRadius: '999px',
                          fontSize: '0.74rem',
                          fontWeight: 600,
                          backgroundColor: isMono ? '#f1f5f9' : '#ecfdf5',
                          color: isMono ? '#475569' : '#065f46',
                          border: `1px solid ${isMono ? '#e2e8f0' : '#a7f3d0'}`,
                        }}
                      >
                        {isMono ? 'Monotributista' : 'En blanco'}
                      </span>
                    </td>

                    <td className="tabular-nums" style={{ padding: '11px 12px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {isMono ? '—' : formatDateAr(emp.hireDate)}
                    </td>

                    <td className="tabular-nums" style={{ padding: '11px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <button
                        type="button"
                        onClick={() => setAdvanceEmpId(emp.id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          cursor: 'pointer',
                          fontWeight: totalAdv > 0 ? 700 : 500,
                          color: totalAdv > 0 ? 'var(--text-primary)' : 'var(--text-secondary)',
                          fontSize: '0.88rem',
                        }}
                      >
                        {formatMoneyAr(totalAdv)}
                        {advCount > 0 && (
                          <span style={{ marginLeft: '5px', fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
                            ({advCount})
                          </span>
                        )}
                      </button>
                    </td>

                    <td className="tabular-nums" style={{ padding: '11px 12px', textAlign: 'center', whiteSpace: 'nowrap' }}>
                      {isMono ? (
                        <span style={{ color: 'var(--text-secondary)' }}>—</span>
                      ) : (
                        <span style={{ fontWeight: 600 }}>
                          {emp.vacationDaysPerYear} d.
                          {takenDays > 0 && (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 500, marginLeft: '4px' }}>
                              ({takenDays} tom.)
                            </span>
                          )}
                        </span>
                      )}
                    </td>

                    <td style={{ padding: '11px 14px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => setAdvanceEmpId(emp.id)}
                          style={{ padding: '4px 9px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <DollarSign size={13} />
                          <span>Retiro</span>
                        </button>

                        {!isMono && (
                          <>
                            <button
                              type="button"
                              className="btn btn-secondary"
                              onClick={() => setVacationsEmpId(emp.id)}
                              style={{ padding: '4px 9px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                            >
                              <Calendar size={13} />
                              <span>Vacaciones</span>
                            </button>

                            <button
                              type="button"
                              className="btn btn-ghost"
                              title="Descargar / Imprimir Planilla de Vacaciones"
                              aria-label={`Planilla de vacaciones de ${emp.firstName} ${emp.lastName}`}
                              onClick={() => printVacationSheet(emp)}
                              style={{ padding: '5px 7px' }}
                            >
                              <Printer size={15} />
                            </button>
                          </>
                        )}

                        <button
                          type="button"
                          className="btn btn-ghost"
                          title="Editar empleado"
                          aria-label={`Editar ${emp.firstName} ${emp.lastName}`}
                          onClick={() => {
                            setFormEmployee(emp);
                            setIsFormOpen(true);
                          }}
                          style={{ padding: '5px 7px' }}
                        >
                          <Pencil size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <EmployeeFormModal
        isOpen={isFormOpen}
        employee={formEmployee}
        onClose={() => setIsFormOpen(false)}
        onSaved={() => void loadData()}
      />

      <EmployeeAdvanceModal
        isOpen={advanceEmpId !== null}
        employee={selectedAdvanceEmployee}
        month={month}
        year={year}
        openDrawers={openDrawers}
        bankAccounts={bankAccounts}
        onClose={() => setAdvanceEmpId(null)}
        onChanged={() => void loadData()}
      />

      <EmployeeVacationsModal
        isOpen={vacationsEmpId !== null}
        employee={selectedVacationsEmployee}
        onClose={() => setVacationsEmpId(null)}
        onChanged={() => void loadData()}
      />
    </div>
  );
};

export default EmployeesTab;
