import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { Role, BillingType, MovementType, CreditNoteStatus } from '@prisma/client';
import { emitirNotaCreditoAFIP } from '../services/afip.service';
import { logAudit } from '../utils/audit';

/**
 * Obtener listado de Notas de Crédito
 */
export async function getCreditNotes(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { startDate, endDate, query, status } = req.query;

  try {
    const whereClause: any = {};

    if (startDate && endDate) {
      whereClause.createdAt = {
        gte: new Date(String(startDate)),
        lte: new Date(String(endDate)),
      };
    }

    if (status) {
      whereClause.status = status as CreditNoteStatus;
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
    // 1. Validar cliente
    const persona = await prisma.persona.findUnique({
      where: { id: Number(personaId) },
    });

    if (!persona) {
      res.status(404).json({ status: 'error', message: 'El cliente seleccionado no existe.' });
      return;
    }

    // Validar y sobreescribir billingType si hay orden/factura vinculada
    let finalBillingType = billingType;
    if (orderId) {
      const linkedOrder = await prisma.order.findUnique({
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
        res.status(400).json({ status: 'error', message: 'Los ítems del comprobante tienen valores inválidos.' });
        return;
      }

      const product = await prisma.product.findUnique({
        where: { id: Number(item.productId) }
      });
      if (!product) {
        res.status(400).json({ status: 'error', message: `El producto con ID ${item.productId} no existe.` });
        return;
      }

      const isPesable = product.isPesable;
      const actualQtyOrWeight = isPesable
        ? (item.weight ? Number(item.weight) : Number(item.quantity) * Number(product.approximateWeight || 1))
        : Number(item.quantity);

      totalAmount += Math.round(actualQtyOrWeight * Number(item.unitPrice));
    }

    const isOfficial = finalBillingType === 'OFFICIAL';
    let netAmount = isOfficial ? Number((totalAmount / 1.21).toFixed(2)) : Math.round(totalAmount / 1.21);
    let taxAmount = isOfficial ? Number((totalAmount - netAmount).toFixed(2)) : (totalAmount - netAmount);

    // 3. Determinar tipo de Nota de Crédito y Estado
    let creditNoteType = 'NOTA_CREDITO_INTERNA';
    let creditNoteNumber: string | null = null;
    let cae: string | null = null;
    let caeDueDate: Date | null = null;

    const isAdmin = req.user?.role === Role.ADMIN;
    const finalStatus = isAdmin ? CreditNoteStatus.APPROVED : CreditNoteStatus.PENDING_APPROVAL;

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

      // Solo emitir por AFIP si es ADMIN (ya aprobada)
      if (isAdmin) {
        try {
          const afipRes = await emitirNotaCreditoAFIP({
            clientCuit: cuitLimpio,
            clientDocType: docType,
            invoiceType: isA ? 'A' : 'B',
            total: totalAmount,
          });

          creditNoteNumber = afipRes.invoiceNumber;
          cae = afipRes.cae;
          caeDueDate = afipRes.caeDueDate;
        } catch (err: any) {
          res.status(400).json({ status: 'error', message: `Error AFIP al emitir nota de crédito: ${err.message}` });
          return;
        }
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      // Solo generar número interno si es ADMIN (ya aprobada) y no es oficial
      if (finalBillingType !== 'OFFICIAL' && isAdmin) {
        const count = await tx.creditNote.count({
          where: { billingType: 'INTERNAL', status: CreditNoteStatus.APPROVED },
        });
        creditNoteNumber = `NCI-${(count + 1).toString().padStart(8, '0')}`;
      }

      // 4. Crear la Nota de Crédito en DB
      const creditNote = await tx.creditNote.create({
        data: {
          personaId: Number(personaId),
          orderId: orderId ? Number(orderId) : null,
          userId,
          status: finalStatus,
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
      }

      // 6 y 7. Afectar stock y saldo corriente SOLO si es ADMIN (ya aprobada)
      if (isAdmin) {
        for (const item of items) {
          const product = await tx.product.findUnique({
            where: { id: Number(item.productId) }
          });
          if (!product) continue;
          
          const isPesable = product.isPesable;
          const actualQtyOrWeight = isPesable
            ? (item.weight ? Number(item.weight) : Number(item.quantity) * Number(product.approximateWeight || 1))
            : Number(item.quantity);

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

            // Si hay lotes involucrados en la factura vinculada, intentamos devolver proporcionalmente a esos lotes.
            let assignedLotId: number | null = null;
            let remainingToReturn = Number(item.quantity);

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
                // Asignar proporcionalmente a los lotes originales del pedido
                for (const oil of orderItem.orderItemLots) {
                  if (remainingToReturn <= 0) break;
                  
                  const toReturn = Math.min(oil.quantity, remainingToReturn);
                  if (toReturn > 0) {
                    await tx.productLot.update({
                      where: { id: oil.productLotId },
                      data: {
                        stock: {
                          increment: toReturn,
                        },
                      },
                    });
                    remainingToReturn -= toReturn;
                    if (!assignedLotId) {
                      assignedLotId = oil.productLotId;
                    }
                  }
                }

                // Si queda remanente (ej. se devolvió más cantidad), sumarlo al primer lote
                if (remainingToReturn > 0) {
                  const firstLot = orderItem.orderItemLots[0];
                  await tx.productLot.update({
                    where: { id: firstLot.productLotId },
                    data: {
                      stock: {
                        increment: remainingToReturn,
                      },
                    },
                  });
                  remainingToReturn = 0;
                  if (!assignedLotId) {
                    assignedLotId = firstLot.productLotId;
                  }
                }
              }
            }

            // Fallback: Si no pudimos asociar a ningún lote de la factura (o no hay factura o queda remanente),
            // buscamos el lote 'S/L' o el primero existente del producto.
            if (!assignedLotId || remainingToReturn > 0) {
              const qtyToIncrement = remainingToReturn > 0 ? remainingToReturn : Number(item.quantity);
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
                      increment: qtyToIncrement,
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
                    stock: qtyToIncrement
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

        // Decrementar el saldo pendiente en la cuenta corriente del cliente
        await tx.persona.update({
          where: { id: Number(personaId) },
          data: {
            outstandingBalance: {
              decrement: totalAmount,
            },
          },
        });
      }

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

/**
 * Autorizar una Nota de Crédito Pendiente (Solo ADMIN)
 */
export async function approveCreditNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const adminId = req.user?.id;

  if (!adminId || req.user?.role !== Role.ADMIN) {
    res.status(403).json({ status: 'error', message: 'No autorizado. Solo los administradores pueden aprobar notas de crédito.' });
    return;
  }

  try {
    // 1. Obtener nota de crédito con ítems y cliente
    const creditNote = await prisma.creditNote.findUnique({
      where: { id: Number(id) },
      include: {
        persona: true,
        items: true,
      },
    });

    if (!creditNote) {
      res.status(404).json({ status: 'error', message: 'Nota de crédito no encontrada.' });
      return;
    }

    if (creditNote.status !== CreditNoteStatus.PENDING_APPROVAL) {
      res.status(400).json({ status: 'error', message: 'La nota de crédito no está pendiente de aprobación.' });
      return;
    }

    let creditNoteNumber: string | null = null;
    let cae: string | null = null;
    let caeDueDate: Date | null = null;
    const totalAmount = Number(creditNote.totalAmount);
    const isOfficial = creditNote.billingType === 'OFFICIAL';

    // Validar existencia de todos los productos antes de llamar a la AFIP
    for (const item of creditNote.items) {
      const product = await prisma.product.findUnique({
        where: { id: item.productId }
      });
      if (!product) {
        res.status(400).json({ status: 'error', message: `El producto ID ${item.productId} de la nota de crédito ya no existe en el sistema.` });
        return;
      }
    }

    // 2. Facturación oficial AFIP / Interna fuera de la transacción de DB
    if (isOfficial) {
      try {
        const cuitLimpio = creditNote.persona.cuit ? creditNote.persona.cuit.replace(/-/g, '') : '';
        let docType = cuitLimpio.length === 11 ? 80 : (cuitLimpio.length === 7 || cuitLimpio.length === 8 ? 96 : 99);
        const isA = cuitLimpio.length === 11;

        const afipRes = await emitirNotaCreditoAFIP({
          clientCuit: cuitLimpio,
          clientDocType: docType,
          invoiceType: isA ? 'A' : 'B',
          total: totalAmount,
        });

        creditNoteNumber = afipRes.invoiceNumber;
        cae = afipRes.cae;
        caeDueDate = afipRes.caeDueDate;
      } catch (err: any) {
        res.status(400).json({ status: 'error', message: `Error AFIP al aprobar nota de crédito: ${err.message}` });
        return;
      }
    }

    const result = await prisma.$transaction(async (tx) => {
      if (!isOfficial) {
        const count = await tx.creditNote.count({
          where: { billingType: 'INTERNAL', status: CreditNoteStatus.APPROVED },
        });
        creditNoteNumber = `NCI-${(count + 1).toString().padStart(8, '0')}`;
      }

      // 3. Procesar ítems, stock y movimientos
      for (const item of creditNote.items) {
        const product = await tx.product.findUnique({
          where: { id: item.productId }
        });
        if (!product) continue;

        const isPesable = product.isPesable;
        const actualQtyOrWeight = isPesable
          ? (item.weight ? Number(item.weight) : Number(item.quantity) * Number(product.approximateWeight || 1))
          : Number(item.quantity);

        if (creditNote.reason === 'DEVOLUCION') {
          // Incrementar stock general del producto
          await tx.product.update({
            where: { id: item.productId },
            data: {
              stock: {
                increment: item.quantity,
              },
            },
          });

          let assignedLotId: number | null = null;
          let remainingToReturn = item.quantity;

          if (creditNote.orderId) {
            const orderItem = await tx.orderItem.findFirst({
              where: {
                orderId: creditNote.orderId,
                productId: item.productId,
              },
              include: {
                orderItemLots: true,
              },
            });

            if (orderItem && orderItem.orderItemLots.length > 0) {
              for (const oil of orderItem.orderItemLots) {
                if (remainingToReturn <= 0) break;
                
                const toReturn = Math.min(oil.quantity, remainingToReturn);
                if (toReturn > 0) {
                  await tx.productLot.update({
                    where: { id: oil.productLotId },
                    data: {
                      stock: {
                        increment: toReturn,
                      },
                    },
                  });
                  remainingToReturn -= toReturn;
                  if (!assignedLotId) {
                    assignedLotId = oil.productLotId;
                  }
                }
              }

              if (remainingToReturn > 0) {
                const firstLot = orderItem.orderItemLots[0];
                await tx.productLot.update({
                  where: { id: firstLot.productLotId },
                  data: {
                    stock: {
                      increment: remainingToReturn,
                    },
                  },
                });
                remainingToReturn = 0;
                if (!assignedLotId) {
                  assignedLotId = firstLot.productLotId;
                }
              }
            }
          }

          if (!assignedLotId || remainingToReturn > 0) {
            const qtyToIncrement = remainingToReturn > 0 ? remainingToReturn : item.quantity;
            let defaultLot = await tx.productLot.findFirst({
              where: { productId: item.productId, lotNumber: 'S/L' }
            });

            if (!defaultLot) {
              defaultLot = await tx.productLot.findFirst({
                where: { productId: item.productId },
                orderBy: { id: 'asc' }
              });
            }

            if (defaultLot) {
              await tx.productLot.update({
                where: { id: defaultLot.id },
                data: {
                  stock: {
                    increment: qtyToIncrement,
                  },
                },
              });
              assignedLotId = defaultLot.id;
            } else {
              const newLot = await tx.productLot.create({
                data: {
                  productId: item.productId,
                  lotNumber: 'S/L',
                  expirationDate: new Date('2036-12-31T00:00:00Z'),
                  stock: qtyToIncrement
                }
              });
              assignedLotId = newLot.id;
            }
          }

          // Registrar movimiento de stock
          await tx.stockMovement.create({
            data: {
              productId: item.productId,
              quantity: item.quantity,
              type: MovementType.IN,
              referenceId: `NC-${creditNote.id}`,
              userId: adminId,
              reason: `Devolución (Aprobación NC #${creditNoteNumber})`,
              productLotId: assignedLotId,
            },
          });
        }
      }

      // 4. Decrementar saldo de cuenta corriente del cliente
      await tx.persona.update({
        where: { id: creditNote.personaId },
        data: {
          outstandingBalance: {
            decrement: totalAmount,
          },
        },
      });

      // 5. Actualizar la Nota de Crédito en DB
      const updated = await tx.creditNote.update({
        where: { id: creditNote.id },
        data: {
          status: CreditNoteStatus.APPROVED,
          creditNoteNumber,
          cae,
          caeDueDate,
        },
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

      return updated;
    });

    // Registrar auditoría fuera de la transacción
    await logAudit({
      userId: adminId,
      action: 'APPROVE_CREDIT_NOTE',
      entityType: 'CreditNote',
      entityId: result.id,
      newValues: result,
    });

    res.status(200).json({
      status: 'success',
      data: { creditNote: result },
    });
  } catch (error: any) {
    console.error('Error al aprobar nota de crédito:', error);
    res.status(500).json({
      status: 'error',
      message: error.message || 'Error al aprobar la nota de crédito.',
    });
  }
}

/**
 * Rechazar una Nota de Crédito Pendiente (Solo ADMIN)
 */
export async function rejectCreditNote(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const adminId = req.user?.id;

  if (!adminId || req.user?.role !== Role.ADMIN) {
    res.status(403).json({ status: 'error', message: 'No autorizado. Solo los administradores pueden rechazar notas de crédito.' });
    return;
  }

  try {
    const creditNote = await prisma.creditNote.findUnique({
      where: { id: Number(id) },
    });

    if (!creditNote) {
      res.status(404).json({ status: 'error', message: 'Nota de crédito no encontrada.' });
      return;
    }

    if (creditNote.status !== CreditNoteStatus.PENDING_APPROVAL) {
      res.status(400).json({ status: 'error', message: 'La nota de crédito no está pendiente de aprobación.' });
      return;
    }

    const updated = await prisma.creditNote.update({
      where: { id: creditNote.id },
      data: {
        status: CreditNoteStatus.REJECTED,
      },
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

    // Registrar auditoría
    await logAudit({
      userId: adminId,
      action: 'REJECT_CREDIT_NOTE',
      entityType: 'CreditNote',
      entityId: updated.id,
      newValues: updated,
    });

    res.status(200).json({
      status: 'success',
      data: { creditNote: updated },
    });
  } catch (error: any) {
    console.error('Error al rechazar nota de crédito:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al rechazar la nota de crédito.',
    });
  }
}


