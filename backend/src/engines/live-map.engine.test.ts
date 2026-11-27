import { describe, expect, it } from 'vitest';
import {
  buildLiveMapPayload,
  classifyDistanceStatus,
  haversineDistanceMeters,
  isValidCoord,
  parseArgentinaDateWindow,
} from './live-map.engine';

describe('live-map.engine', () => {
  describe('isValidCoord', () => {
    it('acepta coordenadas válidas de Argentina y rechaza nulos, cero o fuera de rango', () => {
      expect(isValidCoord(-35.0322, -63.0134)).toBe(true);
      expect(isValidCoord(0, 0)).toBe(false);
      expect(isValidCoord(null, -63.01)).toBe(false);
      expect(isValidCoord(-95, -63.01)).toBe(false);
      expect(isValidCoord(-35.03, 185)).toBe(false);
      expect(isValidCoord(Number.NaN, -63)).toBe(false);
    });
  });

  describe('haversineDistanceMeters & classifyDistanceStatus', () => {
    it('devuelve 0 metros para el mismo punto', () => {
      expect(haversineDistanceMeters(-35.0322, -63.0134, -35.0322, -63.0134)).toBe(0);
    });

    it('calcula distancias reales cercanas (~111 m por 0.001 grado de latitud)', () => {
      const dist = haversineDistanceMeters(-35.0322, -63.0134, -35.0332, -63.0134);
      expect(dist).toBeGreaterThanOrEqual(108);
      expect(dist).toBeLessThanOrEqual(114);
    });

    it('clasifica correctamente OK, FAR, CLIENT_NO_GPS y EVENT_NO_GPS', () => {
      const ok = classifyDistanceStatus(-35.0322, -63.0134, -35.0325, -63.0134);
      expect(ok.status).toBe('OK');
      expect(ok.distanceMeters).toBeLessThanOrEqual(150);

      const far = classifyDistanceStatus(-35.0322, -63.0134, -35.0422, -63.0134);
      expect(far.status).toBe('FAR');
      expect(far.distanceMeters).toBeGreaterThan(1000);

      expect(classifyDistanceStatus(-35.0322, -63.0134, null, null)).toEqual({
        distanceMeters: null,
        status: 'CLIENT_NO_GPS',
      });

      expect(classifyDistanceStatus(null, null, -35.0322, -63.0134)).toEqual({
        distanceMeters: null,
        status: 'EVENT_NO_GPS',
      });
    });
  });

  describe('parseArgentinaDateWindow', () => {
    it('calcula la ventana exacta UTC-3 para una fecha específica y el día de semana', () => {
      // 2026-11-20 es VIERNES
      const fixedNow = new Date('2026-11-20T15:00:00.000Z');
      const win = parseArgentinaDateWindow('2026-11-20', fixedNow);

      expect(win.dateKey).toBe('2026-11-20');
      expect(win.dayOfWeekEs).toBe('VIERNES');
      expect(win.isToday).toBe(true);
      expect(win.startUtc.toISOString()).toBe('2026-11-20T03:00:00.000Z');
      expect(win.endUtc.toISOString()).toBe('2026-11-21T02:59:59.999Z');
    });

    it('marca isToday=false para fechas pasadas y respeta el día correcto en Argentina cerca de medianoche UTC', () => {
      // 2026-11-21T01:30Z todavía es 2026-11-20 22:30 en Argentina
      const lateNightArt = new Date('2026-11-21T01:30:00.000Z');
      const todayWin = parseArgentinaDateWindow(undefined, lateNightArt);
      expect(todayWin.dateKey).toBe('2026-11-20');
      expect(todayWin.isToday).toBe(true);

      const pastWin = parseArgentinaDateWindow('2026-11-19', lateNightArt);
      expect(pastWin.isToday).toBe(false);
      expect(pastWin.dayOfWeekEs).toBe('JUEVES');
    });
  });

  describe('buildLiveMapPayload', () => {
    it('unifica visitas, cobros, vehículos y clientes pendientes con métricas exactas', () => {
      const window = parseArgentinaDateWindow('2026-11-20', new Date('2026-11-20T15:00:00.000Z'));

      const payload = buildLiveMapPayload({
        window,
        visits: [
          {
            id: 10,
            date: new Date('2026-11-20T12:10:00.000Z'),
            status: 'ORDERED',
            noBuyReason: null,
            notes: null,
            latitude: -35.0322,
            longitude: -63.0134,
            seller: { id: 2, username: 'Gemini Ventas' },
            persona: {
              id: 101,
              name: 'Almacén El Sol',
              address: 'Pringles 116',
              city: 'General Villegas',
              latitude: -35.0323,
              longitude: -63.0134,
            },
          },
          {
            id: 11,
            date: new Date('2026-11-20T13:05:00.000Z'),
            status: 'NO_BUY',
            noBuyReason: 'Cerrado',
            notes: 'Vuelve a la tarde',
            latitude: -35.0422,
            longitude: -63.0134,
            seller: { id: 2, username: 'Gemini Ventas' },
            persona: {
              id: 102,
              name: 'Kiosco Central',
              address: 'San Martín 450',
              city: 'General Villegas',
              latitude: -35.0322,
              longitude: -63.0134,
            },
          },
        ],
        receipts: [
          {
            id: 50,
            capturedAt: new Date('2026-11-20T12:40:00.000Z'),
            totalAmount: '45250.00',
            notes: 'Efectivo',
            gpsLat: -35.035,
            gpsLng: -63.015,
            collector: { id: 2, username: 'Gemini Ventas' },
            persona: {
              id: 101,
              name: 'Almacén El Sol',
              address: 'Pringles 116',
              city: 'General Villegas',
              latitude: null,
              longitude: null,
            },
          },
        ],
        deliveryRoutes: [
          {
            id: 7,
            routeName: 'Reparto Villegas Centro',
            driverName: 'Gemini Reparto',
            vehiclePlate: 'AF123CD',
            vehicleDescription: 'Ford Transit',
            status: 'IN_TRANSIT',
            custodyStatus: 'LOADED_IN_TRANSIT',
            currentLat: -35.036,
            currentLng: -63.018,
            currentSpeed: 38,
            lastGpsUpdate: new Date('2026-11-20T14:55:00.000Z'),
            gpsPings: [
              { latitude: -35.0322, longitude: -63.0134, createdAt: new Date('2026-11-20T14:00:00.000Z') },
              { latitude: -35.036, longitude: -63.018, createdAt: new Date('2026-11-20T14:55:00.000Z') },
            ],
            orders: [
              { id: 1, status: 'DELIVERED' },
              { id: 2, status: 'CONFIRMED' },
            ],
          },
        ],
        plannedRoutes: [
          {
            id: 3,
            name: 'Villegas Viernes',
            seller: { id: 2, username: 'Gemini Ventas' },
            clients: [
              {
                id: 101,
                name: 'Almacén El Sol',
                address: 'Pringles 116',
                city: 'General Villegas',
                latitude: -35.0323,
                longitude: -63.0134,
                routeSequence: 1,
              },
              {
                id: 103,
                name: 'Despensa Norte',
                address: 'Moreno 890',
                city: 'General Villegas',
                latitude: -35.028,
                longitude: -63.01,
                routeSequence: 2,
              },
            ],
          },
        ],
      });

      expect(payload.summary).toEqual({
        activeSellers: 1,
        activeVehicles: 1,
        totalVisits: 2,
        totalOrdered: 1,
        totalNoBuy: 1,
        totalReceipts: 1,
        farAlertsCount: 1,
        pendingClientsCount: 1,
      });

      expect(payload.sellers).toHaveLength(1);
      const seller = payload.sellers[0];
      expect(seller.events.map((e) => e.id)).toEqual(['visit-10', 'receipt-50', 'visit-11']);
      expect(seller.events[0].distanceStatus).toBe('OK');
      expect(seller.events[1].distanceStatus).toBe('CLIENT_NO_GPS');
      expect(seller.events[1].receiptAmount).toBe(45250);
      expect(seller.events[2].distanceStatus).toBe('FAR');
      expect(seller.trail).toHaveLength(3);
      expect(seller.lastLocation?.clientName).toBe('Kiosco Central');
      expect(seller.counts.visitedClients).toBe(2);
      expect(seller.counts.plannedClients).toBe(2);

      expect(payload.vehicles).toHaveLength(1);
      expect(payload.vehicles[0].stopsCount).toBe(2);
      expect(payload.vehicles[0].deliveredCount).toBe(1);
      expect(payload.vehicles[0].trail).toHaveLength(2);

      expect(payload.pendingClients).toHaveLength(1);
      expect(payload.pendingClients[0].clientId).toBe(103);
    });

    it('incorpora pings continuos UserGpsPing para trazo, paradas y posición viva aun sin visitas', () => {
      const window = parseArgentinaDateWindow('2026-11-27', new Date('2026-11-27T15:00:00Z'));
      const baseMs = new Date('2026-11-27T12:15:00.000Z').getTime();

      const payload = buildLiveMapPayload({
        window,
        fromTime: '09:15',
        toTime: '18:00',
        visits: [],
        receipts: [],
        deliveryRoutes: [],
        plannedRoutes: [],
        clientsWithGps: [
          {
            id: 201,
            name: 'Autoservicio Castelli',
            address: 'Castelli 1360',
            latitude: -35.03302,
            longitude: -63.01202,
          },
        ],
        userGpsPings: [
          {
            userId: 9,
            user: { id: 9, username: 'Gemini Ventas' },
            latitude: -35.033,
            longitude: -63.012,
            speed: 0,
            heading: 0,
            recordedAt: new Date(baseMs),
          },
          {
            userId: 9,
            user: { id: 9, username: 'Gemini Ventas' },
            latitude: -35.03301,
            longitude: -63.01201,
            speed: 0,
            heading: 0,
            recordedAt: new Date(baseMs + 10 * 60_000),
          },
          {
            userId: 9,
            user: { id: 9, username: 'Gemini Ventas' },
            latitude: -35.025,
            longitude: -63.012,
            speed: 38,
            heading: 0,
            recordedAt: new Date(baseMs + 15 * 60_000),
          },
        ],
      });

      expect(payload.fromTime).toBe('09:15');
      expect(payload.toTime).toBe('18:00');
      expect(payload.summary.activeSellers).toBe(1);
      expect(payload.sellers).toHaveLength(1);

      const seller = payload.sellers[0];
      expect(seller.lastLocation?.eventType).toBe('GPS_PING');
      expect(seller.track.stops).toHaveLength(1);
      expect(seller.track.stops[0].durationLabel).toBe('10 min');
      expect(seller.track.stops[0].nearestClient?.name).toBe('Autoservicio Castelli');
      expect(seller.track.totalDistanceKm).toBeGreaterThan(0.5);
    });
  });
});
