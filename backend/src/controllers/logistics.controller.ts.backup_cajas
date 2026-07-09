import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';
import { BillingType, InvoiceType, OrderStatus, TransactionType, PaymentMethod } from '@prisma/client';
import { emitirFacturaAFIP } from '../services/afip.service';

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

    // Procesar liquidación en una transacción de base de datos
    await prisma.$transaction(async (tx) => {
      // 1. Iterar sobre las órdenes
      for (const order of route.orders) {
        const set = settlements.find((s: any) => s.orderId === order.id);
        if (!set) continue;

        const totalAmount = Number(order.totalAmount);

        // Si está en PREPARED (no facturado aún), primero lo facturamos
        if (order.status === OrderStatus.PREPARED) {
          let finalInvoiceType: InvoiceType = InvoiceType.PRESUPUESTO;
          let finalInvoiceNumber = `INT-${order.id.toString().padStart(8, '0')}`;
          let finalCae = null;
          let finalCaeDueDate = null;

          if (order.billingType === BillingType.OFFICIAL) {
            // Llamar a AFIP o al Mock
            try {
              const persona = await tx.persona.findUnique({ where: { id: order.personaId } });
              const invoiceType = (persona?.cuit && persona.cuit.length > 5) ? InvoiceType.FACTURA_A : InvoiceType.FACTURA_B;
              
              const afipRes = await emitirFacturaAFIP({
                total: Number(order.totalAmount),
                clientDocType: invoiceType === InvoiceType.FACTURA_A ? 80 : 99,
                clientCuit: invoiceType === InvoiceType.FACTURA_A ? (persona?.cuit?.replace(/\D/g, '') || '0') : '0',
                invoiceType: invoiceType === InvoiceType.FACTURA_A ? 'A' : 'B',
              });

              finalInvoiceType = invoiceType;
              finalInvoiceNumber = afipRes.invoiceNumber;
              finalCae = afipRes.cae;
              finalCaeDueDate = afipRes.caeDueDate;
            } catch (err: any) {
              throw new Error(`Error emitiendo factura AFIP para pedido #${order.id}: ${err.message}`);
            }
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

          // Si es cobro diferido (CREDITO), incrementamos Cuenta Corriente
          if (set.paymentMethod === 'CREDITO') {
            await tx.persona.update({
              where: { id: order.personaId },
              data: { outstandingBalance: { increment: totalAmount } }
            });
          }
        }

        // Registrar los cobros si no es crédito
        if (set.paymentMethod && set.paymentMethod !== 'CREDITO') {
          // Si el pedido ya estaba en DELIVERED, significa que ya se le había cargado la deuda en Cuenta Corriente
          // Por ende, registrar el cobro reduce la deuda (outstandingBalance).
          if (order.status === OrderStatus.DELIVERED) {
            await tx.persona.update({
              where: { id: order.personaId },
              data: { outstandingBalance: { decrement: totalAmount } }
            });
          }

          // Determinar Caja Operativa (para CASH)
          let cashDrawerId: number | null = null;
          let bankAccountId: number | null = null;
          let txDescription = `Rendición Reparto - Chofer: ${route.driverName} - Ruta #${route.id} - Pago de ${order.persona.name}`;

          if (set.paymentMethod === 'CASH') {
            const activeDrawer = await tx.cashDrawer.findFirst({
              where: {
                userId: userId,
                status: 'OPEN'
              }
            });
            if (activeDrawer) {
              cashDrawerId = activeDrawer.id;
            }
          } else if (set.paymentMethod === 'BANK_TRANSFER') {
            bankAccountId = set.bankAccountId || (await tx.bankAccount.findFirst())?.id || null;
            if (bankAccountId) {
              await tx.bankAccount.update({
                where: { id: bankAccountId },
                data: { balance: { increment: totalAmount } }
              });
            }
          } else if (set.paymentMethod === 'CHECK') {
            const defaultBank = await tx.bankAccount.findFirst();
            if (defaultBank) {
              bankAccountId = defaultBank.id;
              await tx.bankAccount.update({
                where: { id: defaultBank.id },
                data: { balance: { increment: Number(set.checkAmount || totalAmount) } }
              });
            }
            txDescription = `Rendición Reparto - Cheque N° ${set.checkNumber || 'S/N'} (Emisor: ${set.checkIssuer || 'Desconocido'}) - Chofer: ${route.driverName} - Ruta #${route.id}`;
          }

          // Crear transacción financiera
          await tx.transaction.create({
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
