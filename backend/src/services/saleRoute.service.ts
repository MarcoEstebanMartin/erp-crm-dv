import prisma from '../utils/prisma';
import { logAudit } from '../utils/audit';

export class SaleRouteService {
  /**
   * Obtener todas las rutas (Admin).
   */
  async getSaleRoutes() {
    return prisma.saleRoute.findMany({
      include: {
        seller: {
          select: { id: true, username: true },
        },
        _count: {
          select: { clients: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Obtener rutas de un vendedor.
   */
  async getSellerSaleRoutes(sellerId: number) {
    return prisma.saleRoute.findMany({
      where: {
        sellerId,
        isActive: true,
      },
      include: {
        _count: {
          select: { clients: true },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  /**
   * Obtiene los límites de inicio y fin de la fecha actual en la zona de Argentina (UTC-3)
   * mapeados de vuelta a objetos Date en UTC compatibles con la base de datos.
   */
  private getArgentinaTodayBounds(): { start: Date; end: Date } {
    const argentinaOffset = -3; // UTC-3
    const now = new Date();
    
    // Obtener la hora actual simulada en Argentina
    const dateInArgentina = new Date(now.getTime() + (argentinaOffset * 60 + now.getTimezoneOffset()) * 60000);
    
    const todayStart = new Date(dateInArgentina);
    todayStart.setHours(0, 0, 0, 0);
    const startUtc = new Date(todayStart.getTime() - (argentinaOffset * 60 + now.getTimezoneOffset()) * 60000);
    
    const todayEnd = new Date(dateInArgentina);
    todayEnd.setHours(23, 59, 59, 999);
    const endUtc = new Date(todayEnd.getTime() - (argentinaOffset * 60 + now.getTimezoneOffset()) * 60000);
    
    return { start: startUtc, end: endUtc };
  }

  /**
   * Obtener ruta por ID, con clientes ordenados secuencialmente y estado de visita de hoy.
   */
  async getSaleRouteById(id: number) {
    const bounds = this.getArgentinaTodayBounds();

    const route = await prisma.saleRoute.findUnique({
      where: { id },
      include: {
        seller: {
          select: { id: true, username: true },
        },
        clients: {
          where: { isActive: true },
          orderBy: [
            { routeSequence: 'asc' },
            { name: 'asc' },
          ],
          include: {
            routeVisits: {
              where: {
                date: {
                  gte: bounds.start,
                  lte: bounds.end,
                },
              },
              take: 1,
            },
          },
        },
      },
    });

    if (!route) throw new Error('Ruta de venta no encontrada.');
    return route;
  }

  /**
   * Crear nueva ruta de preventa.
   */
  async createSaleRoute(data: any, userId: number) {
    const sellerId = data.sellerId ? Number(data.sellerId) : null;
    const route = await prisma.saleRoute.create({
      data: {
        name: data.name,
        sellerId,
        dayOfWeek: data.dayOfWeek || null,
        isActive: true,
      },
    });

    await logAudit({
      userId,
      action: 'CREATE_SALE_ROUTE',
      entityType: 'SaleRoute',
      entityId: route.id,
      newValues: route,
    });

    return route;
  }

  /**
   * Actualizar ruta de preventa.
   */
  async updateSaleRoute(id: number, data: any, userId: number) {
    const original = await prisma.saleRoute.findUnique({ where: { id } });
    if (!original) throw new Error('Ruta de venta no encontrada.');

    const sellerId = data.sellerId !== undefined ? (data.sellerId ? Number(data.sellerId) : null) : undefined;

    const route = await prisma.saleRoute.update({
      where: { id },
      data: {
        name: data.name !== undefined ? data.name : undefined,
        sellerId,
        dayOfWeek: data.dayOfWeek !== undefined ? data.dayOfWeek : undefined,
        isActive: data.isActive !== undefined ? Boolean(data.isActive) : undefined,
      },
    });

    await logAudit({
      userId,
      action: 'UPDATE_SALE_ROUTE',
      entityType: 'SaleRoute',
      entityId: route.id,
      oldValues: original,
      newValues: route,
    });

    return route;
  }

  /**
   * Eliminar ruta de preventa (desasociando clientes).
   */
  async deleteSaleRoute(id: number, userId: number) {
    const route = await prisma.saleRoute.findUnique({ where: { id } });
    if (!route) throw new Error('Ruta de venta no encontrada.');

    // Desasociar clientes de la ruta primero
    await prisma.persona.updateMany({
      where: { saleRouteId: id },
      data: { saleRouteId: null, routeSequence: null },
    });

    await prisma.saleRoute.delete({ where: { id } });

    await logAudit({
      userId,
      action: 'DELETE_SALE_ROUTE',
      entityType: 'SaleRoute',
      entityId: id,
      oldValues: route,
    });

    return { status: 'success', message: 'Ruta eliminada con éxito.' };
  }

  /**
   * Actualizar orden secuencial de los clientes en una ruta.
   */
  async updateClientSequence(routeId: number, clientIds: number[], userId: number) {
    const route = await prisma.saleRoute.findUnique({ where: { id: routeId } });
    if (!route) throw new Error('Ruta de venta no encontrada.');

    // Transacción para actualizar la secuencia de cada cliente
    const updates = clientIds.map((clientId, index) => {
      return prisma.persona.update({
        where: { id: clientId },
        data: { 
          saleRouteId: routeId,
          routeSequence: index + 1 
        },
      });
    });

    await prisma.$transaction(updates);

    await logAudit({
      userId,
      action: 'UPDATE_SALE_ROUTE_SEQUENCE',
      entityType: 'SaleRoute',
      entityId: routeId,
      newValues: { clientSequence: clientIds },
    });

    return { status: 'success', message: 'Secuencia de la ruta actualizada con éxito.' };
  }

  /**
   * Asociar un cliente a la ruta (al final de la secuencia).
   */
  async addClientToRoute(routeId: number, clientId: number, userId: number) {
    const route = await prisma.saleRoute.findUnique({ where: { id: routeId } });
    if (!route) throw new Error('Ruta de venta no encontrada.');

    const client = await prisma.persona.findUnique({ where: { id: clientId } });
    if (!client) throw new Error('Cliente no encontrado.');

    // Obtener la secuencia máxima actual en la ruta
    const lastClient = await prisma.persona.findFirst({
      where: { saleRouteId: routeId },
      orderBy: { routeSequence: 'desc' },
      select: { routeSequence: true },
    });

    const nextSequence = (lastClient?.routeSequence ?? 0) + 1;

    const updatedClient = await prisma.persona.update({
      where: { id: clientId },
      data: {
        saleRouteId: routeId,
        routeSequence: nextSequence,
      },
    });

    await logAudit({
      userId,
      action: 'ADD_CLIENT_TO_ROUTE',
      entityType: 'Persona',
      entityId: clientId,
      newValues: { saleRouteId: routeId, routeSequence: nextSequence },
    });

    return updatedClient;
  }

  /**
   * Registrar o actualizar visita de preventa diaria (visita fallida o compra).
   */
  async recordRouteVisit(routeId: number, data: any, sellerId: number) {
    const { personaId, status, noBuyReason, notes, latitude, longitude } = data;

    const client = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!client) throw new Error('Cliente no encontrado.');

    const bounds = this.getArgentinaTodayBounds();

    // Buscar si ya existe una visita hoy para este cliente
    const existingVisit = await prisma.saleRouteVisit.findFirst({
      where: {
        personaId,
        date: {
          gte: bounds.start,
          lte: bounds.end,
        },
      },
    });

    let visit;
    if (existingVisit) {
      visit = await prisma.saleRouteVisit.update({
        where: { id: existingVisit.id },
        data: {
          status,
          noBuyReason: status === 'ORDERED' ? null : (noBuyReason || null),
          notes: notes || null,
          latitude: latitude !== undefined ? latitude : undefined,
          longitude: longitude !== undefined ? longitude : undefined,
          sellerId,
        },
      });
    } else {
      visit = await prisma.saleRouteVisit.create({
        data: {
          personaId,
          sellerId,
          saleRouteId: routeId,
          status,
          noBuyReason: status === 'ORDERED' ? null : (noBuyReason || null),
          notes: notes || null,
          latitude: latitude || null,
          longitude: longitude || null,
        },
      });
    }

    await logAudit({
      userId: sellerId,
      action: 'RECORD_ROUTE_VISIT',
      entityType: 'SaleRouteVisit',
      entityId: visit.id,
      newValues: visit,
    });

    return visit;
  }

  /**
   * Obtener las visitas del día de hoy realizadas por el vendedor.
   */
  async getTodayVisits(sellerId: number) {
    const bounds = this.getArgentinaTodayBounds();

    return prisma.saleRouteVisit.findMany({
      where: {
        sellerId,
        date: {
          gte: bounds.start,
          lte: bounds.end,
        },
      },
      select: {
        personaId: true,
        status: true,
        noBuyReason: true,
        notes: true,
      },
    });
  }
}

export const saleRouteService = new SaleRouteService();
