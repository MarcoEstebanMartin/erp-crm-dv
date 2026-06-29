import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';
import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';

/**
 * Abrir una nueva caja operativa.
 */
export async function openDrawer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { branch, openingBalance } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  const drawerBranch = branch || 'CONSOLIDADA';

  if (openingBalance === undefined || Number(openingBalance) < 0) {
    res.status(400).json({ status: 'error', message: 'El saldo inicial debe ser mayor o igual a cero.' });
    return;
  }

  try {
    // Validar si ya hay una caja abierta para este usuario (cualquier sucursal / consolidada)
    const existing = await prisma.cashDrawer.findFirst({
      where: {
        userId,
        status: 'OPEN',
      },
    });

    if (existing) {
      res.status(400).json({
        status: 'error',
        message: `Ya tenés una caja operativa abierta. Debés cerrarla antes de abrir una nueva.`,
      });
      return;
    }

    const drawer = await prisma.cashDrawer.create({
      data: {
        userId,
        branch: drawerBranch,
        openingBalance: Number(openingBalance),
        status: 'OPEN',
      },
    });

    // Auditoría
    await logAudit({
      userId,
      action: 'OPEN_CASH_DRAWER',
      entityType: 'CashDrawer',
      entityId: drawer.id,
      newValues: drawer,
    });

    res.status(201).json({
      status: 'success',
      data: { drawer },
    });
  } catch (error: any) {
    console.error('Error al abrir caja:', error);
    res.status(500).json({ status: 'error', message: 'Error al abrir la caja operativa.' });
  }
}

/**
 * Cerrar una caja activa y realizar arqueo.
 */
export async function closeDrawer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { drawerId, realBalance } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  if (!drawerId) {
    res.status(400).json({ status: 'error', message: 'El ID de la caja es obligatorio.' });
    return;
  }

  if (realBalance === undefined || Number(realBalance) < 0) {
    res.status(400).json({ status: 'error', message: 'El saldo real contado es obligatorio y no puede ser negativo.' });
    return;
  }

  try {
    const drawer = await prisma.cashDrawer.findUnique({
      where: { id: Number(drawerId) },
    });

    if (!drawer) {
      res.status(404).json({ status: 'error', message: 'Caja no encontrada.' });
      return;
    }

    if (drawer.status === 'CLOSED') {
      res.status(400).json({ status: 'error', message: 'Esta caja ya se encuentra cerrada.' });
      return;
    }

    // Calcular saldo teórico basado en transacciones de la caja
    const transactions = await prisma.transaction.findMany({
      where: { cashDrawerId: drawer.id },
    });

    let cashIncome = 0;
    let cashOutcome = 0;

    transactions.forEach((t) => {
      if (t.type === TransactionType.INCOME) {
        cashIncome += Number(t.amount);
      } else {
        cashOutcome += Number(t.amount);
      }
    });

    const calculatedClosingBalance = Number(drawer.openingBalance) + cashIncome - cashOutcome;

    const closed = await prisma.cashDrawer.update({
      where: { id: drawer.id },
      data: {
        closingBalance: calculatedClosingBalance,
        realBalance: Number(realBalance),
        status: 'CLOSED',
        closedAt: new Date(),
      },
    });

    // Auditoría
    await logAudit({
      userId,
      action: 'CLOSE_CASH_DRAWER',
      entityType: 'CashDrawer',
      entityId: drawer.id,
      oldValues: drawer,
      newValues: closed,
    });

    res.status(200).json({
      status: 'success',
      data: { drawer: closed },
    });
  } catch (error: any) {
    console.error('Error al cerrar caja:', error);
    res.status(500).json({ status: 'error', message: 'Error al cerrar la caja operativa.' });
  }
}

/**
 * Obtener la caja abierta activa de un usuario.
 */
export async function getActiveDrawer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  try {
    const drawer = await prisma.cashDrawer.findFirst({
      where: {
        userId,
        status: 'OPEN',
      },
    });

    res.status(200).json({
      status: 'success',
      data: { drawer },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener la caja activa.' });
  }
}

/**
 * Obtener todas las cajas abiertas activas del usuario (para Sucursal A y X abiertas en paralelo).
 */
export async function getActiveDrawers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  try {
    const drawers = await prisma.cashDrawer.findMany({
      where: {
        userId,
        status: 'OPEN',
      },
    });

    res.status(200).json({
      status: 'success',
      data: { drawers },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener las cajas activas.' });
  }
}

/**
 * Cierre de Caja Conjunto (A + X) para cerrar de forma atómica y conjunta ambas cajas del usuario.
 * Nota: En la versión unificada (Caja Grande), cierra la caja consolidada activa.
 */
export async function closeJointDrawers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { realBalanceA, realBalanceX } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  try {
    // Buscar cajas abiertas del usuario
    const activeDrawers = await prisma.cashDrawer.findMany({
      where: {
        userId,
        status: 'OPEN',
      },
    });

    if (activeDrawers.length === 0) {
      res.status(400).json({ status: 'error', message: 'No se encontraron cajas abiertas para realizar un cierre.' });
      return;
    }

    const closedDrawers = [];

    for (const drawer of activeDrawers) {
      const transactions = await prisma.transaction.findMany({
        where: { cashDrawerId: drawer.id },
      });
      let cashIncome = 0;
      let cashOutcome = 0;
      transactions.forEach((t) => {
        if (t.type === TransactionType.INCOME) cashIncome += Number(t.amount);
        else cashOutcome += Number(t.amount);
      });
      const theoretical = Number(drawer.openingBalance) + cashIncome - cashOutcome;

      // Determinar qué saldo real usar
      let realBalance = theoretical;
      if (drawer.branch === 'A' && realBalanceA !== undefined && realBalanceA !== null) {
        realBalance = Number(realBalanceA);
      } else if (drawer.branch === 'X' && realBalanceX !== undefined && realBalanceX !== null) {
        realBalance = Number(realBalanceX);
      } else if (drawer.branch === 'CONSOLIDADA') {
        realBalance = realBalanceA !== undefined && realBalanceA !== null ? Number(realBalanceA) : 
                     (realBalanceX !== undefined && realBalanceX !== null ? Number(realBalanceX) : theoretical);
      }

      const closed = await prisma.cashDrawer.update({
        where: { id: drawer.id },
        data: {
          closingBalance: theoretical,
          realBalance: realBalance,
          status: 'CLOSED',
          closedAt: new Date(),
        },
      });

      await logAudit({
        userId,
        action: 'CLOSE_CASH_DRAWER',
        entityType: 'CashDrawer',
        entityId: drawer.id,
        oldValues: drawer,
        newValues: closed,
      });

      closedDrawers.push(closed);
    }

    res.status(200).json({
      status: 'success',
      data: { drawers: closedDrawers },
    });
  } catch (error: any) {
    console.error('Error al realizar cierre conjunto:', error);
    res.status(500).json({ status: 'error', message: 'Error al realizar el cierre de caja.' });
  }
}


/**
 * Listado histórico de movimientos financieros con filtros.
 */
export async function getTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { branch, cashDrawerId, bankAccountId, startDate, endDate, paymentMethod, verified } = req.query;

  try {
    const whereClause: any = {};

    if (branch) {
      whereClause.billingType = branch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL;
    }
    if (cashDrawerId) {
      whereClause.cashDrawerId = Number(cashDrawerId);
    }
    if (bankAccountId) {
      whereClause.bankAccountId = Number(bankAccountId);
    }
    if (paymentMethod) {
      whereClause.paymentMethod = String(paymentMethod);
    }
    if (verified !== undefined) {
      whereClause.verified = verified === 'true';
    }

    if (startDate || endDate) {
      whereClause.createdAt = {};
      if (startDate) {
        whereClause.createdAt.gte = new Date(String(startDate));
      }
      if (endDate) {
        whereClause.createdAt.lte = new Date(String(endDate));
      }
    }

    const transactions = await prisma.transaction.findMany({
      where: whereClause,
      include: {
        user: { select: { id: true, username: true } },
        persona: { select: { id: true, name: true, isClient: true, isProvider: true } },
        cashDrawer: true,
        bankAccount: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json({
      status: 'success',
      data: { transactions },
    });
  } catch (error: any) {
    console.error('Error al obtener movimientos de caja:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener el flujo de fondos.' });
  }
}

/**
 * Obtener listado de cuentas bancarias.
 */
export async function getBankAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    let accounts = await prisma.bankAccount.findMany({
      orderBy: { name: 'asc' },
    });

    if (accounts.length === 0) {
      await prisma.bankAccount.createMany({
        data: [
          { name: 'Banco Provincia Corriente', accountNumber: 'CTA-4321/0', balance: 500000.00 },
          { name: 'Mercado Pago Distribuidora', accountNumber: 'CVU-0000003100012345678901', balance: 150000.00 },
          { name: 'QR', accountNumber: 'QR-ARCA', balance: 0.00 },
        ],
      });
      accounts = await prisma.bankAccount.findMany({
        orderBy: { name: 'asc' },
      });
    }

    res.status(200).json({
      status: 'success',
      data: { accounts },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al obtener las cuentas bancarias.' });
  }
}

/**
 * Crear una nueva cuenta bancaria.
 */
export async function createBankAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { name, accountNumber, balance } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  if (!name) {
    res.status(400).json({ status: 'error', message: 'El nombre del banco es obligatorio.' });
    return;
  }

  try {
    const account = await prisma.bankAccount.create({
      data: {
        name,
        accountNumber,
        balance: balance !== undefined ? Number(balance) : 0.00,
      },
    });

    // Auditoría
    await logAudit({
      userId,
      action: 'CREATE_BANK_ACCOUNT',
      entityType: 'BankAccount',
      entityId: account.id,
      newValues: account,
    });

    res.status(201).json({
      status: 'success',
      data: { account },
    });
  } catch (error: any) {
    res.status(500).json({ status: 'error', message: 'Error al crear la cuenta bancaria.' });
  }
}

/**
 * Depositar efectivo de caja a banco.
 */
export async function transferFunds(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { amount, bankAccountId, description } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  if (!amount || Number(amount) <= 0) {
    res.status(400).json({ status: 'error', message: 'El monto de transferencia debe ser mayor a cero.' });
    return;
  }

  if (!bankAccountId) {
    res.status(400).json({ status: 'error', message: 'El banco destino es obligatorio.' });
    return;
  }

  try {
    // Buscar la caja abierta del usuario
    const drawer = await prisma.cashDrawer.findFirst({
      where: {
        userId,
        status: 'OPEN',
      },
    });

    if (!drawer) {
      res.status(400).json({
        status: 'error',
        message: 'No tenés ninguna caja abierta. Abrí una caja antes de transferir efectivo.',
      });
      return;
    }

    const transferAmount = Number(amount);

    const result = await prisma.$transaction(async (tx) => {
      // 1. Crear egreso en la caja física (OUTCOME)
      const outcomeTrans = await tx.transaction.create({
        data: {
          userId,
          billingType: drawer.branch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL,
          type: TransactionType.OUTCOME,
          paymentMethod: PaymentMethod.CASH,
          amount: transferAmount,
          description: description || `Depósito de efectivo a cuenta de banco`,
          cashDrawerId: drawer.id,
        },
      });

      // 2. Crear ingreso en la cuenta bancaria (INCOME)
      const incomeTrans = await tx.transaction.create({
        data: {
          userId,
          billingType: drawer.branch === 'A' ? BillingType.OFFICIAL : BillingType.INTERNAL,
          type: TransactionType.INCOME,
          paymentMethod: PaymentMethod.BANK_TRANSFER,
          amount: transferAmount,
          description: description || `Depósito recibido desde caja`,
          bankAccountId: Number(bankAccountId),
        },
      });

      // 3. Incrementar saldo de la cuenta de banco
      const updatedBank = await tx.bankAccount.update({
        where: { id: Number(bankAccountId) },
        data: {
          balance: {
            increment: transferAmount,
          },
        },
      });

      return { outcomeTrans, incomeTrans, updatedBank };
    });

    // Auditoría
    await logAudit({
      userId,
      action: 'DEPOSIT_CASH_TO_BANK',
      entityType: 'BankAccount',
      entityId: Number(bankAccountId),
      newValues: {
        cashDrawerId: drawer.id,
        amount: transferAmount,
        bankAccountName: result.updatedBank.name,
      },
    });

    res.status(200).json({
      status: 'success',
      data: {
        drawerTransaction: result.outcomeTrans,
        bankTransaction: result.incomeTrans,
        bankAccount: result.updatedBank,
      },
    });
  } catch (error: any) {
    console.error('Error al transferir fondos:', error);
    res.status(400).json({ status: 'error', message: error.message || 'Error al depositar fondos.' });
  }
}

/**
 * Alternar el estado de verificación de una transacción bancaria.
 */
export async function verifyTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const { verified } = req.body;

  try {
    const txId = Number(id);
    if (isNaN(txId)) {
      res.status(400).json({ status: 'error', message: 'ID de transacción inválido.' });
      return;
    }

    const transaction = await prisma.transaction.findUnique({
      where: { id: txId },
    });

    if (!transaction) {
      res.status(404).json({ status: 'error', message: 'Transacción no encontrada.' });
      return;
    }

    const updatedTx = await prisma.transaction.update({
      where: { id: txId },
      data: { verified: Boolean(verified) },
      include: {
        user: { select: { id: true, username: true } },
        persona: { select: { id: true, name: true, isClient: true, isProvider: true } },
        cashDrawer: true,
        bankAccount: true,
      }
    });

    // Auditoría
    await logAudit({
      userId: req.user!.id,
      action: 'VERIFY_BANK_TRANSFER',
      entityType: 'Transaction',
      entityId: txId,
      newValues: {
        verified: Boolean(verified),
        amount: updatedTx.amount,
        bankAccountId: updatedTx.bankAccountId,
      },
    });

    res.status(200).json({
      status: 'success',
      data: { transaction: updatedTx },
    });
  } catch (error: any) {
    console.error('Error al verificar transacción:', error);
    res.status(500).json({ status: 'error', message: 'Error al cambiar estado de verificación.' });
  }
}
