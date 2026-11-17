import React, { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { formatResponsibleName } from '../../utils/formatters';

interface FinanzasCierresHistoryTabProps {
  initialDrawers: any[];
  onInspectDrawer: (drawer: any) => void;
}

const PAGE_SIZE = 30;

export const FinanzasCierresHistoryTab: React.FC<FinanzasCierresHistoryTabProps> = ({
  initialDrawers,
  onInspectDrawer,
}) => {
  const [drawers, setDrawers] = useState<any[]>(initialDrawers.slice(0, PAGE_SIZE));
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
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
          Mostrando {drawers.length} {drawers.length === 1 ? 'cierre' : 'cierres'}
        </span>
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
            {drawers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  Sin cierres en este rango
                </td>
              </tr>
            ) : (
              drawers.map((d: any) => {
                const netAmount = Number(d.realBalance || 0) - Number(d.openingBalance || 0);
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
                          backgroundColor: d.drawerType === 'CENTRAL' ? '#f1f5f9' : '#ecfdf5',
                          color: d.drawerType === 'CENTRAL' ? '#334155' : '#047857',
                        }}
                      >
                        {d.drawerType === 'CENTRAL' ? 'Caja Grande' : 'Arqueo'}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>{formatResponsibleName(d)}</td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                      {d.transactions?.length || 0}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#047857' }}>
                      ${Math.round(netAmount).toLocaleString('es-AR')}
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
