import prisma from '../../utils/prisma';
import {
  buildLiveMapPayload,
  parseArgentinaDateWindow,
  type LiveMapPayload,
} from '../../engines/live-map.engine';
import { parseArgentinaTimeRange } from '../../engines/gps-track.engine';

export const liveMapService = {
  async getLiveMap(dateStr?: string, fromTime?: string, toTime?: string): Promise<LiveMapPayload> {
    const window = parseArgentinaDateWindow(dateStr);
    const range = parseArgentinaTimeRange(window.dateKey, fromTime, toTime);

    const deliveryWhere = window.isToday
      ? {
          OR: [
            { date: { gte: window.startUtc, lte: window.endUtc } },
            { status: 'IN_TRANSIT' },
          ],
        }
      : {
          date: { gte: window.startUtc, lte: window.endUtc },
        };

    const [visits, receipts, deliveryRoutes, plannedRoutes, userGpsPings, clientsWithGps] =
      await Promise.all([
        prisma.saleRouteVisit.findMany({
          where: {
            date: { gte: range.startUtc, lte: range.endUtc },
          },
          select: {
            id: true,
            date: true,
            status: true,
            noBuyReason: true,
            notes: true,
            latitude: true,
            longitude: true,
            seller: { select: { id: true, username: true } },
            persona: {
              select: {
                id: true,
                name: true,
                address: true,
                city: true,
                latitude: true,
                longitude: true,
              },
            },
          },
          orderBy: { date: 'asc' },
        }),
        prisma.fieldReceipt.findMany({
          where: {
            capturedAt: { gte: range.startUtc, lte: range.endUtc },
            status: { not: 'VOIDED' },
          },
          select: {
            id: true,
            capturedAt: true,
            totalAmount: true,
            notes: true,
            gpsLat: true,
            gpsLng: true,
            collector: { select: { id: true, username: true } },
            persona: {
              select: {
                id: true,
                name: true,
                address: true,
                city: true,
                latitude: true,
                longitude: true,
              },
            },
          },
          orderBy: { capturedAt: 'asc' },
        }),
        prisma.deliveryRoute.findMany({
          where: deliveryWhere,
          select: {
            id: true,
            routeName: true,
            driverName: true,
            vehiclePlate: true,
            vehicleDescription: true,
            status: true,
            custodyStatus: true,
            currentLat: true,
            currentLng: true,
            currentSpeed: true,
            lastGpsUpdate: true,
            gpsPings: {
              where: {
                createdAt: { gte: range.startUtc, lte: range.endUtc },
              },
              select: { latitude: true, longitude: true, speed: true, createdAt: true },
              orderBy: { createdAt: 'asc' },
              take: 1500,
            },
            orders: {
              select: { id: true, status: true },
            },
          },
          orderBy: { date: 'desc' },
        }),
        prisma.saleRoute.findMany({
          where: {
            isActive: true,
            dayOfWeek: window.dayOfWeekEs,
          },
          select: {
            id: true,
            name: true,
            seller: { select: { id: true, username: true } },
            clients: {
              where: { isActive: true },
              select: {
                id: true,
                name: true,
                address: true,
                city: true,
                latitude: true,
                longitude: true,
                routeSequence: true,
              },
              orderBy: [{ routeSequence: 'asc' }, { name: 'asc' }],
            },
          },
          orderBy: { name: 'asc' },
        }),
        prisma.userGpsPing.findMany({
          where: {
            recordedAt: { gte: range.startUtc, lte: range.endUtc },
          },
          select: {
            userId: true,
            latitude: true,
            longitude: true,
            speed: true,
            heading: true,
            recordedAt: true,
            user: { select: { id: true, username: true } },
          },
          orderBy: { recordedAt: 'asc' },
          take: 5000,
        }),
        prisma.persona.findMany({
          where: {
            isActive: true,
            isClient: true,
            latitude: { not: null },
            longitude: { not: null },
          },
          select: {
            id: true,
            name: true,
            address: true,
            city: true,
            latitude: true,
            longitude: true,
          },
        }),
      ]);

    return buildLiveMapPayload({
      window,
      fromTime: range.fromTime,
      toTime: range.toTime,
      visits,
      receipts,
      deliveryRoutes,
      plannedRoutes,
      userGpsPings,
      clientsWithGps,
    });
  },
};
