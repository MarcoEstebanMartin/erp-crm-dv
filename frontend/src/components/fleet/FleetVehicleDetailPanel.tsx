import type { FC } from 'react';
import { Plus, Wrench, Activity, Trash2, Layers, Edit3, Calendar, DollarSign } from 'lucide-react';
import {
  FleetStatusBadge, getExpiryLabel, getMaintenanceLabel, isExpiryClose, isExpiryOverdue,
  type Expiry, type Vehicle,
} from './fleet.types';

interface FleetVehicleDetailPanelProps {
  vehicle: Vehicle | undefined;
  onEditVehicle: (v: Vehicle) => void;
  onDeleteVehicle: (id: number) => void;
  onAddExpiry: () => void;
  onEditExpiry: (e: Expiry) => void;
  onDeleteExpiry: (id: number) => void;
  onAddMaintenance: () => void;
  onDeleteMaintenance: (id: number) => void;
}

export const FleetVehicleDetailPanel: FC<FleetVehicleDetailPanelProps> = ({
  vehicle, onEditVehicle, onDeleteVehicle, onAddExpiry, onEditExpiry,
  onDeleteExpiry, onAddMaintenance, onDeleteMaintenance,
}) => {
  if (!vehicle) {
    return (
      <div className="card" style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
        <Layers size={36} aria-hidden="true" style={{ opacity: 0.2 }} />
        <span style={{ fontSize: '0.88rem' }}>Seleccione una unidad</span>
      </div>
    );
  }

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card, #fff)', display: 'flex', flexDirection: 'column', gap: '20px', padding: '22px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '16px', gap: '12px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className="tabular-nums" style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.01em' }}>{vehicle.plate}</span>
            {vehicle.status !== 'ACTIVE' && <FleetStatusBadge status={vehicle.status} />}
          </div>
          <span className="tabular-nums" style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
            {vehicle.brand} {vehicle.model} · {vehicle.year}
          </span>
          {vehicle.notes && (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-muted, #64748b)' }}>{vehicle.notes}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => onEditVehicle(vehicle)} style={{ padding: '5px 10px', fontSize: '0.78rem' }}>
            <Edit3 size={13} aria-hidden="true" /> Editar
          </button>
          <button type="button" className="btn btn-ghost" onClick={() => onDeleteVehicle(vehicle.id)} aria-label="Eliminar vehículo" title="Eliminar" style={{ padding: '5px 8px', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            <Trash2 size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-primary)' }}>
            <Calendar size={15} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} /> Vencimientos y Seguros
          </h3>
          <button type="button" className="btn btn-secondary" onClick={onAddExpiry} style={{ padding: '4px 10px', fontSize: '0.76rem' }}>
            <Plus size={13} aria-hidden="true" /> Agregar
          </button>
        </div>

        {vehicle.expirations.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '6px 0' }}>Sin vencimientos cargados.</div>
        ) : (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
            {vehicle.expirations.map((exp, idx) => {
              const isOverdue = isExpiryOverdue(exp.expirationDate);
              const isClose = isExpiryClose(exp.expirationDate);
              const textColor = isOverdue ? 'var(--color-corp-red)' : isClose ? '#b45309' : '#64748b';
              return (
                <div
                  key={exp.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '9px 14px',
                    borderBottom: idx < vehicle.expirations.length - 1 ? '1px solid #f1f5f9' : 'none',
                    backgroundColor: isOverdue ? 'rgba(var(--color-corp-red-rgb), 0.025)' : 'transparent',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {exp.description || getExpiryLabel(exp.type)}
                    </span>
                    <span style={{ fontSize: '0.7rem', fontWeight: 500, color: '#64748b', backgroundColor: '#f1f5f9', padding: '1px 6px', borderRadius: '4px', whiteSpace: 'nowrap' }}>
                      {getExpiryLabel(exp.type)}
                    </span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
                    <span className="tabular-nums" style={{ fontSize: '0.78rem', fontWeight: isOverdue || isClose ? 600 : 500, color: textColor }}>
                      {isOverdue ? 'Vencido ' : 'Vence '}{new Date(exp.expirationDate).toLocaleDateString('es-AR')}
                    </span>
                    <button type="button" onClick={() => onEditExpiry(exp)} style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px', display: 'inline-flex' }} aria-label={`Editar ${getExpiryLabel(exp.type)}`}>
                      <Edit3 size={13} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => onDeleteExpiry(exp.id)} style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px', display: 'inline-flex' }} aria-label={`Eliminar ${getExpiryLabel(exp.type)}`}>
                      <Trash2 size={13} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.88rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '7px', color: 'var(--text-primary)' }}>
            <Activity size={15} aria-hidden="true" style={{ color: 'var(--text-secondary)' }} /> Actividades
          </h3>
          <button type="button" className="btn btn-secondary" onClick={onAddMaintenance} style={{ padding: '4px 10px', fontSize: '0.76rem' }}>
            <Plus size={13} aria-hidden="true" /> Registrar
          </button>
        </div>

        {vehicle.maintenances.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '6px 0' }}>Sin actividades registradas.</div>
        ) : (
          <div style={{ border: '1px solid var(--border-color)', borderRadius: '6px', overflow: 'hidden' }}>
            {vehicle.maintenances.map((m, idx) => (
              <div
                key={m.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '9px 14px',
                  borderBottom: idx < vehicle.maintenances.length - 1 ? '1px solid #f1f5f9' : 'none',
                  gap: '12px',
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', minWidth: 0 }}>
                  <span style={{ color: '#64748b', display: 'inline-flex', flexShrink: 0 }}>
                    {m.type === 'FUEL' ? <DollarSign size={14} aria-hidden="true" /> : <Wrench size={14} aria-hidden="true" />}
                  </span>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1px', minWidth: 0 }}>
                    <span style={{ fontSize: '0.83rem', fontWeight: 500, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {getMaintenanceLabel(m.type)} <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}>· {m.description}</span>
                    </span>
                    <span className="tabular-nums" style={{ fontSize: '0.74rem', color: '#64748b' }}>
                      {m.odometer.toLocaleString('es-AR')} km{m.supplier ? ` · ${m.supplier.name}` : ''}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '1px' }}>
                    <span className="tabular-nums" style={{ fontSize: '0.82rem', fontWeight: 600 }}>${Number(m.cost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    <span className="tabular-nums" style={{ fontSize: '0.72rem', color: '#64748b' }}>{new Date(m.date).toLocaleDateString('es-AR')}</span>
                  </div>
                  <button type="button" onClick={() => onDeleteMaintenance(m.id)} style={{ border: 'none', background: 'none', color: '#94a3b8', cursor: 'pointer', padding: '3px', display: 'inline-flex' }} aria-label={`Eliminar actividad ${m.description}`}>
                    <Trash2 size={13} aria-hidden="true" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
