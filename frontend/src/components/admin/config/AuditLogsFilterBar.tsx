import type { FormEvent } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import type { AuditLogQueryFilters } from '../../../utils/api';
import { AUDIT_MODULES, translateRole } from './auditLogDictionary';

export interface AuditFilterUserOption {
  id: number;
  username: string;
  role: string;
  isActive?: boolean;
}

interface AuditLogsFilterBarProps {
  draftFilters: AuditLogQueryFilters;
  users: AuditFilterUserOption[];
  hasActiveFilters: boolean;
  onDraftChange: (patch: Partial<AuditLogQueryFilters>) => void;
  onApply: (nextFilters?: AuditLogQueryFilters) => void;
  onReset: () => void;
}

function toLocalIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export default function AuditLogsFilterBar({
  draftFilters,
  users,
  hasActiveFilters,
  onDraftChange,
  onApply,
  onReset,
}: AuditLogsFilterBarProps) {
  const handleSubmit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onApply();
  };

  const applyDatePreset = (daysBack: number) => {
    const today = new Date();
    const start = new Date(today);
    start.setDate(today.getDate() - daysBack);
    const next: AuditLogQueryFilters = {
      ...draftFilters,
      startDate: toLocalIsoDate(start),
      endDate: toLocalIsoDate(today),
    };
    onDraftChange({ startDate: next.startDate, endDate: next.endDate });
    onApply(next);
  };

  return (
    <search
      aria-label="Filtrar registros de auditoría"
      style={{
        backgroundColor: '#F9FAFB',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '14px 16px',
        marginBottom: '14px',
      }}
    >
      <form onSubmit={handleSubmit}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))',
            gap: '12px',
            alignItems: 'end',
          }}
        >
          <div style={{ gridColumn: 'span 2', minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="audit-filter-search">Buscar texto, producto, cliente o #ID</label>
            <div style={{ position: 'relative' }}>
              <Search
                size={15}
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  left: '10px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                  pointerEvents: 'none',
                }}
              />
              <input
                id="audit-filter-search"
                name="search"
                type="search"
                className="input"
                style={{ paddingLeft: '32px' }}
                value={draftFilters.search || ''}
                onChange={(e) => onDraftChange({ search: e.target.value })}
                placeholder="Ej: Playadito, D1-R01, #845, matias..."
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                enterKeyHint="search"
              />
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="audit-filter-user">Empleado</label>
            <select
              id="audit-filter-user"
              name="userId"
              className="select"
              value={draftFilters.userId === undefined ? '' : String(draftFilters.userId)}
              onChange={(e) => onDraftChange({ userId: e.target.value ? Number(e.target.value) : '' })}
            >
              <option value="">Todos los usuarios</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username} ({translateRole(u.role)}){u.isActive === false ? ' · Inactivo' : ''}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="audit-filter-module">Módulo</label>
            <select
              id="audit-filter-module"
              name="module"
              className="select"
              value={draftFilters.module || ''}
              onChange={(e) => onDraftChange({ module: e.target.value })}
            >
              <option value="">Todos los módulos</option>
              {AUDIT_MODULES.map((m) => (
                <option key={m.value} value={m.value}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="audit-filter-status">Estado</label>
            <select
              id="audit-filter-status"
              name="status"
              className="select"
              value={draftFilters.status || ''}
              onChange={(e) => onDraftChange({ status: e.target.value })}
            >
              <option value="">Todos</option>
              <option value="SUCCESS">Exitosos</option>
              <option value="WARNING">Advertencias</option>
              <option value="ERROR">Con error</option>
            </select>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="audit-filter-start">Desde</label>
            <input
              id="audit-filter-start"
              name="startDate"
              type="date"
              className="input"
              value={draftFilters.startDate || ''}
              onChange={(e) => onDraftChange({ startDate: e.target.value })}
            />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <label htmlFor="audit-filter-end">Hasta</label>
            <input
              id="audit-filter-end"
              name="endDate"
              type="date"
              className="input"
              value={draftFilters.endDate || ''}
              onChange={(e) => onDraftChange({ endDate: e.target.value })}
            />
          </div>
        </div>

        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '10px',
            marginTop: '12px',
            paddingTop: '10px',
            borderTop: '1px solid var(--border-color)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>
              Rango rápido:
            </span>
            <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => applyDatePreset(0)}>
              Hoy
            </button>
            <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => applyDatePreset(6)}>
              Últimos 7 días
            </button>
            <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={() => applyDatePreset(29)}>
              Últimos 30 días
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {hasActiveFilters && (
              <button type="button" className="btn btn-secondary" onClick={onReset}>
                <RotateCcw size={14} aria-hidden="true" />
                Limpiar filtros
              </button>
            )}
            <button type="submit" className="btn btn-primary">
              <Search size={14} aria-hidden="true" />
              Buscar / Filtrar
            </button>
          </div>
        </div>
      </form>
    </search>
  );
}
