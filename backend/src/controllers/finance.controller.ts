import { Response } from 'express';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { logAudit } from '../utils/audit';
import { BillingType, PaymentMethod, TransactionType } from '@prisma/client';

/**
 * Abrir una nueva caja operativa.
 */
export async function openDrawer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { branch, drawerType, routeNote, notes, openingBalance, userId: bodyUserId } = req.body;
  const loggedUserId = req.user?.id;

  if (!loggedUserId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  // Si el usuario es ADMIN, puede abrir la caja de otro usuario. De lo contrario, se usa su propio ID.
  let targetUserId = loggedUserId;
  if (req.user?.role === 'ADMIN' && bodyUserId) {
    targetUserId = Number(bodyUserId);
  }

  const drawerBranch = branch || 'CONSOLIDADA';

  if (openingBalance === undefined || Number(openingBalance) < 0) {
    res.status(400).json({ status: 'error', message: 'El saldo inicial debe ser mayor o igual a cero.' });
    return;
  }

  try {
    // Validar si ya hay una caja abierta para este usuario en esta rama
    const existing = await prisma.cashDrawer.findFirst({
      where: {
        userId: targetUserId,
        branch: drawerBranch,
        status: 'OPEN',
      },
    });

    if (existing) {
      res.status(400).json({
        status: 'error',
        message: `La caja para el usuario y rama ${drawerBranch} ya se encuentra abierta.`,
      });
      return;
    }

    const drawer = await prisma.cashDrawer.create({
      data: {
        userId: targetUserId,
        branch: drawerBranch,
        drawerType: drawerType || 'DEPOSITO',
        routeNote: routeNote ? String(routeNote).trim() : null,
        notes: notes ? String(notes).trim() : null,
        openingBalance: Number(openingBalance),
        status: 'OPEN',
      },
    });

    // Auditoría
    await logAudit({
      userId: loggedUserId,
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
  const { drawerId, realBalance, routeNote, notes, receipts } = req.body;
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
    
    // Procesar recibos entrantes (cobranzas) para sumarlos a la caja ANTES del arqueo
    if (receipts && Array.isArray(receipts)) {
      for (const r of receipts) {
        await prisma.transaction.create({
          data: {
            personaId: Number(r.clientId),
            userId,
            billingType: r.billingType || 'INTERNAL',
            type: 'INCOME',
            paymentMethod: r.paymentMethod || 'CASH',
            amount: Number(r.amount),
            description: 'Recibo/Cobranza - Arqueo de Caja',
            cashDrawerId: drawer.id
          }
        });
      }
    }


    // Calcular saldo teórico basado en transacciones de la caja
    const transactions = await prisma.transaction.findMany({
      where: { cashDrawerId: drawer.id },
    });

    let cashIncome = 0;
    let cashOutcome = 0;

    transactions.forEach((t) => {
      if (t.paymentMethod === PaymentMethod.CASH) {
        if (t.type === TransactionType.INCOME) {
          cashIncome += Number(t.amount);
        } else {
          cashOutcome += Number(t.amount);
        }
      }
    });

    const calculatedClosingBalance = Number(drawer.openingBalance) + cashIncome - cashOutcome;

    const closed = await prisma.cashDrawer.update({
      where: { id: drawer.id },
      data: {
        closingBalance: calculatedClosingBalance,
        realBalance: Number(realBalance),
        routeNote: routeNote !== undefined ? String(routeNote).trim() : drawer.routeNote,
        notes: notes !== undefined ? String(notes).trim() : drawer.notes,
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
        if (t.paymentMethod === PaymentMethod.CASH) {
          if (t.type === TransactionType.INCOME) cashIncome += Number(t.amount);
          else cashOutcome += Number(t.amount);
        }
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
 * Obtener detalles de una transacción por ID.
 */
export async function getTransactionById(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { id } = req.params;
  const userId = req.user?.id;
  const userRole = req.user?.role;

  if (!userId || !userRole) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }

  try {
    const transaction = await prisma.transaction.findUnique({
      where: { id: Number(id) },
      include: {
        user: { select: { id: true, username: true } },
        persona: { select: { id: true, name: true, isClient: true, isProvider: true } },
        cashDrawer: true,
        bankAccount: true,
        order: { select: { id: true, invoiceNumber: true } },
      },
    });

    if (!transaction) {
      res.status(404).json({ status: 'error', message: 'Transacción no encontrada.' });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: { transaction },
    });
  } catch (error: any) {
    console.error('Error al obtener la transacción por ID:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener la transacción.',
    });
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
          { name: 'Mercado Pago Transferencias', accountNumber: '0000003100085432453321 (alias: donvenancio2024)', balance: 150000.00 },
          { name: 'QR MP', accountNumber: 'QR-MP-DISTRIB', balance: 0.00 },
          { name: 'Banco Provincia C.A', accountNumber: '520358/9', balance: 250000.00 },
          { name: 'Banco Provincia C/C', accountNumber: '10300/6', balance: 500000.00 },
        ],
      });
      accounts = await prisma.bankAccount.findMany({
        orderBy: { name: 'asc' },
      });
    } else {
      // Renombrar cuentas existentes a la nueva nomenclatura
      const renameMap = [
        { old: 'Mercado Pago Distribuidora', new: 'Mercado Pago Transferencias' },
        { old: 'QR', new: 'QR MP' },
        { old: 'Banco Provincia Corriente', new: 'Banco Provincia C/C' }
      ];

      for (const mapping of renameMap) {
        const found = accounts.find(a => a.name === mapping.old);
        if (found) {
          await prisma.bankAccount.update({
            where: { id: found.id },
            data: { name: mapping.new }
          });
        }
      }

      // Asegurar la existencia de "Banco Provincia C.A"
      accounts = await prisma.bankAccount.findMany({
        orderBy: { name: 'asc' },
      });
      const hasProvinciaCA = accounts.some(a => a.name === 'Banco Provincia C.A');
      if (!hasProvinciaCA) {
        await prisma.bankAccount.create({
          data: { name: 'Banco Provincia C.A', accountNumber: '520358/9', balance: 0.00 }
        });
      }

      // Actualizar cuentas existentes con los números reales solicitados por el usuario si difieren
      accounts = await prisma.bankAccount.findMany({
        orderBy: { name: 'asc' },
      });

      const updates = [
        { name: 'Mercado Pago Transferencias', accountNumber: '0000003100085432453321 (alias: donvenancio2024)' },
        { name: 'Banco Provincia C/C', accountNumber: '10300/6' },
        { name: 'Banco Provincia C.A', accountNumber: '520358/9' }
      ];

      for (const update of updates) {
        const found = accounts.find(a => a.name === update.name);
        if (found && found.accountNumber !== update.accountNumber) {
          await prisma.bankAccount.update({
            where: { id: found.id },
            data: { accountNumber: update.accountNumber }
          });
        }
      }

      // Volver a cargar las cuentas actualizadas
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

    const transferAmount = Math.round(Number(amount));

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
  const { verified, adjustedAmount } = req.body;

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

    const updatedTx = await prisma.$transaction(async (tx) => {
      let finalAmount = Number(transaction.amount);

      if (adjustedAmount !== undefined && adjustedAmount !== null && Boolean(verified)) {
        const newAmount = Number(Number(adjustedAmount).toFixed(2));
        const oldAmount = Number(transaction.amount);
        const diff = newAmount - oldAmount;

        if (diff !== 0) {
          // Ajustar Cuenta Corriente del Cliente si es un cobro (INCOME)
          if (transaction.personaId && transaction.type === 'INCOME') {
            await tx.persona.update({
              where: { id: transaction.personaId },
              data: {
                outstandingBalance: {
                  decrement: diff,
                },
              },
            });
          }

          // Ajustar saldo de Cuenta Bancaria si es un ingreso (INCOME)
          if (transaction.bankAccountId && transaction.type === 'INCOME') {
            await tx.bankAccount.update({
              where: { id: transaction.bankAccountId },
              data: {
                balance: {
                  increment: diff,
                },
              },
            });
          }

          finalAmount = newAmount;
        }
      }

      return tx.transaction.update({
        where: { id: txId },
        data: { 
          verified: Boolean(verified),
          amount: finalAmount,
        },
        include: {
          user: { select: { id: true, username: true } },
          persona: { select: { id: true, name: true, isClient: true, isProvider: true } },
          cashDrawer: true,
          bankAccount: true,
        }
      });
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
        originalAmount: transaction.amount,
        bankAccountId: updatedTx.bankAccountId,
        adjusted: adjustedAmount !== undefined && adjustedAmount !== null,
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

export async function getDrawersHistory(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const closedDrawers = await prisma.cashDrawer.findMany({
      where: {
        status: 'CLOSED'
      },
      orderBy: {
        closedAt: 'desc'
      },
      take: 50,
      include: {
        user: { 
          select: { 
            id: true, 
            username: true,
            employee: { select: { firstName: true, lastName: true } }
          } 
        },
        transactions: {
          select: {
            id: true,
            type: true,
            billingType: true,
            paymentMethod: true,
            amount: true,
            description: true,
            createdAt: true,
            receiptNumber: true,
            orderId: true,
            verified: true,
            persona: { select: { id: true, name: true } }
          }
        }
      }
    });
    res.json({ status: 'success', data: { drawers: closedDrawers } });
  } catch (error: any) {
    console.error('Error fetching drawers history:', error);
    res.status(500).json({ status: 'error', message: 'Error al obtener el historial de cajas.' });
  }
}

export async function createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { amount, description, paymentMethod, billingType } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  const expAmount = Math.round(Number(amount));
  if (isNaN(expAmount) || expAmount <= 0) {
    res.status(400).json({ status: 'error', message: 'El monto del gasto debe ser mayor a 0.' });
    return;
  }

  if (!description) {
    res.status(400).json({ status: 'error', message: 'La descripción del gasto es obligatoria.' });
    return;
  }

  try {
    const transaction = await prisma.transaction.create({
      data: {
        userId,
        type: TransactionType.OUTCOME,
        paymentMethod: paymentMethod as PaymentMethod || PaymentMethod.CASH,
        billingType: billingType as BillingType || BillingType.INTERNAL,
        amount: expAmount,
        description,
        verified: true, // Auto-verified since it is admin-logged
      }
    });

    // Save Audit Log
    await prisma.auditLog.create({
      data: {
        userId,
        action: 'CREATE_EXPENSE',
        entityType: 'Transaction',
        entityId: transaction.id,
        newValues: {
          amount: expAmount,
          description,
          paymentMethod,
          billingType
        }
      }
    });

    res.status(201).json({
      status: 'success',
      data: { transaction }
    });
  } catch (error: any) {
    console.error('Error al registrar gasto:', error);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor al registrar el gasto.' });
  }
}

/**
 * Transferir o retirar fondos directamente desde la Caja Grande (Tesorería Central).
 * Puede ser un Depósito Bancario (Efectivo Caja Grande -> Banco) o un Retiro de Tesorería (Extracción).
 */
export async function transferCentralFunds(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { amount, type, bankAccountId, description } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  const numAmount = Math.round(Number(amount));
  if (isNaN(numAmount) || numAmount <= 0) {
    res.status(400).json({ status: 'error', message: 'El monto debe ser mayor a cero.' });
    return;
  }

  if (type === 'BANK_DEPOSIT' && !bankAccountId) {
    res.status(400).json({ status: 'error', message: 'Debe seleccionar la cuenta bancaria de destino.' });
    return;
  }

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Egreso directo de Caja Grande (cashDrawerId: null, bankAccountId: null)
      const outcomeTrans = await tx.transaction.create({
        data: {
          userId,
          billingType: BillingType.INTERNAL,
          type: TransactionType.OUTCOME,
          paymentMethod: PaymentMethod.CASH,
          amount: numAmount,
          description: description || (type === 'BANK_DEPOSIT' ? 'Depósito en Banco desde Caja Grande' : 'Retiro de Tesorería / Extracción de Bóveda'),
          cashDrawerId: null,
          bankAccountId: null,
          verified: true,
        },
      });

      let incomeTrans = null;
      let updatedBank = null;

      // 2. Si es depósito bancario, crear ingreso en la cuenta de banco
      if (type === 'BANK_DEPOSIT' && bankAccountId) {
        incomeTrans = await tx.transaction.create({
          data: {
            userId,
            billingType: BillingType.INTERNAL,
            type: TransactionType.INCOME,
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            amount: numAmount,
            description: description || 'Depósito en efectivo recibido desde Caja Grande',
            cashDrawerId: null,
            bankAccountId: Number(bankAccountId),
            verified: true,
          },
        });

        updatedBank = await tx.bankAccount.update({
          where: { id: Number(bankAccountId) },
          data: {
            balance: {
              increment: numAmount,
            },
          },
        });
      }

      return { outcomeTrans, incomeTrans, updatedBank };
    });

    await logAudit({
      userId,
      action: type === 'BANK_DEPOSIT' ? 'CENTRAL_DEPOSIT_TO_BANK' : 'CENTRAL_TREASURY_WITHDRAWAL',
      entityType: 'Transaction',
      entityId: result.outcomeTrans.id,
      newValues: {
        amount: numAmount,
        type,
        bankAccountId: bankAccountId ? Number(bankAccountId) : null,
      },
    });

    res.status(200).json({
      status: 'success',
      message: type === 'BANK_DEPOSIT' ? 'Depósito en banco realizado con éxito desde la Caja Grande.' : 'Retiro de tesorería registrado con éxito.',
      data: result,
    });
  } catch (error: any) {
    console.error('Error al transferir fondos de Caja Grande:', error);
    res.status(500).json({ status: 'error', message: 'Error interno al procesar la operación de Caja Grande.' });
  }
}

/**
 * Realizar Arqueo y Cierre de Ciclo de Caja Grande (Tesorería Central).
 * Cierra la etapa actual, realiza depósitos/retiros opcionales y reinicia con un nuevo saldo inicial.
 */
export async function closeCentralDrawer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { realBalance, newOpeningBalance, bankAccountId, transferToBankAmount, withdrawnAmount, notes } = req.body;
  const userId = req.user?.id;

  if (!userId) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }

  const numRealBalance = Number(realBalance || 0);
  const numNewOpeningBalance = Number(newOpeningBalance || 0);
  const numBankAmount = Math.round(Number(transferToBankAmount || 0));
  const numWithdrawnAmount = Math.round(Number(withdrawnAmount || 0));

  try {
    // 1. Obtener el último cierre central previo para calcular el acumulado actual
    const lastCentral = await prisma.cashDrawer.findFirst({
      where: { drawerType: 'CENTRAL', status: 'CLOSED' },
      orderBy: { closedAt: 'desc' },
    });

    const cutoffDate = lastCentral?.closedAt || null;

    // Sumar arqueos cerrados posteriores
    const closedDrawers = await prisma.cashDrawer.findMany({
      where: {
        status: 'CLOSED',
        drawerType: { not: 'CENTRAL' },
        ...(cutoffDate ? { closedAt: { gt: cutoffDate } } : {}),
      },
    });

    const netDrawersCash = closedDrawers.reduce((acc, curr) => acc + (Number(curr.realBalance || 0) - Number(curr.openingBalance || 0)), 0);

    // Restar egresos de caja grande posteriores
    const overallExpenses = await prisma.transaction.findMany({
      where: {
        type: 'OUTCOME',
        cashDrawerId: null,
        bankAccountId: null,
        ...(cutoffDate ? { createdAt: { gt: cutoffDate } } : {}),
      },
    });

    const totalExpensesOverall = overallExpenses.reduce((acc, curr) => acc + Number(curr.amount || 0), 0);

    const baseBalance = lastCentral ? Number(lastCentral.realBalance) : 0;
    const currentCalculatedBalance = baseBalance + netDrawersCash - totalExpensesOverall;

    // 2. Ejecutar Cierre en Transacción
    const result = await prisma.$transaction(async (tx) => {
      // Depósito a Banco opcional durante el cierre
      if (numBankAmount > 0 && bankAccountId) {
        await tx.transaction.create({
          data: {
            userId,
            billingType: BillingType.INTERNAL,
            type: TransactionType.OUTCOME,
            paymentMethod: PaymentMethod.CASH,
            amount: numBankAmount,
            description: `Depósito en Banco al cerrar Caja Grande`,
            cashDrawerId: null,
            bankAccountId: null,
            verified: true,
          },
        });

        await tx.transaction.create({
          data: {
            userId,
            billingType: BillingType.INTERNAL,
            type: TransactionType.INCOME,
            paymentMethod: PaymentMethod.BANK_TRANSFER,
            amount: numBankAmount,
            description: `Depósito recibido al cerrar Caja Grande`,
            cashDrawerId: null,
            bankAccountId: Number(bankAccountId),
            verified: true,
          },
        });

        await tx.bankAccount.update({
          where: { id: Number(bankAccountId) },
          data: { balance: { increment: numBankAmount } },
        });
      }

      // Retiro de Tesorería opcional durante el cierre
      if (numWithdrawnAmount > 0) {
        await tx.transaction.create({
          data: {
            userId,
            billingType: BillingType.INTERNAL,
            type: TransactionType.OUTCOME,
            paymentMethod: PaymentMethod.CASH,
            amount: numWithdrawnAmount,
            description: `Retiro de Tesorería al cerrar Caja Grande`,
            cashDrawerId: null,
            bankAccountId: null,
            verified: true,
          },
        });
      }

      // Crear el registro de Cierre de Caja Grande (CENTRAL)
      const centralDrawer = await tx.cashDrawer.create({
        data: {
          userId,
          branch: 'CENTRAL',
          drawerType: 'CENTRAL',
          openingBalance: currentCalculatedBalance,
          closingBalance: currentCalculatedBalance,
          realBalance: numNewOpeningBalance,
          status: 'CLOSED',
          openedAt: new Date(),
          closedAt: new Date(),
          notes: notes || `Cierre de Caja Grande (Bóveda Central). Conteo real declarado: $${numRealBalance.toLocaleString('es-AR')}. Nuevo saldo inicial: $${numNewOpeningBalance.toLocaleString('es-AR')}.`,
        },
      });

      return centralDrawer;
    });

    await logAudit({
      userId,
      action: 'CLOSE_CENTRAL_DRAWER',
      entityType: 'CashDrawer',
      entityId: result.id,
      newValues: {
        previousBalance: currentCalculatedBalance,
        realBalanceDeclared: numRealBalance,
        newOpeningBalance: numNewOpeningBalance,
        transferredToBank: numBankAmount,
        withdrawn: numWithdrawnAmount,
      },
    });

    res.status(200).json({
      status: 'success',
      message: 'Cierre de Caja Grande completado con éxito. Se ha iniciado un nuevo ciclo de tesorería central.',
      data: { centralDrawer: result },
    });
  } catch (error: any) {
    console.error('Error al cerrar Caja Grande:', error);
    res.status(500).json({ status: 'error', message: 'Error interno al realizar el cierre de Caja Grande.' });
  }
}

