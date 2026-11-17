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
  const missingGpsCount = clients.length - gpsCount;

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#ffffff', padding: '20px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '12px', borderBottom: '1px solid #f1f5f9', paddingBottom: '14px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: '#0f172a' }}>{route.name}</h3>
            {route.isActive === false && (
              <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '10px', backgroundColor: '#FCE8E6', color: '#C5221F' }}>
                Inactiva
              </span>
            )}
          </div>
          <div className="tabular-nums" style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '4px', fontSize: '0.8rem', color: '#64748b' }}>
            <span>{route.seller?.username ? route.seller.username.replace('_', ' ').toUpperCase() : 'Sin vendedor'}</span>
            {route.dayOfWeek && <span>· {route.dayOfWeek}</span>}
            <span>· {clients.length} clientes</span>
            <span>· {gpsCount} con GPS</span>
            {missingGpsCount > 0 && <span style={{ color: '#b45309', fontWeight: 600 }}>· {missingGpsCount} sin GPS</span>}
          </div>
        </div>

        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
          {hasSequenceChanges && (
            <button type="button" className="btn btn-primary" disabled={savingSequence} onClick={onSaveSequence} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 12px', fontSize: '0.8rem' }}>
              <Save size={14} />
              <span>{savingSequence ? 'Guardando...' : 'Guardar orden'}</span>
            </button>
          )}
          <button
            type="button"
            className="btn btn-secondary"
            disabled={clients.length === 0}
            onClick={onOpenOptimize}
            style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '0.8rem' }}
          >
            <MapPin size={14} />
            <span>Optimizar GPS</span>
          </button>
          <button type="button" className="btn btn-secondary" onClick={onOpenEdit} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '6px 10px', fontSize: '0.8rem' }}>
            <Edit3 size={14} />
            <span>Editar</span>
          </button>
          <button type="button" className="btn btn-ghost" aria-label="Eliminar ruta" title="Eliminar" onClick={onDeleteRoute} style={{ color: '#64748b', padding: '6px 8px' }}>
            <Trash2 size={15} />
          </button>
        </div>
      </div>

      <div className="table-container table-container--sticky" role="region" aria-label={`Clientes de ${route.name}`} tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col" style={{ width: '60px' }}>Orden</th>
              <th scope="col">Cliente</th>
              <th scope="col">Localidad</th>
              <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>
              <th scope="col" style={{ width: '108px', textAlign: 'right' }}>Acciones</th>
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
                const absBal = Math.abs(Math.round(balance)).toLocaleString('es-AR');
                const balLabel = balance > 0 ? `$${absBal}` : balance < 0 ? `+$${absBal}` : '$0';
                const balColor = balance > 0 ? 'var(--color-danger)' : balance < 0 ? 'var(--color-success)' : '#64748b';
                return (
                  <tr key={client.id}>
                    <td className="tabular-nums" style={{ fontWeight: 600, color: '#64748b' }}>{idx + 1}</td>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0f172a' }}>{client.name}</div>
                      {client.address && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>{client.address}</div>}
                    </td>
                    <td style={{ color: '#475569' }}>{client.city || '—'}</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600, color: balColor }}>
                      {balLabel}
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
