import { Fragment, useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import { api, type AuditLogQueryFilters } from '../../../utils/api';
import { resolveAuditBadge } from './auditLogDictionary';
import { formatAuditMessage } from './auditLogFormatter';
import AuditLogsFilterBar, { type AuditFilterUserOption } from './AuditLogsFilterBar';
import AuditLogDetailPanel from './AuditLogDetailPanel';

const EMPTY_FILTERS: AuditLogQueryFilters = {
  search: '',
  userId: '',
  module: '',
  status: '',
  startDate: '',
  endDate: '',
};

function hasFiltersApplied(filters: AuditLogQueryFilters): boolean {
  return Boolean(
    filters.search?.trim() ||
      (filters.userId !== undefined && filters.userId !== '') ||
      filters.module ||
      filters.status ||
      filters.startDate ||
      filters.endDate,
  );
}

export default function AuditLogsTab() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [users, setUsers] = useState<AuditFilterUserOption[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<number | null>(null);
  const [draftFilters, setDraftFilters] = useState<AuditLogQueryFilters>(EMPTY_FILTERS);
  const [appliedFilters, setAppliedFilters] = useState<AuditLogQueryFilters>(EMPTY_FILTERS);

  useEffect(() => {
    let cancelled = false;
    api
      .getUsers()
      .then((list: any[]) => {
        if (!cancelled && Array.isArray(list)) {
          setUsers(
            list.map((u) => ({
              id: Number(u.id),
              username: String(u.username),
              role: String(u.role),
              isActive: u.isActive,
            })),
          );
        }
      })
      .catch(() => {
        if (!cancelled) setUsers([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setExpandedLogId(null);

    api
      .getAuditLogs(auditPage, 30, appliedFilters)
      .then((res: any) => {
        if (cancelled) return;
        setAuditLogs(res?.logs || []);
        const total = Number(res?.pagination?.total ?? res?.logs?.length ?? 0);
        const totalPages = Number(res?.pagination?.totalPages ?? res?.totalPages ?? 1);
        setTotalCount(Math.max(0, total));
        setAuditTotalPages(Math.max(1, totalPages));
      })
      .catch(() => {
        if (cancelled) return;
        setAuditLogs([]);
        setTotalCount(0);
        setAuditTotalPages(1);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [auditPage, appliedFilters]);

  const handleDraftChange = (patch: Partial<AuditLogQueryFilters>) => {
    setDraftFilters((prev) => ({ ...prev, ...patch }));
  };

  const handleApplyFilters = (nextFilters?: AuditLogQueryFilters) => {
    setExpandedLogId(null);
    setAuditPage(1);
    setAppliedFilters(nextFilters ? { ...nextFilters } : { ...draftFilters });
  };

  const handleResetFilters = () => {
    setExpandedLogId(null);
    setAuditPage(1);
    setDraftFilters(EMPTY_FILTERS);
    setAppliedFilters(EMPTY_FILTERS);
  };

  const toggleRow = (id: number) => {
    setExpandedLogId((prev) => (prev === id ? null : id));
  };

  const activeFilterFlag = hasFiltersApplied(appliedFilters);
  const draftOrAppliedFlag = activeFilterFlag || hasFiltersApplied(draftFilters);

  return (
    <div className="card" style={{ padding: '24px' }}>
      <AuditLogsFilterBar
        draftFilters={draftFilters}
        users={users}
        hasActiveFilters={draftOrAppliedFlag}
        onDraftChange={handleDraftChange}
        onApply={handleApplyFilters}
        onReset={handleResetFilters}
      />

      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '10px',
          fontSize: '0.8rem',
          color: 'var(--text-secondary)',
        }}
      >
        <span>
          {loading
            ? 'Cargando...'
            : `${auditLogs.length} de ${totalCount}${activeFilterFlag ? ' (filtrados)' : ''}`}
        </span>
      </div>

      <div
        className="table-container"
        tabIndex={0}
        role="region"
        aria-label="Registros de auditoría"
        style={{ maxHeight: 'min(680px, 75vh)', overflow: 'auto' }}
      >
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ position: 'sticky', insetBlockStart: 0, zIndex: 1 }}>
            <tr>
              <th style={{ padding: '10px 12px', backgroundColor: '#F9FAFB', whiteSpace: 'nowrap' }}>Fecha</th>
              <th style={{ padding: '10px 12px', backgroundColor: '#F9FAFB', whiteSpace: 'nowrap' }}>Usuario</th>
              <th style={{ padding: '10px 12px', backgroundColor: '#F9FAFB', whiteSpace: 'nowrap' }}>Acción</th>
              <th style={{ padding: '10px 12px', backgroundColor: '#F9FAFB' }}>Operación</th>
              <th style={{ padding: '10px 12px', backgroundColor: '#F9FAFB', textAlign: 'right', whiteSpace: 'nowrap' }}>
                Detalle
              </th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  {loading ? 'Cargando...' : activeFilterFlag ? 'Sin resultados' : 'Sin registros'}
                </td>
              </tr>
            ) : (
              auditLogs.map((l) => {
                const rawUser = l.user?.username || l.username;
                const displayUser =
                  !rawUser || rawUser.toLowerCase() === 'system' || rawUser.toLowerCase() === 'sistema'
                    ? 'Sistema'
                    : rawUser;
                const actionBadge = resolveAuditBadge(l.action || l.category || '');
                const detailMsg = formatAuditMessage(l);
                const showErrorSubnote =
                  l.status === 'ERROR' &&
                  typeof l.errorMessage === 'string' &&
                  l.errorMessage.trim() !== '' &&
                  !detailMsg.includes(l.errorMessage.trim());
                const isExpanded = expandedLogId === l.id;

                return (
                  <Fragment key={l.id}>
                    <tr
                      onClick={() => {
                        if (window.getSelection()?.toString()) return;
                        toggleRow(l.id);
                      }}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: isExpanded ? '#F8FAFC' : undefined,
                      }}
                    >
                      <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {new Date(l.createdAt).toLocaleString('es-AR')}
                      </td>
                      <td style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{displayUser}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: actionBadge.bg,
                            color: actionBadge.color,
                            fontWeight: 700,
                            fontSize: '0.78rem',
                            padding: '2px 8px',
                            whiteSpace: 'nowrap',
                          }}
                        >
                          {actionBadge.label}
                        </span>
                      </td>
                      <td style={{ color: 'var(--text-primary)' }}>
                        <div>{detailMsg}</div>
                        {showErrorSubnote && (
                          <div style={{ marginTop: '3px', fontSize: '0.78rem', color: '#E30613', fontWeight: 500 }}>
                            Error: {l.errorMessage}
                          </div>
                        )}
                      </td>
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          aria-expanded={isExpanded}
                          aria-controls={`audit-detail-${l.id}`}
                          aria-label={`${isExpanded ? 'Ocultar' : 'Ver'} detalle de ${actionBadge.label}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleRow(l.id);
                          }}
                          style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                        >
                          {isExpanded ? 'Ocultar' : 'Ver'}
                          {isExpanded ? (
                            <ChevronUp size={13} aria-hidden="true" />
                          ) : (
                            <ChevronDown size={13} aria-hidden="true" />
                          )}
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr id={`audit-detail-${l.id}`}>
                        <td colSpan={5} style={{ padding: '0 12px 12px 12px', backgroundColor: '#F8FAFC' }}>
                          <AuditLogDetailPanel log={l} />
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setAuditPage((p) => Math.max(1, p - 1))}
          disabled={auditPage <= 1 || loading}
        >
          Anterior
        </button>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          Página {auditPage} de {auditTotalPages}
        </span>
        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))}
          disabled={auditPage >= auditTotalPages || loading}
        >
          Siguiente
        </button>
      </div>
    </div>
  );
}
