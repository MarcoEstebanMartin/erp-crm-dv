import React, { useEffect, useMemo, useState } from 'react';
import { X, Navigation, MapPin, Search } from 'lucide-react';
import { NativeModalDialog } from './NativeModalDialog';
import { api } from '../../utils/api';
import { OfficialGoogleMap } from '../common/OfficialGoogleMap';
import type { OfficialMapMarker } from '../../utils/officialGoogleMapHelpers';
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
  const [mapQuery, setMapQuery] = useState('');

  useEffect(() => {
    if (!isOpen) {
      setMapQuery('');
      return;
    }
    if (tab === 'VISITS') {
      api
        .getTodayVisits()
        .then((res) => setTodayVisits(res?.visits || []))
        .catch(() => setTodayVisits([]));
    }
  }, [isOpen, tab]);

  const customersWithLocation = useMemo(() => {
    return (clients || []).filter((c) => {
      const lat = Number(c.latitude);
      const lng = Number(c.longitude);
      return (
        c.latitude !== null &&
        c.latitude !== undefined &&
        c.longitude !== null &&
        c.longitude !== undefined &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat !== 0 &&
        lng !== 0
      );
    });
  }, [clients]);

  const filteredCustomers = useMemo(() => {
    const q = mapQuery.trim().toLowerCase();
    if (!q) return customersWithLocation;
    return customersWithLocation.filter((c) =>
      `${c.name || ''} ${c.address || ''} ${c.city || ''}`.toLowerCase().includes(q),
    );
  }, [customersWithLocation, mapQuery]);

  const customerMarkers = useMemo<OfficialMapMarker[]>(() => {
    return filteredCustomers.map((c) => ({
      id: String(c.id),
      lat: Number(c.latitude),
      lng: Number(c.longitude),
      title: c.name,
      subtitle: `${c.address || '-'}${c.city ? ` · ${c.city}` : ''}${Number(c.outstandingBalance || 0) > 0 ? ` · $${Math.round(Number(c.outstandingBalance)).toLocaleString('es-AR')}` : ''}`,
      color: Number(c.outstandingBalance || 0) > 0 ? 'red' : 'blue',
    }));
  }, [filteredCustomers]);

  const visitMarkers = useMemo<OfficialMapMarker[]>(() => {
    const q = mapQuery.trim().toLowerCase();
    return todayVisits
      .filter((v) => v.latitude && v.longitude)
      .filter((v) => {
        if (!q) return true;
        return `${v.seller?.username || ''} ${v.persona?.name || ''}`.toLowerCase().includes(q);
      })
      .map((v) => ({
        id: `v-${v.id}`,
        lat: Number(v.latitude),
        lng: Number(v.longitude),
        title: `${v.seller?.username || 'Vendedor'} - ${v.persona?.name || 'Cliente'}`,
        subtitle: `${new Date(v.visitedAt || v.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs · ${v.status === 'ORDERED' ? 'Compró' : `Sin compra (${v.noBuyReason || '-'})`}`,
        color: v.status === 'ORDERED' ? 'emerald' : 'amber',
      }));
  }, [todayVisits, mapQuery]);

  if (!isOpen) return null;

  const activeMarkers = tab === 'MAP' ? customerMarkers : visitMarkers;
  const centerPoint = activeMarkers[0] ?? DEPOT_VILLEGAS;
  const isSearchFocused = mapQuery.trim().length > 0 && activeMarkers.length > 0;

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
            <MapPin size={17} color="#334155" aria-hidden="true" />
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

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <search aria-label="Buscar en mapa">
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: '9px', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
              <input
                type="search"
                aria-label="Buscar cliente o dirección en mapa"
                className="input"
                placeholder="Buscar cliente..."
                value={mapQuery}
                onChange={(e) => setMapQuery(e.target.value)}
                style={{ width: '190px', height: '32px', paddingLeft: '28px', fontSize: '0.78rem' }}
              />
            </div>
          </search>
          {activeMarkers.length > 0 && (
            <a
              href={buildGoogleMapsMultiStopRouteUrl(activeMarkers)}
              target="_blank"
              rel="noreferrer"
              className="btn btn-secondary"
              style={{ fontSize: '0.78rem', padding: '6px 12px', display: 'inline-flex', alignItems: 'center', gap: '6px', textDecoration: 'none' }}
            >
              <Navigation size={14} aria-hidden="true" />
              <span>Google Maps</span>
            </a>
          )}
          <button type="button" className="btn btn-ghost" aria-label="Cerrar" style={{ padding: '4px' }} onClick={onClose}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <OfficialGoogleMap
        markers={activeMarkers}
        centerLat={centerPoint.lat}
        centerLng={centerPoint.lng}
        defaultZoom={isSearchFocused ? 16 : 13}
        heightPx={540}
        showDepot={false}
        showDirections={false}
        showMarkersPolyline={tab === 'VISITS'}
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
