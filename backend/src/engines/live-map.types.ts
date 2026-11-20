export const ARGENTINA_DAYS_ES = [
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
