import { Fuel, Plus, Trash2, AlertCircle, CheckCircle2, X } from 'lucide-react';
import { useFuelControl } from './fuel/useFuelControl';
import { FuelKpisAndRanking } from './fuel/FuelKpisAndRanking';
import { FuelCreateModal } from './fuel/FuelCreateModal';
import { FuelSettleModal } from './fuel/FuelSettleModal';

interface FuelControlDashboardProps {
  vehicles?: any[];
  onRefreshVehicles?: () => void;
}

const DEFAULT_SUMMARY = {
  totalFleetSpent: 0,
  totalFleetLiters: 0,
  totalPendingLiters: 0,
  totalPendingCount: 0,
  totalFleetKmTraveled: 0,
  averageFleetLitersPer100Km: 0,
  activeVehiclesCount: 0,
};

export default function FuelControlDashboard({ vehicles: vehiclesProp, onRefreshVehicles }: FuelControlDashboardProps) {
  const f = useFuelControl({ vehiclesProp, onRefreshVehicles });
  const summary = f.analytics?.summary || DEFAULT_SUMMARY;
  const vehicleStats = f.analytics?.vehicleStats || [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 18px', backgroundColor: 'var(--bg-card, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', flexWrap: 'wrap', gap: '10px' }}>
        <h2 style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-primary)' }}>
          <Fuel size={18} aria-hidden="true" />
          Combustible
        </h2>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {f.pendingLogs.length > 0 && (
            <button type="button" className="btn btn-secondary" onClick={f.handleOpenSettleModal} style={{ fontSize: '0.8rem' }}>
              <CheckCircle2 size={15} aria-hidden="true" /> Liquidar ({f.pendingLogs.length})
            </button>
          )}
          <button type="button" className="btn btn-primary" onClick={() => f.handleOpenModal()} style={{ fontSize: '0.8rem' }}>
            <Plus size={15} aria-hidden="true" /> Cargar Ticket
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
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
          <h3 style={{ fontSize: '0.9rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Tickets</h3>

          <search aria-label="Filtrar tickets de combustible" style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <select
              aria-label="Filtrar por estado"
              value={f.selectedStatusFilter}
              onChange={(e) => f.setSelectedStatusFilter(e.target.value as any)}
              className="select"
              style={{ fontSize: '0.8rem', minWidth: '130px' }}
            >
              <option value="ALL">Todos</option>
              <option value="PENDING">Pendientes</option>
              <option value="SETTLED">Liquidados</option>
            </select>

            <select
              aria-label="Filtrar por vehículo"
              value={f.selectedVehicleFilter}
              onChange={(e) => f.setSelectedVehicleFilter(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="select"
              style={{ fontSize: '0.8rem', minWidth: '200px' }}
            >
              <option value="ALL">Todos los vehículos ({f.vehicles.length})</option>
              {f.vehicles.map((v) => (
                <option key={v.id} value={v.id}>{v.brand} {v.model} ({v.plate})</option>
              ))}
            </select>
          </search>
        </div>

        {f.filteredLogs.length === 0 ? (
          <div style={{ padding: '28px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-muted)' }}>Sin tickets registrados.</div>
        ) : (
          <div className="table-container table-container--sticky" role="region" aria-label="Historial de tickets" tabIndex={0}>
            <table style={{ width: '100%', fontSize: '0.83rem' }}>
              <thead>
                <tr>
                  <th scope="col">Fecha</th>
                  <th scope="col">Vehículo</th>
                  <th scope="col">Ticket</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Odómetro</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Litros</th>
                  <th scope="col" style={{ textAlign: 'right' }}>Importe</th>
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
                      {log.vehicle ? `${log.vehicle.brand} ${log.vehicle.model}` : '—'}
                      <span className="tabular-nums" style={{ marginLeft: '6px', fontSize: '0.75rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>
                        {log.vehicle?.plate}
                      </span>
                    </td>
                    <td className="tabular-nums" style={{ fontFamily: 'monospace', color: 'var(--text-secondary)' }}>
                      {log.ticketNumber || '—'}
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontFamily: 'monospace' }}>
                      {log.odometer.toLocaleString('es-AR')} km
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700 }}>
                      {Number(log.liters).toFixed(2)} L
                    </td>
                    <td className="tabular-nums" style={{ textAlign: 'right' }}>
                      {log.status === 'SETTLED' && log.totalCost !== null ? (
                        <span style={{ fontWeight: 700 }}>
                          ${Number(log.totalCost).toLocaleString('es-AR', { maximumFractionDigits: 0 })}
                        </span>
                      ) : (
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 7px', borderRadius: '4px', backgroundColor: '#FEF3C7', color: '#92400E' }}>
                          Pendiente
                        </span>
                      )}
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <button type="button" onClick={() => f.handleDeleteLog(log.id)} style={{ border: 'none', background: 'none', cursor: 'pointer', padding: '4px' }} aria-label="Eliminar ticket" title="Eliminar ticket">
                        <Trash2 size={15} color="#E30613" aria-hidden="true" />
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
        form={f.form}
        setForm={f.setForm}
        onVehicleChange={f.handleVehicleChange}
      />

      <FuelSettleModal
        isOpen={f.showSettleModal}
        onClose={f.handleCloseSettleModal}
        onSubmit={f.handleSettleSubmit}
        submitting={f.submitting}
        modalError={f.modalError}
        pendingLogs={f.pendingLogs}
        selectedIds={f.selectedSettleIds}
        onToggleLog={f.toggleSettleLog}
        onSelectAll={f.setSelectedSettleIds}
        bankAccounts={f.bankAccounts}
        form={f.settleForm}
        setForm={f.setSettleForm}
      />
    </div>
  );
}
