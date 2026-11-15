import React, { useEffect, useMemo, useState } from 'react';
import { X, Navigation, MapPin } from 'lucide-react';
import { NativeModalDialog } from './NativeModalDialog';
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
  activeFilterLabel = 'Clientes',
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
      subtitle: `${c.address || '-'}${c.city ? ` · ${c.city}` : ''}${Number(c.outstandingBalance || 0) > 0 ? ` · $${Math.round(Number(c.outstandingBalance)).toLocaleString('es-AR')}` : ''}`,
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
        subtitle: `${new Date(v.visitedAt || v.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs · ${v.status === 'ORDERED' ? 'Compró' : `Sin compra (${v.noBuyReason || '-'})`}`,
        color: v.status === 'ORDERED' ? 'emerald' : 'amber',
      }));
  }, [todayVisits]);

  if (!isOpen) return null;

  const activeMarkers = tab === 'MAP' ? customerMarkers : visitMarkers;
  const centerPoint = activeMarkers[0] ?? DEPOT_VILLEGAS;

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="clients-gps-map-title"
      style={{ maxWidth: '1040px', width: '96vw', padding: '18px 22px', borderRadius: '12px' }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', marginBottom: '12px', flexWrap: 'wrap', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <MapPin size={17} color="#334155" />
            <h3 id="clients-gps-map-title" style={{ margin: 0, fontSize: '1rem', fontWeight: 700 }}>
              Mapa GPS · {activeFilterLabel}
            </h3>
          </div>
          <div className="linear-tablist" role="tablist" aria-label="Capas de mapa" style={{ borderBottom: 'none' }}>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'MAP'}
              className="linear-tab"
              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              onClick={() => setTab('MAP')}
            >
              Clientes ({customerMarkers.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={tab === 'VISITS'}
              className="linear-tab"
              style={{ padding: '6px 10px', fontSize: '0.8rem' }}
              onClick={() => setTab('VISITS')}
            >
              Check-ins ({visitMarkers.length})
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
              <span>Google Maps</span>
            </a>
          )}
          <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '4px' }} onClick={onClose}>
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
    </NativeModalDialog>
  );
};

export default ClientsGpsMapModal;
