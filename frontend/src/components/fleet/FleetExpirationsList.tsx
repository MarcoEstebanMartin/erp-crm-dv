import type { FC } from 'react';
import { Edit3, Trash2 } from 'lucide-react';
import {
  buildExpiryEntries,
  cleanGroupedExpiryLabel,
  getExpiryDisplayName,
  getExpiryLabel,
  isExpiryClose,
  isExpiryOverdue,
  type Expiry,
} from './fleet.types';

interface FleetExpirationsListProps {
  expirations: Expiry[];
  onEditExpiry: (e: Expiry) => void;
  onDeleteExpiry: (id: number) => void;
}

const getExpiryDateStyle = (dateStr: string) => {
  const overdue = isExpiryOverdue(dateStr);
  const close = isExpiryClose(dateStr);
  return {
    overdue,
    close,
    color: overdue ? 'var(--color-corp-red)' : close ? '#b45309' : '#64748b',
    fontWeight: overdue || close ? 600 : 500,
    formatted: new Date(dateStr).toLocaleDateString('es-AR'),
  };
};

export const FleetExpirationsList: FC<FleetExpirationsListProps> = ({
  expirations,
  onEditExpiry,
  onDeleteExpiry,
}) => {
  if (expirations.length === 0) {
    return (
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '6px 0' }}>
        Sin vencimientos cargados.
      </div>
    );
  }

  const entries = buildExpiryEntries(expirations);

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
      {entries.map((entry, idx) => {
        const isLast = idx === entries.length - 1;

        if (entry.kind === 'group') {
          const next = getExpiryDateStyle(entry.nextDate);
          const datePrefix = next.overdue ? 'Vencido ' : next.close ? 'Vence ' : 'Próx. ';

          return (
            <details key={entry.key} className="fleet-expiry-group">
              <summary
                className="fleet-expiry-summary"
                style={{
                  backgroundColor: next.overdue ? 'rgba(var(--color-corp-red-rgb), 0.025)' : 'transparent',
                }}
              >
                <span className="fleet-expiry-summary-left">
                  <span style={{ fontSize: '0.85rem', fontWeight: 600, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {entry.label}
                  </span>
                  <span
                    className="tabular-nums"
                    style={{
                      fontSize: '0.72rem',
                      fontWeight: 600,
                      color: '#64748b',
                      backgroundColor: '#f1f5f9',
                      padding: '1px 6px',
                      borderRadius: '999px',
                    }}
                  >
                    {entry.items.length}
                  </span>
                </span>
                <span
                  className="tabular-nums"
                  style={{ fontSize: '0.78rem', fontWeight: next.fontWeight, color: next.color, whiteSpace: 'nowrap', flexShrink: 0 }}
                >
                  {datePrefix}{next.formatted}
                </span>
              </summary>

              <div style={{ borderTop: '1px solid #f1f5f9', backgroundColor: '#fafbfc' }}>
                {entry.items.map((exp, itemIdx) => {
                  const dateInfo = getExpiryDateStyle(exp.expirationDate);
                  const label = cleanGroupedExpiryLabel(exp);
                  return (
                    <div
                      key={exp.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 14px 8px 30px',
                        borderBottom: itemIdx < entry.items.length - 1 ? '1px solid #f1f5f9' : 'none',
                        backgroundColor: dateInfo.overdue ? 'rgba(var(--color-corp-red-rgb), 0.03)' : 'transparent',
                        gap: '12px',
                      }}
                    >
                      <span style={{ fontSize: '0.83rem', fontWeight: 500, color: '#1e293b', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                        {label}
                      </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                        <span className="tabular-nums" style={{ fontSize: '0.78rem', fontWeight: dateInfo.fontWeight, color: dateInfo.color }}>
                          {dateInfo.overdue ? 'Vencido ' : 'Vence '}{dateInfo.formatted}
                        </span>
                        <button
                          type="button"
                          onClick={() => onEditExpiry(exp)}
                          style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px', display: 'inline-flex' }}
                          aria-label={`Editar ${label}`}
                        >
                          <Edit3 size={13} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => onDeleteExpiry(exp.id)}
                          style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px', display: 'inline-flex' }}
                          aria-label={`Eliminar ${label}`}
                        >
                          <Trash2 size={13} aria-hidden="true" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </details>
          );
        }

        const exp = entry.expiry;
        const dateInfo = getExpiryDateStyle(exp.expirationDate);
        const displayName = getExpiryDisplayName(exp);
        const typeLabel = getExpiryLabel(exp.type);
        const showTypeBadge = exp.type !== 'OTHER' && displayName.toLowerCase() !== typeLabel.toLowerCase();

        return (
          <div
            key={entry.key}
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              borderBottom: isLast ? 'none' : '1px solid #f1f5f9',
              backgroundColor: dateInfo.overdue ? 'rgba(var(--color-corp-red-rgb), 0.025)' : 'transparent',
              gap: '12px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
              <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {displayName}
              </span>
              {showTypeBadge && (
                <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748b', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                  {typeLabel}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
              <span className="tabular-nums" style={{ fontSize: '0.78rem', fontWeight: dateInfo.fontWeight, color: dateInfo.color }}>
                {dateInfo.overdue ? 'Vencido ' : 'Vence '}{dateInfo.formatted}
              </span>
              <button
                type="button"
                onClick={() => onEditExpiry(exp)}
                style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px', display: 'inline-flex' }}
                aria-label={`Editar ${displayName}`}
              >
                <Edit3 size={13} aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() => onDeleteExpiry(exp.id)}
                style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px', display: 'inline-flex' }}
                aria-label={`Eliminar ${displayName}`}
              >
                <Trash2 size={13} aria-hidden="true" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};
