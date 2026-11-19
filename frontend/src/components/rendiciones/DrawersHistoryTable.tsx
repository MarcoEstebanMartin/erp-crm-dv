import { useState } from 'react';
import { Eye, MapPin } from 'lucide-react';
import { formatResponsibleName } from '../../utils/formatters';

interface DrawersHistoryTableProps {
  loadingHistory: boolean;
  filteredHistory: any[];
  filterStartDate: string;
  onFilterStartDateChange: (val: string) => void;
  filterEndDate: string;
  onFilterEndDateChange: (val: string) => void;
  onInspectDrawer: (drawer: any) => void;
}

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

  return (
    <div className="card" style={{ padding: '24px', marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
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

      <div className="table-container table-container--sticky" role="region" aria-label="Historial de arqueos" tabIndex={0}>
        <table style={{ fontSize: '0.86rem' }}>
          <thead>
            <tr>
              <th scope="col">Responsable</th>
              <th scope="col">Apertura</th>
              <th scope="col">Cierre</th>
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
            ) : filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                  Sin arqueos en el período.
                </td>
              </tr>
            ) : (
              filteredHistory.map((d: any) => {
                const dif = Number(d.realBalance) - Number(d.closingBalance);
                const netIncome = Number(d.realBalance) - Number(d.openingBalance);

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

                const isDepo = d.drawerType === 'DEPOSITO' || d.branch === 'DEPOSITO';
                const isCentral =
                  d.drawerType === 'CENTRAL' || d.branch === 'CENTRAL' || d.branch === 'CONSOLIDADA';
                const isRep = d.drawerType === 'REPARTIDOR' || d.branch?.startsWith('REPARTIDOR');

                const badgeBg = isCentral
                  ? '#fef3c7'
                  : isDepo
                  ? '#f1f5f9'
                  : isRep
                  ? '#ecfdf5'
                  : '#eff6ff';
                const badgeColor = isCentral
                  ? '#92400e'
                  : isDepo
                  ? '#475569'
                  : isRep
                  ? '#047857'
                  : '#1d4ed8';
                const badgeLabel = isCentral
                  ? 'Caja Grande'
                  : isDepo
                  ? 'Oficina'
                  : isRep
                  ? 'Repartidor'
                  : 'Vendedor';

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
                    <td style={{ fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor: badgeBg,
                            color: badgeColor,
                          }}
                        >
                          {badgeLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {isDepo ? 'Caja Oficina' : isCentral ? 'Caja Grande' : formatResponsibleName(d)}
                      </div>
                      {!isDepo && !isCentral && d.routeNote && (
                        <div style={{ fontSize: '0.78rem', color: '#0284c7', marginTop: '3px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} color="#0284c7" aria-hidden="true" />
                          <span>{d.routeNote}</span>
                        </div>
                      )}
                      {d.notes && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                          {d.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(d.openedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
                    <td style={{ fontSize: '0.8rem' }}>{new Date(d.closedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}</td>
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
