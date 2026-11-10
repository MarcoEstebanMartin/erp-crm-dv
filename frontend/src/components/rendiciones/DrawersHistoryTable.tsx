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
  onInspectDrawer
}: DrawersHistoryTableProps) {
  const [hoveredRowId, setHoveredRowId] = useState<number | null>(null);

  return (
    <div className="card" style={{ padding: '24px', marginTop: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Historial de Arqueos (Cajas Cerradas)</h3>
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Desde</span>
            <input
              type="date"
              className="input"
              value={filterStartDate}
              onChange={(e) => onFilterStartDateChange(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            />
          </div>
          <div className="form-group" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>Hasta</span>
            <input
              type="date"
              className="input"
              value={filterEndDate}
              onChange={(e) => onFilterEndDateChange(e.target.value)}
              style={{ padding: '6px 12px', fontSize: '0.85rem' }}
            />
          </div>
        </div>
      </div>

      <div className="table-responsive">
        <table className="table" style={{ width: '100%', textAlign: 'left', borderCollapse: 'collapse', fontSize: '0.88rem' }}>
          <thead>
            <tr style={{ backgroundColor: 'var(--bg-light)', borderBottom: '1px solid var(--border-color)' }}>
              <th style={{ padding: '12px' }}>Responsable / Caja</th>
              <th style={{ padding: '12px' }}>Apertura</th>
              <th style={{ padding: '12px' }}>Cierre</th>
              <th style={{ padding: '12px' }}>Fondo Inicial</th>
              <th style={{ padding: '12px' }}>Saldo Teórico</th>
              <th style={{ padding: '12px' }}>Arqueo Real</th>
              <th style={{ padding: '12px' }}>Ingreso Efectivo</th>
              <th style={{ padding: '12px' }}>Ingreso Cheques</th>
              <th style={{ padding: '12px' }}>Recaudación Total</th>
              <th style={{ padding: '12px' }}>Diferencia</th>
              <th style={{ padding: '12px', textAlign: 'center' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {loadingHistory ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                  Cargando historial de arqueos...
                </td>
              </tr>
            ) : filteredHistory.length === 0 ? (
              <tr>
                <td colSpan={11} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-secondary)' }}>
                  No hay historiales de cajas cerradas en este período.
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
                const isRep = d.drawerType === 'REPARTIDOR' || d.branch?.startsWith('REPARTIDOR');

                return (
                  <tr
                    key={d.id}
                    onClick={() => onInspectDrawer(d)}
                    style={{
                      borderBottom: '1px solid var(--border-color)',
                      cursor: 'pointer',
                      backgroundColor: hoveredRowId === d.id ? 'var(--bg-light)' : 'transparent',
                      transition: 'background-color 0.15s'
                    }}
                    onMouseEnter={() => setHoveredRowId(d.id)}
                    onMouseLeave={() => setHoveredRowId(null)}
                  >
                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span
                          style={{
                            padding: '2px 8px',
                            borderRadius: '12px',
                            fontSize: '0.72rem',
                            fontWeight: 600,
                            backgroundColor: isDepo ? '#f1f5f9' : isRep ? '#ecfdf5' : '#eff6ff',
                            color: isDepo ? '#475569' : isRep ? '#047857' : '#1d4ed8'
                          }}
                        >
                          {isDepo ? '🏢 Depósito' : isRep ? '🚚 Repartidor' : '💼 Vendedor'}
                        </span>
                      </div>
                      <div style={{ fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                        {d.branch === 'DEPOSITO' ? 'Caja Depósito' : formatResponsibleName(d)}
                      </div>
                      {d.routeNote && (
                        <div style={{ fontSize: '0.78rem', color: '#0284c7', marginTop: '3px', fontWeight: 500, display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <MapPin size={12} color="#0284c7" />
                          <span>{d.routeNote}</span>
                        </div>
                      )}
                      {d.notes && (
                        <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontStyle: 'italic', marginTop: '2px' }}>
                          Obs: {d.notes}
                        </div>
                      )}
                    </td>
                    <td style={{ padding: '12px', fontSize: '0.8rem' }}>
                      {new Date(d.openedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '12px', fontSize: '0.8rem' }}>
                      {new Date(d.closedAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                    </td>
                    <td style={{ padding: '12px' }}>
                      ${Number(d.openingBalance).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>
                      ${Number(d.closingBalance).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      ${Number(d.realBalance).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#047857' }}>
                      ${rowCash.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#1d4ed8' }}>
                      ${rowCheck.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700, color: '#0f172a' }}>
                      ${netIncome.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '12px', fontWeight: 600, color: dif >= 0 ? '#10b981' : '#ef4444' }}>
                      {dif > 0 ? '+' : ''}${dif.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>
                    <td style={{ padding: '12px', textAlign: 'center' }}>
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={(e) => {
                          e.stopPropagation();
                          onInspectDrawer(d);
                        }}
                        style={{ padding: '4px 8px', display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                        title="Ver detalle de recibos"
                      >
                        <Eye size={14} /> Ver
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
