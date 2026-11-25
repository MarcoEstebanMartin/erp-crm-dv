import { useState, type FC } from 'react';
import { Check, Pencil, X } from 'lucide-react';
import { formatArDisplayDate } from '../reportDateHelpers';

export interface TripProfitabilityRow {
  id: number;
  routeName: string;
  driverName: string;
  vehicleId: number | null;
  vehiclePlate: string;
  vehicleDescription: string | null;
  status: string;
  date: string;
  cities: string[];
  orderCount: number;
  totalRevenue: number;
  totalCost: number;
  grossProfit: number;
  grossMarginPct: number;
  tripKm: number | null;
  costPerKm: number;
  estimatedFuelCost: number;
  tripExpenses: number;
  totalTripCost: number;
  netProfit: number;
  netMarginPct: number;
}

interface ProfitabilityTripsTableProps {
  trips: TripProfitabilityRow[];
  kpis?: {
    totalRoutes: number;
    routesWithTripCost: number;
    totalRevenue: number;
    totalGrossProfit: number;
    totalTripCost: number;
    totalNetProfit: number;
    overallNetMarginPct: number;
  } | null;
  loading: boolean;
  formatCurrency: (val: number) => string;
  onSaveTripCosts: (
    routeId: number,
    payload: { tripKm: number | null; tripExpenses: number },
  ) => Promise<void>;
}

export const ProfitabilityTripsTable: FC<ProfitabilityTripsTableProps> = ({
  trips,
  kpis,
  loading,
  formatCurrency,
  onSaveTripCosts,
}) => {
  const [editingId, setEditingId] = useState<number | null>(null);
  const [kmInput, setKmInput] = useState<string>('');
  const [expensesInput, setExpensesInput] = useState<string>('');
  const [saving, setSaving] = useState<boolean>(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const startEdit = (row: TripProfitabilityRow) => {
    setEditingId(row.id);
    setKmInput(row.tripKm !== null && row.tripKm > 0 ? String(row.tripKm) : '');
    setExpensesInput(row.tripExpenses > 0 ? String(row.tripExpenses) : '');
    setSaveError(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setSaveError(null);
  };

  const handleSave = async (routeId: number) => {
    const parsedKm = kmInput.trim() === '' ? null : Number(kmInput.replace(',', '.'));
    const parsedExp = expensesInput.trim() === '' ? 0 : Number(expensesInput.replace(',', '.'));

    if ((parsedKm !== null && (Number.isNaN(parsedKm) || parsedKm < 0)) || Number.isNaN(parsedExp) || parsedExp < 0) {
      setSaveError('Ingresá valores numéricos válidos.');
      return;
    }

    setSaving(true);
    setSaveError(null);
    try {
      await onSaveTripCosts(routeId, { tripKm: parsedKm, tripExpenses: parsedExp });
      setEditingId(null);
    } catch (err: any) {
      setSaveError(err?.message || 'No se pudo guardar el costo del viaje.');
    } finally {
      setSaving(false);
    }
  };

  const netProfitTotal = kpis?.totalNetProfit || 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {kpis && kpis.totalRoutes > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
          <div className="card" style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Utilidad bruta viajes</span>
            <span className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {formatCurrency(kpis.totalGrossProfit)}
            </span>
          </div>
          <div className="card" style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Costo viajes</span>
            <span className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 700, color: '#475569' }}>
              {formatCurrency(kpis.totalTripCost)}
            </span>
          </div>
          <div className="card" style={{ padding: '12px 16px', borderRadius: '10px', border: '1px solid var(--border-color)', borderLeft: `3px solid ${netProfitTotal >= 0 ? '#047857' : 'var(--color-corp-red)'}` }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Utilidad neta viajes</span>
            <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 700, color: netProfitTotal >= 0 ? '#047857' : 'var(--color-corp-red)' }}>
                {formatCurrency(netProfitTotal)}
              </span>
              <span style={{ backgroundColor: netProfitTotal >= 0 ? '#ecfdf5' : '#fef2f2', color: netProfitTotal >= 0 ? '#047857' : 'var(--color-corp-red)', fontWeight: 600, fontSize: '0.74rem', padding: '2px 6px', borderRadius: '4px' }}>
                {kpis.overallNetMarginPct}%
              </span>
            </div>
          </div>
        </div>
      )}

      {saveError && (
        <div role="alert" style={{ padding: '8px 12px', borderRadius: '8px', backgroundColor: '#fef2f2', color: 'var(--color-corp-red)', fontSize: '0.82rem', fontWeight: 500 }}>
          {saveError}
        </div>
      )}

      <div
        className="table-container table-container--sticky"
        role="region"
        aria-label="Rentabilidad por viaje"
        tabIndex={0}
        style={{ margin: 0, border: '1px solid var(--border-color)', borderRadius: '10px' }}
      >
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.83rem' }}>
          <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid var(--border-color)' }}>
            <tr>
              <th scope="col" style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Fecha</th>
              <th scope="col" style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Ruta / Vehículo</th>
              <th scope="col" style={{ padding: '10px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Chofer</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Pedidos</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Facturación</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Utilidad bruta</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Km</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Comb. est.</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Viáticos</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 700 }}>Utilidad neta</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-primary)', fontWeight: 700 }}>Margen %</th>
              <th scope="col" style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Costo viaje</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={12} style={{ padding: '28px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Cargando viajes...
                </td>
              </tr>
            ) : trips.length === 0 ? (
              <tr>
                <td colSpan={12} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                  Sin hojas de ruta en este período.
                </td>
              </tr>
            ) : (
              trips.map((row) => {
                const isEditing = editingId === row.id;
                const isNetNegative = row.netProfit < 0;
                const dateLabel = row.date ? formatArDisplayDate(row.date.slice(0, 10)) : '-';

                return (
                  <tr key={row.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td className="tabular-nums" style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {dateLabel}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{row.routeName}</div>
                      <div style={{ fontSize: '0.73rem', color: 'var(--text-muted)' }}>
                        {row.vehiclePlate}
                        {row.cities.length > 0 ? ` · ${row.cities.join(', ')}` : ''}
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{row.driverName}</td>
                    <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }}>
                      {row.orderCount}
                    </td>
                    <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {formatCurrency(row.totalRevenue)}
                    </td>
                    <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', color: '#047857', fontWeight: 600 }}>
                      {formatCurrency(row.grossProfit)}
                    </td>
                    <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="1"
                          aria-label={`Km del viaje ${row.routeName}`}
                          className="input tabular-nums"
                          value={kmInput}
                          onChange={(e) => setKmInput(e.target.value)}
                          placeholder="0"
                          style={{ width: '76px', padding: '4px 6px', fontSize: '0.8rem', textAlign: 'right' }}
                        />
                      ) : row.tripKm !== null ? (
                        `${row.tripKm} km`
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', color: 'var(--text-secondary)' }} title={row.costPerKm > 0 ? `$${row.costPerKm}/km según FuelLog` : undefined}>
                      {row.estimatedFuelCost > 0 ? formatCurrency(row.estimatedFuelCost) : '—'}
                    </td>
                    <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          step="100"
                          aria-label={`Viáticos del viaje ${row.routeName}`}
                          className="input tabular-nums"
                          value={expensesInput}
                          onChange={(e) => setExpensesInput(e.target.value)}
                          placeholder="0"
                          style={{ width: '92px', padding: '4px 6px', fontSize: '0.8rem', textAlign: 'right' }}
                        />
                      ) : row.tripExpenses > 0 ? (
                        formatCurrency(row.tripExpenses)
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 700, color: isNetNegative ? 'var(--color-corp-red)' : '#047857' }}>
                      {formatCurrency(row.netProfit)}
                    </td>
                    <td className="tabular-nums" style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '6px', backgroundColor: isNetNegative ? '#fef2f2' : '#f1f5f9', color: isNetNegative ? 'var(--color-corp-red)' : '#0f172a', fontWeight: 600, fontSize: '0.78rem' }}>
                        {row.netMarginPct}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {isEditing ? (
                        <div style={{ display: 'inline-flex', gap: '4px' }}>
                          <button
                            type="button"
                            className="btn btn-primary"
                            disabled={saving}
                            onClick={() => handleSave(row.id)}
                            aria-label="Guardar costo"
                            style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                          >
                            <Check size={13} aria-hidden="true" />
                            Guardar
                          </button>
                          <button
                            type="button"
                            className="btn btn-secondary"
                            disabled={saving}
                            onClick={cancelEdit}
                            aria-label="Cancelar"
                            style={{ padding: '4px 6px', fontSize: '0.75rem' }}
                          >
                            <X size={13} aria-hidden="true" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          onClick={() => startEdit(row)}
                          style={{ padding: '4px 8px', fontSize: '0.75rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          <Pencil size={12} aria-hidden="true" />
                          Editar
                        </button>
                      )}
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
};
