import { toDecimal } from '../core/money';

export const PROXIMITY_OK_METERS = 150;

const ARGENTINA_OFFSET_HOURS = -3;
const ARGENTINA_DAYS_ES = [
  'DOMINGO',
  'LUNES',
  'MARTES',
  'MIERCOLES',
  'JUEVES',
  'VIERNES',
  'SABADO',
] as const;

export type ArgentinaDayOfWeek = (typeof ARGENTINA_DAYS_ES)[number];
export type LiveMapDistanceStatus = 'OK' | 'FAR' | 'CLIENT_NO_GPS' | 'EVENT_NO_GPS';
export type LiveMapEventType = 'ORDER_VISIT' | 'NO_BUY_VISIT' | 'RECEIPT';

export interface ArgentinaDateWindow {
  dateKey: string;
  startUtc: Date;
  endUtc: Date;
  dayOfWeekEs: ArgentinaDayOfWeek;
  isToday: boolean;
}

export interface RawLiveMapVisit {
  id: number;
  date: Date;
  status: string;
  noBuyReason: string | null;
  notes: string | null;
  latitude: number | null;
  longitude: number | null;
  seller: { id: number; username: string };
  persona: {
    id: number;
    name: string;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}

export interface RawLiveMapReceipt {
  id: number;
  capturedAt: Date;
  totalAmount: unknown;
  notes: string | null;
  gpsLat: number | null;
  gpsLng: number | null;
  collector: { id: number; username: string };
  persona: {
    id: number;
    name: string;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
  };
}

export interface RawLiveMapDeliveryRoute {
  id: number;
  routeName: string | null;
  driverName: string;
  vehiclePlate: string;
  vehicleDescription: string | null;
  status: string;
  custodyStatus: string;
  currentLat: number | null;
  currentLng: number | null;
  currentSpeed: number | null;
  lastGpsUpdate: Date | null;
  gpsPings: Array<{ latitude: number; longitude: number; createdAt: Date }>;
  orders: Array<{ id: number; status: string }>;
}

export interface RawLiveMapPlannedRoute {
  id: number;
  name: string;
  seller: { id: number; username: string } | null;
  clients: Array<{
    id: number;
    name: string;
    address: string | null;
    city: string | null;
    latitude: number | null;
    longitude: number | null;
    routeSequence: number | null;
  }>;
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
    eventType: LiveMapEventType;
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
  dayOfWeek: ArgentinaDayOfWeek;
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

export function isValidCoord(lat: number | null | undefined, lng: number | null | undefined): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  if (lat === 0 && lng === 0) return false;
  return true;
}

export function haversineDistanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6_371_000;
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c);
}

export function classifyDistanceStatus(
  eventLat: number | null | undefined,
  eventLng: number | null | undefined,
  clientLat: number | null | undefined,
  clientLng: number | null | undefined,
  thresholdMeters = PROXIMITY_OK_METERS,
): { distanceMeters: number | null; status: LiveMapDistanceStatus } {
  if (!isValidCoord(eventLat, eventLng)) {
    return { distanceMeters: null, status: 'EVENT_NO_GPS' };
  }
  if (!isValidCoord(clientLat, clientLng)) {
    return { distanceMeters: null, status: 'CLIENT_NO_GPS' };
  }
  const distanceMeters = haversineDistanceMeters(
    eventLat as number,
    eventLng as number,
    clientLat as number,
    clientLng as number,
  );
  return {
    distanceMeters,
    status: distanceMeters <= thresholdMeters ? 'OK' : 'FAR',
  };
}

function getArgentinaTodayKey(now: Date): string {
  const shifted = new Date(now.getTime() + ARGENTINA_OFFSET_HOURS * 3_600_000);
  const y = shifted.getUTCFullYear();
  const m = String(shifted.getUTCMonth() + 1).padStart(2, '0');
  const d = String(shifted.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function parseArgentinaDateWindow(dateStr?: string, now = new Date()): ArgentinaDateWindow {
  const todayKey = getArgentinaTodayKey(now);
  const dateKey = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : todayKey;
  const [year, month, day] = dateKey.split('-').map((n) => parseInt(n, 10));

  // Argentina is UTC-3 year-round (no DST): 00:00 ART = 03:00 UTC
  const startUtc = new Date(Date.UTC(year, month - 1, day, -ARGENTINA_OFFSET_HOURS, 0, 0, 0));
  const endUtc = new Date(Date.UTC(year, month - 1, day, 23 - ARGENTINA_OFFSET_HOURS, 59, 59, 999));
  const dayOfWeekEs = ARGENTINA_DAYS_ES[new Date(Date.UTC(year, month - 1, day)).getUTCDay()];

  return {
    dateKey,
    startUtc,
    endUtc,
    dayOfWeekEs,
    isToday: dateKey === todayKey,
  };
}

export function buildLiveMapPayload(input: {
  window: ArgentinaDateWindow;
  visits: RawLiveMapVisit[];
  receipts: RawLiveMapReceipt[];
  deliveryRoutes: RawLiveMapDeliveryRoute[];
  plannedRoutes: RawLiveMapPlannedRoute[];
}): LiveMapPayload {
  const { window, visits, receipts, deliveryRoutes, plannedRoutes } = input;

  const sellerMap = new Map<
    number,
    {
      sellerId: number;
      sellerName: string;
      events: LiveMapEventItem[];
      visitedClientIds: Set<number>;
      plannedClientIds: Set<number>;
      ordered: number;
      noBuy: number;
      receipts: number;
      farAlerts: number;
    }
  >();

  const ensureSeller = (sellerId: number, sellerName: string) => {
    let entry = sellerMap.get(sellerId);
    if (!entry) {
      entry = {
        sellerId,
        sellerName,
        events: [],
        visitedClientIds: new Set<number>(),
        plannedClientIds: new Set<number>(),
        ordered: 0,
        noBuy: 0,
        receipts: 0,
        farAlerts: 0,
      };
      sellerMap.set(sellerId, entry);
    }
    return entry;
  };

  for (const route of plannedRoutes) {
    if (!route.seller) continue;
    const entry = ensureSeller(route.seller.id, route.seller.username);
    for (const c of route.clients) entry.plannedClientIds.add(c.id);
  }

  const globallyVisitedClientIds = new Set<number>();

  for (const visit of visits) {
    const entry = ensureSeller(visit.seller.id, visit.seller.username);
    const type: LiveMapEventType = visit.status === 'ORDERED' ? 'ORDER_VISIT' : 'NO_BUY_VISIT';
    const dist = classifyDistanceStatus(
      visit.latitude,
      visit.longitude,
      visit.persona.latitude,
      visit.persona.longitude,
    );

    if (type === 'ORDER_VISIT') entry.ordered += 1;
    else entry.noBuy += 1;
    if (dist.status === 'FAR') entry.farAlerts += 1;

    entry.visitedClientIds.add(visit.persona.id);
    globallyVisitedClientIds.add(visit.persona.id);

    entry.events.push({
      id: `visit-${visit.id}`,
      type,
      at: visit.date.toISOString(),
      clientId: visit.persona.id,
      clientName: visit.persona.name,
      clientAddress: visit.persona.address,
      clientCity: visit.persona.city,
      clientLat: isValidCoord(visit.persona.latitude, visit.persona.longitude)
        ? visit.persona.latitude
        : null,
      clientLng: isValidCoord(visit.persona.latitude, visit.persona.longitude)
        ? visit.persona.longitude
        : null,
      lat: isValidCoord(visit.latitude, visit.longitude) ? visit.latitude : null,
      lng: isValidCoord(visit.latitude, visit.longitude) ? visit.longitude : null,
      distanceMeters: dist.distanceMeters,
      distanceStatus: dist.status,
      noBuyReason: visit.noBuyReason,
      notes: visit.notes,
      receiptAmount: null,
    });
  }

  for (const receipt of receipts) {
    const entry = ensureSeller(receipt.collector.id, receipt.collector.username);
    const dist = classifyDistanceStatus(
      receipt.gpsLat,
      receipt.gpsLng,
      receipt.persona.latitude,
      receipt.persona.longitude,
    );

    entry.receipts += 1;
    if (dist.status === 'FAR') entry.farAlerts += 1;

    entry.visitedClientIds.add(receipt.persona.id);
    globallyVisitedClientIds.add(receipt.persona.id);

    entry.events.push({
      id: `receipt-${receipt.id}`,
      type: 'RECEIPT',
      at: receipt.capturedAt.toISOString(),
      clientId: receipt.persona.id,
      clientName: receipt.persona.name,
      clientAddress: receipt.persona.address,
      clientCity: receipt.persona.city,
      clientLat: isValidCoord(receipt.persona.latitude, receipt.persona.longitude)
        ? receipt.persona.latitude
        : null,
      clientLng: isValidCoord(receipt.persona.latitude, receipt.persona.longitude)
        ? receipt.persona.longitude
        : null,
      lat: isValidCoord(receipt.gpsLat, receipt.gpsLng) ? receipt.gpsLat : null,
      lng: isValidCoord(receipt.gpsLat, receipt.gpsLng) ? receipt.gpsLng : null,
      distanceMeters: dist.distanceMeters,
      distanceStatus: dist.status,
      noBuyReason: null,
      notes: receipt.notes,
      receiptAmount: toDecimal(receipt.totalAmount as any).toDecimalPlaces(0).toNumber(),
    });
  }

  const sellers: LiveMapSellerSummary[] = Array.from(sellerMap.values())
    .map((entry) => {
      entry.events.sort((a, b) => a.at.localeCompare(b.at));
      const trail: [number, number][] = [];
      let lastLocation: LiveMapSellerSummary['lastLocation'] = null;

      for (const ev of entry.events) {
        if (ev.lat !== null && ev.lng !== null) {
          trail.push([ev.lat, ev.lng]);
          lastLocation = {
            lat: ev.lat,
            lng: ev.lng,
            at: ev.at,
            eventType: ev.type,
            clientName: ev.clientName,
          };
        }
      }

      const lastActivityAt =
        entry.events.length > 0 ? entry.events[entry.events.length - 1].at : null;

      return {
        sellerId: entry.sellerId,
        sellerName: entry.sellerName,
        lastLocation,
        lastActivityAt,
        counts: {
          ordered: entry.ordered,
          noBuy: entry.noBuy,
          receipts: entry.receipts,
          totalEvents: entry.events.length,
          visitedClients: entry.visitedClientIds.size,
          plannedClients: entry.plannedClientIds.size,
          farAlerts: entry.farAlerts,
        },
        events: entry.events,
        trail,
      };
    })
    .sort((a, b) => {
      if (a.lastActivityAt && b.lastActivityAt) return b.lastActivityAt.localeCompare(a.lastActivityAt);
      if (a.lastActivityAt) return -1;
      if (b.lastActivityAt) return 1;
      return a.sellerName.localeCompare(b.sellerName);
    });

  const vehicles: LiveMapVehicleSummary[] = deliveryRoutes.map((route) => {
    const validPings = route.gpsPings
      .filter((p) => isValidCoord(p.latitude, p.longitude))
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());

    const trail: [number, number][] = validPings.map((p) => [p.latitude, p.longitude]);

    let lastLocation: LiveMapVehicleSummary['lastLocation'] = null;
    if (isValidCoord(route.currentLat, route.currentLng)) {
      lastLocation = {
        lat: route.currentLat as number,
        lng: route.currentLng as number,
        speed: route.currentSpeed ?? null,
        at: route.lastGpsUpdate ? route.lastGpsUpdate.toISOString() : null,
      };
    } else if (validPings.length > 0) {
      const last = validPings[validPings.length - 1];
      lastLocation = {
        lat: last.latitude,
        lng: last.longitude,
        speed: null,
        at: last.createdAt.toISOString(),
      };
    }

    const deliveredCount = route.orders.filter(
      (o) => o.status === 'DELIVERED' || o.status === 'COMPLETED',
    ).length;

    return {
      routeId: route.id,
      routeName: route.routeName,
      driverName: route.driverName,
      vehiclePlate: route.vehiclePlate,
      vehicleDescription: route.vehicleDescription,
      status: route.status,
      custodyStatus: route.custodyStatus,
      lastLocation,
      trail,
      stopsCount: route.orders.length,
      deliveredCount,
    };
  });

  const pendingClients: LiveMapPendingClient[] = [];
  const seenPendingIds = new Set<number>();

  for (const route of plannedRoutes) {
    for (const c of route.clients) {
      if (globallyVisitedClientIds.has(c.id) || seenPendingIds.has(c.id)) continue;
      seenPendingIds.add(c.id);
      const valid = isValidCoord(c.latitude, c.longitude);
      pendingClients.push({
        clientId: c.id,
        name: c.name,
        address: c.address,
        city: c.city,
        lat: valid ? c.latitude : null,
        lng: valid ? c.longitude : null,
        sellerId: route.seller?.id ?? null,
        sellerName: route.seller?.username ?? null,
        saleRouteId: route.id,
        saleRouteName: route.name,
        routeSequence: c.routeSequence,
      });
    }
  }

  let totalOrdered = 0;
  let totalNoBuy = 0;
  let totalReceipts = 0;
  let farAlertsCount = 0;
  let activeSellers = 0;

  for (const s of sellers) {
    if (s.counts.totalEvents > 0) activeSellers += 1;
    totalOrdered += s.counts.ordered;
    totalNoBuy += s.counts.noBuy;
    totalReceipts += s.counts.receipts;
    farAlertsCount += s.counts.farAlerts;
  }

  return {
    date: window.dateKey,
    dayOfWeek: window.dayOfWeekEs,
    isToday: window.isToday,
    sellers,
    vehicles,
    pendingClients,
    summary: {
      activeSellers,
      activeVehicles: vehicles.filter((v) => v.status === 'IN_TRANSIT' || v.lastLocation !== null)
        .length,
      totalVisits: totalOrdered + totalNoBuy,
      totalOrdered,
      totalNoBuy,
      totalReceipts,
      farAlertsCount,
      pendingClientsCount: pendingClients.length,
    },
  };
}
