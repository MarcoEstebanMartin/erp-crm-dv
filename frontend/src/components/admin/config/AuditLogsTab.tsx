import { useState, useEffect } from 'react';
import { FileText } from 'lucide-react';
import { api } from '../../../utils/api';
import { resolveAuditBadge } from './auditLogDictionary';
import { formatAuditMessage } from './auditLogFormatter';

export default function AuditLogsTab() {
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);

  useEffect(() => {
    api.getAuditLogs(auditPage, 30)
      .then((res: any) => {
        setAuditLogs(res?.logs || []);
        const totalPages = Number(res?.pagination?.totalPages ?? res?.totalPages ?? 1);
        setAuditTotalPages(Math.max(1, totalPages));
      })
      .catch(() => {
        setAuditLogs([]);
        setAuditTotalPages(1);
      });
  }, [auditPage]);

  return (
    <div className="card" style={{ padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
        <div>
          <h3
            id="audit-logs-heading"
            className="card-title"
            style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}
          >
            <FileText size={20} color="var(--color-primary)" /> Registro de Auditoría del Sistema
          </h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Historial completo en español de ingresos y operaciones realizadas por usuarios y procesos automáticos.
          </p>
        </div>
      </div>

      <div
        className="table-container"
        tabIndex={0}
        role="region"
        aria-labelledby="audit-logs-heading"
        style={{ maxHeight: 'min(680px, 75vh)', overflow: 'auto' }}
      >
        <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'separate', borderSpacing: 0 }}>
          <thead style={{ position: 'sticky', insetBlockStart: 0, zIndex: 1 }}>
            <tr>
              <th style={{ padding: '10px 12px', backgroundColor: '#F9FAFB', whiteSpace: 'nowrap' }}>Fecha y Hora</th>
              <th style={{ padding: '10px 12px', backgroundColor: '#F9FAFB', whiteSpace: 'nowrap' }}>Usuario en Sesión</th>
              <th style={{ padding: '10px 12px', backgroundColor: '#F9FAFB', whiteSpace: 'nowrap' }}>Acción / Categoría</th>
              <th style={{ padding: '10px 12px', backgroundColor: '#F9FAFB' }}>Detalle de la Operación</th>
            </tr>
          </thead>
          <tbody>
            {auditLogs.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  No hay registros de auditoría disponibles en esta página.
                </td>
              </tr>
            ) : (
              auditLogs.map((l) => {
                const rawUser = l.user?.username || l.username;
                const displayUser =
                  !rawUser || rawUser.toLowerCase() === 'system' || rawUser.toLowerCase() === 'sistema'
                    ? 'Sistema (Automático)'
                    : rawUser;
                const actionBadge = resolveAuditBadge(l.action || l.category || '');
                const detailMsg = formatAuditMessage(l);
                const showErrorSubnote =
                  l.status === 'ERROR' &&
                  typeof l.errorMessage === 'string' &&
                  l.errorMessage.trim() !== '' &&
                  !detailMsg.includes(l.errorMessage.trim());

                return (
                  <tr key={l.id}>
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
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
        <button className="btn btn-secondary" onClick={() => setAuditPage((p) => Math.max(1, p - 1))} disabled={auditPage <= 1}>
          Anterior
        </button>
        <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>
          Página {auditPage} de {auditTotalPages}
        </span>
        <button className="btn btn-secondary" onClick={() => setAuditPage((p) => Math.min(auditTotalPages, p + 1))} disabled={auditPage >= auditTotalPages}>
          Siguiente
        </button>
      </div>
    </div>
  );
}
