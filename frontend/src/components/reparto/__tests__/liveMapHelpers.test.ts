import { describe, expect, it } from 'vitest';
import { buildClientAddressQuery } from '../LiveMapClientLocationModal';
import {
  buildLiveMapScene,
  formatDistanceEs,
  formatRelativeTimeEs,
  type LiveMapPayload,
} from '../liveMap.types';

const SAMPLE_PAYLOAD: LiveMapPayload = {
  date: '2026-11-20',
  dayOfWeek: 'VIERNES',
  isToday: true,
  sellers: [
    {
      sellerId: 2,
      sellerName: 'Gemini Ventas',
      lastLocation: {
        lat: -35.035,
        lng: -63.015,
        at: '2026-11-20T14:20:00.000Z',
        eventType: 'NO_BUY_VISIT',
        clientName: 'Kiosco Central',
      },
      lastActivityAt: '2026-11-20T14:20:00.000Z',
      counts: {
        ordered: 1,
        noBuy: 1,
        receipts: 0,
        totalEvents: 2,
        visitedClients: 2,
        plannedClients: 3,
        farAlerts: 1,
      },
      events: [
        {
          id: 'visit-1',
          type: 'ORDER_VISIT',
          at: '2026-11-20T13:10:00.000Z',
          clientId: 10,
          clientName: 'Almacén El Sol',
          clientAddress: 'Pringles 116',
          clientCity: 'General Villegas',
          clientLat: -35.0322,
          clientLng: -63.0134,
          lat: -35.0323,
          lng: -63.0134,
          distanceMeters: 11,
          distanceStatus: 'OK',
          noBuyReason: null,
          notes: null,
          receiptAmount: null,
        },
        {
          id: 'visit-2',
          type: 'NO_BUY_VISIT',
          at: '2026-11-20T14:20:00.000Z',
          clientId: 11,
          clientName: 'Kiosco Central',
          clientAddress: 'San Martín 450',
          clientCity: 'General Villegas',
          clientLat: -35.0322,
          clientLng: -63.0134,
          lat: -35.035,
          lng: -63.015,
          distanceMeters: 345,
          distanceStatus: 'FAR',
          noBuyReason: 'Cerrado',
          notes: null,
          receiptAmount: null,
        },
      ],
      trail: [
        [-35.0323, -63.0134],
        [-35.035, -63.015],
      ],
    },
  ],
  vehicles: [
    {
      routeId: 7,
      routeName: 'Villegas Centro',
      driverName: 'Gemini Reparto',
      vehiclePlate: 'AF123CD',
      vehicleDescription: 'Ford Transit',
      status: 'IN_TRANSIT',
      custodyStatus: 'LOADED_IN_TRANSIT',
      lastLocation: {
        lat: -35.04,
        lng: -63.02,
        speed: 42,
        at: '2026-11-20T14:25:00.000Z',
      },
      trail: [
        [-35.0322, -63.0134],
        [-35.04, -63.02],
      ],
      stopsCount: 5,
      deliveredCount: 2,
    },
  ],
  pendingClients: [
    {
      clientId: 12,
      name: 'Despensa Norte',
      address: 'Moreno 890',
      city: 'General Villegas',
      lat: -35.028,
      lng: -63.01,
      sellerId: 2,
      sellerName: 'Gemini Ventas',
      saleRouteId: 3,
      saleRouteName: 'Villegas Viernes',
      routeSequence: 3,
    },
  ],
  summary: {
    activeSellers: 1,
    activeVehicles: 1,
    totalVisits: 2,
    totalOrdered: 1,
    totalNoBuy: 1,
    totalReceipts: 0,
    farAlertsCount: 1,
    pendingClientsCount: 1,
  },
};

describe('liveMapHelpers', () => {
  it('formatea distancias y tiempos relativos en español', () => {
    expect(formatDistanceEs(85)).toBe('a 85 m');
    expect(formatDistanceEs(1450)).toBe('a 1,5 km');
    expect(formatDistanceEs(null)).toBe('');

    const now = new Date('2026-11-20T14:30:00.000Z').getTime();
    expect(formatRelativeTimeEs('2026-11-20T14:25:00.000Z', now)).toBe('hace 5 min');
    expect(formatRelativeTimeEs('2026-11-20T14:29:40.000Z', now)).toBe('ahora');
    expect(formatRelativeTimeEs(null, now)).toBe('Sin GPS');
  });

  it('arma la escena global respetando las capas activas', () => {
    const scene = buildLiveMapScene({
      data: SAMPLE_PAYLOAD,
      layers: { sellers: true, vehicles: true, visits: false, pending: false },
      selection: null,
    });

    expect(scene.markers.map((m) => m.id)).toEqual(['seller-2', 'vehicle-7']);
    expect(scene.showMarkersPolyline).toBe(false);

    const withPending = buildLiveMapScene({
      data: SAMPLE_PAYLOAD,
      layers: { sellers: false, vehicles: false, visits: false, pending: true },
      selection: null,
    });
    expect(withPending.markers.map((m) => m.id)).toEqual(['pending-12']);
  });

  it('enfoca un vendedor mostrando su estela GPS, paradas y alerta de distancia', () => {
    const scene = buildLiveMapScene({
      data: SAMPLE_PAYLOAD,
      layers: { sellers: true, vehicles: true, visits: true, pending: true },
      selection: { kind: 'seller', id: 2 },
    });

    expect(scene.gpsTrail).toHaveLength(2);
    expect(scene.showMarkersPolyline).toBe(false);
    expect(scene.markers.map((m) => m.id)).toEqual(['visit-1', 'visit-2', 'pending-12']);
    expect(scene.markers[0].stopOrder).toBe(1);
    expect(scene.markers[1].color).toBe('red');
  });

  it('enfoca un vehículo mostrando su ubicación en vivo, estela GPS y pines numerados de paradas', () => {
    const payloadWithStops: LiveMapPayload = {
      ...SAMPLE_PAYLOAD,
      vehicles: [
        {
          ...SAMPLE_PAYLOAD.vehicles[0],
          track: {
            pointCount: 3,
            totalDistanceKm: 4.2,
            totalDurationSec: 3600,
            movingDurationSec: 557,
            stoppedDurationSec: 3043,
            maxSpeedKmh: 45,
            startedAt: '2026-11-20T12:15:01.000Z',
            endedAt: '2026-11-20T13:15:01.000Z',
            startPoint: { lat: -35.0322, lng: -63.0134 },
            endPoint: { lat: -35.04, lng: -63.02 },
            trail: [
              [-35.0322, -63.0134],
              [-35.04, -63.02],
            ],
            stops: [
              {
                stopNumber: 1,
                lat: -35.033,
                lng: -63.012,
                arrivedAt: '2026-11-20T12:15:01.000Z',
                departedAt: '2026-11-20T13:05:44.000Z',
                durationSec: 3043,
                durationLabel: '50 min 43 s',
                nearestClient: {
                  clientId: 10,
                  name: 'Almacén El Sol',
                  address: 'Pringles 116',
                  distanceMeters: 18,
                },
              },
            ],
          },
        },
      ],
    };

    const scene = buildLiveMapScene({
      data: payloadWithStops,
      layers: { sellers: true, vehicles: true, visits: true, pending: false },
      selection: { kind: 'vehicle', id: 7 },
    });

    expect(scene.markers).toHaveLength(1);
    expect(scene.markers[0].id).toBe('stop-1');
    expect(scene.markers[0].stopOrder).toBe(1);
    expect(scene.markers[0].title).toContain('50 min 43 s');
    expect(scene.gpsLocation?.vehiclePlate).toBe('AF123CD · Gemini Reparto');
    expect(scene.gpsTrail).toHaveLength(2);
  });

  it('arma la búsqueda priorizando dirección y localidad del cliente', () => {
    expect(buildClientAddressQuery('Rivadavia 350', 'General Villegas')).toBe(
      'Rivadavia 350, General Villegas, Buenos Aires, Argentina',
    );
    expect(buildClientAddressQuery('  Mitre 120 ', null)).toContain('Mitre 120');
  });
});
