import React from 'react';
import { ChevronUp, ChevronDown, Trash2, MapPin, Edit3, Save } from 'lucide-react';

interface SaleRouteDetailPanelProps {
  route: any | null;
  loading: boolean;
  hasSequenceChanges: boolean;
  savingSequence: boolean;
  onMoveClient: (index: number, direction: -1 | 1) => void;
  onSaveSequence: () => void;
  onRemoveClient: (clientId: number, clientName: string) => void;
  onOpenEdit: () => void;
  onDeleteRoute: () => void;
  onOpenOptimize: () => void;
}

export const SaleRouteDetailPanel: React.FC<SaleRouteDetailPanelProps> = ({
  route,
  loading,
  hasSequenceChanges,
  savingSequence,
  onMoveClient,
  onSaveSequence,
  onRemoveClient,
  onOpenEdit,
  onDeleteRoute,
  onOpenOptimize,
}) => {
  if (loading) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Cargando...
      </div>
    );
  }

  if (!route) {
    return (
      <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
        Seleccioná una ruta
      </div>
    );
  }

  const clients: any[] = route.clients || [];
  const gpsCount = clients.filter(
    (c) => c.latitude !== null && c.longitude !== null && Number(c.latitude) !== 0,
  ).length;

  return (
    <div className="card" style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>{route.name}</h3>
            <span
              style={{
                fontSize: '0.74rem',
                fontWeight: 600,
                padding: '2px 8px',
                borderRadius: '10px',
                backgroundColor: route.isActive !== false ? '#E6F4EA' : '#FCE8E6',
                color: route.isActive !== false ? '#137333' : '#C5221F',
              }}
            >
              {route.isActive !== false ? 'Activa' : 'Inactiva'}
            </span>
          </div>
          <div style={{ display: 'flex', gap: '12px', marginTop: '6px', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            <span>{route.seller?.username ? route.seller.username.replace('_', ' ').toUpperCase() : 'Sin vendedor'}</span>
            {route.dayOfWeek && <span>· {route.dayOfWeek}</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {hasSequenceChanges && (
            <button type="button" className="btn btn-primary" disabled={savingSequence} onClick={onSaveSequence} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Save size={15} />
              <span>{savingSequence ? 'Guardando...' : 'Guardar orden'}</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={clients.length === 0}
            onClick={onOpenOptimize}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <MapPin size={15} />
            <span>Optimizar GPS</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={onOpenEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Edit3 size={15} />
            <span>Editar</span>
          </button>
          <button type="button" className="btn btn-ghost text-danger" aria-label="Eliminar ruta" title="Eliminar" onClick={onDeleteRoute} style={{ color: '#e30613', padding: '6px 10px' }}>
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
        <div style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#fafafa' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Clientes</div>
          <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 700 }}>{clients.length}</div>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#fafafa' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Con GPS</div>
          <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 700 }}>{gpsCount}</div>
        </div>
        <div style={{ padding: '10px 14px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: '#fafafa' }}>
          <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Sin GPS</div>
          <div className="tabular-nums" style={{ fontSize: '1.15rem', fontWeight: 700 }}>{clients.length - gpsCount}</div>
        </div>
      </div>

      <div className="table-container table-container--sticky" role="region" aria-label={`Clientes de ${route.name}`} tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: '72px' }}>Orden</th>
              <th scope="col">Cliente</th>
              <th scope="col">Localidad</th>
              <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>
              <th scope="col" style={{ width: '120px', textAlign: 'right' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {clients.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-secondary)' }}>
                  Sin clientes asignados
                </td>
              </tr>
            ) : (
              clients.map((client, idx) => {
                const balance = Number(client.outstandingBalance || 0);
                return (
                  <tr key={client.id}>
                    <td className="tabular-nums" style={{ fontWeight: 700 }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{client.name}</div>
                      {client.address && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{client.address}</div>}
                    </td>
                    <td>{client.city || '-'}</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600, color: balance > 0 ? 'var(--color-danger)' : 'inherit' }}>
                      ${Math.round(balance).toLocaleString('es-AR')}
                    </td>
                    <td>
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '4px' }}>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          aria-label={`Subir a ${client.name}`}
                          disabled={idx === 0}
                          onClick={() => onMoveClient(idx, -1)}
                          style={{ padding: '4px' }}
                        >
                          <ChevronUp size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost"
                          aria-label={`Bajar a ${client.name}`}
                          disabled={idx === clients.length - 1}
                          onClick={() => onMoveClient(idx, 1)}
                          style={{ padding: '4px' }}
                        >
                          <ChevronDown size={15} />
                        </button>
                        <button
                          type="button"
                          className="btn btn-ghost text-danger"
                          aria-label={`Quitar a ${client.name}`}
                          onClick={() => onRemoveClient(client.id, client.name)}
                          style={{ padding: '4px', color: '#e30613' }}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
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
