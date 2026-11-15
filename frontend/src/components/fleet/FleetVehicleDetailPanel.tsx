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
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: 'var(--bg-card, #fff)', display: 'flex', flexDirection: 'column', gap: '24px', padding: '24px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--border-color)', paddingBottom: '18px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span className="tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 800 }}>{vehicle.plate}</span>
            <FleetStatusBadge status={vehicle.status} />
          </div>
          <span className="tabular-nums" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            {vehicle.brand} {vehicle.model} — {vehicle.year}
          </span>
          {vehicle.notes && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{vehicle.notes}</span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => onEditVehicle(vehicle)} style={{ padding: '6px 12px', fontSize: '0.8rem' }}>
            <Edit3 size={14} aria-hidden="true" /> Editar
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => onDeleteVehicle(vehicle.id)} style={{ padding: '6px 12px', fontSize: '0.8rem', color: 'var(--color-corp-red)' }}>
            <Trash2 size={14} aria-hidden="true" /> Eliminar
          </button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Calendar size={16} aria-hidden="true" /> Vencimientos y Seguros
          </h3>
          <button type="button" onClick={onAddExpiry} style={{ fontSize: '0.78rem', color: 'var(--color-corp-red)', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={14} aria-hidden="true" /> Agregar
          </button>
        </div>

        {vehicle.expirations.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '6px 0' }}>Sin vencimientos cargados.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {vehicle.expirations.map((exp) => {
              const isOverdue = isExpiryOverdue(exp.expirationDate);
              const isClose = isExpiryClose(exp.expirationDate);
              const boxBorder = isOverdue ? 'rgba(var(--color-corp-red-rgb), 0.25)' : isClose ? 'rgba(234, 179, 8, 0.35)' : 'var(--border-color)';
              const boxBg = isOverdue ? 'rgba(var(--color-corp-red-rgb), 0.03)' : isClose ? 'rgba(234, 179, 8, 0.03)' : 'transparent';
              const textColor = isOverdue ? 'var(--color-corp-red)' : isClose ? '#eab308' : 'var(--text-secondary)';
              return (
                <div key={exp.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: `1px solid ${boxBorder}`, backgroundColor: boxBg, borderRadius: '6px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>{getExpiryLabel(exp.type)}</span>
                    <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{exp.description}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <span className="tabular-nums" style={{ fontSize: '0.8rem', fontWeight: 600, color: textColor }}>
                      {isOverdue ? 'Vencido ' : 'Vence '}{new Date(exp.expirationDate).toLocaleDateString('es-AR')}
                    </span>
                    <button type="button" onClick={() => onEditExpiry(exp)} style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }} aria-label={`Editar ${getExpiryLabel(exp.type)}`}>
                      <Edit3 size={13} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => onDeleteExpiry(exp.id)} style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }} aria-label={`Eliminar ${getExpiryLabel(exp.type)}`}>
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
          <h3 style={{ fontSize: '0.92rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Activity size={16} aria-hidden="true" /> Actividades
          </h3>
          <button type="button" onClick={onAddMaintenance} style={{ fontSize: '0.78rem', color: 'var(--color-corp-red)', border: 'none', backgroundColor: 'transparent', cursor: 'pointer', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
            <Plus size={14} aria-hidden="true" /> Registrar
          </button>
        </div>

        {vehicle.maintenances.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', padding: '6px 0' }}>Sin actividades registradas.</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {vehicle.maintenances.map((m) => (
              <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', backgroundColor: 'var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    {m.type === 'FUEL' ? <DollarSign size={14} aria-hidden="true" /> : <Wrench size={14} aria-hidden="true" />}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '0.84rem', fontWeight: 600 }}>
                      {getMaintenanceLabel(m.type)} — <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>{m.description}</span>
                    </span>
                    <span className="tabular-nums" style={{ fontSize: '0.76rem', color: 'var(--text-secondary)' }}>
                      {m.odometer.toLocaleString()} km{m.supplier ? ` · ${m.supplier.name}` : ''}
                    </span>
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '2px' }}>
                    <span className="tabular-nums" style={{ fontSize: '0.82rem', fontWeight: 700 }}>${Number(m.cost).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</span>
                    <span className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>{new Date(m.date).toLocaleDateString('es-AR')}</span>
                  </div>
                  <button type="button" onClick={() => onDeleteMaintenance(m.id)} style={{ border: 'none', background: 'none', color: 'var(--text-secondary)', cursor: 'pointer', padding: '4px' }} aria-label={`Eliminar actividad ${m.description}`}>
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
