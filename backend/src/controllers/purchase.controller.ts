import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';

/**
 * Obtener órdenes de compra
 */
export async function getPurchaseOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { startDate, endDate, status } = req.query;

  try {
    const whereClause: any = {};

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(String(startDate)),
        lte: new Date(String(endDate)),
      };
    }

    if (status) {
      whereClause.status = String(status);
    }

    const orders = await prisma.purchaseOrder.findMany({
      where: whereClause,
      include: {
        persona: true,
        items: {
          include: {
            product: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: { orders },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las órdenes de compra.',
    });
  }
}

/**
 * Crear una nueva orden de compra
 */
export async function createPurchaseOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { personaId, items } = req.body;
  const userId = req.user?.id;

  if (!personaId || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({
      status: 'error',
      message: 'Proveedor y al menos un artículo son requeridos.',
    });
    return;
  }

  try {
    const order = await prisma.$transaction(async (tx) => {
      let totalSum = 0;
      
      // Validar ítems y calcular total
      const parsedItems = items.map((item: any) => {
        const subtotal = Number(item.quantity) * Number(item.costPrice);
        totalSum += subtotal;
        return {
          productId: Number(item.productId),
          productIdRef: Number(item.productId),
          quantity: Number(item.quantity),
          costPrice: Number(item.costPrice),
          subtotal: Number(subtotal.toFixed(2)),
        };
      });

      // Crear la orden de compra
      const newOrder = await tx.purchaseOrder.create({
        data: {
          personaId: Number(personaId),
          status: 'PENDING',
          totalAmount: Number(totalSum.toFixed(2)),
          items: {
            create: parsedItems,
          },
        },
        include: {
          items: true,
        },
      });

      return newOrder;
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'CREATE_PURCHASE_ORDER',
        entityType: 'PurchaseOrder',
        entityId: order.id,
        newValues: order,
      });
    }

    res.status(201).json({
      status: 'success',
      data: { order },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al registrar la orden de compra.',
    });
  }
}

/**
 * Recibir mercadería de una orden de compra
 */
export async function receivePurchaseOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { invoiceNumber, lotAssignments } = req.body; // lotAssignments: { productId: { lotNumber, expirationDate } }
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado' });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Obtener la orden de compra
      const order = await tx.purchaseOrder.findUnique({
        where: { id: Number(id) },
        include: { items: true },
      });

      if (!order) throw new Error('Orden de compra no encontrada.');
      if (order.status !== 'PENDING') throw new Error('Esta orden de compra ya fue procesada o cancelada.');

      // 2. Marcar como RECEIVED
      const updatedOrder = await tx.purchaseOrder.update({
        where: { id: order.id },
        data: { status: 'RECEIVED' },
      });

      // 3. Procesar cada artículo
      for (const item of order.items) {
        const qty = Number(item.quantity);
        const cost = Number(item.costPrice);

        // a. Actualizar stock y costo del producto
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (product) {
          await tx.product.update({
            where: { id: product.id },
            data: {
              stock: { increment: qty },
              costPrice: cost, // Actualización automática del precio costo
            },
          });
        }

        // b. Manejar asignación a lote
        let createdLotId: number | null = null;
        const assignment = lotAssignments ? lotAssignments[item.productId] : null;

        if (assignment && assignment.lotNumber && assignment.expirationDate) {
          // Buscar si el lote existe para el producto
          let lot = await tx.productLot.findUnique({
            where: {
              productId_lotNumber: {
                productId: item.productId,
                lotNumber: String(assignment.lotNumber),
              },
            },
          });

          if (lot) {
            lot = await tx.productLot.update({
              where: { id: lot.id },
              data: {
                stock: { increment: qty },
              },
            });
          } else {
            lot = await tx.productLot.create({
              data: {
                productId: item.productId,
                lotNumber: String(assignment.lotNumber),
                expirationDate: new Date(assignment.expirationDate),
                stock: qty,
              },
            });
          }
          createdLotId = lot.id;
        }

        // c. Registrar movimiento de stock
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            quantity: qty,
            type: 'IN',
            referenceId: `PO-${order.id}`,
            userId,
            reason: 'Recepción de Orden de Compra',
            productLotId: createdLotId,
          },
        });
      }

      // 4. Auto-generar SupplierInvoice y actualizar cuenta corriente
      const neto = Number(order.totalAmount);
      const iva = Number((neto * 0.21).toFixed(2));
      const total = Number((neto + iva).toFixed(2));
      const nroInvoice = invoiceNumber || `COMP-${order.id.toString().padStart(8, '0')}`;

      // Crear factura de proveedor
      await tx.supplierInvoice.create({
        data: {
          personaId: order.personaId,
          invoiceNumber: nroInvoice,
          invoiceType: 'FACTURA_A',
          issueDate: new Date(),
          netAmount: neto,
          taxAmount: iva,
          percepcionAmount: 0.00,
          totalAmount: total,
        },
      });

      // Actualizar cuenta corriente del proveedor (decrementando saldo deudor, aumenta lo que le debemos)
      await tx.persona.update({
        where: { id: order.personaId },
        data: {
          outstandingBalance: {
            decrement: total,
          },
        },
      });

      return updatedOrder;
    });

    if (userId) {
      await logAudit({
        userId,
        action: 'RECEIVE_PURCHASE_ORDER',
        entityType: 'PurchaseOrder',
        entityId: result.id,
        newValues: result,
      });
    }

    res.status(200).json({
      status: 'success',
      data: { order: result },
    });
  } catch (error: any) {
    console.error('Error al recibir orden de compra:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al procesar la recepción de la orden de compra.',
    });
  }
}
