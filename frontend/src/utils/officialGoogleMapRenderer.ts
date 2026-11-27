import { DEPOT_VILLEGAS } from './geoUtils';
import {
  MAP_PIN_HEX,
  buildMarkerInfoHtml,
  buildStopInfoHtml,
  escapeMapHtml,
  formatDirectionsSummary,
  type LiveVehicleGpsPoint,
  type OfficialMapMarker,
  type OfficialMapStop,
} from './officialGoogleMapHelpers';

export interface RenderOfficialMapSceneParams {
  gmaps: any;
  map: any;
  infoWindow: any;
  overlays: any[];
  validStops: OfficialMapStop[];
  validMarkers: OfficialMapMarker[];
  singlePin?: { lat: number; lng: number };
  shouldShowDepot: boolean;
  shouldShowDirections: boolean;
  showMarkersPolyline: boolean;
  gpsLocation?: LiveVehicleGpsPoint | null;
  gpsTrail?: [number, number][];
  centerLat: number;
  centerLng: number;
  defaultZoom: number;
  callbacks: {
    onUpdateClientCoords?: (clientId: number, lat: number, lng: number) => void;
    onSelectMarker?: (markerId: string) => void;
    onSinglePinChange?: (lat: number, lng: number) => void;
  };
  onMetrics: (metrics: { distance: string; duration: string } | null) => void;
  isCancelled: () => boolean;
}

export function renderOfficialMapScene(params: RenderOfficialMapSceneParams): {
  directionsRenderer: any | null;
  mapClickListener: any | null;
} {
  const {
    gmaps,
    map,
    infoWindow,
    overlays,
    validStops,
    validMarkers,
    singlePin,
    shouldShowDepot,
    shouldShowDirections,
    showMarkersPolyline,
    gpsLocation,
    gpsTrail,
    centerLat,
    centerLng,
    defaultZoom,
    callbacks,
    onMetrics,
    isCancelled,
  } = params;

  if (singlePin) {
    const pinPos = { lat: singlePin.lat, lng: singlePin.lng };
    const pinMarker = new gmaps.Marker({
      position: pinPos,
      map,
      draggable: true,
      title: 'Ubicación del cliente',
      icon: {
        path: gmaps.SymbolPath.CIRCLE,
        fillColor: '#E30613',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2.5,
        scale: 10,
      },
    });
    pinMarker.addListener('dragend', (e: any) => {
      callbacks.onSinglePinChange?.(
        Number(Number(e.latLng.lat()).toFixed(6)),
        Number(Number(e.latLng.lng()).toFixed(6)),
      );
    });
    const mapClickListener = map.addListener('click', (e: any) => {
      callbacks.onSinglePinChange?.(
        Number(Number(e.latLng.lat()).toFixed(6)),
        Number(Number(e.latLng.lng()).toFixed(6)),
      );
    });
    overlays.push(pinMarker);
    map.setCenter(pinPos);
    if (map.getZoom() < 15) map.setZoom(16);
    return { directionsRenderer: null, mapClickListener };
  }

  const bounds = new gmaps.LatLngBounds();
  let hasBounds = false;

  if (shouldShowDepot) {
    const depotMarker = new gmaps.Marker({
      position: { lat: DEPOT_VILLEGAS.lat, lng: DEPOT_VILLEGAS.lng },
      map,
      title: DEPOT_VILLEGAS.label,
      icon: {
        path: gmaps.SymbolPath.CIRCLE,
        fillColor: '#E30613',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2.5,
        scale: 10,
      },
    });
    depotMarker.addListener('click', () => {
      infoWindow.setContent('<b>Depósito Central DV</b><br/>Pringles 116, General Villegas');
      infoWindow.open(map, depotMarker);
    });
    overlays.push(depotMarker);
    bounds.extend(depotMarker.getPosition());
    hasBounds = true;
  }

  validStops.forEach((stop, idx) => {
    const isApprox = stop.hasExactGps === false;
    const marker = new gmaps.Marker({
      position: { lat: stop.lat, lng: stop.lng },
      map,
      label: { text: String(idx + 1), color: '#FFFFFF', fontWeight: '700', fontSize: '11px' },
      icon: {
        path: gmaps.SymbolPath.CIRCLE,
        fillColor: '#111827',
        fillOpacity: 1,
        strokeColor: isApprox ? '#D97706' : '#FFFFFF',
        strokeWeight: isApprox ? 3 : 2,
        scale: 12,
        labelOrigin: new gmaps.Point(0, 0),
      },
      title: `${idx + 1}º Parada: ${stop.name}`,
      draggable: Boolean(callbacks.onUpdateClientCoords && stop.clientId),
    });
    marker.addListener('click', () => {
      infoWindow.setContent(buildStopInfoHtml(stop, idx));
      infoWindow.open(map, marker);
    });
    if (stop.clientId && callbacks.onUpdateClientCoords) {
      marker.addListener('dragend', (e: any) => {
        callbacks.onUpdateClientCoords?.(
          stop.clientId!,
          Number(Number(e.latLng.lat()).toFixed(6)),
          Number(Number(e.latLng.lng()).toFixed(6)),
        );
      });
    }
    overlays.push(marker);
    bounds.extend(marker.getPosition());
    hasBounds = true;
  });

  validMarkers.forEach((m) => {
    const hasOrder = typeof m.stopOrder === 'number';
    const marker = new gmaps.Marker({
      position: { lat: m.lat, lng: m.lng },
      map,
      title: m.title,
      label: hasOrder
        ? {
            text: String(m.stopOrder),
            color: '#FFFFFF',
            fontWeight: '700',
            fontSize: '11px',
          }
        : undefined,
      icon: {
        path: gmaps.SymbolPath.CIRCLE,
        fillColor: MAP_PIN_HEX[m.color ?? 'red'],
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2,
        scale: hasOrder ? 11 : 8,
      },
    });
    marker.addListener('click', () => {
      infoWindow.setContent(buildMarkerInfoHtml(m));
      infoWindow.open(map, marker);
      callbacks.onSelectMarker?.(m.id);
    });
    overlays.push(marker);
    bounds.extend(marker.getPosition());
    hasBounds = true;
  });

  if (showMarkersPolyline && validMarkers.length > 1) {
    const poly = new gmaps.Polyline({
      path: validMarkers.map((m) => ({ lat: m.lat, lng: m.lng })),
      geodesic: true,
      strokeColor: '#2563eb',
      strokeOpacity: 0.78,
      strokeWeight: 3,
    });
    poly.setMap(map);
    overlays.push(poly);
  }

  if (gpsTrail && gpsTrail.length > 1) {
    const trailPath = gpsTrail.map((p) => ({ lat: p[0], lng: p[1] }));
    const arrowSymbol = gmaps.SymbolPath?.FORWARD_CLOSED_ARROW
      ? {
          path: gmaps.SymbolPath.FORWARD_CLOSED_ARROW,
          scale: 2.8,
          strokeColor: '#E30613',
          fillColor: '#E30613',
          fillOpacity: 1,
        }
      : null;

    const trailLine = new gmaps.Polyline({
      path: trailPath,
      geodesic: true,
      strokeColor: '#2563eb',
      strokeOpacity: 0.88,
      strokeWeight: 3.5,
      icons: arrowSymbol
        ? [
            {
              icon: arrowSymbol,
              offset: '24px',
              repeat: '70px',
            },
          ]
        : undefined,
    });
    trailLine.setMap(map);
    overlays.push(trailLine);

    const startPoint = trailPath[0];
    const startMarker = new gmaps.Marker({
      position: startPoint,
      map,
      title: 'Inicio del recorrido',
      zIndex: 900,
      icon: {
        path: gmaps.SymbolPath.CIRCLE,
        fillColor: '#059669',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2.5,
        scale: 7,
      },
    });
    overlays.push(startMarker);

    trailPath.forEach((pt) => {
      bounds.extend(pt);
    });
    hasBounds = true;
  }

  if (gpsLocation && Number.isFinite(gpsLocation.lat) && Number.isFinite(gpsLocation.lng)) {
    const truckMarker = new gmaps.Marker({
      position: { lat: gpsLocation.lat, lng: gpsLocation.lng },
      map,
      title: `Vehículo: ${gpsLocation.vehiclePlate || 'Unidad'}`,
      zIndex: 999,
      icon: {
        path: gmaps.SymbolPath.CIRCLE,
        fillColor: '#059669',
        fillOpacity: 1,
        strokeColor: '#FFFFFF',
        strokeWeight: 2.5,
        scale: 10,
      },
    });
    const speedText =
      gpsLocation.speed !== null && gpsLocation.speed !== undefined ? `${gpsLocation.speed} km/h` : 'En parada';
    const timeText = gpsLocation.lastUpdate
      ? new Date(gpsLocation.lastUpdate).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })
      : 'En vivo';
    truckMarker.addListener('click', () => {
      infoWindow.setContent(
        `<b>${escapeMapHtml(gpsLocation.vehiclePlate || 'Unidad en reparto')}</b><br/>Velocidad: ${escapeMapHtml(speedText)}<br/>Última señal: ${escapeMapHtml(timeText)}`,
      );
      infoWindow.open(map, truckMarker);
    });
    overlays.push(truckMarker);
    bounds.extend(truckMarker.getPosition());
    hasBounds = true;
  }

  const drawStopsFallbackPolyline = () => {
    if (validStops.length === 0) return;
    const path = [
      { lat: DEPOT_VILLEGAS.lat, lng: DEPOT_VILLEGAS.lng },
      ...validStops.map((s) => ({ lat: s.lat, lng: s.lng })),
      { lat: DEPOT_VILLEGAS.lat, lng: DEPOT_VILLEGAS.lng },
    ];
    const poly = new gmaps.Polyline({
      path,
      geodesic: true,
      strokeColor: '#E30613',
      strokeOpacity: 0.82,
      strokeWeight: 4,
    });
    poly.setMap(map);
    overlays.push(poly);
    if (hasBounds) map.fitBounds(bounds);
  };

  let directionsRenderer: any = null;
  if (shouldShowDirections && validStops.length > 0 && validStops.length <= 25) {
    directionsRenderer = new gmaps.DirectionsRenderer({
      map,
      suppressMarkers: true,
      polylineOptions: { strokeColor: '#E30613', strokeOpacity: 0.85, strokeWeight: 4 },
    });
    const directionsService = new gmaps.DirectionsService();
    const origin = new gmaps.LatLng(DEPOT_VILLEGAS.lat, DEPOT_VILLEGAS.lng);
    directionsService.route(
      {
        origin,
        destination: origin,
        waypoints: validStops.map((s) => ({ location: new gmaps.LatLng(s.lat, s.lng), stopover: true })),
        travelMode: gmaps.TravelMode.DRIVING,
        optimizeWaypoints: false,
      },
      (result: any, status: any) => {
        if (isCancelled()) return;
        if (status === gmaps.DirectionsStatus.OK && result) {
          directionsRenderer.setDirections(result);
          onMetrics(formatDirectionsSummary(result));
        } else {
          directionsRenderer.setMap(null);
          drawStopsFallbackPolyline();
        }
      },
    );
  } else if (validStops.length > 0) {
    drawStopsFallbackPolyline();
  } else if (validMarkers.length > 0) {
    map.setCenter({ lat: centerLat, lng: centerLng });
    map.setZoom(defaultZoom);
  } else if (hasBounds) {
    map.fitBounds(bounds);
  }

  return { directionsRenderer, mapClickListener: null };
}
