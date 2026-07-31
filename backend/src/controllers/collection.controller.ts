import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { TransactionType, PaymentMethod, BillingType, Role } from '@prisma/client';
import prisma from '../utils/prisma';

export const getPendingCollections = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const whereClause: any = {
      outstandingBalance: { gt: 0 },
      isActive: true
    };

    if (userRole === Role.VENDEDOR) {
      whereClause.sellerId = userId;
    }

    const personas = await prisma.persona.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        address: true,
        city: true,
        outstandingBalance: true,
        phone: true,
      }
    });

    res.json(personas);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener saldos pendientes' });
  }
};

export const registerCollection = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    const userRole = req.user?.role;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { personaId, amount, paymentMethod, billingType, description, orderId, bankAccountId, checkNumber } = req.body;

    if (!personaId || !amount || !paymentMethod || !billingType) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    // Verificar que el cliente exista y pertenezca al vendedor (si el rol es VENDEDOR)
    const client = await prisma.persona.findUnique({ where: { id: Number(personaId) } });
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    if (userRole === Role.VENDEDOR && client.isClient && client.sellerId !== userId) {
      return res.status(403).json({ error: 'Acceso denegado. No podés registrar cobros para clientes de otros vendedores.' });
    }

    const roundedAmount = Number(Number(amount).toFixed(2));

    // Control de duplicados (Idempotencia)
    const fifteenSecondsAgo = new Date(Date.now() - 15000);
    const duplicateTx = await prisma.transaction.findFirst({
      where: {
        personaId,
        amount: roundedAmount,
        paymentMethod: paymentMethod as PaymentMethod,
        type: TransactionType.INCOME,
        createdAt: {
          gte: fifteenSecondsAgo
        }
      }
    });
    if (duplicateTx) {
      return res.status(400).json({ error: 'Ya se registró un cobro idéntico para este cliente hace instantes.' });
    }

    // Buscar número de factura si se especificó orderId para la descripción
    let orderNumberDesc = '';
    let finalBillingType = billingType;
    if (orderId) {
      const targetOrder = await prisma.order.findUnique({ where: { id: Number(orderId) } });
      if (targetOrder) {
        orderNumberDesc = targetOrder.invoiceNumber || `INT-${targetOrder.id.toString().padStart(5, '0')}`;
        // Forzar que el recibo herede la sucursal de la factura origen
        finalBillingType = targetOrder.billingType;
      }
    }

    const checkInfoStr = checkNumber ? ` (Cheque N° ${checkNumber})` : '';

    // Ejecutar creación de transacción y actualización de saldo de forma atómica
    const transaction = await prisma.$transaction(async (tx) => {
      // Crear transacción inicial sin receiptNumber (se generará a partir del movementId autoincremental de la base de datos)
      const newTx = await tx.transaction.create({
        data: {
          userId,
          personaId,
          billingType: finalBillingType as BillingType,
          type: TransactionType.INCOME,
          paymentMethod: paymentMethod as PaymentMethod,
          amount: roundedAmount,
          description: description 
            ? `${description}${checkInfoStr}` 
            : (orderId 
                ? `Cobro Factura ${orderNumberDesc}${checkInfoStr}` 
                : `Cobro a cliente ${client.name}${checkInfoStr}`),
          receiptNumber: null, // Se asigna abajo
          verified: false, // Pendiente de rendición
          orderId: orderId ? Number(orderId) : null,
          bankAccountId: bankAccountId ? Number(bankAccountId) : null
        }
      });

      const formattedReceiptNumber = `REC-${newTx.movementId.toString().padStart(5, '0')}`;

      // Decrementar el saldo pendiente del cliente de forma inmediata al registrar el cobro
      await tx.persona.update({
        where: { id: Number(personaId) },
        data: {
          outstandingBalance: { decrement: roundedAmount }
        }
      });

      const updatedTx = await tx.transaction.update({
        where: { id: newTx.id },
        data: { receiptNumber: formattedReceiptNumber },
        include: {
          persona: true
        }
      });

      return updatedTx;
    });

    // Simulación del envío de WhatsApp inmediato por el ERP al registrar el cobro
    if (transaction.persona?.phone) {
      const cleanPhone = transaction.persona.phone.replace(/\D/g, '');
      const clientName = transaction.persona.name;
      const receiptLink = `${req.protocol}://${req.get('host')}/recibo/${transaction.id}`;
      console.log(`[WhatsApp ERP Auto-Send] Registro inicial de cobro. Enviando comprobante provisional a ${clientName} (+${cleanPhone}). Mensaje: "Hola ${clientName}! Registramos tu pago por $${transaction.amount}. Comprobante digital provisional: ${receiptLink} (Estado: Pendiente de rendición en administración)"`);
    } else {
      console.log(`[WhatsApp ERP Auto-Send] No se pudo enviar notificación de cobro provisional a ${transaction.persona?.name || 'Cliente'} (ID: ${transaction.personaId}) porque no posee teléfono registrado.`);
    }

    // Audit Log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE_COLLECTION',
        entityType: 'Transaction',
        entityId: transaction.id,
        newValues: JSON.parse(JSON.stringify(transaction))
      }
    });

    res.status(201).json({ message: 'Cobro registrado exitosamente', transaction });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al registrar cobro' });
  }
};

export const getReceipt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const { id } = req.params;
    
    const transaction = await prisma.transaction.findUnique({
      where: { id: parseInt(id as string) },
      include: {
        persona: true,
        user: true,
      }
    });

    if (!transaction || transaction.type !== TransactionType.INCOME) {
      return res.status(404).json({ error: 'Recibo no encontrado' });
    }

    res.json(transaction);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener recibo' });
  }
};

// ADMINISTRACIÓN: Ver las rendiciones pendientes por Vendedor y por Repartidor (Chofer)
export const getPendingRendiciones = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Buscar todas las transacciones de ingreso (Cobros) que no estén verificadas
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        type: TransactionType.INCOME,
        verified: false
      },
      include: {
        user: { select: { id: true, username: true, role: true } },
        persona: { select: { id: true, name: true } },
        order: {
          include: {
            deliveryRoute: true
          }
        }
      }
    });

    const sellersGroup: any = {};
    const routesGroup: any = {};

    for (const tx of pendingTransactions) {
      const route = tx.order?.deliveryRoute;
      const amount = Number(tx.amount);
      const isOfficial = tx.billingType === BillingType.OFFICIAL;
      const method = tx.paymentMethod;

      if (route) {
        if (!routesGroup[route.id]) {
          routesGroup[route.id] = {
            routeId: route.id,
            driverName: route.driverName,
            vehiclePlate: route.vehiclePlate,
            totalToCollect: 0,
            totalBranchA: 0,
            totalBranchX: 0,
            totalCash: 0,
            totalChecks: 0,
            totalTransfers: 0,
            transactions: []
          };
        }
        const g = routesGroup[route.id];
        g.totalToCollect += amount;
        if (isOfficial) g.totalBranchA += amount;
        else g.totalBranchX += amount;

        if (method === PaymentMethod.CASH) g.totalCash += amount;
        else if (method === PaymentMethod.CHECK) g.totalChecks += amount;
        else if (method === PaymentMethod.BANK_TRANSFER) g.totalTransfers += amount;

        g.transactions.push(tx);
      } else {
        const userId = tx.userId;
        if (!sellersGroup[userId]) {
          sellersGroup[userId] = {
            user: tx.user,
            totalToCollect: 0,
            totalBranchA: 0,
            totalBranchX: 0,
            totalCash: 0,
            totalChecks: 0,
            totalTransfers: 0,
            transactions: []
          };
        }
        const g = sellersGroup[userId];
        g.totalToCollect += amount;
        if (isOfficial) g.totalBranchA += amount;
        else g.totalBranchX += amount;

        if (method === PaymentMethod.CASH) g.totalCash += amount;
        else if (method === PaymentMethod.CHECK) g.totalChecks += amount;
        else if (method === PaymentMethod.BANK_TRANSFER) g.totalTransfers += amount;

        g.transactions.push(tx);
      }
    }

    res.json({
      status: 'success',
      data: {
        sellers: Object.values(sellersGroup),
        routes: Object.values(routesGroup)
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener rendiciones pendientes' });
  }
};

// ADMINISTRACIÓN: Verificar y cerrar rendición mediante arqueo de caja
export const verifyRendicion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { sellerId, routeId, realCash, realChecks, destinationDrawerId, routeNote, notes } = req.body;

    if (!adminId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (!sellerId && !routeId) {
      return res.status(400).json({ error: 'Debe especificar sellerId o routeId' });
    }

    const inputCash = Number(realCash || 0);
    const inputChecks = Number(realChecks || 0);

    if (isNaN(inputCash) || inputCash < 0 || isNaN(inputChecks) || inputChecks < 0) {
      return res.status(400).json({ error: 'Montos reales ingresados inválidos' });
    }

    let txs: any[] = [];
    let branchName = '';
    const drawerType = sellerId ? 'VENDEDOR' : 'REPARTIDOR';

    if (sellerId) {
      const sellerUser = await prisma.user.findUnique({
        where: { id: Number(sellerId) }
      });
      if (!sellerUser) {
        return res.status(404).json({ error: 'Vendedor no encontrado' });
      }
      branchName = `VENDEDOR: ${(sellerUser.username).toUpperCase()}`;

      // Buscar transacciones asociadas a este vendedor que NO pertenezcan a una hoja de reparto
      const allSellerTxs = await prisma.transaction.findMany({
        where: {
          userId: Number(sellerId),
          type: TransactionType.INCOME,
          verified: false
        },
        include: {
          order: true,
          persona: true
        }
      });
      txs = allSellerTxs.filter(t => !t.order || t.order.deliveryRouteId === null);

    } else if (routeId) {
      const route = await prisma.deliveryRoute.findUnique({
        where: { id: Number(routeId) }
      });
      if (!route) {
        return res.status(404).json({ error: 'Hoja de ruta no encontrada' });
      }
      branchName = `REPARTIDOR: ${route.driverName} (Ruta #${routeId})`;

      // Buscar transacciones asociadas a esta hoja de reparto
      txs = await prisma.transaction.findMany({
        where: {
          type: TransactionType.INCOME,
          verified: false,
          order: {
            deliveryRouteId: Number(routeId)
          }
        },
        include: {
          persona: true
        }
      });
    }

    if (txs.length === 0) {
      return res.status(400).json({ error: 'No hay transacciones pendientes para verificar' });
    }

    // Calcular el saldo teórico esperado
    let expectedCash = 0;
    let expectedChecks = 0;

    for (const t of txs) {
      const amt = Number(t.amount);
      if (t.paymentMethod === PaymentMethod.CASH) {
        expectedCash += amt;
      } else if (t.paymentMethod === PaymentMethod.CHECK) {
        expectedChecks += amt;
      }
    }

    const theoreticalClosing = expectedCash + expectedChecks;
    const realTotal = inputCash + inputChecks;

    const declaredChecks = req.body.declaredChecks;
    let extraNotes = notes ? String(notes).trim() : '';
    if (declaredChecks && Array.isArray(declaredChecks) && declaredChecks.length > 0) {
      const checksFormatted = declaredChecks.map((c: any) => `N° ${c.number || 'S/N'} (${c.bank || 'Banco'}) $${c.amount}`).join('; ');
      extraNotes += (extraNotes ? ' | ' : '') + `Cheques: ${checksFormatted}`;
    }

    // Crear la caja cerrada asociada a esta rendición
    const drawer = await prisma.cashDrawer.create({
      data: {
        userId: adminId,
        branch: branchName,
        drawerType,
        routeNote: routeNote ? String(routeNote).trim() : null,
        notes: extraNotes || null,
        openingBalance: 0.00,
        closingBalance: theoreticalClosing,
        realBalance: realTotal,
        status: 'CLOSED',
        openedAt: txs.reduce((min, t) => t.createdAt < min ? t.createdAt : min, txs[0].createdAt),
        closedAt: new Date()
      }
    });

    // Marcar transacciones como verificadas, asociarlas a la caja y actualizar saldo bancario si es transferencia
    const defaultBank = await prisma.bankAccount.findFirst();
    const operations: any[] = [];

    // ÚNICAMENTE si se especificó explícitamente una caja de destino abierta y hay efectivo recibido, se genera transferencia
    const targetDrawerId = destinationDrawerId ? Number(destinationDrawerId) : null;

    if (targetDrawerId && inputCash > 0) {
      operations.push(
        prisma.transaction.create({
          data: {
            userId: adminId,
            cashDrawerId: targetDrawerId,
            billingType: BillingType.INTERNAL, // Interna por transferencia
            type: TransactionType.INCOME,
            paymentMethod: PaymentMethod.CASH,
            amount: inputCash,
            description: `Ingreso Rendición de Fondos - ${branchName}`,
            verified: true
          }
        })
      );
    }

    for (const t of txs) {
      if (t.paymentMethod === PaymentMethod.BANK_TRANSFER || t.paymentMethod === PaymentMethod.CHECK) {
        const selectedBankId = t.bankAccountId || defaultBank?.id;
        
        operations.push(
          prisma.transaction.update({
            where: { id: t.id },
            data: {
              verified: true,
              cashDrawerId: drawer.id,
              bankAccountId: selectedBankId
            }
          })
        );

        if (selectedBankId) {
          operations.push(
            prisma.bankAccount.update({
              where: { id: selectedBankId },
              data: {
                balance: { increment: t.amount }
              }
            })
          );
        }
      } else {
        operations.push(
          prisma.transaction.update({
            where: { id: t.id },
            data: {
              verified: true,
              cashDrawerId: drawer.id
            }
          })
        );
      }
    }

    await prisma.$transaction(operations);

    // Mapear recibos verificados para la respuesta y simular WhatsApp del ERP
    const verifiedReceipts = txs.map(t => {
      const formattedReceiptNumber = t.receiptNumber || `REC-${t.movementId.toString().padStart(5, '0')}`;
      const receiptLink = `${req.protocol}://${req.get('host')}/recibo/${t.id}`;
      
      if (t.persona?.phone) {
        const cleanPhone = t.persona.phone.replace(/\D/g, '');
        console.log(`[WhatsApp ERP Auto-Send] Acreditación de Fondos. Enviando recibo verificado a ${t.persona.name} (+${cleanPhone}). Mensaje: "Hola ${t.persona.name}! Tu pago por $${t.amount} ha sido verificado y acreditado formalmente en tu cuenta corriente. Comprobante digital: ${receiptLink} (Estado: Verificado)"`);
      } else {
        console.log(`[WhatsApp ERP Auto-Send] No se pudo enviar notificación de acreditación a ${t.persona?.name || 'Cliente'} (ID: ${t.personaId}) porque no posee teléfono registrado.`);
      }

      return {
        id: t.id,
        receiptNumber: formattedReceiptNumber,
        amount: Number(t.amount),
        paymentMethod: t.paymentMethod,
        clientName: t.persona?.name || 'Cliente Desconocido',
        clientPhone: t.persona?.phone || null,
        billingType: t.billingType
      };
    });

    // Guardar Audit Log
    await prisma.auditLog.create({
      data: {
        userId: adminId,
        action: 'CLOSE_OPERATIVE_DRAWER_RENDICION',
        entityType: 'CashDrawer',
        entityId: drawer.id,
        newValues: {
          branch: branchName,
          expectedCash,
          expectedChecks,
          realCash: inputCash,
          realChecks: inputChecks,
          transactionsCount: txs.length
        }
      }
    });

    res.json({
      status: 'success',
      data: {
        message: 'Rendición y arqueo completados con éxito. Fondos transferidos a la Caja Grande.',
        drawer,
        difference: realTotal - theoreticalClosing,
        verifiedReceipts
      }
    });

  } catch (error) {
    console.error('Error al verificar rendición:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar la rendición.' });
  }
};

export const deleteReceipt = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const userRole = req.user?.role;
    const { id } = req.params;

    if (!adminId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    if (userRole !== Role.ADMIN && userRole !== Role.FACTURACION) {
      return res.status(403).json({ error: 'No tienes permisos para eliminar o anular recibos' });
    }

    const txId = Number(id);
    if (isNaN(txId)) {
      return res.status(400).json({ error: 'ID de recibo inválido' });
    }

    const tx = await prisma.transaction.findUnique({
      where: { id: txId },
      include: { persona: true }
    });

    if (!tx || tx.type !== TransactionType.INCOME) {
      return res.status(404).json({ error: 'Recibo no encontrado' });
    }

    if (tx.verified) {
      return res.status(400).json({ 
        error: 'No se puede eliminar un recibo que ya ha sido verificado y cerrado en una rendición.' 
      });
    }

    const amountToRestore = Number(tx.amount);

    await prisma.$transaction(async (prismaTx) => {
      // 1. Restablecer e incrementar el saldo pendiente del cliente (devuelve la deuda)
      if (tx.personaId) {
        await prismaTx.persona.update({
          where: { id: tx.personaId },
          data: {
            outstandingBalance: { increment: amountToRestore }
          }
        });
      }

      // 2. Eliminar la transacción de la base de datos
      await prismaTx.transaction.delete({
        where: { id: tx.id }
      });

      // 3. Crear registro de auditoría
      await prismaTx.auditLog.create({
        data: {
          userId: adminId,
          action: 'DELETE_COLLECTION_RECEIPT',
          entityType: 'Transaction',
          entityId: tx.id,
          oldValues: {
            receiptNumber: tx.receiptNumber,
            amount: amountToRestore,
            personaId: tx.personaId,
            personaName: tx.persona?.name,
            paymentMethod: tx.paymentMethod,
            billingType: tx.billingType
          }
        }
      });
    });

    res.json({ 
      status: 'success', 
      message: `Recibo ${tx.receiptNumber || 'N° ' + tx.id} eliminado correctamente. Se restableció $${amountToRestore.toLocaleString()} al saldo pendiente del cliente.` 
    });

  } catch (error) {
    console.error('Error al eliminar recibo:', error);
    res.status(500).json({ error: 'Error interno del servidor al eliminar el recibo' });
  }
};

