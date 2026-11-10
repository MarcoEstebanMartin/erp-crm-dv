import React, { useEffect, useMemo, useState } from 'react';
import { X, Navigation, MapPin } from 'lucide-react';
import { api } from '../../utils/api';
import { InteractiveRouteMap, type RouteMapMarker } from '../common/InteractiveRouteMap';
import { DEPOT_VILLEGAS, buildGoogleMapsMultiStopRouteUrl } from '../../utils/geoUtils';

interface ClientsGpsMapModalProps {
  isOpen: boolean;
  clients: any[];
  activeFilterLabel?: string;
  onClose: () => void;
  onSelectClient?: (client: any) => void;
}

export const ClientsGpsMapModal: React.FC<ClientsGpsMapModalProps> = ({
  isOpen,
  clients,
  activeFilterLabel = 'Padrón de Clientes',
  onClose,
  onSelectClient,
}) => {
  const [tab, setTab] = useState<'MAP' | 'VISITS'>('MAP');
  const [todayVisits, setTodayVisits] = useState<any[]>([]);

  useEffect(() => {
    if (isOpen && tab === 'VISITS') {
      api
        .getTodayVisits()
        .then((res) => setTodayVisits(res?.visits || []))
        .catch(() => setTodayVisits([]));
    }
  }, [isOpen, tab]);

  const customersWithLocation = useMemo(() => {
    const withCoords = (clients || []).filter(
      (c) => Number.isFinite(Number(c.latitude)) && Number.isFinite(Number(c.longitude)) && Number(c.latitude) !== 0,
    );
    return withCoords.length > 0 ? withCoords : (clients || []).slice(0, 40);
  }, [clients]);

  const customerMarkers = useMemo<RouteMapMarker[]>(() => {
    return customersWithLocation.slice(0, 120).map((c) => ({
      id: String(c.id),
      lat: Number(c.latitude) || DEPOT_VILLEGAS.lat,
      lng: Number(c.longitude) || DEPOT_VILLEGAS.lng,
      title: c.name,
      subtitle: `${c.address || 'Sin dirección'} · ${c.city || 'General Villegas'} ${Number(c.outstandingBalance || 0) > 0 ? `(Debe $${Math.round(Number(c.outstandingBalance)).toLocaleString('es-AR')})` : ''}`,
      color: Number(c.outstandingBalance || 0) > 0 ? 'red' : 'blue',
    }));
  }, [customersWithLocation]);

  const visitMarkers = useMemo<RouteMapMarker[]>(() => {
    return todayVisits
      .filter((v) => v.latitude && v.longitude)
      .map((v) => ({
        id: `v-${v.id}`,
        lat: Number(v.latitude),
        lng: Number(v.longitude),
        title: `${v.seller?.username || 'Vendedor'} → ${v.persona?.name || 'Cliente'}`,
        subtitle: `${new Date(v.visitedAt || v.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs · ${v.status === 'ORDERED' ? 'Compró' : `No compró (${v.noBuyReason || ''})`}`,
        color: v.status === 'ORDERED' ? 'emerald' : 'amber',
      }));
  }, [todayVisits]);

  if (!isOpen) return null;

  const activeMarkers = tab === 'MAP' ? customerMarkers : visitMarkers;
  const centerPoint = activeMarkers[0] ?? DEPOT_VILLEGAS;

  return (
    <div className="modal-overlay" style={{ zIndex: 2500 }} onClick={onClose}>
      <div
        className="modal-content"
        style={{ maxWidth: '1040px', width: '96%', padding: '16px 20px', borderRadius: '14px' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <MapPin size={18} color="#E30613" />
              <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>Mapa GPS — {activeFilterLabel}</h3>
            </div>
            <div style={{ display: 'flex', backgroundColor: 'var(--bg-secondary)', padding: '3px', borderRadius: '8px', gap: '4px' }}>
              <button
                type="button"
                className={`btn btn-sm ${tab === 'MAP' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.76rem', padding: '4px 10px', borderRadius: '6px' }}
                onClick={() => setTab('MAP')}
              >
                Clientes ({customerMarkers.length})
              </button>
              <button
                type="button"
                className={`btn btn-sm ${tab === 'VISITS' ? 'btn-primary' : 'btn-ghost'}`}
                style={{ fontSize: '0.76rem', padding: '4px 10px', borderRadius: '6px' }}
                onClick={() => setTab('VISITS')}
              >
                Check-ins GPS Hoy ({visitMarkers.length})
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {activeMarkers.length > 0 && (
              <a
                href={buildGoogleMapsMultiStopRouteUrl(activeMarkers)}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
              >
                <Navigation size={14} />
                <span>Abrir Ruta en Google Maps</span>
              </a>
            )}
            <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
              <X size={18} />
            </button>
          </div>
        </div>

        <InteractiveRouteMap
          markers={activeMarkers}
          centerLat={centerPoint.lat}
          centerLng={centerPoint.lng}
          defaultZoom={14}
          heightPx={540}
          showRouteLine={tab === 'VISITS'}
          onSelectMarker={(markerId) => {
            if (tab === 'MAP' && onSelectClient) {
              const found = clients.find((c) => String(c.id) === markerId);
              if (found) onSelectClient(found);
            }
          }}
        />
      </div>
    </div>
  );
};
export default ClientsGpsMapModal;
