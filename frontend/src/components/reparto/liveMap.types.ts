import type {
  LiveVehicleGpsPoint,
  OfficialMapMarker,
} from '../../utils/officialGoogleMapHelpers';

export type LiveMapDistanceStatus = 'OK' | 'FAR' | 'CLIENT_NO_GPS' | 'EVENT_NO_GPS';
export type LiveMapEventType = 'ORDER_VISIT' | 'NO_BUY_VISIT' | 'RECEIPT';
export type LiveMapLocationSourceType = LiveMapEventType | 'GPS_PING';

export interface GpsTrackStop {
  stopNumber: number;
  lat: number;
  lng: number;
  arrivedAt: string;
  departedAt: string;
  durationSec: number;
  durationLabel: string;
  nearestClient: {
    clientId: number;
    name: string;
    address: string | null;
    distanceMeters: number;
  } | null;
}

export interface GpsTrackAnalysis {
  pointCount: number;
  totalDistanceKm: number;
  totalDurationSec: number;
  movingDurationSec: number;
  stoppedDurationSec: number;
  maxSpeedKmh: number | null;
  startedAt: string | null;
  endedAt: string | null;
  startPoint: { lat: number; lng: number } | null;
  endPoint: { lat: number; lng: number } | null;
  trail: [number, number][];
  stops: GpsTrackStop[];
}

export interface LiveMapEventItem {
  id: string;
  type: LiveMapEventType;
  at: string;
  clientId: number;
  clientName: string;
  clientAddress: string | null;
  clientCity: string | null;
  clientLat: number | null;
  clientLng: number | null;
  lat: number | null;
  lng: number | null;
  distanceMeters: number | null;
  distanceStatus: LiveMapDistanceStatus;
  noBuyReason: string | null;
  notes: string | null;
  receiptAmount: number | null;
}

export interface LiveMapSellerSummary {
  sellerId: number;
  sellerName: string;
  lastLocation: {
    lat: number;
    lng: number;
    at: string;
    eventType: LiveMapLocationSourceType;
    clientName: string;
  } | null;
  lastActivityAt: string | null;
  counts: {
    ordered: number;
    noBuy: number;
    receipts: number;
    totalEvents: number;
    visitedClients: number;
    plannedClients: number;
    farAlerts: number;
  };
  events: LiveMapEventItem[];
  trail: [number, number][];
  track?: GpsTrackAnalysis;
}

export interface LiveMapVehicleSummary {
  routeId: number;
  routeName: string | null;
  driverName: string;
  vehiclePlate: string;
  vehicleDescription: string | null;
  status: string;
  custodyStatus: string;
  lastLocation: {
    lat: number;
    lng: number;
    speed: number | null;
    at: string | null;
  } | null;
  trail: [number, number][];
  track?: GpsTrackAnalysis;
  stopsCount: number;
  deliveredCount: number;
}

export interface LiveMapPendingClient {
  clientId: number;
  name: string;
  address: string | null;
  city: string | null;
  lat: number | null;
  lng: number | null;
  sellerId: number | null;
  sellerName: string | null;
  saleRouteId: number;
  saleRouteName: string;
  routeSequence: number | null;
}

export interface LiveMapPayload {
  date: string;
  fromTime?: string;
  toTime?: string;
  dayOfWeek: string;
  isToday: boolean;
  sellers: LiveMapSellerSummary[];
  vehicles: LiveMapVehicleSummary[];
  pendingClients: LiveMapPendingClient[];
  summary: {
    activeSellers: number;
    activeVehicles: number;
    totalVisits: number;
    totalOrdered: number;
    totalNoBuy: number;
    totalReceipts: number;
    farAlertsCount: number;
    pendingClientsCount: number;
  };
}

export interface LiveMapLayers {
  sellers: boolean;
  vehicles: boolean;
  visits: boolean;
  pending: boolean;
}

export type LiveMapSelection =
  | { kind: 'seller'; id: number }
  | { kind: 'vehicle'; id: number }
  | null;

export function getTodayArgentinaDateInput(): string {
  const now = new Date();
  const shifted = new Date(now.getTime() - 3 * 3_600_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function formatEventTimeEs(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '--:--';
  return date.toLocaleTimeString('es-AR', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

export function formatRelativeTimeEs(iso: string | null, nowMs = Date.now()): string {
  if (!iso) return 'Sin GPS';
  const ts = new Date(iso).getTime();
  if (Number.isNaN(ts)) return 'Sin GPS';
  const diffMin = Math.max(0, Math.floor((nowMs - ts) / 60_000));
  if (diffMin < 1) return 'ahora';
  if (diffMin < 60) return `hace ${diffMin} min`;
  const hours = Math.floor(diffMin / 60);
  if (hours < 24) return `hace ${hours} h`;
  return formatEventTimeEs(iso);
}

export function formatDistanceEs(meters: number | null): string {
  if (meters === null || !Number.isFinite(meters)) return '';
  if (meters < 1000) return `a ${Math.round(meters)} m`;
  return `a ${(Math.round(meters / 100) / 10).toFixed(1).replace('.', ',')} km`;
}

export function eventTypeLabel(type: LiveMapLocationSourceType): string {
  if (type === 'ORDER_VISIT') return 'Venta';
  if (type === 'NO_BUY_VISIT') return 'No compró';
  if (type === 'GPS_PING') return 'GPS';
  return 'Cobro';
}

export function formatDurationCompactEs(seconds: number): string {
  const sec = Math.max(0, Math.round(seconds));
  const hours = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  if (hours > 0) return mins > 0 ? `${hours} h ${mins} min` : `${hours} h`;
  if (mins > 0) return `${mins} min`;
  return `${sec} s`;
}

function buildStopMarkers(stops: GpsTrackStop[] | undefined): OfficialMapMarker[] {
  if (!stops || stops.length === 0) return [];
  return stops.map((stop) => ({
    id: `stop-${stop.stopNumber}`,
    lat: stop.lat,
    lng: stop.lng,
    title: `Parada ${stop.stopNumber} · ${stop.durationLabel}`,
    subtitle: `${formatEventTimeEs(stop.arrivedAt)}–${formatEventTimeEs(stop.departedAt)}${stop.nearestClient ? ` · ${stop.nearestClient.name}` : ''}`,
    color: 'slate',
    stopOrder: stop.stopNumber,
  }));
}

export function buildLiveMapScene(params: {
  data: LiveMapPayload | null;
  layers: LiveMapLayers;
  selection: LiveMapSelection;
}): {
  markers: OfficialMapMarker[];
  showMarkersPolyline: boolean;
  gpsLocation: LiveVehicleGpsPoint | null;
  gpsTrail: [number, number][];
} {
  const { data, layers, selection } = params;
  if (!data) {
    return { markers: [], showMarkersPolyline: false, gpsLocation: null, gpsTrail: [] };
  }

  const markers: OfficialMapMarker[] = [];

  if (selection?.kind === 'vehicle') {
    const vehicle = data.vehicles.find((v) => v.routeId === selection.id);
    if (!vehicle) {
      return { markers: [], showMarkersPolyline: false, gpsLocation: null, gpsTrail: [] };
    }
    const gpsLocation: LiveVehicleGpsPoint | null = vehicle.lastLocation
      ? {
          lat: vehicle.lastLocation.lat,
          lng: vehicle.lastLocation.lng,
          speed: vehicle.lastLocation.speed,
          lastUpdate: vehicle.lastLocation.at,
          vehiclePlate: `${vehicle.vehiclePlate} · ${vehicle.driverName}`,
        }
      : null;
    return {
      markers: buildStopMarkers(vehicle.track?.stops),
      showMarkersPolyline: false,
      gpsLocation,
      gpsTrail: vehicle.track?.trail?.length ? vehicle.track.trail : vehicle.trail,
    };
  }

  if (selection?.kind === 'seller') {
    const seller = data.sellers.find((s) => s.sellerId === selection.id);
    let sellerTrail: [number, number][] = [];
    let sellerGpsLoc: LiveVehicleGpsPoint | null = null;

    if (seller) {
      sellerTrail = seller.track?.trail?.length ? seller.track.trail : seller.trail;

      if (seller.lastLocation && sellerTrail.length > 0) {
        sellerGpsLoc = {
          lat: seller.lastLocation.lat,
          lng: seller.lastLocation.lng,
          speed: seller.track?.maxSpeedKmh ?? null,
          lastUpdate: seller.lastLocation.at,
          vehiclePlate: seller.sellerName,
        };
      }

      const stopMarkers = buildStopMarkers(seller.track?.stops);
      markers.push(...stopMarkers);

      let seq = 0;
      for (const ev of seller.events) {
        if (ev.lat === null || ev.lng === null) continue;
        seq += 1;
        const distPart =
          ev.distanceStatus === 'FAR' && ev.distanceMeters !== null
            ? ` · ${formatDistanceEs(ev.distanceMeters)}`
            : ev.distanceStatus === 'CLIENT_NO_GPS'
              ? ' · Cliente sin GPS'
              : '';
        markers.push({
          id: ev.id,
          lat: ev.lat,
          lng: ev.lng,
          title: `${formatEventTimeEs(ev.at)} · ${ev.clientName}`,
          subtitle: `${eventTypeLabel(ev.type)}${ev.noBuyReason ? ` (${ev.noBuyReason})` : ''}${distPart}`,
          color:
            ev.distanceStatus === 'FAR'
              ? 'red'
              : ev.type === 'ORDER_VISIT'
                ? 'emerald'
                : ev.type === 'RECEIPT'
                  ? 'blue'
                  : 'slate',
          stopOrder: stopMarkers.length === 0 ? seq : undefined,
        });
      }

      if (layers.pending) {
        for (const p of data.pendingClients) {
          if (p.sellerId !== seller.sellerId || p.lat === null || p.lng === null) continue;
          markers.push({
            id: `pending-${p.clientId}`,
            lat: p.lat,
            lng: p.lng,
            title: p.name,
            subtitle: `Pendiente · ${p.address || p.city || p.saleRouteName}`,
            color: 'amber',
          });
        }
      }
    }

    const hasRealGpsTrail = sellerTrail.length > 1;
    return {
      markers,
      showMarkersPolyline: !hasRealGpsTrail && markers.some((m) => typeof m.stopOrder === 'number'),
      gpsLocation: sellerGpsLoc,
      gpsTrail: hasRealGpsTrail ? sellerTrail : [],
    };
  }

  // Vista global
  if (layers.sellers) {
    for (const s of data.sellers) {
      if (!s.lastLocation) continue;
      markers.push({
        id: `seller-${s.sellerId}`,
        lat: s.lastLocation.lat,
        lng: s.lastLocation.lng,
        title: s.sellerName,
        subtitle: `${eventTypeLabel(s.lastLocation.eventType)} · ${s.lastLocation.clientName} (${formatEventTimeEs(s.lastLocation.at)})`,
        color: 'blue',
      });
    }
  }

  if (layers.vehicles) {
    for (const v of data.vehicles) {
      if (!v.lastLocation) continue;
      markers.push({
        id: `vehicle-${v.routeId}`,
        lat: v.lastLocation.lat,
        lng: v.lastLocation.lng,
        title: `${v.vehiclePlate} · ${v.driverName}`,
        subtitle: `${v.deliveredCount}/${v.stopsCount} entregas${v.lastLocation.speed != null ? ` · ${v.lastLocation.speed} km/h` : ''}`,
        color: 'red',
      });
    }
  }

  if (layers.visits) {
    for (const s of data.sellers) {
      for (const ev of s.events) {
        if (ev.lat === null || ev.lng === null) continue;
        markers.push({
          id: ev.id,
          lat: ev.lat,
          lng: ev.lng,
          title: `${ev.clientName} (${s.sellerName})`,
          subtitle: `${formatEventTimeEs(ev.at)} · ${eventTypeLabel(ev.type)}${ev.distanceStatus === 'FAR' ? ` · ${formatDistanceEs(ev.distanceMeters)}` : ''}`,
          color:
            ev.type === 'ORDER_VISIT'
              ? 'emerald'
              : ev.type === 'RECEIPT'
                ? 'blue'
                : 'slate',
        });
      }
    }
  }

  if (layers.pending) {
    for (const p of data.pendingClients) {
      if (p.lat === null || p.lng === null) continue;
      markers.push({
        id: `pending-${p.clientId}`,
        lat: p.lat,
        lng: p.lng,
        title: p.name,
        subtitle: `Pendiente · ${p.sellerName || p.saleRouteName}`,
        color: 'amber',
      });
    }
  }

  return {
    markers,
    showMarkersPolyline: false,
    gpsLocation: null,
    gpsTrail: [],
  };
}
