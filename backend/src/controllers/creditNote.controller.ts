import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { Role, BillingType, MovementType } from '@prisma/client';
import { emitirNotaCreditoAFIP } from '../services/afip.service';
import { logAudit } from '../utils/audit';

/**
 * Obtener listado de Notas de Crédito
 */
export async function getCreditNotes(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { startDate, endDate, query } = req.query;

  try {
    const whereClause: any = {};

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(String(startDate)),
        lte: new Date(String(endDate)),
      };
    }

    if (query) {
      whereClause.OR = [
        { creditNoteNumber: { contains: String(query), mode: 'insensitive' } },
        { persona: { name: { contains: String(query), mode: 'insensitive' } } },
        { persona: { cuit: { contains: String(query) } } },
      ];
    }

    const creditNotes = await prisma.creditNote.findMany({
      where: whereClause,
      include: {
        persona: true,
        user: { select: { id: true, username: true } },
        order: { select: { id: true, invoiceNumber: true } },
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
      data: { creditNotes },
    });
  } catch (error: any) {
    console.error('Error al obtener notas de crédito:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener las notas de crédito.',
    });
  }
}

/**
 * Crear una nueva Nota de Crédito
 */
export async function createCreditNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { personaId, orderId, billingType, reason, comments, items } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  if (!personaId || !reason || !items || !Array.isArray(items) || items.length === 0) {
    res.status(400).json({ status: 'error', message: 'Los campos personaId, reason y al menos un ítem son obligatorios.' });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Validar cliente
      const persona = await tx.persona.findUnique({
        where: { id: Number(personaId) },
      });

      if (!persona) {
        throw new Error('El cliente seleccionado no existe.');
      }

      // Validar y sobreescribir billingType si hay orden/factura vinculada
      let finalBillingType = billingType;
      if (orderId) {
        const linkedOrder = await tx.order.findUnique({
          where: { id: Number(orderId) },
        });
        if (linkedOrder) {
          finalBillingType = linkedOrder.billingType;
        }
      }

      // 2. Calcular montos
      let totalAmount = 0;
      for (const item of items) {
        if (!item.productId || !item.quantity || Number(item.quantity) <= 0 || !item.unitPrice || Number(item.unitPrice) < 0) {
          throw new Error('Los ítems del comprobante tienen valores inválidos.');
        }

        const product = await tx.product.findUnique({
          where: { id: Number(item.productId) }
        });
        if (!product) {
          throw new Error(`El producto con ID ${item.productId} no existe.`);
        }

        const isPesable = product.isPesable;
        const actualQtyOrWeight = isPesable
          ? (item.weight ? Number(item.weight) : Number(item.quantity) * Number(product.approximateWeight || 1))
          : Number(item.quantity);

        totalAmount += Math.round(actualQtyOrWeight * Number(item.unitPrice));
      }

      const isA = finalBillingType === 'OFFICIAL' && persona.cuit && persona.cuit.replace(/-/g, '').length === 11;
      let netAmount = isA ? (totalAmount / 1.21) : Math.round(totalAmount / 1.21);
      let taxAmount = isA ? (totalAmount - netAmount) : (totalAmount - netAmount);

      // 3. Determinar tipo de Nota de Crédito
      let creditNoteType = 'NOTA_CREDITO_INTERNA';
      let creditNoteNumber = null;
      let cae = null;
      let caeDueDate = null;

      if (finalBillingType === 'OFFICIAL') {
        const cuitLimpio = persona.cuit ? persona.cuit.replace(/-/g, '') : '';
        let docType = 99; // Consumidor Final
        let isA = false;

        if (cuitLimpio.length === 11) {
          docType = 80;
          isA = true;
          creditNoteType = 'NOTA_CREDITO_A';
        } else if (cuitLimpio.length === 7 || cuitLimpio.length === 8) {
          docType = 96;
          creditNoteType = 'NOTA_CREDITO_B';
        } else {
          creditNoteType = 'NOTA_CREDITO_B';
        }

        // Llamar a AFIP (o mock)
        const afipRes = await emitirNotaCreditoAFIP({
          clientCuit: cuitLimpio,
          clientDocType: docType,
          invoiceType: isA ? 'A' : 'B',
          total: totalAmount,
        });

        creditNoteNumber = afipRes.invoiceNumber;
        cae = afipRes.cae;
        caeDueDate = afipRes.caeDueDate;
      } else {
        // Interna: generamos un número interno secuencial
        const count = await tx.creditNote.count({
          where: { billingType: 'INTERNAL' },
        });
        creditNoteNumber = `NCI-${(count + 1).toString().padStart(8, '0')}`;
      }

      // 4. Crear la Nota de Crédito en DB
      const creditNote = await tx.creditNote.create({
        data: {
          personaId: Number(personaId),
          orderId: orderId ? Number(orderId) : null,
          userId,
          billingType: finalBillingType as BillingType,
          creditNoteType,
          creditNoteNumber,
          cae,
          caeDueDate,
          totalAmount,
          netAmount,
          taxAmount,
          reason,
          comments,
        },
      });

      // 5. Crear ítems
      for (const item of items) {
        const product = await tx.product.findUnique({
          where: { id: Number(item.productId) }
        });
        if (!product) {
          throw new Error(`El producto con ID ${item.productId} no existe.`);
        }
        const isPesable = product.isPesable;
        const actualQtyOrWeight = isPesable
          ? (item.weight ? Number(item.weight) : Number(item.quantity) * Number(product.approximateWeight || 1))
          : Number(item.quantity);

        await tx.creditNoteItem.create({
          data: {
            creditNoteId: creditNote.id,
            productId: Number(item.productId),
            quantity: Number(item.quantity),
            weight: isPesable ? actualQtyOrWeight : null,
            unitPrice: Number(item.unitPrice),
            subtotal: Math.round(actualQtyOrWeight * Number(item.unitPrice)),
          },
        });

        // 6. Si es devolución física, ingresar stock e impactar en movimientos de stock y lotes
        if (reason === 'DEVOLUCION') {
          // Actualizar stock general del producto
          await tx.product.update({
            where: { id: Number(item.productId) },
            data: {
              stock: {
                increment: Number(item.quantity),
              },
            },
          });

          // Si hay lotes involucrados en la factura vinculada, intentamos devolver a ese lote.
          let assignedLotId: number | null = null;
          if (orderId) {
            const orderItem = await tx.orderItem.findFirst({
              where: {
                orderId: Number(orderId),
                productId: Number(item.productId),
              },
              include: {
                orderItemLots: true,
              },
            });

            if (orderItem && orderItem.orderItemLots.length > 0) {
              const firstLot = orderItem.orderItemLots[0];
              await tx.productLot.update({
                where: { id: firstLot.productLotId },
                data: {
                  stock: {
                    increment: Number(item.quantity),
                  },
                },
              });
              assignedLotId = firstLot.productLotId;
            }
          }

          // Fallback: Si no pudimos asociar a un lote de la factura (o no hay factura),
          // buscamos el lote 'S/L' o el primero existente del producto.
          if (!assignedLotId) {
            let defaultLot = await tx.productLot.findFirst({
              where: { productId: Number(item.productId), lotNumber: 'S/L' }
            });

            if (!defaultLot) {
              defaultLot = await tx.productLot.findFirst({
                where: { productId: Number(item.productId) },
                orderBy: { id: 'asc' }
              });
            }

            if (defaultLot) {
              await tx.productLot.update({
                where: { id: defaultLot.id },
                data: {
                  stock: {
                    increment: Number(item.quantity),
                  },
                },
              });
              assignedLotId = defaultLot.id;
            } else {
              // Si el producto no tiene absolutamente ningún lote registrado, creamos uno de contingencia
              const newLot = await tx.productLot.create({
                data: {
                  productId: Number(item.productId),
                  lotNumber: 'S/L',
                  expirationDate: new Date('2036-12-31T00:00:00Z'),
                  stock: Number(item.quantity)
                }
              });
              assignedLotId = newLot.id;
            }
          }

          // Registrar movimiento de stock
          await tx.stockMovement.create({
            data: {
              productId: Number(item.productId),
              quantity: Number(item.quantity),
              type: MovementType.IN,
              referenceId: `NC-${creditNote.id}`,
              userId,
              reason: `Devolución del cliente: ${persona.name} (NC #${creditNoteNumber})`,
              productLotId: assignedLotId,
            },
          });
        }
      }

      // 7. Decrementar el saldo pendiente en la cuenta corriente del cliente
      await tx.persona.update({
        where: { id: Number(personaId) },
        data: {
          outstandingBalance: {
            decrement: totalAmount,
          },
        },
      });

      return creditNote;
    });

    // Auditoría fuera de la transacción
    await logAudit({
      userId,
      action: 'CREATE_CREDIT_NOTE',
      entityType: 'CreditNote',
      entityId: result.id,
      newValues: result,
    });

    res.status(201).json({
      status: 'success',
      data: { creditNote: result },
    });
  } catch (error: any) {
    console.error('Error al emitir nota de crédito:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al guardar la nota de crédito.',
    });
  }
}

/**
 * Obtener detalles de una Nota de Crédito específica por ID.
 */
export async function getCreditNoteById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const creditNote = await prisma.creditNote.findUnique({
      where: { id: Number(id) },
      include: {
        persona: true,
        user: { select: { id: true, username: true } },
        order: { select: { id: true, invoiceNumber: true } },
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!creditNote) {
      res.status(404).json({ status: 'error', message: 'Nota de crédito no encontrada.' });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: { creditNote },
    });
  } catch (error: any) {
    console.error('Error al obtener la nota de crédito por ID:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la nota de crédito.',
    });
  }
}

