import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { Role, BillingType, InvoiceType, OrderStatus, MovementType, TransactionType, PaymentMethod } from '@prisma/client';
import { emitirFacturaAFIP } from '../services/afip.service';
import { logAudit } from '../utils/audit';
import { OrderService } from '../services/order.service';

/**
 * Obtener listado de pedidos.
 * - ADMIN / DEPOSITO: Ven todos los pedidos.
 * - VENDEDOR: Solo ve los pedidos que él mismo cargó.
 */
export async function getOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const { billingType, status } = req.query;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const whereClause: any = {};

    if (userRole === Role.VENDEDOR) {
      whereClause.sellerId = userId;
    }

    if (billingType) {
      whereClause.billingType = billingType as BillingType;
    }

    if (status) {
      whereClause.status = status as OrderStatus;
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        persona: {
          select: { id: true, name: true, cuit: true },
        },
        seller: {
          select: { id: true, username: true },
        },
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true } },
            orderItemLots: {
              include: {
                productLot: true,
              },
            },
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
      message: 'Error al obtener pedidos.',
    });
  }
}

/**
 * Obtener detalles de un pedido específico.
 */
export async function getOrderById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(id) },
      include: {
        persona: true,
        seller: { select: { id: true, username: true } },
        items: {
          include: {
            product: true,
            orderItemLots: {
              include: {
                productLot: true,
              },
            },
          },
        },
        transactions: true,
      },
    });

    if (!order) {
      res.status(404).json({ status: 'error', message: 'Pedido no encontrado.' });
      return;
    }

    if (userRole === Role.VENDEDOR && order.sellerId !== userId) {
      res.status(403).json({
        status: 'error',
        message: 'Acceso denegado. No podés ver pedidos de otros vendedores.',
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: { order },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener el pedido.',
    });
  }
}

interface CreateOrderRequest {
  personaId: number;
  items: {
    productId: number;
    quantity: number;
    weight?: number;
  }[];
}

/**
 * Crear un pedido en la calle (Vendedor).
 * Se crea en estado PENDING, descontando stock preventivamente.
 */
export async function createOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const sellerId = req.user?.id;
  const userRole = req.user?.role;
  const { personaId, items }: CreateOrderRequest = req.body;

  if (!sellerId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const result = await OrderService.createOrder({
      sellerId,
      userRole,
      personaId,
      items,
    });

    // Auditoría
    await logAudit({
      userId: sellerId,
      action: 'CREATE_ORDER',
      entityType: 'Order',
      entityId: result.id,
      newValues: {
        personaId: result.personaId,
        total: result.totalAmount,
        status: result.status,
      },
    });

    res.status(201).json({
      status: 'success',
      data: { order: result },
    });
  } catch (error: any) {
    console.error('Error creando pedido:', error.message);
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al procesar el pedido.',
    });
  }
}

/**
 * Actualizar pesos de productos pesables (Depósito / Facturación).
 */
export async function updateOrderWeights(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { items } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  if (userRole !== Role.ADMIN && userRole !== Role.FACTURACION && userRole !== Role.DEPOSITO) {
    res.status(403).json({ status: 'error', message: 'Permisos insuficientes para actualizar pesos.' });
    return;
  }

  try {
    const updatedOrder = await OrderService.updateOrderWeights(Number(id), items);

    await logAudit({
      userId,
      action: 'UPDATE_ORDER_WEIGHTS',
      entityType: 'Order',
      entityId: updatedOrder.id,
      newValues: { totalAmount: updatedOrder.totalAmount },
    });

    res.status(200).json({
      status: 'success',
      data: { order: updatedOrder },
      message: 'Pesos actualizados con éxito.',
    });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al actualizar los pesos.',
    });
  }
}

/**
 * Cambiar el estado de un pedido en logística (Depósito / Admin).
 */
export async function updateOrderStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, lotAssignments } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  if (!status || !Object.values(OrderStatus).includes(status)) {
    res.status(400).json({ status: 'error', message: 'Estado inválido.' });
    return;
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(id) },
    });

    if (!order) {
      res.status(404).json({ status: 'error', message: 'Pedido no encontrado.' });
      return;
    }

    // Depósito solo puede pasar a PREPARING o PREPARED. No puede cancelar ni marcar como DELIVERED.
    if (userRole === Role.DEPOSITO) {
      if (status !== OrderStatus.PREPARING && status !== OrderStatus.PREPARED) {
        res.status(403).json({
          status: 'error',
          message: 'Depósito solo puede pasar pedidos a "Preparando" o "Armado listo para facturar".',
        });
        return;
      }
    }

    // Si se cancela un pedido, debemos reponer el stock reservado
    const updated = await prisma.$transaction(async (tx) => {
      // 1. Si pasa a PREPARED, validar y procesar lotes
      if (status === OrderStatus.PREPARED) {
        if (!lotAssignments) {
          throw new Error('Las asignaciones de lote son requeridas para marcar el pedido como Armado.');
        }

        const items = await tx.orderItem.findMany({
          where: { orderId: order.id },
          include: { product: true }
        });

        for (const item of items) {
          const assignments = lotAssignments[item.id] || [];
          const totalAssigned = assignments.reduce((sum: number, a: any) => sum + Number(a.quantity), 0);

          if (totalAssigned !== item.quantity) {
            throw new Error(`Asignación incompleta para "${item.product.name}". Cantidad pedida: ${item.quantity}, Asignada: ${totalAssigned}.`);
          }

          for (const assignment of assignments) {
            const { lotId, quantity } = assignment;
            const q = Number(quantity);
            if (q <= 0) continue;

            const lot = await tx.productLot.findUnique({
              where: { id: Number(lotId) },
            });

            if (!lot || lot.productId !== item.productId) {
              throw new Error(`El lote especificado no pertenece al producto "${item.product.name}".`);
            }

            if (lot.stock < q && process.env.IGNORE_STOCK_CHECK !== 'true') {
              throw new Error(`Stock insuficiente en el lote "${lot.lotNumber}" para "${item.product.name}" (Disponible: ${lot.stock}, Solicitado: ${q}).`);
            }

            // Decrementar stock del lote
            await tx.productLot.update({
              where: { id: lot.id },
              data: { stock: { decrement: q } },
            });

            // Crear registro de OrderItemLot
            await tx.orderItemLot.create({
              data: {
                orderItemId: item.id,
                productLotId: lot.id,
                quantity: q,
              },
            });
          }
        }
      }

      const uOrder = await tx.order.update({
        where: { id: order.id },
        data: { status: status as OrderStatus },
      });

      if (status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
        // Obtener ítems del pedido para devolver stock
        const items = await tx.orderItem.findMany({
          where: { orderId: order.id },
          include: { orderItemLots: true }
        });

        for (const item of items) {
          const prod = await tx.product.findUnique({ where: { id: item.productId } });
          if (prod) {
            await tx.product.update({
              where: { id: prod.id },
              data: { stock: prod.stock + item.quantity },
            });

            await tx.stockMovement.create({
              data: {
                productId: prod.id,
                quantity: item.quantity,
                type: MovementType.IN,
                referenceId: `CANCEL-${order.id}`,
                userId: userId,
                reason: `Devolución por cancelación de pedido #${order.id}`,
              },
            });
          }

          // Si el pedido estaba PREPARED o DELIVERED, también tenía lotes asignados. Los devolvemos.
          if (order.status === OrderStatus.PREPARED || order.status === OrderStatus.DELIVERED) {
            for (const itemLot of item.orderItemLots) {
              await tx.productLot.update({
                where: { id: itemLot.productLotId },
                data: { stock: { increment: itemLot.quantity } }
              });
            }

            // Eliminar asignaciones de lote ya que el picking se cancela
            await tx.orderItemLot.deleteMany({
              where: { orderItemId: item.id }
            });
          }
        }

        // Si el pedido estaba entregado (DELIVERED), revertir su saldo en la cuenta corriente
        if (order.status === OrderStatus.DELIVERED) {
          const payment = await tx.transaction.findFirst({
            where: { orderId: order.id, type: TransactionType.INCOME }
          });
          
          if (!payment) {
            await tx.persona.update({
              where: { id: order.personaId },
              data: {
                outstandingBalance: {
                  decrement: Number(order.totalAmount)
                }
              }
            });
          }
        }
      }

      return uOrder;
    });

    // Auditoría
    await logAudit({
      userId,
      action: 'UPDATE_ORDER_STATUS',
      entityType: 'Order',
      entityId: order.id,
      oldValues: { status: order.status },
      newValues: { status: updated.status },
    });

    res.status(200).json({
      status: 'success',
      data: { order: updated },
    });
  } catch (error: any) {
    res.status(500).json({
      status: 'error',
      message: 'Error al actualizar el estado del pedido.',
    });
  }
}

interface InvoiceOrderRequest {
  billingType: BillingType;
  paymentMethod?: 'CASH' | 'BANK_TRANSFER' | 'CHECK' | 'OTHER';
  paymentDescription?: string;
}

/**
 * Facturar y cobrar un pedido armado (Admin y Facturación).
 * Realiza la comunicación con AFIP si es Oficial y asienta el cobro.
 */
export async function invoiceOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { billingType, paymentMethod, paymentDescription }: InvoiceOrderRequest = req.body;
  const adminId = req.user?.id;
  const userRole = req.user?.role;

  if (!adminId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  if (userRole !== Role.ADMIN && userRole !== Role.FACTURACION) {
    res.status(403).json({
      status: 'error',
      message: 'Acceso denegado. Permisos de facturación insuficientes.',
    });
    return;
  }

  if (!billingType) {
    res.status(400).json({ status: 'error', message: 'El tipo de facturación es obligatorio.' });
    return;
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(id) },
      include: {
        persona: true,
        items: true,
      },
    });

    if (!order) {
      res.status(404).json({ status: 'error', message: 'Pedido no encontrado.' });
      return;
    }

    if (order.status !== OrderStatus.PREPARED) {
      res.status(400).json({
        status: 'error',
        message: `No se puede facturar. El pedido debe estar armado por depósito primero (Estado actual: ${order.status}).`,
      });
      return;
    }

    const totalSum = Number(order.totalAmount);

    // Validar regla de "boleta contra boleta" (deben una y deben pagar la proxima)
    const outstandingBalance = Number(order.persona.outstandingBalance || 0);
    if (!paymentMethod && outstandingBalance > 0) {
      if (userRole !== Role.ADMIN) {
        res.status(400).json({
          status: 'error',
          message: `Regla Boleta contra Boleta: El cliente posee una boleta pendiente ($${outstandingBalance.toLocaleString()}). Debe registrar su cobro para poder facturar este pedido a crédito.`,
        });
        return;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      let finalInvoiceType: InvoiceType = InvoiceType.PRESUPUESTO;
      let finalInvoiceNumber: string | null = null;
      let finalCae: string | null = null;
      let finalCaeDueDate: Date | null = null;

      if (billingType === BillingType.OFFICIAL) {
        // Reglas de CUIT/DocType para AFIP
        const cuitLimpio = order.persona.cuit ? order.persona.cuit.replace(/-/g, '') : '';
        let docType = 99; // Consumidor Final

        if (cuitLimpio.length === 11) {
          docType = 80;
          finalInvoiceType = InvoiceType.FACTURA_A;
        } else if (cuitLimpio.length === 7 || cuitLimpio.length === 8) {
          docType = 96;
          finalInvoiceType = InvoiceType.FACTURA_B;
        } else {
          finalInvoiceType = InvoiceType.FACTURA_B;
        }

        // Llamar a AFIP
        const afipRes = await emitirFacturaAFIP({
          clientCuit: cuitLimpio,
          clientDocType: docType,
          invoiceType: finalInvoiceType === InvoiceType.FACTURA_A ? 'A' : 'B',
          total: totalSum,
        });

        finalInvoiceNumber = afipRes.invoiceNumber;
        finalCae = afipRes.cae;
        finalCaeDueDate = afipRes.caeDueDate;
      } else {
        // Facturación Interna
        finalInvoiceType = InvoiceType.PRESUPUESTO;
        finalInvoiceNumber = `INT-${order.id.toString().padStart(8, '0')}`;
      }

      // Calcular desglose impositivo
      let net = totalSum / 1.21;
      let tax = totalSum - net;
      let percepcion = 0;

      if (billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A) {
        const iibbAliquot = Number(order.persona.iibbAliquot || 0);
        if (iibbAliquot > 0) {
          net = totalSum / (1.21 + (iibbAliquot / 100));
          tax = net * 0.21;
          percepcion = net * (iibbAliquot / 100);
        }
      }

      // Actualizar pedido a DELIVERED (Facturado/Finalizado)
      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          billingType,
          invoiceType: finalInvoiceType,
          invoiceNumber: finalInvoiceNumber,
          cae: finalCae,
          caeDueDate: finalCaeDueDate,
          netAmount: Number(net.toFixed(2)),
          taxAmount: Number(tax.toFixed(2)),
          percepcionAmount: Number(percepcion.toFixed(2)),
          status: OrderStatus.DELIVERED,
        },
      });

      // Registrar percepción en TaxWithholding si corresponde
      if (percepcion > 0) {
        await tx.taxWithholding.create({
          data: {
            type: 'PERCEPCION_PRACTICADA',
            taxType: 'IIBB',
            personaId: order.personaId,
            number: finalInvoiceNumber || `FAC-${order.id}`,
            date: new Date(),
            amount: Number(percepcion.toFixed(2)),
            jurisdiction: order.persona.address?.includes('CABA') ? 'AR-C' : 'AR-B',
          },
        });
      }

      // Crear transacción de caja si se cobró, de lo contrario incrementar la cuenta corriente de la persona
      if (paymentMethod) {
        let cashDrawerId: number | undefined = undefined;
        let bankAccountId: number | undefined = undefined;

        if (paymentMethod === PaymentMethod.CASH) {
          const activeDrawer = await tx.cashDrawer.findFirst({
            where: {
              userId: adminId,
              status: 'OPEN',
            },
          });
          if (!activeDrawer) {
            throw new Error(`Debe abrir la Caja Grande antes de registrar cobros en efectivo.`);
          }
          cashDrawerId = activeDrawer.id;
        } else if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
          const defaultBank = await tx.bankAccount.findFirst();
          if (!defaultBank) {
            throw new Error(`No se encontró ninguna cuenta bancaria configurada en el sistema.`);
          }
          bankAccountId = defaultBank.id;

          // Incrementar saldo del banco
          await tx.bankAccount.update({
            where: { id: defaultBank.id },
            data: { balance: { increment: totalSum } },
          });
        }

        await tx.transaction.create({
          data: {
            orderId: order.id,
            personaId: order.personaId,
            userId: adminId,
            billingType,
            type: TransactionType.INCOME,
            paymentMethod,
            amount: totalSum,
            description: paymentDescription ? `Cobro en caja de pedido #${order.id} - ${paymentDescription}` : `Cobro en caja de pedido #${order.id} (${billingType === BillingType.OFFICIAL ? 'Sucursal A' : 'Sucursal X'})`,
            cashDrawerId,
            bankAccountId,
          },
        });
      } else {
        await tx.persona.update({
          where: { id: order.personaId },
          data: {
            outstandingBalance: {
              increment: totalSum
            }
          }
        });
      }

      return updatedOrder;
    });

    // Auditoría
    await logAudit({
      userId: adminId,
      action: 'INVOICE_ORDER',
      entityType: 'Order',
      entityId: order.id,
      newValues: {
        billingType,
        invoiceNumber: result.invoiceNumber,
        cae: result.cae,
        total: result.totalAmount,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { order: result },
    });
  } catch (error: any) {
    console.error('Error al facturar pedido:', error.message);
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al facturar el pedido.',
    });
  }
}

/**
 * Editar un pedido PENDING (vendedor o admin).
 */
export async function updateOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { items }: CreateOrderRequest = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  if (!items || items.length === 0) {
    res.status(400).json({ status: 'error', message: 'Los items son requeridos.' });
    return;
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(id) },
      include: { items: true }
    });

    if (!order) {
      res.status(404).json({ status: 'error', message: 'Pedido no encontrado.' });
      return;
    }

    if (order.status !== OrderStatus.PENDING) {
      res.status(400).json({ status: 'error', message: 'Solo se pueden editar pedidos en estado Pendiente.' });
      return;
    }

    if (userRole === Role.VENDEDOR && order.sellerId !== userId) {
      res.status(403).json({ status: 'error', message: 'No podés editar pedidos de otros vendedores.' });
      return;
    }

    // Ejecutar transacciones: restaurar stock, validar nuevo stock, actualizar pedido
    const result = await prisma.$transaction(async (tx) => {
      // 1. Restaurar stock de los items viejos
      for (const oldItem of order.items) {
        const product = await tx.product.findUnique({ where: { id: oldItem.productId } });
        if (product) {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: product.stock + oldItem.quantity }
          });
        }
      }

      // Obtener persona
      const persona = await tx.persona.findUnique({ where: { id: order.personaId } });
      if (!persona) {
        throw new Error(`Persona no encontrada.`);
      }

      // 2. Validar y descontar nuevo stock, aplicando lista de precios y descuento
      let totalSum = 0;
      const orderItemsToCreate = [];

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new Error(`Producto ID ${item.productId} no encontrado.`);
        }

        if (product.stock < item.quantity && process.env.IGNORE_STOCK_CHECK !== 'true') {
          throw new Error(`Stock insuficiente para "${product.name}" (Disponible: ${product.stock}, Solicitado: ${item.quantity}).`);
        }

        // Determinar precio según lista con fallback
        let selectedPrice = Number(product.listPrice);
        let itemDiscount = Number(persona.discount || 0);

        if (persona.priceList === 'B') {
          const isMelincue = product.description?.toUpperCase() === 'MELINCUE' || product.name?.toUpperCase().includes('MELINCUE');
          if (isMelincue) {
            itemDiscount = 3;
          } else {
            itemDiscount = 0;
          }
        }

        // Aplicar descuento
        const finalUnitPrice = selectedPrice * (1 - itemDiscount / 100);
        const subtotal = finalUnitPrice * item.quantity;
        totalSum += subtotal;

        orderItemsToCreate.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: finalUnitPrice,
          subtotal: subtotal
        });

        // Descontar
        await tx.product.update({
          where: { id: product.id },
          data: { stock: product.stock - item.quantity }
        });
      }

      // Validar límite de crédito
      const creditLimit = Number(persona.creditLimit || 0);
      const outstandingBalance = Number(persona.outstandingBalance || 0);
      if (creditLimit > 0 && (outstandingBalance + totalSum) > creditLimit) {
        if (userRole !== Role.ADMIN) {
          throw new Error(
            `Límite de crédito excedido. Saldo actual: $${outstandingBalance.toLocaleString()}, Disponible: $${(creditLimit - outstandingBalance).toLocaleString()}, Requerido para este pedido: $${totalSum.toLocaleString()}.`
          );
        }
      }

      // Validar regla de "boleta contra boleta" (deben una y deben pagar la proxima)
      if (outstandingBalance > 0) {
        if (userRole !== Role.ADMIN) {
          throw new Error(
            `Regla Boleta contra Boleta: El cliente posee una boleta pendiente ($${outstandingBalance.toLocaleString()}). Debe registrar el pago de la boleta anterior antes de modificar el pedido a crédito.`
          );
        }
      }

      // 3. Eliminar items viejos y crear los nuevos
      await tx.orderItem.deleteMany({ where: { orderId: order.id } });

      const updatedOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          totalAmount: totalSum,
          items: {
            create: orderItemsToCreate
          }
        },
        include: {
          persona: true,
          items: { include: { product: true } }
        }
      });

      return updatedOrder;
    });

    // Auditoría
    await logAudit({
      userId,
      action: 'UPDATE_ORDER_ITEMS',
      entityType: 'Order',
      entityId: order.id,
      oldValues: { total: order.totalAmount, itemsCount: order.items.length },
      newValues: { total: result.totalAmount, itemsCount: result.items.length }
    });

    res.status(200).json({
      status: 'success',
      data: { order: result }
    });

  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al editar el pedido.'
    });
  }
}

interface CreateDirectInvoiceRequest {
  personaId: number;
  billingType: BillingType;
  paymentMethod?: PaymentMethod;
  bankAccountId?: number;
  checkNumber?: string;
  checkIssuer?: string;
  checkAmount?: number;
  items: {
    productId: number;
    quantity: number;
  }[];
}

export async function createDirectInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  const adminId = req.user?.id;
  const userRole = req.user?.role;
  const { 
    personaId, 
    billingType, 
    paymentMethod, 
    bankAccountId,
    checkNumber,
    checkIssuer,
    checkAmount,
    items 
  }: CreateDirectInvoiceRequest = req.body;

  if (!adminId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  if (userRole !== Role.ADMIN && userRole !== Role.FACTURACION) {
    res.status(403).json({
      status: 'error',
      message: 'Acceso denegado. Permisos de facturación insuficientes.',
    });
    return;
  }

  if (!personaId || !billingType || !items || items.length === 0) {
    res.status(400).json({
      status: 'error',
      message: 'Cliente, tipo de facturación e ítems son requeridos.',
    });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Obtener cliente/persona
      const persona = await tx.persona.findUnique({ where: { id: personaId } });
      if (!persona) {
        throw new Error('Cliente no encontrado.');
      }

      // 2. Procesar ítems y descontar stock general y por lotes (FIFO)
      let totalSum = 0;
      const orderItemsData = [];

      for (const item of items) {
        const product = await tx.product.findUnique({ where: { id: item.productId } });
        if (!product) {
          throw new Error(`Producto ID ${item.productId} no encontrado.`);
        }

        if (product.stock < item.quantity && process.env.IGNORE_STOCK_CHECK !== 'true') {
          throw new Error(`Stock insuficiente para "${product.name}" (Disponible: ${product.stock}, Solicitado: ${item.quantity}).`);
        }

        // Determinar precio unitario base según la lista del cliente
        let selectedPrice = Number(product.listPrice);
        let itemDiscount = Number(persona.discount || 0);

        if (persona.priceList === 'B') {
          const isMelincue = product.description?.toUpperCase() === 'MELINCUE' || product.name?.toUpperCase().includes('MELINCUE');
          if (isMelincue) {
            itemDiscount = 3;
          } else {
            itemDiscount = 0;
          }
        }

        // Aplicar descuento fijo / dinámico
        const finalUnitPrice = selectedPrice * (1 - itemDiscount / 100);
        const subtotal = finalUnitPrice * item.quantity;
        totalSum += subtotal;

        // Descontar del stock general del producto
        await tx.product.update({
          where: { id: product.id },
          data: { stock: { decrement: item.quantity } },
        });

        orderItemsData.push({
          productId: product.id,
          quantity: item.quantity,
          unitPrice: finalUnitPrice,
          subtotal,
          productName: product.name,
        });
      }

      // 3. Validar límite de crédito y boleta contra boleta
      const creditLimit = Number(persona.creditLimit || 0);
      const outstandingBalance = Number(persona.outstandingBalance || 0);
      if (creditLimit > 0 && (outstandingBalance + totalSum) > creditLimit) {
        if (userRole !== Role.ADMIN) {
          throw new Error(
            `Límite de crédito excedido. Saldo actual: $${outstandingBalance.toLocaleString()}, Disponible: $${(creditLimit - outstandingBalance).toLocaleString()}, Requerido: $${totalSum.toLocaleString()}.`
          );
        }
      }

      if (!paymentMethod && outstandingBalance > 0) {
        if (userRole !== Role.ADMIN) {
          throw new Error(
            `Regla Boleta contra Boleta: El cliente posee una boleta pendiente ($${outstandingBalance.toLocaleString()}). Debe registrar su cobro para poder facturar a crédito.`
          );
        }
      }

      // 4. Determinar datos impositivos y generar Factura AFIP o Interna
      let finalInvoiceType: InvoiceType = InvoiceType.PRESUPUESTO;
      let finalInvoiceNumber: string | null = null;
      let finalCae: string | null = null;
      let finalCaeDueDate: Date | null = null;

      let net = totalSum / 1.21;
      let tax = totalSum - net;
      let percepcion = 0;

      // Creamos el Order primero para tener un ID y poder asociarlo
      const order = await tx.order.create({
        data: {
          personaId,
          sellerId: adminId,
          status: OrderStatus.DELIVERED,
          billingType,
          totalAmount: totalSum,
          netAmount: 0,
          taxAmount: 0,
          percepcionAmount: 0,
        },
      });

      if (billingType === BillingType.OFFICIAL) {
        const cuitLimpio = persona.cuit ? persona.cuit.replace(/-/g, '') : '';
        let docType = 99;

        if (cuitLimpio.length === 11) {
          docType = 80;
          finalInvoiceType = InvoiceType.FACTURA_A;
        } else if (cuitLimpio.length === 7 || cuitLimpio.length === 8) {
          docType = 96;
          finalInvoiceType = InvoiceType.FACTURA_B;
        } else {
          finalInvoiceType = InvoiceType.FACTURA_B;
        }

        // Llamar a AFIP
        const afipRes = await emitirFacturaAFIP({
          clientCuit: cuitLimpio,
          clientDocType: docType,
          invoiceType: finalInvoiceType === InvoiceType.FACTURA_A ? 'A' : 'B',
          total: totalSum,
        });

        finalInvoiceNumber = afipRes.invoiceNumber;
        finalCae = afipRes.cae;
        finalCaeDueDate = afipRes.caeDueDate;
      } else {
        finalInvoiceType = InvoiceType.PRESUPUESTO;
        finalInvoiceNumber = `INT-${order.id.toString().padStart(8, '0')}`;
      }

      if (billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A) {
        const iibbAliquot = Number(persona.iibbAliquot || 0);
        if (iibbAliquot > 0) {
          net = totalSum / (1.21 + (iibbAliquot / 100));
          tax = net * 0.21;
          percepcion = net * (iibbAliquot / 100);
        }
      }

      // 5. Crear los OrderItems y hacer la asignación automática de lotes (FIFO)
      for (const itemData of orderItemsData) {
        const orderItem = await tx.orderItem.create({
          data: {
            orderId: order.id,
            productId: itemData.productId,
            quantity: itemData.quantity,
            unitPrice: itemData.unitPrice,
            subtotal: itemData.subtotal,
          },
        });

        // Registrar movimiento de stock general
        await tx.stockMovement.create({
          data: {
            productId: itemData.productId,
            quantity: itemData.quantity,
            type: MovementType.OUT,
            referenceId: `FAC-${order.id}`,
            userId: adminId,
            reason: `Venta directa comprobante ${finalInvoiceNumber || 'INT-' + order.id}`,
          },
        });

        // Asignación de lotes FIFO
        let remainingToAssign = itemData.quantity;
        const activeLots = await tx.productLot.findMany({
          where: { productId: itemData.productId, stock: { gt: 0 } },
          orderBy: { expirationDate: 'asc' },
        });

        for (const lot of activeLots) {
          if (remainingToAssign <= 0) break;

          const allocatedQty = Math.min(lot.stock, remainingToAssign);
          remainingToAssign -= allocatedQty;

          // Decrementar del lote
          await tx.productLot.update({
            where: { id: lot.id },
            data: { stock: { decrement: allocatedQty } },
          });

          // Crear relación OrderItemLot
          await tx.orderItemLot.create({
            data: {
              orderItemId: orderItem.id,
              productLotId: lot.id,
              quantity: allocatedQty,
            },
          });
        }

        if (remainingToAssign > 0 && process.env.IGNORE_STOCK_CHECK !== 'true') {
          throw new Error(`Inconsistencia de stock por lotes para "${itemData.productName}". Faltaron asignar ${remainingToAssign} unidades en lotes.`);
        }
      }

      // 6. Registrar percepción IIBB si corresponde
      if (percepcion > 0) {
        await tx.taxWithholding.create({
          data: {
            type: 'PERCEPCION_PRACTICADA',
            taxType: 'IIBB',
            personaId,
            number: finalInvoiceNumber || `FAC-${order.id}`,
            date: new Date(),
            amount: Number(percepcion.toFixed(2)),
            jurisdiction: persona.address?.includes('CABA') ? 'AR-C' : 'AR-B',
          },
        });
      }

      // 7. Cobro en caja (si se pagó en el acto) o registro en Cuenta Corriente
      if (paymentMethod) {
        let cashDrawerId: number | undefined = undefined;
        let bankAccountIdVal: number | undefined = undefined;
        let txAmount = totalSum;
        let txDescription = `Cobro en el acto de factura directa #${order.id} (${finalInvoiceNumber})`;

        if (paymentMethod === PaymentMethod.CASH) {
          const activeDrawer = await tx.cashDrawer.findFirst({
            where: {
              userId: adminId,
              status: 'OPEN',
            },
          });
          if (!activeDrawer) {
            throw new Error(`Debe abrir la Caja Grande antes de registrar cobros en efectivo.`);
          }
          cashDrawerId = activeDrawer.id;
        } else if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
          const selectedBankId = bankAccountId || (await tx.bankAccount.findFirst())?.id;
          if (!selectedBankId) {
            throw new Error(`No se encontró ninguna cuenta bancaria configurada en el sistema.`);
          }
          bankAccountIdVal = selectedBankId;

          // Incrementar saldo banco
          await tx.bankAccount.update({
            where: { id: selectedBankId },
            data: { balance: { increment: totalSum } },
          });
        } else if (paymentMethod === PaymentMethod.CHECK) {
          const defaultBank = await tx.bankAccount.findFirst();
          if (!defaultBank) {
            throw new Error(`No se encontró ninguna cuenta bancaria configurada en el sistema.`);
          }
          bankAccountIdVal = defaultBank.id;

          const finalCheckAmount = checkAmount !== undefined ? Number(checkAmount) : totalSum;
          txAmount = finalCheckAmount;
          txDescription = `Cobro con Cheque N° ${checkNumber || 'S/N'} (Emisor: ${checkIssuer || 'Desconocido'}) - Comprobante ${finalInvoiceNumber || 'INT-' + order.id}`;

          // Incrementar saldo banco
          await tx.bankAccount.update({
            where: { id: defaultBank.id },
            data: { balance: { increment: finalCheckAmount } },
          });
        }

        await tx.transaction.create({
          data: {
            orderId: order.id,
            personaId,
            userId: adminId,
            billingType,
            type: TransactionType.INCOME,
            paymentMethod,
            amount: txAmount,
            description: txDescription,
            cashDrawerId,
            bankAccountId: bankAccountIdVal,
          },
        });
      } else {
        // C/C saldo deudor
        await tx.persona.update({
          where: { id: personaId },
          data: { outstandingBalance: { increment: totalSum } },
        });
      }

      // 8. Actualizar desglose final en la orden
      const finalOrder = await tx.order.update({
        where: { id: order.id },
        data: {
          invoiceType: finalInvoiceType,
          invoiceNumber: finalInvoiceNumber,
          cae: finalCae,
          caeDueDate: finalCaeDueDate,
          netAmount: Number(net.toFixed(2)),
          taxAmount: Number(tax.toFixed(2)),
          percepcionAmount: Number(percepcion.toFixed(2)),
        },
        include: {
          persona: true,
          items: { include: { product: true } },
        },
      });

      return finalOrder;
    });

    // Auditoría
    await logAudit({
      userId: adminId,
      action: 'CREATE_DIRECT_INVOICE',
      entityType: 'Order',
      entityId: result.id,
      newValues: {
        billingType,
        invoiceNumber: result.invoiceNumber,
        cae: result.cae,
        total: result.totalAmount,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { order: result },
    });
  } catch (error: any) {
    console.error('Error al emitir factura directa:', error.message);
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al emitir factura directa.',
    });
  }
}

