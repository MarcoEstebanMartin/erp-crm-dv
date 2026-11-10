import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';
import {
  BillingType,
  InvoiceType,
  OrderStatus,
  TransactionType,
  PaymentMethod,
  Role,
  LedgerEntryType,
  LedgerSourceType,
} from '@prisma/client';
import { emitirFacturaAFIP } from '../services/afip.service';
import { recordLedgerMovement } from '../services/ledger/account-ledger.service';

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
            items: {
              include: {
                product: true,
              },
            },
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
  const { driverName, companionName, vehiclePlate, vehicleDescription, vehicleId, date, orderIds } = req.body;
  const userId = req.user?.id;

  if (!driverName || (!vehiclePlate && !vehicleId) || !orderIds || !Array.isArray(orderIds)) {
    res.status(400).json({
      status: 'error',
      message: 'Chofer, patente (o vehículo de la flota) y listado de pedidos son obligatorios.',
    });
    return;
  }

  try {
    let finalPlate = vehiclePlate;
    let finalDesc = vehicleDescription;
    let vId = vehicleId ? Number(vehicleId) : null;

    if (vId) {
      const dbVehicle = await prisma.vehicle.findUnique({ where: { id: vId } });
      if (dbVehicle) {
        if (!finalPlate) finalPlate = dbVehicle.plate;
        if (!finalDesc) finalDesc = `${dbVehicle.brand} ${dbVehicle.model}`;
      } else {
        vId = null; // Si por alguna razón no existe, no asociar
      }
    }

    const route = await prisma.$transaction(async (tx) => {
      // 1. Crear la hoja de ruta
      const newRoute = await tx.deliveryRoute.create({
        data: {
          driverName: driverName.trim(),
          companionName: companionName ? companionName.trim() : null,
          vehiclePlate: finalPlate || '',
          vehicleDescription: finalDesc || null,
          vehicleId: vId,
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

/**
 * Liquidar una hoja de ruta con cobros por lote
 */
export async function settleDeliveryRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { settlements, cashDeclared, checksDeclared, transfersDeclared } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const routeId = Number(id);
    const route = await prisma.deliveryRoute.findUnique({
      where: { id: routeId },
      include: { orders: { include: { persona: true } } }
    });

    if (!route) {
      res.status(404).json({ status: 'error', message: 'Hoja de ruta no encontrada.' });
      return;
    }

    if (route.status === 'COMPLETED') {
      res.status(400).json({ status: 'error', message: 'La hoja de ruta ya fue completada y liquidada.' });
      return;
    }

    // 1. Pre-facturar por AFIP fuera de la transacción de DB para evitar bloqueos y timeouts
    const afipResults: Record<number, {
      invoiceType: InvoiceType;
      invoiceNumber: string;
      cae: string | null;
      caeDueDate: Date | null;
    }> = {};

    for (const order of route.orders) {
      const set = settlements.find((s: any) => s.orderId === order.id);
      if (!set) continue;

      if (order.status === OrderStatus.PREPARED && order.billingType === BillingType.OFFICIAL) {
        try {
          const persona = order.persona;
          const invoiceType = (persona?.cuit && persona.cuit.length > 5) ? InvoiceType.FACTURA_A : InvoiceType.FACTURA_B;
          
          const afipRes = await emitirFacturaAFIP({
            total: Number(order.totalAmount),
            clientDocType: invoiceType === InvoiceType.FACTURA_A ? 80 : 99,
            clientCuit: invoiceType === InvoiceType.FACTURA_A ? (persona?.cuit?.replace(/\D/g, '') || '0') : '0',
            invoiceType: invoiceType === InvoiceType.FACTURA_A ? 'A' : 'B',
          });

          afipResults[order.id] = {
            invoiceType,
            invoiceNumber: afipRes.invoiceNumber,
            cae: afipRes.cae,
            caeDueDate: afipRes.caeDueDate ? new Date(afipRes.caeDueDate) : null
          };
        } catch (err: any) {
          res.status(400).json({
            status: 'error',
            message: `Error emitiendo factura AFIP para pedido #${order.id}: ${err.message}`
          });
          return;
        }
      }
    }

    // Procesar liquidación en una transacción de base de datos
    await prisma.$transaction(async (tx) => {
      // 2. Iterar sobre las órdenes
      for (const order of route.orders) {
        const set = settlements.find((s: any) => s.orderId === order.id);
        if (!set) continue;

        const totalAmount = Number(order.totalAmount);

        // Si está en PREPARED (no facturado aún), primero lo facturamos
        if (order.status === OrderStatus.PREPARED) {
          let finalInvoiceType: InvoiceType = InvoiceType.PRESUPUESTO;
          let finalInvoiceNumber = `INT-${order.id.toString().padStart(5, '0')}`;
          let finalCae = null;
          let finalCaeDueDate = null;

          if (order.billingType === BillingType.OFFICIAL) {
            const afipInfo = afipResults[order.id];
            if (!afipInfo) {
              throw new Error(`Falta información de AFIP para pedido #${order.id}`);
            }
            finalInvoiceType = afipInfo.invoiceType;
            finalInvoiceNumber = afipInfo.invoiceNumber;
            finalCae = afipInfo.cae;
            finalCaeDueDate = afipInfo.caeDueDate;
          }
          
          // Actualizar pedido a DELIVERED
          await tx.order.update({
            where: { id: order.id },
            data: {
              status: OrderStatus.DELIVERED,
              invoiceType: finalInvoiceType,
              invoiceNumber: finalInvoiceNumber,
              cae: finalCae,
              caeDueDate: finalCaeDueDate ? new Date(finalCaeDueDate) : null,
            }
          });

          // Incrementamos Cuenta Corriente del cliente mediante asiento auditable en AccountLedger
          await recordLedgerMovement(tx, {
            personaId: order.personaId,
            entryType: LedgerEntryType.DEBIT,
            sourceType: LedgerSourceType.ORDER_INVOICE,
            billingType: order.billingType,
            amount: totalAmount,
            orderId: order.id,
            userId,
            reference: `Pedido #${order.id}`,
            description: `Factura ${order.invoiceNumber || 'INT-' + order.id.toString().padStart(5, '0')} (Reparto Ruta #${route.id})`,
          });
        }

        // Registrar los cobros si no es crédito
        if (set.paymentMethod && set.paymentMethod !== 'CREDITO') {
          // Determinar Caja Operativa (para CASH)
          let cashDrawerId: number | null = null;
          let bankAccountId: number | null = null;
          let txDescription = `Rendición Reparto - Chofer: ${route.driverName} - Ruta #${route.id} - Pago de ${order.persona.name}`;

          if (set.paymentMethod === 'CASH') {
            // Buscar si existe un usuario registrado cuyo nombre de usuario coincida con el chofer de la ruta
            const driverUser = await tx.user.findFirst({
              where: {
                username: {
                  equals: route.driverName.trim(),
                  mode: 'insensitive'
                }
              }
            });

            let driverDrawer = null;
            if (driverUser) {
              driverDrawer = await tx.cashDrawer.findFirst({
                where: {
                  userId: driverUser.id,
                  status: 'OPEN'
                }
              });
            }

            if (driverDrawer) {
              cashDrawerId = driverDrawer.id;
            } else {
              // Fallback al cajero/administrador que liquida el viaje
              const activeDrawer = await tx.cashDrawer.findFirst({
                where: {
                  userId: userId,
                  status: 'OPEN'
                }
              });
              if (activeDrawer) {
                cashDrawerId = activeDrawer.id;
              }
            }
          } else if (set.paymentMethod === 'BANK_TRANSFER') {
            bankAccountId = set.bankAccountId || (await tx.bankAccount.findFirst())?.id || null;
            // No incrementamos el balance de cuenta bancaria aquí. Se incrementará en verifyRendicion cuando sea verificado por administración.
          } else if (set.paymentMethod === 'CHECK') {
            const defaultBank = await tx.bankAccount.findFirst();
            if (defaultBank) {
              bankAccountId = defaultBank.id;
            }
            // No incrementamos el balance de cuenta bancaria aquí. Se incrementará en verifyRendicion cuando sea verificado por administración.
            txDescription = `Rendición Reparto - Cheque N° ${set.checkNumber || 'S/N'} (Emisor: ${set.checkIssuer || 'Desconocido'}) - Chofer: ${route.driverName} - Ruta #${route.id}`;
          }

          // Crear transacción financiera (verified: false, pendiente de rendición) y acreditar cobro en AccountLedger
          const createdRouteTx = await tx.transaction.create({
            data: {
              orderId: order.id,
              personaId: order.personaId,
              userId: userId,
              billingType: order.billingType,
              type: TransactionType.INCOME,
              paymentMethod: set.paymentMethod as PaymentMethod,
              amount: totalAmount,
              description: txDescription,
              cashDrawerId,
              bankAccountId
            }
          });

          const routeReceiptNumber = `REC-${createdRouteTx.movementId.toString().padStart(5, '0')}`;
          await tx.transaction.update({
            where: { id: createdRouteTx.id },
            data: { receiptNumber: routeReceiptNumber }
          });

          await recordLedgerMovement(tx, {
            personaId: order.personaId,
            entryType: LedgerEntryType.CREDIT,
            sourceType: LedgerSourceType.COLLECTION_RECEIPT,
            billingType: order.billingType,
            amount: totalAmount,
            orderId: order.id,
            transactionId: createdRouteTx.id,
            userId,
            reference: `Recibo #${createdRouteTx.id}`,
            description: `Recibo N° ${routeReceiptNumber} - ${txDescription}`,
          });
        }
      }

      // 2. Marcar la Hoja de Ruta como COMPLETADA
      await tx.deliveryRoute.update({
        where: { id: routeId },
        data: { status: 'COMPLETED' }
      });
    });

    // Auditoría
    await logAudit({
      userId,
      action: 'SETTLE_DELIVERY_ROUTE',
      entityType: 'DeliveryRoute',
      entityId: routeId,
      newValues: {
        status: 'COMPLETED',
        cashDeclared,
        checksDeclared,
        transfersDeclared
      }
    });

    res.status(200).json({
      status: 'success',
      message: 'Hoja de ruta liquidada y completada con éxito.'
    });
  } catch (error: any) {
    console.error('Error al liquidar hoja de ruta:', error);
    res.status(500).json({ status: 'error', message: error.message || 'Error al liquidar la hoja de ruta.' });
  }
}

/**
 * Eliminar una hoja de ruta de reparto pendiente
 */
export async function deleteDeliveryRoute(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;

  try {
    const routeId = Number(id);

    // 1. Verificar si la hoja de ruta existe y su estado
    const route = await prisma.deliveryRoute.findUnique({
      where: { id: routeId },
      include: { orders: true }
    });

    if (!route) {
      res.status(404).json({
        status: 'error',
        message: 'Hoja de ruta no encontrada.',
      });
      return;
    }

    if (route.status !== 'PENDING') {
      res.status(400).json({
        status: 'error',
        message: 'Solo se pueden eliminar hojas de ruta en estado Pendiente.',
      });
      return;
    }

    // 2. Realizar la eliminación dentro de una transacción
    await prisma.$transaction(async (tx) => {
      // Disociar todos los pedidos de la hoja de ruta
      if (route.orders.length > 0) {
        await tx.order.updateMany({
          where: { deliveryRouteId: routeId },
          data: { deliveryRouteId: null }
        });
      }

      // Eliminar la hoja de ruta
      await tx.deliveryRoute.delete({
        where: { id: routeId }
      });
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'DELETE_DELIVERY_ROUTE',
        entityType: 'DeliveryRoute',
        entityId: routeId,
        oldValues: route,
      });
    }

    res.status(200).json({
      status: 'success',
      message: 'Hoja de ruta eliminada exitosamente y pedidos liberados.',
    });
  } catch (error: any) {
    console.error('Error al eliminar hoja de ruta:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al eliminar la hoja de ruta de reparto.',
    });
  }
}

/**
 * Obtener listado de choferes y vehículos únicos en el sistema
 */
export async function getLogisticsResources(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    // Helper to format usernames nicely
    const capitalizeUsername = (username: string): string => {
      const parts = username.replace(/[_-]/g, ' ').split(' ');
      return parts
        .map(p => p.charAt(0).toUpperCase() + p.slice(1).toLowerCase())
        .join(' ');
    };

    // 1. Obtener todos los usuarios activos excepto cuentas de sistema/oficina
    const activeUsers = await prisma.user.findMany({
      where: {
        isActive: true,
        NOT: {
          username: {
            in: ['admin', 'OFICINA', 'oficina']
          }
        }
      },
      select: {
        username: true
      }
    });

    // 2. Obtener choferes y vehículos de Hojas de Ruta pasadas
    const pastRoutes = await prisma.deliveryRoute.findMany({
      select: {
        driverName: true,
        vehiclePlate: true,
        vehicleDescription: true
      }
    });

    // Choferes habilitados en la empresa (únicos autorizados para reparto)
    const drivers = ['Agustin', 'Fabian', 'Matias', 'Miguel', 'Norberto'];

    // Consolidar vehículos únicos (por patente)
    const vehicleMap = new Map<string, string>();
    
    // Carga de vehículos de reparto preconfigurados
    const defaultVehicles = [
      { plate: 'AB 919 WO', description: 'MERCEDES ACCELO 1016' },
      { plate: 'AE 178 EC', description: 'MERCEDES ACCELO 815' },
      { plate: 'FUL 385', description: 'MERCEDES 710' },
      { plate: 'AI 148 CP', description: 'KYC MAMUT' },
      { plate: 'AG 422 GS', description: 'PEUGEOT PARTNER BLANCA' },
      { plate: 'AE 764 FE', description: 'PEUGEOT PARTNER' }
    ];
    defaultVehicles.forEach(v => {
      vehicleMap.set(v.plate.toUpperCase(), v.description);
    });

    pastRoutes.forEach(r => {
      if (r.vehiclePlate) {
        const plate = r.vehiclePlate.trim().toUpperCase();
        if (!vehicleMap.has(plate)) {
          vehicleMap.set(plate, r.vehicleDescription?.trim() || '');
        }
      }
    });
    
    const vehicles = Array.from(vehicleMap.entries()).map(([plate, desc]) => ({
      plate,
      description: desc
    })).sort((a, b) => a.plate.localeCompare(b.plate));

    res.status(200).json({
      status: 'success',
      data: { drivers, vehicles }
    });
  } catch (error: any) {
    console.error('Error al obtener recursos de logística:', error);
  }
}

/**
 * Transferir Custodia de Carga al Chofer (Conformidad y Cierre de Carga)
 */
export async function transferRouteCustody(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { driverNotes } = req.body;
  const userId = req.user?.id;

  try {
    const routeId = Number(id);
    const route = await prisma.deliveryRoute.findUnique({
      where: { id: routeId },
      include: { orders: true }
    });

    if (!route) {
      res.status(404).json({ status: 'error', message: 'Hoja de ruta no encontrada.' });
      return;
    }

    const totalBultos = route.orders.reduce((sum, o) => sum + Math.max(1, Number(o.bultosCount || 1)), 0);

    const updatedRoute = await prisma.deliveryRoute.update({
      where: { id: routeId },
      data: {
        custodyStatus: 'LOADED_IN_TRANSIT',
        status: 'IN_TRANSIT',
        totalBultos,
        signedByDriverAt: new Date(),
        driverNotes: driverNotes ? String(driverNotes).trim() : null
      }
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'TRANSFER_ROUTE_CUSTODY',
        entityType: 'DeliveryRoute',
        entityId: routeId,
        newValues: updatedRoute
      });
    }

    res.status(200).json({
      status: 'success',
      data: { route: updatedRoute }
    });
  } catch (error: any) {
    console.error('Error al transferir custodia de ruta:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al transferir la custodia de la ruta.'
    });
  }
}

/**
 * Registrar punto de GPS en tiempo real para una hoja de ruta activa
 */
export async function recordRouteGpsPing(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { latitude, longitude, speed, heading } = req.body;

  try {
    const routeId = Number(id);
    if (isNaN(routeId)) {
      res.status(400).json({ status: 'error', message: 'ID de ruta inválido.' });
      return;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (isNaN(lat) || isNaN(lng) || lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      res.status(400).json({ status: 'error', message: 'Coordenadas GPS inválidas.' });
      return;
    }

    const spd = speed !== undefined && speed !== null ? Number(speed) : null;
    const hdg = heading !== undefined && heading !== null ? Number(heading) : null;

    const route = await prisma.deliveryRoute.findUnique({
      where: { id: routeId }
    });

    if (!route) {
      res.status(404).json({ status: 'error', message: 'Hoja de ruta no encontrada.' });
      return;
    }

    const now = new Date();

    // Actualizar última posición en DeliveryRoute
    const updatedRoute = await prisma.deliveryRoute.update({
      where: { id: routeId },
      data: {
        currentLat: lat,
        currentLng: lng,
        currentSpeed: spd,
        lastGpsUpdate: now
      }
    });

    // Guardar ping en el historial de traza
    const ping = await prisma.routeGpsPing.create({
      data: {
        deliveryRouteId: routeId,
        latitude: lat,
        longitude: lng,
        speed: spd,
        heading: hdg,
        createdAt: now
      }
    });

    res.status(200).json({
      status: 'success',
      data: {
        routeId: updatedRoute.id,
        currentLat: updatedRoute.currentLat,
        currentLng: updatedRoute.currentLng,
        lastGpsUpdate: updatedRoute.lastGpsUpdate,
        pingId: ping.id
      }
    });
  } catch (error: any) {
    console.error('Error al registrar ping GPS de ruta:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error interno al registrar telemetría GPS.'
    });
  }
}

/**
 * Obtener historial de traza GPS y última ubicación de una hoja de ruta
 */
export async function getRouteGpsHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;

  try {
    const routeId = Number(id);
    if (isNaN(routeId)) {
      res.status(400).json({ status: 'error', message: 'ID de ruta inválido.' });
      return;
    }

    const route = await prisma.deliveryRoute.findUnique({
      where: { id: routeId },
      select: {
        id: true,
        driverName: true,
        vehiclePlate: true,
        status: true,
        custodyStatus: true,
        currentLat: true,
        currentLng: true,
        currentSpeed: true,
        lastGpsUpdate: true
      }
    });

    if (!route) {
      res.status(404).json({ status: 'error', message: 'Hoja de ruta no encontrada.' });
      return;
    }

    const pings = await prisma.routeGpsPing.findMany({
      where: { deliveryRouteId: routeId },
      orderBy: { createdAt: 'asc' },
      take: 1000
    });

    res.status(200).json({
      status: 'success',
      data: {
        route,
        pings
      }
    });
  } catch (error: any) {
    console.error('Error al obtener historial GPS de ruta:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al obtener historial GPS.'
    });
  }
}


