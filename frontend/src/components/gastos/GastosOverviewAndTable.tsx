import { Car, Trash2, TrendingDown } from 'lucide-react';
import {
  type CategoryStatItem,
  type Expense,
  getMethodLabel,
  getMonthName,
} from './gastos.types';

interface GastosOverviewAndTableProps {
  expenses: Expense[];
  selectedMonth: number;
  selectedYear: number;
  totalGasto: number;
  sortedCategories: CategoryStatItem[];
  isAdmin: boolean;
  onDeleteExpense: (id: number) => void;
}

export function GastosOverviewAndTable({
  expenses,
  selectedMonth,
  selectedYear,
  totalGasto,
  sortedCategories,
  isAdmin,
  onDeleteExpense,
}: GastosOverviewAndTableProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '24px', alignItems: 'stretch' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <div
          className="card"
          style={{
            padding: '24px',
            backgroundColor: '#111827',
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <div>
            <span style={{ fontSize: '0.84rem', fontWeight: 600, color: '#9CA3AF' }}>
              Total — {getMonthName(selectedMonth)} {selectedYear}
            </span>
            <h3 className="tabular-nums" style={{ fontSize: '2.3rem', fontWeight: 700, margin: '6px 0 4px 0', fontFamily: 'monospace', letterSpacing: '-0.02em', color: '#fff' }}>
              ${totalGasto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
            </h3>
            <span className="tabular-nums" style={{ fontSize: '0.84rem', color: '#9CA3AF' }}>
              {expenses.length} registros
            </span>
          </div>
          <div style={{ width: '52px', height: '52px', borderRadius: '12px', backgroundColor: 'rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <TrendingDown size={26} style={{ color: 'var(--color-corp-red)' }} aria-hidden="true" />
          </div>
        </div>

        <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', flex: 1 }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 16px 0' }}>Por Categoría</h3>

          {sortedCategories.length === 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '180px', color: 'var(--text-secondary)', gap: '10px' }}>
              <TrendingDown size={32} style={{ color: 'var(--text-muted)' }} aria-hidden="true" />
              <span style={{ fontSize: '0.9rem' }}>Sin gastos en el período</span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', overflowY: 'auto', maxHeight: '350px', paddingRight: '4px' }}>
              {sortedCategories.map((cat, idx) => (
                <div key={cat.name} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 500 }}>
                    <span style={{ color: 'var(--text-primary)' }}>{cat.name}</span>
                    <div className="tabular-nums" style={{ display: 'flex', gap: '10px' }}>
                      <span style={{ fontWeight: 600 }}>${cat.amount.toLocaleString('es-AR')}</span>
                      <span style={{ color: 'var(--text-muted)' }}>({cat.pct.toFixed(1)}%)</span>
                    </div>
                  </div>
                  <div style={{ width: '100%', height: '8px', backgroundColor: '#F3F4F6', borderRadius: '4px', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${cat.pct}%`,
                        height: '100%',
                        backgroundColor: idx === 0 ? 'var(--color-corp-red)' : 'var(--color-primary)',
                        borderRadius: '4px',
                        transition: 'width 0.8s cubic-bezier(0.25, 1, 0.5, 1)',
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="card" style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
        <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 12px 0' }}>Movimientos</h3>

        <div className="table-container table-container--sticky" role="region" aria-label="Listado de gastos" tabIndex={0} style={{ flex: 1, minHeight: '380px', marginTop: 0 }}>
          {expenses.length === 0 ? (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', padding: '40px 0', fontSize: '0.9rem' }}>
              Sin gastos registrados
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Descripción</th>
                  <th scope="col">Categoría</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Pago</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="tabular-nums" style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {new Date(e.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                    </td>
                    <td style={{ fontWeight: 500 }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span>{e.description}</span>
                        {e.vehicle && (
                          <span style={{ fontSize: '0.72rem', color: '#1a73e8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <Car size={10} aria-hidden="true" />
                            <span>{e.vehicle.brand} {e.vehicle.model} ({e.vehicle.plate})</span>
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span style={{ padding: '3px 8px', borderRadius: '4px', backgroundColor: '#F3F4F6', fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-primary)' }}>
                        {e.category?.name || 'General'}
                      </span>
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                      ${Number(e.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                    </td>
                    <td style={{ textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                      {getMethodLabel(e.paymentMethod)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(e.id)}
                          aria-label={`Eliminar gasto ${e.description}`}
                          style={{ background: 'none', border: 'none', color: 'var(--color-danger)', cursor: 'pointer', padding: '4px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
