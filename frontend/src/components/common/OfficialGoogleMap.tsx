import { useEffect, useMemo, useRef, useState } from 'react';
import { ExternalLink, MapPin } from 'lucide-react';
import { DEPOT_VILLEGAS, buildGoogleMapsMultiStopRouteUrl } from '../../utils/geoUtils';
import {
  loadOfficialGoogleMaps,
  subscribeGoogleMapsApiKey,
} from '../../utils/googleMapsLoader';
import type {
  LiveVehicleGpsPoint,
  OfficialMapMarker,
  OfficialMapStop,
} from '../../utils/officialGoogleMapHelpers';
import { renderOfficialMapScene } from '../../utils/officialGoogleMapRenderer';

interface OfficialGoogleMapProps {
  stops?: OfficialMapStop[];
  markers?: OfficialMapMarker[];
  singlePin?: {
    lat: number;
    lng: number;
    onChange: (lat: number, lng: number) => void;
  };
  showDepot?: boolean;
  showDirections?: boolean;
  showMarkersPolyline?: boolean;
  gpsLocation?: LiveVehicleGpsPoint | null;
  gpsTrail?: [number, number][];
  centerLat?: number;
  centerLng?: number;
  defaultZoom?: number;
  heightPx?: number;
  apiKey?: string;
  onUpdateClientCoords?: (clientId: number, lat: number, lng: number) => void;
  onSelectMarker?: (markerId: string) => void;
}

export function OfficialGoogleMap({
  stops,
  markers,
  singlePin,
  showDepot,
  showDirections,
  showMarkersPolyline = false,
  gpsLocation,
  gpsTrail,
  centerLat = DEPOT_VILLEGAS.lat,
  centerLng = DEPOT_VILLEGAS.lng,
  defaultZoom = 14,
  heightPx = 420,
  apiKey,
  onUpdateClientCoords,
  onSelectMarker,
}: OfficialGoogleMapProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<any>(null);
  const overlaysRef = useRef<any[]>([]);
  const directionsRendererRef = useRef<any>(null);
  const infoWindowRef = useRef<any>(null);
  const mapClickListenerRef = useRef<any>(null);
  const callbacksRef = useRef({
    onUpdateClientCoords,
    onSelectMarker,
    onSinglePinChange: singlePin?.onChange,
  });
  callbacksRef.current = {
    onUpdateClientCoords,
    onSelectMarker,
    onSinglePinChange: singlePin?.onChange,
  };

  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<{ distance: string; duration: string } | null>(null);
  const [runtimeKeyVersion, setRuntimeKeyVersion] = useState(0);

  useEffect(() => {
    return subscribeGoogleMapsApiKey(() => {
      setRuntimeKeyVersion((v) => v + 1);
    });
  }, []);

  const validStops = useMemo(
    () => (stops || []).filter((s) => Number.isFinite(s.lat) && Number.isFinite(s.lng)),
    [stops],
  );
  const validMarkers = useMemo(
    () => (markers || []).filter((m) => Number.isFinite(m.lat) && Number.isFinite(m.lng)),
    [markers],
  );
  const shouldShowDepot = showDepot ?? validStops.length > 0;
  const shouldShowDirections = showDirections ?? validStops.length > 0;

  useEffect(() => {
    let mounted = true;
    setLoadError(null);
    loadOfficialGoogleMaps(apiKey)
      .then((maps) => {
        if (!mounted || !containerRef.current) return;
        if (!mapRef.current) {
          const initLat = singlePin ? singlePin.lat : centerLat;
          const initLng = singlePin ? singlePin.lng : centerLng;
          mapRef.current = new maps.Map(containerRef.current, {
            center: { lat: initLat, lng: initLng },
            zoom: singlePin ? 16 : defaultZoom,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: true,
            zoomControl: true,
          });
          infoWindowRef.current = new maps.InfoWindow();
        }
        setReady(true);
      })
      .catch((err: any) => {
        if (!mounted) return;
        setLoadError(err?.message || 'No se pudo cargar el mapa oficial de Google Maps.');
      });

    return () => {
      mounted = false;
    };
  }, [apiKey, runtimeKeyVersion]);

  useEffect(() => {
    const gmaps = (window as any).google?.maps;
    const map = mapRef.current;
    if (!ready || !gmaps || !map) return;

    overlaysRef.current.forEach((ov) => ov.setMap?.(null));
    overlaysRef.current = [];
    if (directionsRendererRef.current) {
      directionsRendererRef.current.setMap(null);
      directionsRendererRef.current = null;
    }
    if (mapClickListenerRef.current) {
      gmaps.event.removeListener(mapClickListenerRef.current);
      mapClickListenerRef.current = null;
    }
    setMetrics(null);

    let cancelled = false;
    const infoWindow = infoWindowRef.current || new gmaps.InfoWindow();
    infoWindowRef.current = infoWindow;

    const { directionsRenderer, mapClickListener } = renderOfficialMapScene({
      gmaps,
      map,
      infoWindow,
      overlays: overlaysRef.current,
      validStops,
      validMarkers,
      singlePin: singlePin ? { lat: singlePin.lat, lng: singlePin.lng } : undefined,
      shouldShowDepot,
      shouldShowDirections,
      showMarkersPolyline,
      gpsLocation,
      gpsTrail,
      centerLat,
      centerLng,
      defaultZoom,
      callbacks: {
        onUpdateClientCoords: (cId, lat, lng) => callbacksRef.current.onUpdateClientCoords?.(cId, lat, lng),
        onSelectMarker: (mId) => callbacksRef.current.onSelectMarker?.(mId),
        onSinglePinChange: (lat, lng) => callbacksRef.current.onSinglePinChange?.(lat, lng),
      },
      onMetrics: setMetrics,
      isCancelled: () => cancelled,
    });

    directionsRendererRef.current = directionsRenderer;
    mapClickListenerRef.current = mapClickListener;

    return () => {
      cancelled = true;
    };
  }, [
    ready,
    validStops,
    validMarkers,
    singlePin?.lat,
    singlePin?.lng,
    shouldShowDepot,
    shouldShowDirections,
    showMarkersPolyline,
    gpsLocation,
    gpsTrail,
    centerLat,
    centerLng,
    defaultZoom,
  ]);

  const externalRouteUrl =
    validStops.length > 0
      ? buildGoogleMapsMultiStopRouteUrl(validStops, { roundTrip: true })
      : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      {(metrics || externalRouteUrl) && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '10px',
            padding: '7px 12px',
            backgroundColor: '#fafafa',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            fontSize: '0.79rem',
            color: 'var(--text-primary)',
          }}
        >
          <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span><strong>Paradas:</strong> {validStops.length}</span>
            {metrics && (
              <>
                <span><strong>Distancia:</strong> {metrics.distance}</span>
                <span><strong>Duración:</strong> {metrics.duration}</span>
              </>
            )}
          </div>
          {externalRouteUrl && (
            <a
              href={externalRouteUrl}
              target="_blank"
              rel="noreferrer"
              style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontWeight: 600, color: '#2563eb', textDecoration: 'none' }}
            >
              <span>Abrir en Google Maps</span>
              <ExternalLink size={13} aria-hidden="true" />
            </a>
          )}
        </div>
      )}

      {loadError ? (
        <div
          role="status"
          style={{
            height: `${heightPx}px`,
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '16px',
            textAlign: 'center',
            color: 'var(--text-secondary)',
            fontSize: '0.84rem',
          }}
        >
          <MapPin size={24} aria-hidden="true" />
          <span>{loadError}</span>
        </div>
      ) : (
        <div
          ref={containerRef}
          style={{
            width: '100%',
            height: `${heightPx}px`,
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: '#f1f5f9',
          }}
        />
      )}
    </div>
  );
}

export default OfficialGoogleMap;
