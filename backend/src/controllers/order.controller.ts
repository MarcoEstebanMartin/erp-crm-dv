import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { Role, BillingType, InvoiceType, OrderStatus, MovementType, TransactionType, PaymentMethod, SalesChannel } from '@prisma/client';
import { emitirFacturaAFIP } from '../services/afip.service';
import { logAudit } from '../utils/audit';
import { OrderService } from '../services/order.service';
import { PricingService } from '../services/pricing.service';
import { roundCurrency } from '../utils/math';

function getJurisdictionCode(provinceOrAddress?: string | null): string {
  if (!provinceOrAddress) return 'AR-B';
  const p = provinceOrAddress.toLowerCase();
  if (p.includes('misiones')) return 'AR-N';
  if (p.includes('corrientes')) return 'AR-W';
  if (p.includes('caba') || p.includes('capital') || p.includes('ciudad aut')) return 'AR-C';
  if (p.includes('buenos aires') || p.includes('bs')) return 'AR-B';
  return 'AR-B'; // Default
}

/**
 * Obtener listado de pedidos.
 * - ADMIN / DEPOSITO: Ven todos los pedidos.
 * - VENDEDOR: Solo ve los pedidos que él mismo cargó.
 */
export async function getOrders(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;
  const userRole = req.user?.role;
  const { billingType, status, page, limit } = req.query;

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

    const pageNum = page ? Math.max(1, parseInt(page as string, 10)) : undefined;
    const limitNum = limit ? Math.max(1, parseInt(limit as string, 10)) : undefined;
    const skip = pageNum && limitNum ? (pageNum - 1) * limitNum : undefined;
    const take = limitNum || undefined;

    const [orders, totalCount] = await Promise.all([
      prisma.order.findMany({
        where: whereClause,
        include: {
          persona: {
            select: { id: true, name: true, cuit: true, city: true, route: true, address: true, saleRoute: { select: { id: true, name: true } } },
          },
          seller: {
            select: { id: true, username: true },
          },
          deliveryRoute: {
            select: { id: true, status: true, driverName: true, vehiclePlate: true }
          },
          items: {
            include: {
              product: {
                select: {
                  id: true,
                  sku: true,
                  name: true,
                  isPesable: true,
                  approximateWeight: true,
                  unitsPerBox: true,
                  pickingZone: true,
                  defaultLocation: true,
                  rubro: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      prisma.order.count({ where: whereClause }),
    ]);

    res.status(200).json({
      status: 'success',
      data: {
        orders,
        pagination: {
          total: totalCount,
          page: pageNum || 1,
          limit: limitNum || totalCount,
          totalPages: limitNum ? Math.ceil(totalCount / limitNum) : 1,
        },
      },
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
        deliveryRoute: {
          select: { id: true, status: true, driverName: true, vehiclePlate: true }
        },
        items: {
          include: {
            product: {
              include: {
                lots: {
                  orderBy: { expirationDate: 'asc' },
                },
                rubro: true,
              },
            },
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
  personaId?: number;
  clientId?: number;
  billingType?: string;
  salesChannel?: any;
  notes?: string;
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
  const { personaId, clientId, billingType, salesChannel, notes, items }: CreateOrderRequest = req.body;
  const targetPersonaId = personaId || clientId;

  if (!sellerId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  if (!targetPersonaId) {
    res.status(400).json({ status: 'error', message: 'Debe especificar el cliente (personaId o clientId).' });
    return;
  }

  try {
    const result = await OrderService.createOrder({
      sellerId,
      userRole,
      personaId: targetPersonaId,
      billingType: billingType as any,
      salesChannel: salesChannel as any,
      notes,
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
 * Confirmación de Armado (Data Entry de Alta Eficiencia)
 */
export async function confirmArmado(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { items } = req.body;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  if (userRole !== Role.ADMIN && userRole !== Role.FACTURACION && userRole !== Role.DEPOSITO) {
    res.status(403).json({ status: 'error', message: 'Permisos insuficientes para confirmar armado.' });
    return;
  }

  try {
    const updatedOrder = await OrderService.confirmArmado(Number(id), items);

    await logAudit({
      userId,
      action: 'CONFIRM_ARMADO',
      entityType: 'Order',
      entityId: updatedOrder.id,
      newValues: { totalAmount: updatedOrder.totalAmount, status: updatedOrder.status },
    });

    res.status(200).json({
      status: 'success',
      data: { order: updatedOrder },
      message: 'Armado confirmado con éxito.',
    });
  } catch (error: any) {
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al confirmar el armado.',
    });
  }
}

/**
 * Cambiar el estado de un pedido en logística (Depósito / Admin).
 */
export async function updateOrderStatus(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { status, lotAssignments, bultosCount, bultosDetails } = req.body;
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

    if (status === OrderStatus.DELIVERED) {
      res.status(400).json({
        status: 'error',
        message: 'El estado ENTREGADO (DELIVERED) no se puede asignar manualmente. Debe procesarse a través del módulo de Facturación o de la Liquidación de Reparto en Logística para garantizar la consistencia contable y de stock.',
      });
      return;
    }

    if (status === OrderStatus.CANCELLED && order.status === OrderStatus.DELIVERED) {
      if (order.billingType === BillingType.OFFICIAL) {
        res.status(400).json({
          status: 'error',
          message: 'No se puede cancelar una factura oficial entregada directamente. Se debe emitir una Nota de Crédito para anularla.',
        });
        return;
      }

      // Para pedidos internos entregados, verificar si poseen cobros registrados en caja o banco
      const existingPayment = await prisma.transaction.findFirst({
        where: {
          orderId: order.id,
          type: TransactionType.INCOME
        }
      });

      if (existingPayment) {
        res.status(400).json({
          status: 'error',
          message: `No se puede cancelar el pedido #${order.id} porque posee cobros registrados en caja o cuenta bancaria. Debe anular o revertir el cobro en Finanzas/Cajas antes de cancelar el pedido.`,
        });
        return;
      }
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
      let finalTotalAmount = Number(order.totalAmount);

      // 1. Si pasa a PREPARED, validar y procesar lotes
      if (status === OrderStatus.PREPARED) {
        if (!lotAssignments) {
          throw new Error('Las asignaciones de lote son requeridas para marcar el pedido como Armado.');
        }

        const items = await tx.orderItem.findMany({
          where: { orderId: order.id },
          include: { product: true }
        });

        let recalculatedTotal = 0;

        for (const item of items) {
          const userAssignments = lotAssignments[item.id] || [];
          const totalUserAssigned = userAssignments.reduce((sum: number, a: any) => sum + Number(a.quantity), 0);

          if (totalUserAssigned > item.quantity) {
            throw new Error(`Asignación inválida para "${item.product.name}". Cantidad asignada (${totalUserAssigned}) supera la cantidad pedida (${item.quantity}).`);
          }

          const finalAssignments: { lotId: number; quantity: number }[] = [];
          
          for (const uAs of userAssignments) {
            const q = Number(uAs.quantity);
            if (q > 0) {
              finalAssignments.push({ lotId: Number(uAs.lotId), quantity: q });
            }
          }

          let remainingToAssign = item.quantity - totalUserAssigned;
          if (remainingToAssign > 0) {
            const activeLots = await tx.productLot.findMany({
              where: { 
                productId: item.productId, 
                stock: { gt: 0 },
                id: { notIn: finalAssignments.map(fa => fa.lotId) }
              },
              orderBy: { expirationDate: 'asc' },
            });

            for (const lot of activeLots) {
              if (remainingToAssign <= 0) break;
              const allocatedQty = Math.min(lot.stock, remainingToAssign);
              if (allocatedQty > 0) {
                finalAssignments.push({ lotId: lot.id, quantity: allocatedQty });
                remainingToAssign -= allocatedQty;
              }
            }

            if (remainingToAssign > 0) {
              if (process.env.IGNORE_STOCK_CHECK === 'true') {
                let slLot = await tx.productLot.findFirst({
                  where: { productId: item.productId, lotNumber: 'S/L' }
                });
                if (!slLot) {
                  slLot = await tx.productLot.create({
                    data: {
                      productId: item.productId,
                      lotNumber: 'S/L',
                      expirationDate: new Date('2036-12-31T00:00:00Z'),
                      stock: 0,
                      location: 'S/U'
                    }
                  });
                }
                finalAssignments.push({ lotId: slLot.id, quantity: remainingToAssign });
                remainingToAssign = 0;
              }
            }
          }

          const totalAssigned = finalAssignments.reduce((sum, a) => sum + a.quantity, 0);

          const diff = item.quantity - totalAssigned;
          if (diff > 0) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: diff } }
            });

            await tx.stockMovement.create({
              data: {
                productId: item.productId,
                quantity: diff,
                type: MovementType.IN,
                orderId: order.id,
                referenceId: `PICK-SHORT-${order.id}`,
                userId: userId,
                reason: `Devolución por faltante en preparación de Pedido #${order.id}`,
              }
            });
          }

          let newSubtotal = Number(item.subtotal);
          let newWeight = item.weight ? Number(item.weight) : null;
          if (totalAssigned === 0) {
            newSubtotal = 0;
            newWeight = 0;
          } else {
            if (item.product.isPesable && newWeight !== null && newWeight > 0) {
              newSubtotal = Math.round(Number(item.unitPrice) * newWeight);
            } else {
              newSubtotal = Math.round(Number(item.unitPrice) * totalAssigned);
            }
          }

          await tx.orderItem.update({
            where: { id: item.id },
            data: {
              quantity: totalAssigned,
              subtotal: newSubtotal,
              weight: newWeight
            }
          });

          recalculatedTotal += newSubtotal;

          for (const assignment of finalAssignments) {
            const { lotId, quantity } = assignment;

            const lot = await tx.productLot.findUnique({
              where: { id: lotId },
            });

            if (!lot) continue;

            await tx.productLot.update({
              where: { id: lot.id },
              data: { stock: { decrement: quantity } },
            });

            await tx.orderItemLot.create({
              data: {
                orderItemId: item.id,
                productLotId: lot.id,
                quantity,
              },
            });

            const originalMov = await tx.stockMovement.findFirst({
              where: {
                productId: item.productId,
                referenceId: `ORDER-${order.id}`,
                productLotId: null
              }
            });

            if (originalMov) {
              await tx.stockMovement.update({
                where: { id: originalMov.id },
                data: { productLotId: lot.id, orderId: order.id }
              });
            } else {
              await tx.stockMovement.create({
                data: {
                  productId: item.productId,
                  quantity: -quantity,
                  type: MovementType.OUT,
                  orderId: order.id,
                  referenceId: `ORDER-${order.id}`,
                  userId: order.sellerId,
                  reason: `Venta - Descuento físico de Lote #${lot.lotNumber} para Pedido #${order.id}`,
                  productLotId: lot.id
                }
              });
            }
          }
        }

        finalTotalAmount = recalculatedTotal;
      }

      const uOrder = await tx.order.update({
        where: { id: order.id },
        data: { 
          status: status as OrderStatus,
          totalAmount: finalTotalAmount,
          bultosCount: bultosCount !== undefined ? Number(bultosCount) : undefined,
          bultosDetails: bultosDetails !== undefined ? bultosDetails : undefined
        },
      });

      if (status === OrderStatus.CANCELLED && order.status !== OrderStatus.CANCELLED) {
        // Obtener ítems del pedido para devolver stock
        const items = await tx.orderItem.findMany({
          where: { orderId: order.id },
          include: { orderItemLots: true }
        });

        for (const item of items) {
          // Devolución atómica de stock para evitar condiciones de carrera (race conditions)
          await tx.product.update({
            where: { id: item.productId },
            data: { stock: { increment: item.quantity } },
          });

          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: MovementType.IN,
              orderId: order.id,
              referenceId: `CANCEL-${order.id}`,
              userId: userId,
              reason: `Devolución por cancelación de pedido #${order.id}`,
            },
          });

          // Si el pedido estaba PREPARING, PREPARED o DELIVERED, tenía lotes asignados. Los devolvemos.
          const hasLotsAssigned = order.status === OrderStatus.PREPARING || order.status === OrderStatus.PREPARED || order.status === OrderStatus.DELIVERED;
          if (hasLotsAssigned) {
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

        // Si el pedido estaba entregado (DELIVERED), revertir su saldo en la cuenta corriente de forma incondicional
        if (order.status === OrderStatus.DELIVERED) {
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
  bankAccountId?: number;
}

/**
 * Facturar y cobrar un pedido armado (Admin y Facturación).
 * Realiza la comunicación con AFIP si es Oficial y asienta el cobro.
 */
export async function invoiceOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { billingType, paymentMethod, paymentDescription, bankAccountId: reqBankAccountId, deferCae }: InvoiceOrderRequest & { deferCae?: boolean } = req.body;
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
        items: {
          include: {
            product: true
          }
        },
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

    // 1. Precargar todos los productos involucrados en la transacción
    const productIds = order.items.map(item => item.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: { rubro: true }
    });

    // 2. Precargar todas las reglas de descuento aplicables
    const dbRules = await prisma.discountRule.findMany({
      where: {
        OR: [
          { personaId: order.personaId },
          { priceList: order.persona.priceList }
        ]
      }
    });

    // 3. Detectar si hay reglas de división para este cliente
    const rubroIds = Array.from(new Set(order.items.map(i => i.product.rubroId).filter(id => id !== null))) as number[];
    const splitConfigs = await prisma.splitBillingConfig.findMany({
      where: {
        personaId: order.personaId,
        rubroId: { in: rubroIds }
      }
    });

    const hasSplit = splitConfigs.length > 0;
    
    let officialOrderTotal = 0;
    let internalOrderTotal = 0;
    let splitApplied = false;

    const oficialItemsData: any[] = [];
    const internoItemsData: any[] = [];

    if (hasSplit) {
      // LÓGICA DE SPLIT BILLING
      for (const item of order.items) {
        const config = splitConfigs.find(c => c.rubroId === item.product.rubroId);
        const product = dbProducts.find(p => p.id === item.productId);
        if (!product) {
          res.status(400).json({ status: 'error', message: `Producto ID ${item.productId} no encontrado.` });
          return;
        }

        if (config) {
          // Dividir al 50%
          const qtyOficial = Math.ceil(item.quantity / 2);
          const qtyInterno = Math.floor(item.quantity / 2);

          let weightOficial: number | null = null;
          let weightInterno: number | null = null;

          if (item.weight) {
            weightOficial = Number((Number(item.weight) / 2).toFixed(3));
            weightInterno = Number((Number(item.weight) - weightOficial).toFixed(3));
          }

          // Calcular precios unitarios en memoria (sin N+1 queries)
          const pricingOficial = PricingService.calculatePriceAndDiscountInMemory(product, order.persona, dbRules, BillingType.OFFICIAL);
          const pricingInterno = PricingService.calculatePriceAndDiscountInMemory(product, order.persona, dbRules, BillingType.INTERNAL);

          if (qtyOficial > 0) {
            const actualQty = product.isPesable ? (weightOficial || qtyOficial) : qtyOficial;
            const subtotal = Math.round(pricingOficial.finalPrice * actualQty);
            oficialItemsData.push({
              orderItemId: item.id,
              productId: item.productId,
              quantity: qtyOficial,
              weight: weightOficial,
              unitPrice: pricingOficial.finalPrice,
              subtotal
            });
          }

          if (qtyInterno > 0) {
            const actualQty = product.isPesable ? (weightInterno || qtyInterno) : qtyInterno;
            const subtotal = Math.round(pricingInterno.finalPrice * actualQty);
            internoItemsData.push({
              productId: item.productId,
              quantity: qtyInterno,
              weight: weightInterno,
              unitPrice: pricingInterno.finalPrice,
              subtotal
            });
          }
        } else {
          // No tiene regla de split: va al 100% a la oficial (Sucursal A) o según corresponda
          const pricing = PricingService.calculatePriceAndDiscountInMemory(product, order.persona, dbRules, billingType as BillingType);
          const actualQty = product.isPesable ? (item.weight ? Number(item.weight) : item.quantity) : item.quantity;
          const subtotal = Math.round(pricing.finalPrice * actualQty);

          const itemData = {
            orderItemId: item.id,
            productId: item.productId,
            quantity: item.quantity,
            weight: item.weight ? Number(item.weight) : null,
            unitPrice: pricing.finalPrice,
            subtotal
          };

          if (billingType === BillingType.OFFICIAL) {
            oficialItemsData.push(itemData);
          } else {
            internoItemsData.push(itemData);
          }
        }
      }

      // Si tenemos ítems para la orden interna, calculamos total
      if (internoItemsData.length > 0) {
        splitApplied = true;
        internalOrderTotal = internoItemsData.reduce((sum, item) => sum + item.subtotal, 0);
      }

      officialOrderTotal = oficialItemsData.reduce((sum, item) => sum + item.subtotal, 0);
    } else {
      // LÓGICA ESTÁNDAR: Recalcular precios pero sin split
      officialOrderTotal = 0;
      for (const item of order.items) {
        const product = dbProducts.find(p => p.id === item.productId);
        if (!product) {
          res.status(400).json({ status: 'error', message: `Producto ID ${item.productId} no encontrado.` });
          return;
        }

        const pricing = PricingService.calculatePriceAndDiscountInMemory(product, order.persona, dbRules, billingType as BillingType);
        const actualQty = product.isPesable ? (item.weight ? Number(item.weight) : item.quantity) : item.quantity;
        const subtotal = Math.round(pricing.finalPrice * actualQty);

        oficialItemsData.push({
          orderItemId: item.id,
          productId: item.productId,
          quantity: item.quantity,
          weight: item.weight ? Number(item.weight) : null,
          unitPrice: pricing.finalPrice,
          subtotal
        });

        officialOrderTotal += subtotal;
      }
    }

    // 4. VALIDACIONES PRE-AFIP de Caja y Banco (Evita facturas huérfanas)
    let activeDrawerOfficialId: number | null = null;
    let activeDrawerInternalId: number | null = null;
    let bankAccountOfficialId: number | null = null;
    let bankAccountInternalId: number | null = null;

    if (paymentMethod) {
      if (paymentMethod === PaymentMethod.CASH) {
        // Validar caja para la porción oficial: Buscar primero caja abierta del usuario
        let activeDrawerOfficial = await prisma.cashDrawer.findFirst({
          where: {
            userId: adminId,
            status: 'OPEN',
          },
          orderBy: { openedAt: 'desc' }
        });

        // Si no hay del usuario, buscar cualquier caja abierta en el sistema
        if (!activeDrawerOfficial) {
          activeDrawerOfficial = await prisma.cashDrawer.findFirst({
            where: {
              status: 'OPEN',
            },
            orderBy: { openedAt: 'desc' }
          });
        }

        // EXIGIR OBLIGATORIAMENTE que haya una caja abierta para ingresar cobros en efectivo
        if (!activeDrawerOfficial) {
          res.status(400).json({
            status: 'error',
            message: 'No hay ninguna Caja de Efectivo abierta. Debe abrir la caja diaria/depósito en el módulo de Cajas antes de facturar un cobro en efectivo.'
          });
          return;
        }
        activeDrawerOfficialId = activeDrawerOfficial.id;

        // Validar caja para la porción interna si hay split
        if (splitApplied && internoItemsData.length > 0) {
          let activeDrawerInternal = await prisma.cashDrawer.findFirst({
            where: {
              userId: adminId,
              status: 'OPEN',
            },
            orderBy: { openedAt: 'desc' }
          });

          if (!activeDrawerInternal) {
            activeDrawerInternal = await prisma.cashDrawer.findFirst({
              where: { status: 'OPEN' },
              orderBy: { openedAt: 'desc' }
            });
          }

          if (!activeDrawerInternal) {
            res.status(400).json({
              status: 'error',
              message: 'No hay ninguna Caja de Efectivo abierta. Debe abrir una caja de efectivo antes de facturar cobros en efectivo para la parte interna.'
            });
            return;
          }
          activeDrawerInternalId = activeDrawerInternal.id;
        }
      } else if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
        const selectedBankId = reqBankAccountId ? Number(reqBankAccountId) : (await prisma.bankAccount.findFirst())?.id;
        if (!selectedBankId) {
          res.status(400).json({ status: 'error', message: `No se encontró ninguna cuenta bancaria configurada en el sistema.` });
          return;
        }
        bankAccountOfficialId = selectedBankId;
        if (splitApplied && internoItemsData.length > 0) {
          bankAccountInternalId = selectedBankId;
        }
      }
    }

    let finalInvoiceType: InvoiceType = InvoiceType.PRESUPUESTO;
    let finalInvoiceNumber: string | null = null;
    let finalCae: string | null = null;
    let finalCaeDueDate: Date | null = null;

    const cuitLimpio = order.persona.cuit ? order.persona.cuit.replace(/-/g, '') : '';
    let docType = 99; // Consumidor Final

    if (billingType === BillingType.OFFICIAL) {
      if (cuitLimpio.length === 11) {
        docType = 80;
        finalInvoiceType = InvoiceType.FACTURA_A;
      } else if (cuitLimpio.length === 7 || cuitLimpio.length === 8) {
        docType = 96;
        finalInvoiceType = InvoiceType.FACTURA_B;
      } else {
        finalInvoiceType = InvoiceType.FACTURA_B;
      }
    } else {
      finalInvoiceType = InvoiceType.PRESUPUESTO;
    }
    // Calcular desglose impositivo (Bottom-Up)
    let net = 0;
    let tax = 0;
    let percepIIBB = 0;
    let percepIVA = 0;

    const isFacturaA_Official = billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A;
    if (isFacturaA_Official) {
      const perceptionIVA = await prisma.perceptionType.findUnique({
        where: { code: 'IVA_5329' }
      });
      
      const applyIvaPerc = officialOrderTotal > 100000;
      const ivaPercAliquot = applyIvaPerc ? ((perceptionIVA && perceptionIVA.aliquot) ? Number(perceptionIVA.aliquot) : 3.00) : 0;
      const iibbAliquot = Number(order.persona.iibbAliquot || 0);

      // Desglose limpio: dividir el total comercial por 1.21 para obtener el neto
      net = Number((officialOrderTotal / 1.21).toFixed(2));
      tax = Number((officialOrderTotal - net).toFixed(2));

      // Las percepciones se calculan directamente sobre el neto y se adicionan
      percepIIBB = Number((net * (iibbAliquot / 100)).toFixed(2));
      percepIVA = Number((net * (ivaPercAliquot / 100)).toFixed(2));

      // El total facturado final se incrementa adicionando las percepciones calculadas
      officialOrderTotal = Number((net + tax + percepIIBB + percepIVA).toFixed(2));
    } else {
      // Para Factura B, C o Presupuesto no hay percepciones, dividimos simplemente en neto e IVA 21%
      net = Number((officialOrderTotal / 1.21).toFixed(2));
      tax = Number((officialOrderTotal - net).toFixed(2));
    }

    if (billingType === BillingType.OFFICIAL) {
      if (deferCae) {
        // Pre-Factura A/B: Solicitud diferida de CAE (flujo tipo IDUO)
        finalInvoiceNumber = `PRE-${finalInvoiceType === InvoiceType.FACTURA_A ? 'A' : 'B'}-${order.id.toString().padStart(6, '0')}`;
        finalCae = null;
        finalCaeDueDate = null;
      } else {
        try {
          const afipRes = await emitirFacturaAFIP({
            clientCuit: cuitLimpio,
            clientDocType: docType,
            invoiceType: finalInvoiceType === InvoiceType.FACTURA_A ? 'A' : 'B',
            total: officialOrderTotal,
            neto: isFacturaA_Official ? Number(net.toFixed(2)) : undefined,
            iva: isFacturaA_Official ? Number(tax.toFixed(2)) : undefined,
            percepcionAmount: isFacturaA_Official ? Number(percepIIBB.toFixed(2)) : undefined,
            percepcionIvaAmount: isFacturaA_Official ? Number(percepIVA.toFixed(2)) : undefined,
          });

          finalInvoiceNumber = afipRes.invoiceNumber;
          finalCae = afipRes.cae;
          finalCaeDueDate = afipRes.caeDueDate;
        } catch (err: any) {
          res.status(400).json({ status: 'error', message: `Error AFIP al facturar pedido: ${err.message}` });
          return;
        }
      }
    } else {
      finalInvoiceNumber = `INT-${order.id.toString().padStart(5, '0')}`;
    }

    // PERSISTENCIA AISLADA DE FACTURACIÓN: Guardamos inmediatamente los datos de facturación y CAE obtenidos de AFIP o generados de forma interna.
    // Esto asegura que si ocurre algún error financiero posterior (ej. caja cerrada), los datos fiscales no se pierdan.
    let updatedOrderPre;
    try {
      updatedOrderPre = await prisma.order.update({
        where: { id: order.id },
        data: {
          billingType,
          invoiceType: finalInvoiceType,
          invoiceNumber: finalInvoiceNumber,
          cae: finalCae,
          caeDueDate: finalCaeDueDate ? new Date(finalCaeDueDate) : null,
          totalAmount: officialOrderTotal,
          netAmount: Number(net.toFixed(2)),
          taxAmount: Number(tax.toFixed(2)),
          percepcionAmount: Number(percepIIBB.toFixed(2)),
          percepcionIvaAmount: Number(percepIVA.toFixed(2)),
          status: OrderStatus.DELIVERED,
        },
        include: { items: { include: { product: true } }, persona: true }
      });
    } catch (saveCaeError: any) {
      console.error('❌ Error crítico al persistir CAE de AFIP en base de datos local:', saveCaeError);
      res.status(500).json({
        status: 'error',
        message: `La factura fue emitida en AFIP (Nro: ${finalInvoiceNumber}, CAE: ${finalCae}), pero falló el registro local. Por favor registre estos datos manualmente: ${saveCaeError.message}`
      });
      return;
    }

    // Transacción secundaria para procesar los flujos financieros, orden interna (split), percepciones de rentas y balances.
    try {
      const result = await prisma.$transaction(async (tx) => {
        let internalOrderId: number | null = null;

        if (hasSplit) {
          // Si tenemos ítems para la orden interna, la creamos
          if (internoItemsData.length > 0) {
            const internalOrder = await tx.order.create({
              data: {
                personaId: order.personaId,
                sellerId: order.sellerId,
                billingType: BillingType.INTERNAL,
                invoiceType: InvoiceType.PRESUPUESTO,
                invoiceNumber: `INT-${order.id.toString().padStart(5, '0')}-X`,
                totalAmount: internalOrderTotal,
                status: OrderStatus.DELIVERED
              }
            });

            internalOrderId = internalOrder.id;

            // Crear los ítems de la orden interna
            for (const item of internoItemsData) {
              await tx.orderItem.create({
                data: {
                  orderId: internalOrder.id,
                  productId: item.productId,
                  quantity: item.quantity,
                  weight: item.weight,
                  unitPrice: item.unitPrice,
                  subtotal: item.subtotal
                }
              });
            }

            // Registrar cobro o deuda de la orden interna (Sucursal X)
            if (paymentMethod) {
              let cashDrawerId: number | undefined = undefined;
              let bankAccountId: number | undefined = undefined;

              if (paymentMethod === PaymentMethod.CASH) {
                cashDrawerId = activeDrawerInternalId || undefined;
              } else if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
                bankAccountId = bankAccountInternalId || undefined;
                await tx.bankAccount.update({
                  where: { id: bankAccountId! },
                  data: { balance: { increment: internalOrderTotal } }
                });
              }

              await tx.transaction.create({
                data: {
                  orderId: internalOrder.id,
                  personaId: order.personaId,
                  userId: adminId,
                  billingType: BillingType.INTERNAL,
                  type: TransactionType.INCOME,
                  paymentMethod,
                  amount: internalOrderTotal,
                  description: `Cobro en caja de pedido interno #${internalOrder.id} (Parte Interna de Pedido Original #${order.id})`,
                  cashDrawerId,
                  bankAccountId,
                  verified: true
                }
              });
            } else {
              await tx.persona.update({
                where: { id: order.personaId },
                data: { outstandingBalance: { increment: internalOrderTotal } }
              });
            }

            // Reasignar los movimientos de stock del 50% de la porción interna
            for (const item of internoItemsData) {
              const stockMov = await tx.stockMovement.findFirst({
                where: {
                  productId: item.productId,
                  referenceId: `ORDER-${order.id}`
                }
              });

              if (stockMov) {
                await tx.stockMovement.create({
                  data: {
                    productId: item.productId,
                    quantity: -item.quantity,
                    type: MovementType.OUT,
                    orderId: internalOrder.id,
                    referenceId: `ORDER-${internalOrder.id}`,
                    userId: order.sellerId,
                    reason: `Venta - Pedido Interno #${internalOrder.id} (Parte Interna de Pedido #${order.id})`,
                    productLotId: stockMov.productLotId
                  }
                });

                await tx.stockMovement.update({
                  where: { id: stockMov.id },
                  data: {
                    quantity: stockMov.quantity + item.quantity,
                    orderId: order.id
                  }
                });
              }
            }
          }

          // Actualizamos los ítems del pedido original en base de datos
          for (const item of oficialItemsData) {
            if (item.orderItemId) {
              await tx.orderItem.update({
                where: { id: item.orderItemId },
                data: {
                  quantity: item.quantity,
                  weight: item.weight,
                  unitPrice: item.unitPrice,
                  subtotal: item.subtotal
                }
              });
            }
          }

          // Borramos del pedido original los ítems que se hayan trasladado 100% a la interna (si hubiera)
          const oficialItemsIds = oficialItemsData.map(o => o.orderItemId).filter(id => id !== undefined);
          await tx.orderItem.deleteMany({
            where: {
              orderId: order.id,
              id: { notIn: oficialItemsIds }
            }
          });
        } else {
          // LÓGICA ESTÁNDAR: Actualizar precios de la orden oficial sin split
          for (const item of oficialItemsData) {
            await tx.orderItem.update({
              where: { id: item.orderItemId },
              data: {
                unitPrice: item.unitPrice,
                subtotal: item.subtotal
              }
            });
          }
        }

        // Registrar percepción IIBB
        if (percepIIBB > 0) {
          await tx.taxWithholding.create({
            data: {
              type: 'PERCEPCION_PRACTICADA',
              taxType: 'IIBB',
              personaId: order.personaId,
              number: finalInvoiceNumber || `FAC-${order.id}`,
              date: new Date(),
              amount: Number(percepIIBB.toFixed(2)),
              jurisdiction: getJurisdictionCode(order.persona.province || order.persona.address),
            },
          });
        }

        // Registrar percepción IVA
        if (percepIVA > 0) {
          await tx.taxWithholding.create({
            data: {
              type: 'PERCEPCION_PRACTICADA',
              taxType: 'IVA',
              personaId: order.personaId,
              number: finalInvoiceNumber || `FAC-${order.id}`,
              date: new Date(),
              amount: Number(percepIVA.toFixed(2)),
              jurisdiction: null,
            },
          });
        }

        // Registrar cobro o deuda de la parte Oficial
        if (paymentMethod) {
          let cashDrawerId: number | undefined = undefined;
          let bankAccountId: number | undefined = undefined;

          if (paymentMethod === PaymentMethod.CASH) {
            cashDrawerId = activeDrawerOfficialId || undefined;
          } else if (paymentMethod === PaymentMethod.BANK_TRANSFER) {
            bankAccountId = bankAccountOfficialId || undefined;
            await tx.bankAccount.update({
              where: { id: bankAccountId! },
              data: { balance: { increment: officialOrderTotal } },
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
              amount: officialOrderTotal,
              description: paymentDescription ? `Cobro en caja de pedido #${order.id} - ${paymentDescription}` : `Cobro en caja de pedido #${order.id} (Parte Oficial)`,
              cashDrawerId,
              bankAccountId,
              verified: true,
            },
          });
        } else {
          await tx.persona.update({
            where: { id: order.personaId },
            data: {
              outstandingBalance: {
                increment: officialOrderTotal
              }
            }
          });
        }

        return {
          split: splitApplied,
          internalOrderId,
          internalOrderTotal
        };
      });

      // Auditoría
      await logAudit({
        userId: adminId,
        action: 'INVOICE_ORDER',
        entityType: 'Order',
        entityId: order.id,
        newValues: {
          billingType,
          invoiceNumber: finalInvoiceNumber,
          cae: finalCae,
          total: officialOrderTotal,
          split: result.split,
          internalOrderId: result.internalOrderId
        },
      });

      res.status(200).json({
        status: 'success',
        data: { 
          order: updatedOrderPre,
          split: result.split,
          internalOrderId: result.internalOrderId,
          internalOrderTotal: result.internalOrderTotal
        },
      });
    } catch (secondaryError: any) {
      console.error('❌ Error en el flujo secundario de facturación:', secondaryError.message);
      try {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            notes: (order.notes ? order.notes + ' | ' : '') + `[ALERTA AFIP] CAE ${finalCae} emitido pero falló registro financiero: ${secondaryError.message}. Conciliar manualmente.`
          }
        });
      } catch (noteErr) {
        console.error('No se pudo guardar la nota de alerta en el pedido:', noteErr);
      }
      res.status(400).json({
        status: 'error',
        message: `La factura oficial de AFIP fue emitida con éxito (Nro: ${finalInvoiceNumber}, CAE: ${finalCae}). Sin embargo, ocurrió un error al registrar las transacciones financieras o la porción interna: ${secondaryError.message}. El pedido fue marcado con una alerta contable para su conciliación manual.`
      });
    }
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

    // Ejecutar transacciones: restaurar stock, validar nuevo stock, actualizar pedido y movimientos
    const result = await prisma.$transaction(async (tx) => {
      // 1. Restaurar stock de los items viejos de manera atómica
      for (const oldItem of order.items) {
        await tx.product.update({
          where: { id: oldItem.productId },
          data: { stock: { increment: oldItem.quantity } }
        });
      }

      // Obtener persona
      const persona = await tx.persona.findUnique({ where: { id: order.personaId } });
      if (!persona) {
        throw new Error(`Persona no encontrada.`);
      }

      const productIds = items.map(i => i.productId);
      const dbProducts = await tx.product.findMany({
        where: { id: { in: productIds } },
        include: { rubro: true }
      });

      const dbRules = await tx.discountRule.findMany({
        where: {
          OR: [
            { personaId: persona.id },
            { priceList: persona.priceList }
          ]
        }
      });

      // 2. Validar y descontar nuevo stock de forma atómica evitando race conditions
      let totalSum = 0;
      const orderItemsToCreate = [];

      for (const item of items) {
        const product = dbProducts.find(p => p.id === item.productId);
        if (!product) {
          throw new Error(`Producto ID ${item.productId} no encontrado.`);
        }

        const minQty = product.minOrderQuantity || 1;
        if (item.quantity < minQty && !(item as any).isEmergencyOverride) {
          throw new Error(
            `El producto "${product.name}" exige un mínimo de ${minQty} unidades (solicitado: ${item.quantity}).`
          );
        }

        // Calcular precio en memoria con PricingService
        const pricing = PricingService.calculatePriceAndDiscountInMemory(
          product,
          persona,
          dbRules,
          order.billingType
        );
        const finalUnitPrice = pricing.finalPrice;

        const actualQuantityForPrice = product.isPesable 
          ? (item.weight ? Number(item.weight) : item.quantity * Number((product as any).approximateWeight || 1))
          : item.quantity;
        const subtotal = roundCurrency(finalUnitPrice * actualQuantityForPrice);
        totalSum = roundCurrency(totalSum + subtotal);

        orderItemsToCreate.push({
          productId: product.id,
          quantity: item.quantity,
          weight: product.isPesable ? (item.weight ? Number(item.weight) : null) : null,
          unitPrice: finalUnitPrice,
          subtotal: subtotal
        });

        // Descontar atómicamente con chequeo de stock gte
        if (process.env.IGNORE_STOCK_CHECK === 'true') {
          await tx.product.update({
            where: { id: product.id },
            data: { stock: { decrement: item.quantity } }
          });
        } else {
          const res = await tx.product.updateMany({
            where: {
              id: product.id,
              stock: { gte: item.quantity }
            },
            data: {
              stock: { decrement: item.quantity }
            }
          });

          if (res.count === 0) {
            throw new Error(`Stock insuficiente para "${product.name}" debido a una operación concurrente (Solicitado: ${item.quantity}).`);
          }
        }
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

      // 4. Sincronizar movimientos de stock para mantener la auditoría consistente
      await tx.stockMovement.deleteMany({
        where: {
          orderId: order.id,
          referenceId: `ORDER-${order.id}`
        }
      });

      await tx.stockMovement.createMany({
        data: orderItemsToCreate.map(item => ({
          productId: item.productId,
          quantity: -item.quantity,
          type: MovementType.OUT,
          orderId: order.id,
          referenceId: `ORDER-${order.id}`,
          userId: order.sellerId,
          reason: `Venta - Reserva de Pedido #${order.id} (Modificado)`,
        }))
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
  salesChannel?: any;
  paymentMethod?: PaymentMethod;
  bankAccountId?: number;
  cashDrawerId?: number;
  checkNumber?: string;
  checkIssuer?: string;
  checkAmount?: number;
  items: {
    productId: number;
    quantity: number;
    weight?: number | null;
  }[];
}

export async function createDirectInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  const adminId = req.user?.id;
  const userRole = req.user?.role;
  const { 
    personaId, 
    billingType, 
    salesChannel,
    paymentMethod, 
    bankAccountId,
    cashDrawerId: explicitCashDrawerId,
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
    // 1. Obtener cliente/persona
    const persona = await prisma.persona.findUnique({ where: { id: personaId } });
    if (!persona) {
      res.status(404).json({ status: 'error', message: 'Cliente no encontrado.' });
      return;
    }

    // 2. Cargar todos los productos y validar stock previo a AFIP
    const productIds = items.map(item => item.productId);
    const dbProducts = await prisma.product.findMany({
      where: { id: { in: productIds } }
    });

    let totalSum = 0;
    const orderItemsData: any[] = [];

    for (const item of items) {
      const product = dbProducts.find(p => p.id === item.productId);
      if (!product) {
        res.status(404).json({ status: 'error', message: `Producto ID ${item.productId} no encontrado.` });
        return;
      }

      if (product.stock < item.quantity && process.env.IGNORE_STOCK_CHECK !== 'true') {
        res.status(400).json({
          status: 'error',
          message: `Stock insuficiente para "${product.name}" (Disponible: ${product.stock}, Solicitado: ${item.quantity}).`
        });
        return;
      }

      // Determinar precio unitario base según la lista del cliente
      let selectedPrice = Number(product.listPrice);
      let itemDiscount = Number(persona.discount || 0);

      if (persona.priceList === 'B') {
        selectedPrice = Number(product.listPriceB) > 0 ? Number(product.listPriceB) : Number(product.listPrice);
        const isMelincue = product.description?.toUpperCase() === 'MELINCUE' || product.name?.toUpperCase().includes('MELINCUE');
        if (isMelincue) {
          itemDiscount = 3;
        } else {
          itemDiscount = 0;
        }
      } else if (persona.priceList === 'C') {
        selectedPrice = Number(product.listPriceC) > 0 ? Number(product.listPriceC) : Number(product.listPrice);
      }

      // Aplicar descuento fijo / dinámico (redondeando a 2 decimales)
      const finalUnitPrice = Math.round(selectedPrice * (1 - itemDiscount / 100));
      
      // Si es pesable y tiene peso explícito lo usa, si no, usa quantity * approximateWeight, si no tiene aprox, asume 1kg por unidad.
      const actualQuantityForPrice = product.isPesable 
        ? (item.weight ? Number(item.weight) : item.quantity * Number((product as any).approximateWeight || 1))
        : item.quantity;
      const subtotal = Math.round(finalUnitPrice * actualQuantityForPrice);
      totalSum += subtotal;

      orderItemsData.push({
        productId: product.id,
        quantity: item.quantity,
        weight: product.isPesable ? (item.weight ? Number(item.weight) : item.quantity * Number((product as any).approximateWeight || 1)) : null,
        unitPrice: finalUnitPrice,
        subtotal,
        productName: product.name,
      });
    }

    totalSum = Math.round(totalSum);

    // 3. Validar límite de crédito y boleta contra boleta
    const creditLimit = Number(persona.creditLimit || 0);
    const outstandingBalance = Number(persona.outstandingBalance || 0);
    if (creditLimit > 0 && (outstandingBalance + totalSum) > creditLimit) {
      if (userRole !== Role.ADMIN) {
        res.status(400).json({
          status: 'error',
          message: `Límite de crédito excedido. Saldo actual: $${outstandingBalance.toLocaleString()}, Disponible: $${(creditLimit - outstandingBalance).toLocaleString()}, Requerido: $${totalSum.toLocaleString()}.`
        });
        return;
      }
    }

    if (!paymentMethod && outstandingBalance > 0) {
      if (userRole !== Role.ADMIN) {
        res.status(400).json({
          status: 'error',
          message: `Regla Boleta contra Boleta: El cliente posee una boleta pendiente ($${outstandingBalance.toLocaleString()}). Debe registrar su cobro para poder facturar a crédito.`
        });
        return;
      }
    }

    // 4. Determinar datos impositivos y generar Factura AFIP o Interna
    let finalInvoiceType: InvoiceType = InvoiceType.PRESUPUESTO;
    let finalInvoiceNumber: string | null = null;
    let finalCae: string | null = null;
    let finalCaeDueDate: Date | null = null;

    let net = Math.round(totalSum / 1.21);
    let tax = totalSum - net;

    const cuitLimpio = persona.cuit ? persona.cuit.replace(/-/g, '') : '';
    let docType = 99;

    if (billingType === BillingType.OFFICIAL) {
      if (cuitLimpio.length === 11) {
        docType = 80;
        finalInvoiceType = InvoiceType.FACTURA_A;
      } else if (cuitLimpio.length === 7 || cuitLimpio.length === 8) {
        docType = 96;
        finalInvoiceType = InvoiceType.FACTURA_B;
      } else {
        finalInvoiceType = InvoiceType.FACTURA_B;
      }
    } else {
      finalInvoiceType = InvoiceType.PRESUPUESTO;
    }
    // Calcular desglose impositivo (Bottom-Up)
    net = Number((totalSum / 1.21).toFixed(2));
    tax = Number((totalSum - net).toFixed(2));
    let percepIIBB = 0;
    let percepIVA = 0;

    const isFacturaA_Official = billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A;
    if (isFacturaA_Official) {
      // Obtener alícuota activa de la percepción de IVA RG 5329
      const perceptionIVA = await prisma.perceptionType.findUnique({
        where: { code: 'IVA_5329' }
      });
      
      // La percepción de IVA aplica en facturas mayores a $100.000
      const applyIvaPerc = totalSum > 100000;
      const ivaPercAliquot = applyIvaPerc ? ((perceptionIVA && perceptionIVA.aliquot) ? Number(perceptionIVA.aliquot) : 3.00) : 0;
      const iibbAliquot = Number(persona.iibbAliquot || 0);

      // Calcular percepciones directamente sobre el neto y adicionarlas al total
      percepIIBB = Number((net * (iibbAliquot / 100)).toFixed(2));
      percepIVA = Number((net * (ivaPercAliquot / 100)).toFixed(2));
      totalSum = Number((net + tax + percepIIBB + percepIVA).toFixed(2));
    }

    if (billingType === BillingType.OFFICIAL) {
      try {
        const afipRes = await emitirFacturaAFIP({
          clientCuit: cuitLimpio,
          clientDocType: docType,
          invoiceType: finalInvoiceType === InvoiceType.FACTURA_A ? 'A' : 'B',
          total: totalSum,
          neto: isFacturaA_Official ? Number(net.toFixed(2)) : undefined,
          iva: isFacturaA_Official ? Number(tax.toFixed(2)) : undefined,
          percepcionAmount: isFacturaA_Official ? Number(percepIIBB.toFixed(2)) : undefined,
          percepcionIvaAmount: isFacturaA_Official ? Number(percepIVA.toFixed(2)) : undefined,
        });

        finalInvoiceNumber = afipRes.invoiceNumber;
        finalCae = afipRes.cae;
        finalCaeDueDate = afipRes.caeDueDate;
      } catch (err: any) {
        res.status(400).json({ status: 'error', message: `Error AFIP al emitir factura: ${err.message}` });
        return;
      }
    }

    // PERSISTENCIA AISLADA DE FACTURACIÓN:
    // Creamos primero el registro de la orden principal de forma simple y aislada con sus datos fiscales (incluyendo el CAE si es oficial).
    // Esto asegura que si falla la lógica de lotes o transacciones de caja subsiguiente, la factura ya quede registrada localmente.
    let order;
    try {
      order = await prisma.order.create({
        data: {
          personaId,
          sellerId: adminId,
          status: OrderStatus.DELIVERED,
          billingType,
          salesChannel: salesChannel || SalesChannel.MOSTRADOR,
          totalAmount: totalSum,
          netAmount: billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A ? Number(net.toFixed(2)) : Math.round(net),
          taxAmount: billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A ? Number(tax.toFixed(2)) : Math.round(tax),
          percepcionAmount: billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A ? Number(percepIIBB.toFixed(2)) : Math.round(percepIIBB),
          percepcionIvaAmount: billingType === BillingType.OFFICIAL && finalInvoiceType === InvoiceType.FACTURA_A ? Number(percepIVA.toFixed(2)) : Math.round(percepIVA),
          invoiceType: finalInvoiceType,
          cae: finalCae,
          caeDueDate: finalCaeDueDate ? new Date(finalCaeDueDate) : null,
          invoiceNumber: finalInvoiceNumber // Podrá ser nulo si no es oficial, se actualizará abajo
        },
      });

      // Si no es oficial, generamos el invoiceNumber interno usando el ID autogenerado de la orden
      if (!finalInvoiceNumber) {
        finalInvoiceNumber = `INT-${order.id.toString().padStart(5, '0')}`;
        order = await prisma.order.update({
          where: { id: order.id },
          data: { invoiceNumber: finalInvoiceNumber }
        });
      }
    } catch (creationError: any) {
      console.error('❌ Error crítico al guardar orden básica en base de datos local:', creationError);
      res.status(500).json({
        status: 'error',
        message: `La factura fue procesada, pero ocurrió un error al registrarla localmente: ${creationError.message}.`
      });
      return;
    }

    // Transacción secundaria para procesar la lógica de stock, lotes, percepciones de rentas y cobros financieros.
    try {
      const result = await prisma.$transaction(async (tx) => {
        // Descontar del stock general de manera atómica para evitar race conditions
        for (const itemData of orderItemsData) {
          if (process.env.IGNORE_STOCK_CHECK === 'true') {
            await tx.product.update({
              where: { id: itemData.productId },
              data: { stock: { decrement: itemData.quantity } },
            });
          } else {
            const res = await tx.product.updateMany({
              where: {
                id: itemData.productId,
                stock: { gte: itemData.quantity },
              },
              data: {
                stock: { decrement: itemData.quantity },
              },
            });

            if (res.count === 0) {
              throw new Error(`Stock insuficiente para "${itemData.productName}" debido a una operación concurrente. Por favor reintente la venta.`);
            }
          }
        }

        // Crear los OrderItems y hacer la asignación automática de lotes (FIFO)
        for (const itemData of orderItemsData) {
          const orderItem = await tx.orderItem.create({
            data: {
              orderId: order.id,
              productId: itemData.productId,
              quantity: itemData.quantity,
              weight: itemData.weight,
              unitPrice: itemData.unitPrice,
              subtotal: itemData.subtotal,
            },
          });

          // Registrar movimiento de stock general
          await tx.stockMovement.create({
            data: {
              productId: itemData.productId,
              quantity: -itemData.quantity,
              type: MovementType.OUT,
              orderId: order.id,
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

            await tx.productLot.update({
              where: { id: lot.id },
              data: { stock: { decrement: allocatedQty } },
            });

            await tx.orderItemLot.create({
              data: {
                orderItemId: orderItem.id,
                productLotId: lot.id,
                quantity: allocatedQty,
              },
            });
          }

          if (remainingToAssign > 0) {
            if (process.env.IGNORE_STOCK_CHECK === 'true') {
              let slLot = await tx.productLot.findFirst({
                where: { productId: itemData.productId, lotNumber: 'S/L' }
              });
              if (!slLot) {
                slLot = await tx.productLot.create({
                  data: {
                    productId: itemData.productId,
                    lotNumber: 'S/L',
                    expirationDate: new Date('2036-12-31T00:00:00Z'),
                    stock: 0,
                    location: 'S/U'
                  }
                });
              }

              await tx.productLot.update({
                where: { id: slLot.id },
                data: { stock: { decrement: remainingToAssign } },
              });

              await tx.orderItemLot.create({
                data: {
                  orderItemId: orderItem.id,
                  productLotId: slLot.id,
                  quantity: remainingToAssign,
                },
              });

              remainingToAssign = 0;
            } else {
              throw new Error(`Inconsistencia de stock por lotes para "${itemData.productName}". Faltaron asignar ${remainingToAssign} unidades en lotes.`);
            }
          }

          // Vincular el primer lote al movimiento de stock original para trazabilidad
          const originalMov = await tx.stockMovement.findFirst({
            where: {
              productId: itemData.productId,
              referenceId: `FAC-${order.id}`,
              productLotId: null
            }
          });
          if (originalMov) {
            const firstAssignedLot = activeLots.length > 0 ? activeLots[0].id : (await tx.productLot.findFirst({ where: { productId: itemData.productId, lotNumber: 'S/L' } }))?.id;
            if (firstAssignedLot) {
              await tx.stockMovement.update({
                where: { id: originalMov.id },
                data: { productLotId: firstAssignedLot, orderId: order.id }
              });
            }
          }
        }

        // Registrar percepción IIBB si corresponde
        if (percepIIBB > 0) {
          await tx.taxWithholding.create({
            data: {
              type: 'PERCEPCION_PRACTICADA',
              taxType: 'IIBB',
              personaId,
              number: finalInvoiceNumber || `FAC-${order.id}`,
              date: new Date(),
              amount: isFacturaA_Official ? Number(percepIIBB.toFixed(2)) : Math.round(percepIIBB),
              jurisdiction: getJurisdictionCode(persona.province || persona.address),
            },
          });
        }

        // Registrar percepción IVA RG 5329 si corresponde
        if (percepIVA > 0) {
          await tx.taxWithholding.create({
            data: {
              type: 'PERCEPCION_PRACTICADA',
              taxType: 'IVA',
              personaId,
              number: finalInvoiceNumber || `FAC-${order.id}`,
              date: new Date(),
              amount: isFacturaA_Official ? Number(percepIVA.toFixed(2)) : Math.round(percepIVA),
              jurisdiction: null,
            },
          });
        }

        // Cobro en caja (si se pagó en el acto) o registro en Cuenta Corriente
        if (paymentMethod) {
          let cashDrawerId: number | undefined = undefined;
          let bankAccountIdVal: number | undefined = undefined;
          let txAmount = totalSum;
          let txDescription = `Cobro en el acto de factura directa #${order.id} (${finalInvoiceNumber})`;

          if (paymentMethod === PaymentMethod.CASH) {
            let activeDrawer;
            if (explicitCashDrawerId) {
              activeDrawer = await tx.cashDrawer.findFirst({
                where: {
                  id: explicitCashDrawerId,
                  status: 'OPEN',
                },
              });
            } else {
              activeDrawer = await tx.cashDrawer.findFirst({
                where: {
                  userId: adminId,
                  status: 'OPEN',
                },
              });
            }
            
            if (!activeDrawer) {
              if (userRole === Role.ADMIN || userRole === Role.FACTURACION) {
                cashDrawerId = undefined;
              } else {
                throw new Error(`Debe abrir la Caja o seleccionar una caja operativa válida antes de registrar cobros en efectivo.`);
              }
            } else {
              cashDrawerId = activeDrawer.id;
            }
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
              verified: true,
            },
          });
        } else {
          // C/C saldo deudor
          await tx.persona.update({
            where: { id: personaId },
            data: { outstandingBalance: { increment: totalSum } },
          });
        }

        // Retornar la orden oficial completa que ya tenemos guardada en db
        const finalOrder = await tx.order.findUnique({
          where: { id: order.id },
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
        entityId: order.id,
        newValues: {
          billingType,
          invoiceNumber: finalInvoiceNumber,
          cae: finalCae,
          total: totalSum,
        },
      });

      res.status(200).json({
        status: 'success',
        data: { order: result },
      });
    } catch (secondaryError: any) {
      console.error('❌ Error en el flujo secundario de facturación directa:', secondaryError.message);
      try {
        await prisma.order.update({
          where: { id: order.id },
          data: {
            notes: (order.notes ? order.notes + ' | ' : '') + `[ALERTA AFIP] CAE ${finalCae} emitido pero falló imputación de stock/caja: ${secondaryError.message}. Conciliar manualmente.`
          }
        });
      } catch (noteErr) {
        console.error('No se pudo guardar la nota de alerta en la orden directa:', noteErr);
      }
      res.status(400).json({
        status: 'error',
        message: `La factura oficial fue emitida con éxito (Nro: ${finalInvoiceNumber}, CAE: ${finalCae}). Sin embargo, ocurrió un error al registrar las transacciones financieras o el stock de lotes: ${secondaryError.message}. El comprobante fue registrado con una alerta contable para su conciliación manual.`
      });
    }
  } catch (error: any) {
    console.error('Error al emitir factura directa:', error.message);
    res.status(400).json({
      status: 'error',
      message: error.message || 'Error al emitir factura directa.',
    });
  }
}

/**
 * Solicitar CAE a AFIP para un pedido pre-facturado (flujo diferido IDUO)
 */
export async function requestCaeForOrder(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const adminId = req.user?.id;
  const userRole = req.user?.role;

  if (!adminId || (userRole !== Role.ADMIN && userRole !== Role.FACTURACION)) {
    res.status(403).json({ status: 'error', message: 'Acceso denegado.' });
    return;
  }

  try {
    const order = await prisma.order.findUnique({
      where: { id: Number(id) },
      include: { persona: true }
    });

    if (!order) {
      res.status(404).json({ status: 'error', message: 'Pedido no encontrado.' });
      return;
    }

    if (order.cae) {
      res.status(400).json({ status: 'error', message: `Este pedido ya posee CAE asignado (CAE: ${order.cae}).` });
      return;
    }

    if (order.billingType !== BillingType.OFFICIAL) {
      res.status(400).json({ status: 'error', message: 'Solo se puede solicitar CAE para comprobantes de Sucursal A (Oficial).' });
      return;
    }

    const cuitLimpio = (order.persona.cuit || '').replace(/\D/g, '');
    const isFacturaA = order.invoiceType === InvoiceType.FACTURA_A;
    const docType = (cuitLimpio.length === 11) ? 80 : 96;

    const afipRes = await emitirFacturaAFIP({
      clientCuit: cuitLimpio || '20000000001',
      clientDocType: docType,
      invoiceType: isFacturaA ? 'A' : 'B',
      total: Number(order.totalAmount),
      neto: Number(order.netAmount || 0),
      iva: Number(order.taxAmount || 0),
      percepcionAmount: Number(order.percepcionAmount || 0),
      percepcionIvaAmount: Number(order.percepcionIvaAmount || 0),
    });

    const updated = await prisma.order.update({
      where: { id: order.id },
      data: {
        invoiceNumber: afipRes.invoiceNumber,
        cae: afipRes.cae,
        caeDueDate: afipRes.caeDueDate ? new Date(afipRes.caeDueDate) : null,
      },
      include: { items: { include: { product: true } }, persona: true }
    });

    res.json({
      status: 'success',
      message: `CAE asignado correctamente por AFIP/ARCA (N° ${afipRes.invoiceNumber}, CAE: ${afipRes.cae}).`,
      data: updated
    });
  } catch (err: any) {
    res.status(400).json({ status: 'error', message: `Error AFIP al solicitar CAE: ${err.message}` });
  }
}

