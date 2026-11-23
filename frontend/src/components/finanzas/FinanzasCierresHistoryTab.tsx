import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { classifyDrawerHistoryRow, type DrawerKind } from '../rendiciones/drawerHistoryHelpers';

interface FinanzasCierresHistoryTabProps {
  initialDrawers: any[];
  onInspectDrawer: (drawer: any) => void;
}

const PAGE_SIZE = 30;
type KindFilter = 'ALL' | DrawerKind;

const KIND_FILTERS: Array<{ key: KindFilter; label: string }> = [
  { key: 'ALL', label: 'Todos' },
  { key: 'CENTRAL', label: 'Caja Grande' },
  { key: 'DEPOSITO', label: 'Caja Oficina' },
  { key: 'VENDEDOR', label: 'Vendedores' },
  { key: 'REPARTIDOR', label: 'Reparto' },
  { key: 'ADMINISTRACION', label: 'Mostrador' },
];

export const FinanzasCierresHistoryTab: React.FC<FinanzasCierresHistoryTabProps> = ({
  initialDrawers,
  onInspectDrawer,
}) => {
  const [drawers, setDrawers] = useState<any[]>(initialDrawers.slice(0, PAGE_SIZE));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [kindFilter, setKindFilter] = useState<KindFilter>('ALL');
  const [loading, setLoading] = useState(false);
  const [hasMore, setHasMore] = useState(initialDrawers.length >= PAGE_SIZE);

  useEffect(() => {
    if (!startDate && !endDate) {
      setDrawers(initialDrawers.slice(0, PAGE_SIZE));
      setHasMore(initialDrawers.length >= PAGE_SIZE);
    }
  }, [initialDrawers]);

  const fetchHistory = async (offset = 0, append = false) => {
    setLoading(true);
    try {
      const rows = await api.getCashDrawers({
        limit: PAGE_SIZE,
        offset,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
      });
      setDrawers((prev) => (append ? [...prev, ...rows] : rows));
      setHasMore(rows.length >= PAGE_SIZE);
    } finally {
      setLoading(false);
    }
  };

  const classifiedRows = drawers.map((d: any) => ({ drawer: d, meta: classifyDrawerHistoryRow(d) }));
  const visibleRows = kindFilter === 'ALL' ? classifiedRows : classifiedRows.filter((row) => row.meta.kind === kindFilter);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="date"
            aria-label="Cierres desde"
            className="input"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            style={{ width: '150px', height: '34px', fontSize: '0.82rem' }}
          />
          <input
            type="date"
            aria-label="Cierres hasta"
            className="input"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            style={{ width: '150px', height: '34px', fontSize: '0.82rem' }}
          />
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={() => fetchHistory(0, false)}
            style={{ height: '34px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}
          >
            <RefreshCw size={13} aria-hidden="true" /> {loading ? '...' : 'Filtrar'}
          </button>
          {(startDate || endDate) && (
            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => {
                setStartDate('');
                setEndDate('');
                setDrawers(initialDrawers.slice(0, PAGE_SIZE));
                setHasMore(initialDrawers.length >= PAGE_SIZE);
              }}
              style={{ height: '34px', fontSize: '0.8rem' }}
            >
              Limpiar
            </button>
          )}
        </div>
        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          Mostrando {visibleRows.length} {visibleRows.length === 1 ? 'cierre' : 'cierres'}
        </span>
      </div>

      <div role="group" aria-label="Filtrar cierres por tipo" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
        {KIND_FILTERS.map((f) => {
          const active = kindFilter === f.key;
          return (
            <button
              key={f.key}
              type="button"
              aria-pressed={active}
              onClick={() => setKindFilter(f.key)}
              style={{
                padding: '5px 12px',
                borderRadius: '999px',
                fontSize: '0.78rem',
                fontWeight: 600,
                cursor: 'pointer',
                border: active ? '1px solid #0f172a' : '1px solid var(--border-color)',
                backgroundColor: active ? '#0f172a' : 'transparent',
                color: active ? '#ffffff' : 'var(--text-secondary)',
                transition: 'all 0.15s',
              }}
            >
              {f.label}
            </button>
          );
        })}
      </div>

      <div className="table-container table-container--sticky" role="region" aria-label="Historial de cierres y arqueos" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Cierre</th>
              <th scope="col">Tipo</th>
              <th scope="col">Responsable</th>
              <th scope="col">Recibos</th>
              <th scope="col" style={{ textAlign: 'right' }}>Saldo Real</th>
            </tr>
          </thead>
          <tbody>
            {visibleRows.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  Sin cierres en este rango
                </td>
              </tr>
            ) : (
              visibleRows.map(({ drawer: d, meta }) => {
                const displayAmount = meta.isCentral
                  ? Number(d.realBalance ?? 0)
                  : Number(d.realBalance ?? 0) - Number(d.openingBalance ?? 0);
                const amountColor = displayAmount < 0 ? '#c53030' : meta.isCentral ? 'var(--text-primary)' : '#047857';
                const formattedAmount = `${displayAmount < 0 ? '-' : ''}$${Math.round(Math.abs(displayAmount)).toLocaleString('es-AR')}`;
                return (
                  <tr key={d.id} style={{ cursor: 'pointer' }} onClick={() => onInspectDrawer(d)}>
                    <td style={{ fontSize: '0.82rem' }}>
                      {new Date(d.closedAt || d.openedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: '12px',
                          fontSize: '0.72rem',
                          fontWeight: 600,
                          backgroundColor: meta.badgeBg,
                          color: meta.badgeColor,
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {meta.badgeLabel}
                      </span>
                    </td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{meta.responsibleName}</div>
                      {meta.activitySummary && (
                        <div
                          title={meta.activitySummary}
                          style={{
                            fontSize: '0.75rem',
                            color: 'var(--text-secondary)',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '240px',
                          }}
                        >
                          {meta.activitySummary}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {meta.isCentral ? '—' : d.transactions?.length || 0}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: amountColor }}>
                      {formattedAmount}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {hasMore && (
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button
            type="button"
            className="btn btn-secondary"
            disabled={loading}
            onClick={() => fetchHistory(drawers.length, true)}
            style={{ fontSize: '0.82rem', padding: '6px 16px' }}
          >
            {loading ? 'Cargando...' : 'Cargar 30 más'}
          </button>
        </div>
      )}
    </div>
  );
};
