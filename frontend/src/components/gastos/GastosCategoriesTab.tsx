import { Car, Trash2 } from 'lucide-react';
import {
  type CategoryStatItem,
  type Expense,
  formatPeso,
  getMethodLabel,
} from './gastos.types';

interface GastosCategoriesTabProps {
  expenses: Expense[];
  sortedCategories: CategoryStatItem[];
  isAdmin: boolean;
  onDeleteExpense: (id: number) => void;
}

export function GastosCategoriesTab({
  expenses,
  sortedCategories,
  isAdmin,
  onDeleteExpense,
}: GastosCategoriesTabProps) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '20px', alignItems: 'start' }}>
      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 16px 0' }}>Por categoría</h3>

        {sortedCategories.length === 0 ? (
          <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
            Sin gastos en el período
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {sortedCategories.map((cat, idx) => (
              <div key={cat.name} style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.84rem' }}>
                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>{cat.name}</span>
                  <span className="tabular-nums" style={{ display: 'flex', gap: '8px' }}>
                    <span style={{ fontWeight: 600 }}>{formatPeso(cat.amount)}</span>
                    <span style={{ color: 'var(--text-muted)' }}>{cat.pct.toFixed(1)}%</span>
                  </span>
                </div>
                <div style={{ width: '100%', height: '6px', backgroundColor: '#F3F4F6', borderRadius: '3px', overflow: 'hidden' }}>
                  <div
                    style={{
                      width: `${cat.pct}%`,
                      height: '100%',
                      backgroundColor: idx === 0 ? '#111827' : '#9CA3AF',
                      borderRadius: '3px',
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '20px' }}>
        <h3 style={{ fontSize: '0.95rem', fontWeight: 600, margin: '0 0 12px 0' }}>Movimientos</h3>

        <div className="table-container table-container--sticky" role="region" aria-label="Detalle de movimientos" tabIndex={0} style={{ marginTop: 0, maxHeight: '440px' }}>
          {expenses.length === 0 ? (
            <div style={{ padding: '32px 0', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.88rem' }}>
              Sin movimientos
            </div>
          ) : (
            <table>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Concepto</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
                  <th scope="col">Origen</th>
                  <th scope="col" style={{ width: '40px' }} aria-label="Eliminar" />
                </tr>
              </thead>
              <tbody>
                {expenses.map((e) => (
                  <tr key={e.id}>
                    <td className="tabular-nums" style={{ whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.82rem' }}>
                      {new Date(e.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                    </td>
                    <td>
                      <div style={{ fontWeight: 500, fontSize: '0.86rem' }}>{e.description}</div>
                      {e.vehicle && (
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <Car size={10} aria-hidden="true" />
                          <span>{e.vehicle.brand} {e.vehicle.model} ({e.vehicle.plate})</span>
                        </div>
                      )}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600, fontSize: '0.86rem' }}>
                      {formatPeso(Number(e.amount))}
                    </td>
                    <td style={{ color: 'var(--text-secondary)', fontSize: '0.78rem', whiteSpace: 'nowrap' }}>
                      {getMethodLabel(e.paymentMethod)}
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => onDeleteExpense(e.id)}
                          aria-label={`Eliminar ${e.description}`}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '4px' }}
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
