import { useState } from 'react';
import { Eye, MapPin } from 'lucide-react';
import { classifyDrawerHistoryRow, DrawerKind, formatDrawerDateSummary } from './drawerHistoryHelpers';

interface DrawersHistoryTableProps {
  loadingHistory: boolean;
  filteredHistory: any[];
  filterStartDate: string;
  onFilterStartDateChange: (val: string) => void;
  filterEndDate: string;
  onFilterEndDateChange: (val: string) => void;
  onInspectDrawer: (drawer: any) => void;
}

type KindFilter = 'ALL' | DrawerKind;

const KIND_FILTERS: Array<{ key: KindFilter; label: string }> = [
  { key: 'ALL', label: 'Todos' },
  { key: 'DEPOSITO', label: 'Caja Oficina' },
  { key: 'VENDEDOR', label: 'Vendedores' },
  { key: 'REPARTIDOR', label: 'Reparto' },
  { key: 'ADMINISTRACION', label: 'Mostrador' },
];

export default function DrawersHistoryTable({
  loadingHistory,
  filteredHistory,
  filterStartDate,
  onFilterStartDateChange,
  filterEndDate,
  onFilterEndDateChange,
  onInspectDrawer,
}: DrawersHistoryTableProps) {
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);
  const [kindFilter, setKindFilter] = useState<KindFilter>('ALL');

  const classifiedRows = filteredHistory.map((d: any) => ({ drawer: d, meta: classifyDrawerHistoryRow(d) }));
  const visibleRows = kindFilter === 'ALL' ? classifiedRows : classifiedRows.filter((row) => row.meta.kind === kindFilter);

  return (
    <div className="card" style={{ padding: '24px', marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Historial de Arqueos</h3>
        <search aria-label="Filtrar historial de arqueos" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="hist-start-date" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Desde</label>
            <input
              id="hist-start-date"
              type="date"
              className="input"
              value={filterStartDate}
              onChange={(e) => onFilterStartDateChange(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="hist-end-date" style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Hasta</label>
            <input
              id="hist-end-date"
              type="date"
              className="input"
              value={filterEndDate}
              onChange={(e) => onFilterEndDateChange(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '0.85rem', width: 'auto' }}
            />
          </div>
        </search>
      </div>

      <div role="group" aria-label="Filtrar por tipo de cierre" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '16px' }}>
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

      <div className="table-container table-container--sticky" role="region" aria-label="Historial de arqueos" tabIndex={0}>
        <table style={{ fontSize: '0.86rem' }}>
          <thead>
            <tr>
              <th scope="col">Tipo</th>
              <th scope="col">Responsable</th>
              <th scope="col">Fecha</th>
              <th scope="col">Fondo Inicial</th>
              <th scope="col">Saldo Teórico</th>
              <th scope="col">Arqueo Real</th>
              <th scope="col">Efectivo</th>
              <th scope="col">Cheques</th>
              <th scope="col">Recaudación</th>
              <th scope="col">Diferencia</th>
              <th scope="col" style={{ textAlign: 'center' }}>Detalle</th>
            </tr>
          </thead>
          <tbody>
            {loadingHistory ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                  Cargando historial...
                </td>
              </tr>
            ) : visibleRows.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                  Sin arqueos en el período.
                </td>
              </tr>
            ) : (
              visibleRows.map(({ drawer: d, meta }) => {
                const dif = Number(d.realBalance) - Number(d.closingBalance);
                const netIncome = meta.isCentral
                  ? Number(d.realBalance ?? 0)
                  : Number(d.realBalance) - Number(d.openingBalance);

                let rowCash = 0;
                let rowCheck = 0;
                d.transactions?.forEach((t: any) => {
                  if (t.type === 'INCOME') {
                    if (t.paymentMethod === 'CASH') rowCash += Number(t.amount);
                    if (t.paymentMethod === 'CHECK') rowCheck += Number(t.amount);
                  } else if (t.type === 'OUTCOME') {
                    if (t.paymentMethod === 'CASH') rowCash -= Number(t.amount);
                    if (t.paymentMethod === 'CHECK') rowCheck -= Number(t.amount);
                  }
                });

                const dateInfo = formatDrawerDateSummary(d, meta.isDepo);

                return (
                  <tr
                    key={d.id}
                    onClick={() => onInspectDrawer(d)}
                    style={{
                      cursor: 'pointer',
                      backgroundColor: hoveredRowId === d.id ? 'var(--bg-light)' : 'transparent',
                      transition: 'background-color 0.15s',
                    }}
                    onMouseEnter={() => setHoveredRowId(d.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                  >
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 9px',
                          borderRadius: '12px',
                          fontSize: '0.73rem',
                          fontWeight: 600,
                          backgroundColor: meta.badgeBg,
                          color: meta.badgeColor,
                        }}
                      >
                        {meta.badgeLabel}
                      </span>
                    </td>
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {meta.responsibleName}
                      </div>
                      {meta.activitySummary && (
                        <div
                          title={meta.activitySummary}
                          style={{
                            fontSize: '0.76rem',
                            color: 'var(--text-secondary)',
                            fontWeight: 500,
                            marginTop: '2px',
                            whiteSpace: 'nowrap',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            maxWidth: '240px',
                          }}
                        >
                          {meta.activitySummary}
                        </div>
                      )}
                      {meta.showRouteNote && (
                        <div style={{ fontSize: '0.78rem', color: '#0284c7', marginTop: '3px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} color="#0284c7" aria-hidden="true" />
                          <span>{d.routeNote}</span>
                        </div>
                      )}
                      {!meta.isCentral && d.notes && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                          {d.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.82rem', whiteSpace: 'nowrap' }}>
                      <time dateTime={dateInfo.isoDateTime} className="tabular-nums" style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                        {dateInfo.primaryLabel}
                      </time>
                      {dateInfo.rangeLabel && (
                        <div className="tabular-nums" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {dateInfo.rangeLabel}
                        </div>
                      )}
                    </td>
                    <td className="tabular-nums">${Number(d.openingBalance).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                    <td className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>${Number(d.closingBalance).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                    <td className="tabular-nums" style={{ fontWeight: 600 }}>${Number(d.realBalance).toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                    <td className="tabular-nums" style={{ fontWeight: 600, color: '#047857' }}>${rowCash.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                    <td className="tabular-nums" style={{ fontWeight: 600, color: '#1d4ed8' }}>${rowCheck.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                    <td className="tabular-nums" style={{ fontWeight: 700, color: '#0f172a' }}>${netIncome.toLocaleString('es-AR', { maximumFractionDigits: 0 })}</td>
                    <td className="tabular-nums" style={{ fontWeight: 600, color: dif >= 0 ? '#10b981' : '#ef4444' }}>
                      {dif > 0 ? '+' : ''}${dif.toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectDrawer(d);
                        }}
                        style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                      >
                        <Eye size={14} aria-hidden="true" /> Ver
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
