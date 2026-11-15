import { Fuel, Plus, Trash2, AlertCircle, RefreshCw, X } from 'lucide-react';
import { useFuelControl } from './fuel/useFuelControl';
import { FuelKpisAndRanking } from './fuel/FuelKpisAndRanking';
import { FuelCreateModal } from './fuel/FuelCreateModal';

interface FuelControlDashboardProps {
  vehicles?: any[];
  onRefreshVehicles?: () => void;
}

const DEFAULT_SUMMARY = {
  totalFleetSpent: 0,
  totalFleetLiters: 0,
  totalFleetKmTraveled: 0,
  averageFleetLitersPer100Km: 0,
  activeVehiclesCount: 0,
};

export default function FuelControlDashboard({ vehicles: vehiclesProp, onRefreshVehicles }: FuelControlDashboardProps) {
  const f = useFuelControl({ vehiclesProp, onRefreshVehicles });
  const summary = f.analytics?.summary || DEFAULT_SUMMARY;
  const vehicleStats = f.analytics?.vehicleStats || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Fuel size={20} aria-hidden="true" />
          Combustible
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={f.loadData} disabled={f.loading} style={{ fontSize: '0.8rem' }}>
            <RefreshCw size={14} aria-hidden="true" /> Actualizar
          </button>
          <button type="button" className="btn btn-primary" onClick={() => f.handleOpenModal()} style={{ fontSize: '0.8rem' }}>
            <Plus size={15} aria-hidden="true" /> Cargar Combustible
          </button>
        </div>
      </div>

      {f.error && (
        <div role="alert" style={{ padding: '12px 16px', backgroundColor: 'rgba(239, 68, 68, 0.05)', border: '1px solid rgba(239, 68, 68, 0.2)', color: '#DC2626', borderRadius: '6px', fontSize: '0.84rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>{f.error}</span>
          </span>
          <button type="button" className="btn btn-ghost" style={{ padding: '2px' }} onClick={() => f.setError(null)} aria-label="Cerrar alerta">
            <X size={15} aria-hidden="true" />
          </button>
        </div>
      )}

      <FuelKpisAndRanking summary={summary} vehicleStats={vehicleStats} />

      <div style={{ backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Historial de Cargas</h3>

          <search aria-label="Filtrar cargas de combustible" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <label htmlFor="fuel-vehicle-filter" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 500, margin: 0 }}>Vehículo</label>
            <select
              id="fuel-vehicle-filter"
              value={f.selectedVehicleFilter}
              onChange={(e) => f.setSelectedVehicleFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="select"
              style={{ fontSize: '0.8rem', minWidth: '210px' }}
            >
              <option value="ALL">Todos ({f.vehicles.length})</option>
              {f.vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.brand} {v.model} - {v.plate}</option>
              ))}
            </select>
          </search>
        </div>

        {f.filteredLogs.length === 0 ? (
          <div style={{ padding: '32px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sin cargas registradas.</div>
        ) : (
          <div className="table-container table-container--sticky" role="region" aria-label="Historial de cargas de combustible" tabIndex={0}>
            <table style={{ width: '100%', fontSize: '0.83rem' }}>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Vehículo</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Odómetro</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Litros</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Precio / L</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Total</th>
                  <th scope="col" style={{ textAlign: 'center' }}>Tanque</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {f.filteredLogs.map((log) => (
                  <tr key={log.id}>
                    <td className="tabular-nums" style={{ color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                      {new Date(log.date).toLocaleDateString('es-AR')}
                    </td>
                    <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>
                      {log.vehicle ? `${log.vehicle.brand} ${log.vehicle.model}` : 'General'}
                      <span className="tabular-nums" style={{ marginLeft: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>({log.vehicle?.plate})</span>
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontFamily: 'monospace', fontWeight: 600 }}>{log.odometer.toLocaleString('es-AR')} km</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700 }}>{Number(log.liters).toFixed(1)} L</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>${Number(log.pricePerLiter || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700 }}>${Number(log.totalCost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                    <td style={{ textAlign: 'center' }}>
                      <span style={{ padding: '2px 6px', backgroundColor: log.isFullTank ? '#ECFDF5' : '#F3F4F6', color: log.isFullTank ? '#059669' : '#4B5563', fontSize: '0.72rem', fontWeight: 600, borderRadius: '4px', border: log.isFullTank ? '1px solid #A7F3D0' : 'none' }}>
                        {log.isFullTank ? 'Lleno' : 'Parcial'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" onClick={() => f.handleDeleteLog(log.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }} aria-label="Eliminar carga" title="Eliminar carga">
                        <Trash2 size={15} color="#EF4444" aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <FuelCreateModal
        isOpen={f.showModal}
        onClose={f.handleCloseModal}
        onSubmit={f.handleSubmit}
        submitting={f.submitting}
        modalError={f.modalError}
        vehicles={f.vehicles}
        bankAccounts={f.bankAccounts}
        form={f.form}
        setForm={f.setForm}
        onVehicleChange={f.handleVehicleChange}
        onCostOrLitersChange={f.handleCostOrLitersChange}
      />
    </div>
  );
}
