import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';

/**
 * Obtener hojas de ruta de reparto
 */
export async function getDeliveryRoutes(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { startDate, endDate, status } = req.query;

  try {
    const whereClause: any = {};

    if (startDate && endDate) {
      whereClause.date = {
        gte: new Date(String(startDate)),
        lte: new Date(String(endDate)),
      };
    }

    if (status) {
      whereClause.status = String(status);
    }

    const routes = await prisma.deliveryRoute.findMany({
      where: whereClause,
      include: {
        orders: {
          include: {
            persona: true,
          },
        },
      },
      orderBy: { date: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: { routes },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las hojas de ruta de reparto.',
    });
  }
}

/**
 * Crear una nueva hoja de ruta de reparto
 */
export async function createDeliveryRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { driverName, vehiclePlate, vehicleDescription, date, orderIds } = req.body;
  const userId = req.user?.id;

  if (!driverName || !vehiclePlate || !orderIds || !Array.isArray(orderIds)) {
    res.status(400).json({
      status: 'error',
      message: 'Chofer, patente y listado de pedidos son obligatorios.',
    });
    return;
  }

  try {
    const route = await prisma.$transaction(async (tx) => {
      // 1. Crear la hoja de ruta
      const newRoute = await tx.deliveryRoute.create({
        data: {
          driverName,
          vehiclePlate,
          vehicleDescription,
          date: date ? new Date(date) : new Date(),
          status: 'PENDING',
        },
      });

      // 2. Asociar los pedidos a la hoja de ruta
      if (orderIds.length > 0) {
        await tx.order.updateMany({
          where: {
            id: { in: orderIds.map(Number) },
          },
          data: {
            deliveryRouteId: newRoute.id,
          },
        });
      }

      return newRoute;
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'CREATE_DELIVERY_ROUTE',
        entityType: 'DeliveryRoute',
        entityId: route.id,
        newValues: route,
      });
    }

    res.status(201).json({
      status: 'success',
      data: { route },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al crear la hoja de ruta de reparto.',
    });
  }
}

/**
 * Actualizar el estado de la hoja de ruta
 */
export async function updateRouteStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status } = req.body;
  const userId = req.user?.id;

  if (!status || !['PENDING', 'IN_TRANSIT', 'COMPLETED'].includes(status)) {
    res.status(400).json({
      status: 'error',
      message: 'Estado inválido.',
    });
    return;
  }

  try {
    const route = await prisma.$transaction(async (tx) => {
      const updatedRoute = await tx.deliveryRoute.update({
        where: { id: Number(id) },
        data: { status },
        include: { orders: true },
      });

      // Si pasa a COMPLETED, marcamos los pedidos asociados como entregados (DELIVERED)
      if (status === 'COMPLETED' && updatedRoute.orders.length > 0) {
        await tx.order.updateMany({
          where: {
            deliveryRouteId: updatedRoute.id,
            status: { not: 'CANCELLED' },
          },
          data: {
            status: 'DELIVERED',
          },
        });
      }

      return updatedRoute;
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'UPDATE_DELIVERY_ROUTE_STATUS',
        entityType: 'DeliveryRoute',
        entityId: route.id,
        newValues: route,
      });
    }

    res.status(200).json({
      status: 'success',
      data: { route },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar el estado de la hoja de ruta.',
    });
  }
}
