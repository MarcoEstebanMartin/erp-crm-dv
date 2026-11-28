import { toDecimal } from '../core/money';
import { analyzeGpsTrack, type RawGpsTrackPing } from './gps-track.engine';
import {
  PROXIMITY_OK_METERS,
  classifyDistanceStatus,
  haversineDistanceMeters,
  isValidCoord,
  parseArgentinaDateWindow,
} from './live-map-geo.engine';
import {
  type ArgentinaDateWindow,
  type LiveMapClientGpsRef,
  type LiveMapEventItem,
  type LiveMapEventType,
  type LiveMapPayload,
  type LiveMapPendingClient,
  type LiveMapSellerSummary,
  type LiveMapVehicleSummary,
  type RawLiveMapDeliveryRoute,
  type RawLiveMapPlannedRoute,
  type RawLiveMapReceipt,
  type RawLiveMapUserGpsPing,
  type RawLiveMapVisit,
} from './live-map.types';

export * from './live-map.types';
export {
  PROXIMITY_OK_METERS,
  classifyDistanceStatus,
  haversineDistanceMeters,
  isValidCoord,
  parseArgentinaDateWindow,
};

export function buildLiveMapPayload(input: {
  window: ArgentinaDateWindow;
  fromTime?: string;
  toTime?: string;
  visits: RawLiveMapVisit[];
  receipts: RawLiveMapReceipt[];
  deliveryRoutes: RawLiveMapDeliveryRoute[];
  plannedRoutes: RawLiveMapPlannedRoute[];
  userGpsPings?: RawLiveMapUserGpsPing[];
  clientsWithGps?: LiveMapClientGpsRef[];
}): LiveMapPayload {
  const {
    window,
    fromTime = '00:00',
    toTime = '23:59',
    visits,
    receipts,
    deliveryRoutes,
    plannedRoutes,
    userGpsPings = [],
    clientsWithGps = [],
  } = input;

  const sellerMap = new Map<
    number,
    {
      sellerId: number;
      sellerName: string;
      events: LiveMapEventItem[];
      rawPings: RawGpsTrackPing[];
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
        rawPings: [],
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

  for (const ping of userGpsPings) {
    if (!isValidCoord(ping.latitude, ping.longitude)) continue;
    const entry = ensureSeller(ping.user.id, ping.user.username);
    entry.rawPings.push({
      latitude: ping.latitude,
      longitude: ping.longitude,
      speed: ping.speed,
      heading: ping.heading,
      recordedAt: ping.recordedAt,
    });
  }

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
      const eventTrail: [number, number][] = [];
      let lastLocation: LiveMapSellerSummary['lastLocation'] = null;

      for (const ev of entry.events) {
        if (ev.lat !== null && ev.lng !== null) {
          eventTrail.push([ev.lat, ev.lng]);
          lastLocation = {
            lat: ev.lat,
            lng: ev.lng,
            at: ev.at,
            eventType: ev.type,
            clientName: ev.clientName,
          };
        }
      }

      // Si hay pings GPS continuos los usamos para trazo y paradas; si no, usamos las coords de eventos
      const trackSourcePings: RawGpsTrackPing[] =
        entry.rawPings.length > 0
          ? entry.rawPings
          : entry.events
              .filter((ev) => ev.lat !== null && ev.lng !== null)
              .map((ev) => ({
                latitude: ev.lat as number,
                longitude: ev.lng as number,
                recordedAt: ev.at,
              }));

      const track = analyzeGpsTrack({
        pings: trackSourcePings,
        clients: clientsWithGps,
      });

      if (
        entry.rawPings.length > 0 &&
        track.endPoint &&
        track.endedAt &&
        (!lastLocation || track.endedAt > lastLocation.at)
      ) {
        lastLocation = {
          lat: track.endPoint.lat,
          lng: track.endPoint.lng,
          at: track.endedAt,
          eventType: 'GPS_PING',
          clientName: 'GPS activo',
        };
      }

      const lastEventAt =
        entry.events.length > 0 ? entry.events[entry.events.length - 1].at : null;
      const lastActivityAt =
        lastEventAt && track.endedAt
          ? lastEventAt >= track.endedAt
            ? lastEventAt
            : track.endedAt
          : lastEventAt ?? track.endedAt;

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
        trail: track.trail.length > 0 ? track.trail : eventTrail,
        track,
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

    const track = analyzeGpsTrack({
      pings: validPings.map((p) => ({
        latitude: p.latitude,
        longitude: p.longitude,
        speed: p.speed ?? null,
        recordedAt: p.createdAt,
      })),
      clients: clientsWithGps,
    });

    const trail: [number, number][] =
      track.trail.length > 0 ? track.trail : validPings.map((p) => [p.latitude, p.longitude]);

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
        speed: last.speed ?? null,
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
      track,
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
    if (s.counts.totalEvents > 0 || s.track.pointCount > 0) activeSellers += 1;
    totalOrdered += s.counts.ordered;
    totalNoBuy += s.counts.noBuy;
    totalReceipts += s.counts.receipts;
    farAlertsCount += s.counts.farAlerts;
  }

  return {
    date: window.dateKey,
    fromTime,
    toTime,
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
