import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { PrismaClient, TransactionType, PaymentMethod, BillingType } from '@prisma/client';

const prisma = new PrismaClient();

// Helper para generar números de recibo
const generateReceiptNumber = async (): Promise<string> => {
  const lastTx = await prisma.transaction.findFirst({
    where: { receiptNumber: { not: null } },
    orderBy: { id: 'desc' }
  });
  
  let nextNum = 1;
  if (lastTx?.receiptNumber) {
    const parts = lastTx.receiptNumber.split('-');
    if (parts.length === 2) {
      nextNum = parseInt(parts[1], 10) + 1;
    }
  }
  
  return `REC-${nextNum.toString().padStart(8, '0')}`;
};

export const getPendingCollections = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    // Aquí buscaríamos las cuentas corrientes con saldo deudor o pedidos pendientes.
    // Simplificando, devolvemos las Personas con saldo > 0.
    const personas = await prisma.persona.findMany({
      where: {
        outstandingBalance: { gt: 0 }
        // Se podría filtrar por zona, ruta, o cliente asignado al vendedor
      },
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
    if (!userId) {
      return res.status(401).json({ error: 'No autorizado' });
    }

    const { personaId, amount, paymentMethod, billingType, description } = req.body;

    if (!personaId || !amount || !paymentMethod || !billingType) {
      return res.status(400).json({ error: 'Faltan datos requeridos' });
    }

    const receiptNumber = await generateReceiptNumber();

    // Crear la transacción de tipo INCOME
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        personaId,
        billingType: billingType as BillingType,
        type: TransactionType.INCOME,
        paymentMethod: paymentMethod as PaymentMethod,
        amount: amount,
        description: description || `Cobro generado vía móvil a cliente ${personaId}`,
        receiptNumber,
        verified: false // Pendiente de rendición
      },
      include: {
        persona: true
      }
    });

    // Actualizar cuenta corriente del cliente (disminuir deuda)
    // El balance positivo significa que el cliente nos debe.
    await prisma.persona.update({
      where: { id: personaId },
      data: {
        outstandingBalance: { decrement: amount }
      }
    });

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
      sellers: Object.values(sellersGroup),
      routes: Object.values(routesGroup)
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
    const { sellerId, routeId, realCash, realChecks } = req.body;

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
          order: true
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

    // Crear la caja cerrada asociada a esta rendición
    const drawer = await prisma.cashDrawer.create({
      data: {
        userId: adminId,
        branch: branchName,
        openingBalance: 0.00,
        closingBalance: theoreticalClosing,
        realBalance: realTotal,
        status: 'CLOSED',
        openedAt: txs.reduce((min, t) => t.createdAt < min ? t.createdAt : min, txs[0].createdAt),
        closedAt: new Date()
      }
    });

    // Marcar transacciones como verificadas y asociarlas a la caja
    await prisma.$transaction(
      txs.map(t => prisma.transaction.update({
        where: { id: t.id },
        data: {
          verified: true,
          cashDrawerId: drawer.id
        }
      }))
    );

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
      message: 'Rendición y arqueo completados con éxito. Fondos transferidos a la Caja Grande.',
      drawer,
      difference: realTotal - theoreticalClosing
    });

  } catch (error) {
    console.error('Error al verificar rendición:', error);
    res.status(500).json({ error: 'Error interno del servidor al procesar la rendición.' });
  }
};
