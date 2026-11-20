import { ArrowLeft, Check, LocateFixed, MapPin, Truck, User } from 'lucide-react';
import {
  eventTypeLabel,
  formatDistanceEs,
  formatEventTimeEs,
  formatRelativeTimeEs,
  type LiveMapEventItem,
  type LiveMapPayload,
  type LiveMapSelection,
} from './liveMap.types';

interface LiveMapSidePanelProps {
  data: LiveMapPayload | null;
  selection: LiveMapSelection;
  onSelect: (next: LiveMapSelection) => void;
  fixingClientId: number | null;
  onFixClientCoords: (event: LiveMapEventItem) => Promise<void>;
  onEditClientLocation: (event: LiveMapEventItem) => void;
}

const ROW_BASE_STYLE: React.CSSProperties = {
  width: '100%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '8px',
  padding: '10px 12px',
  borderRadius: '8px',
  border: '1px solid var(--border-color)',
  backgroundColor: 'var(--bg-card, #fff)',
  textAlign: 'left',
  cursor: 'pointer',
};

export function LiveMapSidePanel({
  data,
  selection,
  onSelect,
  fixingClientId,
  onFixClientCoords,
  onEditClientLocation,
}: LiveMapSidePanelProps) {
  const selectedSeller =
    selection?.kind === 'seller'
      ? data?.sellers.find((s) => s.sellerId === selection.id) ?? null
      : null;

  const selectedVehicle =
    selection?.kind === 'vehicle'
      ? data?.vehicles.find((v) => v.routeId === selection.id) ?? null
      : null;

  if (selectedSeller) {
    return (
      <aside
        aria-label={`Recorrido de ${selectedSeller.sellerName}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          backgroundColor: 'var(--bg-card, #fff)',
          padding: '12px',
          maxHeight: '620px',
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onSelect(null)}
            style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Todos
          </button>
          <span className="tabular-nums" style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
            {selectedSeller.counts.ordered} vta · {selectedSeller.counts.noBuy} no · {selectedSeller.counts.receipts} cob
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)' }}>
          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>{selectedSeller.sellerName}</strong>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {formatRelativeTimeEs(selectedSeller.lastActivityAt)}
          </span>
        </div>

        {selectedSeller.events.length === 0 ? (
          <div style={{ padding: '20px 8px', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
            Sin eventos registrados
          </div>
        ) : (
          <ol style={{ listStyle: 'none', margin: 0, padding: 0, display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {selectedSeller.events.map((ev) => {
              const canFix =
                ev.lat !== null &&
                ev.lng !== null &&
                (ev.distanceStatus === 'FAR' || ev.distanceStatus === 'CLIENT_NO_GPS');
              const isFixing = fixingClientId === ev.clientId;
              const badgeColor =
                ev.type === 'ORDER_VISIT'
                  ? '#059669'
                  : ev.type === 'RECEIPT'
                    ? '#2563eb'
                    : '#64748b';

              return (
                <li
                  key={ev.id}
                  style={{
                    padding: '8px 10px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                    <span className="tabular-nums" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {formatEventTimeEs(ev.at)}
                    </span>
                    <span style={{ fontSize: '0.72rem', fontWeight: 600, color: badgeColor }}>
                      {eventTypeLabel(ev.type)}
                      {ev.receiptAmount ? ` · $${ev.receiptAmount.toLocaleString('es-AR')}` : ''}
                    </span>
                  </div>

                  <div style={{ fontSize: '0.84rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {ev.clientName}
                  </div>

                  {ev.noBuyReason && (
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {ev.noBuyReason}
                    </div>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px', marginTop: '2px', flexWrap: 'wrap' }}>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        color: ev.distanceStatus === 'FAR' ? '#E30613' : 'var(--text-secondary)',
                      }}
                    >
                      {ev.distanceStatus === 'FAR'
                        ? formatDistanceEs(ev.distanceMeters)
                        : ev.distanceStatus === 'CLIENT_NO_GPS'
                          ? 'Cliente sin GPS'
                          : ev.distanceStatus === 'EVENT_NO_GPS'
                            ? 'Sin GPS'
                            : ''}
                    </span>

                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', marginLeft: 'auto' }}>
                      {canFix && (
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={isFixing}
                          onClick={() => void onFixClientCoords(ev)}
                          style={{ padding: '2px 7px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                        >
                          {isFixing ? <Check size={12} aria-hidden="true" /> : <MapPin size={12} aria-hidden="true" />}
                          {isFixing ? 'Guardando' : 'Fijar acá'}
                        </button>
                      )}

                      <button
                        type="button"
                        className="btn btn-secondary"
                        onClick={() => onEditClientLocation(ev)}
                        style={{ padding: '2px 7px', fontSize: '0.72rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
                      >
                        <LocateFixed size={12} aria-hidden="true" />
                        Ubicar
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </aside>
    );
  }

  if (selectedVehicle) {
    return (
      <aside
        aria-label={`Vehículo ${selectedVehicle.vehiclePlate}`}
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          backgroundColor: 'var(--bg-card, #fff)',
          padding: '12px',
        }}
      >
        <div>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => onSelect(null)}
            style={{ padding: '4px 8px', fontSize: '0.78rem', display: 'inline-flex', alignItems: 'center', gap: '4px' }}
          >
            <ArrowLeft size={14} aria-hidden="true" />
            Todos
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
          <strong style={{ fontSize: '0.95rem', color: 'var(--text-primary)' }}>
            {selectedVehicle.vehiclePlate} · {selectedVehicle.driverName}
          </strong>
          {selectedVehicle.routeName && (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{selectedVehicle.routeName}</span>
          )}
          <div style={{ display: 'flex', gap: '12px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            <span className="tabular-nums">{selectedVehicle.deliveredCount}/{selectedVehicle.stopsCount} entregas</span>
            {selectedVehicle.lastLocation?.speed != null && (
              <span className="tabular-nums">{selectedVehicle.lastLocation.speed} km/h</span>
            )}
            <span>{formatRelativeTimeEs(selectedVehicle.lastLocation?.at ?? null)}</span>
          </div>
        </div>
      </aside>
    );
  }

  const sellers = data?.sellers ?? [];
  const vehicles = data?.vehicles ?? [];

  return (
    <aside
      aria-label="Vendedores y vehículos activos"
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        backgroundColor: 'var(--bg-card, #fff)',
        padding: '12px',
        maxHeight: '620px',
        overflowY: 'auto',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <User size={13} aria-hidden="true" />
            Vendedores ({sellers.length})
          </span>
        </div>

        {sellers.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '6px 2px' }}>Sin actividad</div>
        ) : (
          sellers.map((s) => (
            <button
              key={s.sellerId}
              type="button"
              onClick={() => onSelect({ kind: 'seller', id: s.sellerId })}
              style={ROW_BASE_STYLE}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {s.sellerName}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {formatRelativeTimeEs(s.lastActivityAt)}
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="tabular-nums" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {s.counts.plannedClients > 0
                    ? `${s.counts.visitedClients}/${s.counts.plannedClients}`
                    : `${s.counts.totalEvents} ev.`}
                </div>
                {s.counts.farAlerts > 0 && (
                  <div className="tabular-nums" style={{ fontSize: '0.72rem', fontWeight: 600, color: '#E30613' }}>
                    {s.counts.farAlerts} lejos
                  </div>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', paddingTop: '8px', borderTop: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
            <Truck size={13} aria-hidden="true" />
            Vehículos ({vehicles.length})
          </span>
        </div>

        {vehicles.length === 0 ? (
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', padding: '6px 2px' }}>Sin viajes</div>
        ) : (
          vehicles.map((v) => (
            <button
              key={v.routeId}
              type="button"
              onClick={() => onSelect({ kind: 'vehicle', id: v.routeId })}
              style={ROW_BASE_STYLE}
            >
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: '0.86rem', fontWeight: 600, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {v.vehiclePlate} · {v.driverName}
                </div>
                <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                  {v.status === 'IN_TRANSIT' ? 'En ruta' : v.status === 'COMPLETED' ? 'Cerrado' : 'Pendiente'}
                  {' · '}
                  {formatRelativeTimeEs(v.lastLocation?.at ?? null)}
                </div>
              </div>
              <div className="tabular-nums" style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-primary)', flexShrink: 0 }}>
                {v.deliveredCount}/{v.stopsCount}
              </div>
            </button>
          ))
        )}
      </div>
    </aside>
  );
}
