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

// ADMINISTRACIÓN: Ver las rendiciones pendientes por Vendedor
export const getPendingRendiciones = async (req: AuthenticatedRequest, res: Response) => {
  try {
    // Buscar todas las transacciones de ingreso (Cobros) que no estén verificadas
    const pendingTransactions = await prisma.transaction.findMany({
      where: {
        type: TransactionType.INCOME,
        verified: false,
        receiptNumber: { not: null } // Solo recibos móviles
      },
      include: {
        user: { select: { id: true, username: true, role: true } },
        persona: { select: { id: true, name: true } }
      }
    });

    // Agrupar por usuario (vendedor)
    const grouped = pendingTransactions.reduce((acc: any, tx) => {
      if (!acc[tx.userId]) {
        acc[tx.userId] = {
          user: tx.user,
          totalToCollect: 0,
          totalBranchA: 0,
          totalBranchX: 0,
          transactions: []
        };
      }
      
      const amount = Number(tx.amount);
      acc[tx.userId].totalToCollect += amount;
      
      if (tx.billingType === BillingType.OFFICIAL) {
        acc[tx.userId].totalBranchA += amount;
      } else {
        acc[tx.userId].totalBranchX += amount;
      }
      
      acc[tx.userId].transactions.push(tx);
      
      return acc;
    }, {});

    res.json(Object.values(grouped));
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener rendiciones pendientes' });
  }
};

// ADMINISTRACIÓN: Verificar y cerrar rendición
export const verifyRendicion = async (req: AuthenticatedRequest, res: Response) => {
  try {
    const adminId = req.user?.id;
    const { sellerId } = req.body;

    if (!sellerId) {
      return res.status(400).json({ error: 'Falta sellerId' });
    }

    // Actualizar todas las transacciones pendientes de ese vendedor
    const result = await prisma.transaction.updateMany({
      where: {
        userId: sellerId,
        type: TransactionType.INCOME,
        verified: false,
        receiptNumber: { not: null }
      },
      data: {
        verified: true
        // El dinero pasa contablemente a estar "en la caja principal" al estar verified=true.
        // Opcional: Podríamos vincularlo a un cashDrawerId de la "Caja Grande" si existiera lógica.
      }
    });

    await prisma.auditLog.create({
      data: {
        userId: adminId!,
        action: 'VERIFY_RENDICION',
        entityType: 'User',
        entityId: sellerId,
        newValues: { transactionsVerified: result.count }
      }
    });

    res.json({ message: 'Rendición verificada exitosamente', count: result.count });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al verificar rendición' });
  }
};
