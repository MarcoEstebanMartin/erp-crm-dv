import { buildAuditLogInspection } from './auditLogDiffBuilder';

interface AuditLogDetailPanelProps {
  log: any;
}

const DELTA_COLORS: Record<'positive' | 'negative' | 'neutral', { bg: string; color: string }> = {
  positive: { bg: '#ECFDF5', color: '#047857' },
  negative: { bg: '#FEF2F2', color: '#B91C1C' },
  neutral: { bg: '#F1F5F9', color: '#475569' },
};

export default function AuditLogDetailPanel({ log }: AuditLogDetailPanelProps) {
  const inspection = buildAuditLogInspection(log);

  return (
    <div
      style={{
        backgroundColor: '#FFFFFF',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        padding: '14px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
          gap: '8px 14px',
          paddingBottom: '10px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        {inspection.metadata.map((item) => (
          <div key={item.label}>
            <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              {item.label}
            </div>
            <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)', marginTop: '2px' }}>
              {item.value}
            </div>
          </div>
        ))}
      </div>

      {inspection.errorBanner && (
        <div
          style={{
            borderLeft: '3px solid #E30613',
            backgroundColor: '#FEF2F2',
            padding: '8px 12px',
            borderRadius: '4px',
            fontSize: '0.82rem',
            color: '#991B1B',
            fontWeight: 500,
          }}
        >
          <strong>Motivo:</strong> {inspection.errorBanner}
        </div>
      )}

      {inspection.batchItems && inspection.batchItems.length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            Productos ajustados ({inspection.batchItems.length})
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '7px 10px', textAlign: 'left' }}>Producto</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Anterior</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Nuevo</th>
                  <th style={{ padding: '7px 10px', textAlign: 'right', whiteSpace: 'nowrap' }}>Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {inspection.batchItems.map((item, idx) => {
                  const badgeStyle = DELTA_COLORS[item.tone];
                  return (
                    <tr key={`${item.productId}-${idx}`} style={{ borderTop: idx > 0 ? '1px solid var(--border-color)' : undefined }}>
                      <td style={{ padding: '7px 10px', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {item.productLabel}
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                        {item.before}
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>
                        {item.after}
                      </td>
                      <td style={{ padding: '7px 10px', textAlign: 'right' }}>
                        <span
                          style={{
                            display: 'inline-block',
                            padding: '1px 7px',
                            borderRadius: '4px',
                            fontWeight: 700,
                            fontSize: '0.76rem',
                            backgroundColor: badgeStyle.bg,
                            color: badgeStyle.color,
                          }}
                        >
                          {item.delta}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {inspection.changes.length > 0 && (
        <div>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '6px' }}>
            {inspection.hasBeforeColumn ? 'Cambios' : 'Datos'}
          </div>
          <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
            <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid var(--border-color)' }}>
                  <th style={{ padding: '7px 10px', textAlign: 'left', width: '28%' }}>Campo</th>
                  {inspection.hasBeforeColumn && (
                    <th style={{ padding: '7px 10px', textAlign: 'left', width: '36%' }}>Anterior</th>
                  )}
                  <th style={{ padding: '7px 10px', textAlign: 'left' }}>
                    {inspection.hasBeforeColumn ? 'Nuevo' : 'Valor'}
                  </th>
                </tr>
              </thead>
              <tbody>
                {inspection.changes.map((row, idx) => (
                  <tr key={row.key} style={{ borderTop: idx > 0 ? '1px solid var(--border-color)' : undefined }}>
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {row.label}
                    </td>
                    {inspection.hasBeforeColumn && (
                      <td style={{ padding: '7px 10px', color: '#6B7280', textDecoration: row.after ? 'line-through' : 'none' }}>
                        {row.before ?? '—'}
                      </td>
                    )}
                    <td style={{ padding: '7px 10px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {row.after ?? '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {!inspection.errorBanner && !inspection.batchItems?.length && inspection.changes.length === 0 && (
        <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Sin detalle adicional
        </p>
      )}
    </div>
  );
}
