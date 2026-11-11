import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import AppError from '../utils/AppError';
import { cashDrawerService } from '../services/finance/cash-drawer.service';
import { centralDrawerService } from '../services/finance/central-drawer.service';
import { bankAccountService } from '../services/finance/bank-account.service';
import { transactionAdminService } from '../services/finance/transaction-admin.service';

function handleFinanceError(res: Response, error: unknown, fallbackMessage: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ status: 'error', message: fallbackMessage });
}

function requireUserId(
  req: AuthenticatedRequest,
  res: Response,
  message = 'No autenticado.',
): number | null {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message });
    return null;
  }
  return req.user.id;
}

export async function openDrawer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const drawer = await cashDrawerService.openDrawer({
      loggedUserId: userId,
      loggedUserRole: req.user?.role,
      bodyUserId: req.body.userId,
      branch: req.body.branch,
      drawerType: req.body.drawerType,
      routeNote: req.body.routeNote,
      notes: req.body.notes,
      openingBalance: Number(req.body.openingBalance),
    });
    res.status(201).json({ status: 'success', data: { drawer } });
  } catch (error) {
    handleFinanceError(res, error, 'Error al abrir la caja operativa.');
  }
}

export async function closeDrawer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const drawer = await cashDrawerService.closeDrawer({
      userId,
      drawerId: Number(req.body.drawerId),
      realBalance: Number(req.body.realBalance),
      routeNote: req.body.routeNote,
      notes: req.body.notes,
      receipts: req.body.receipts,
    });
    res.status(200).json({ status: 'success', data: { drawer } });
  } catch (error) {
    handleFinanceError(res, error, 'Error al cerrar la caja operativa.');
  }
}

export async function getActiveDrawer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const drawer = await cashDrawerService.getActiveDrawer(userId);
    res.status(200).json({ status: 'success', data: { drawer } });
  } catch (error) {
    handleFinanceError(res, error, 'Error al obtener la caja activa.');
  }
}

export async function getActiveDrawers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const drawers = await cashDrawerService.getActiveDrawers(userId);
    res.status(200).json({ status: 'success', data: { drawers } });
  } catch (error) {
    handleFinanceError(res, error, 'Error al obtener las cajas activas.');
  }
}

export async function closeJointDrawers(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const drawers = await centralDrawerService.closeJointDrawers({
      userId,
      realBalanceA: req.body.realBalanceA,
      realBalanceX: req.body.realBalanceX,
    });
    res.status(200).json({ status: 'success', data: { drawers } });
  } catch (error) {
    handleFinanceError(res, error, 'Error al realizar el cierre de caja.');
  }
}

export async function getDrawersHistory(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const drawers = await centralDrawerService.getDrawersHistory();
    res.status(200).json({ status: 'success', data: { drawers } });
  } catch (error) {
    handleFinanceError(res, error, 'Error al obtener el historial de cajas.');
  }
}

export async function closeCentralDrawer(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const centralDrawer = await centralDrawerService.closeCentralDrawer({
      userId,
      realBalance: req.body.realBalance !== undefined ? Number(req.body.realBalance) : undefined,
      notes: req.body.notes,
    });
    res.status(200).json({
      status: 'success',
      message: 'Caja Grande cerrada correctamente.',
      data: { centralDrawer },
    });
  } catch (error) {
    handleFinanceError(res, error, 'Error interno al realizar el cierre de Caja Grande.');
  }
}

export async function getTransactions(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const transactions = await transactionAdminService.getTransactions(
      req.query as Record<string, string>,
    );
    res.status(200).json({ status: 'success', data: { transactions } });
  } catch (error) {
    handleFinanceError(res, error, 'Error al obtener el flujo de fondos.');
  }
}

export async function getTransactionById(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id || !req.user?.role) {
    res.status(401).json({ status: 'error', message: 'No autorizado.' });
    return;
  }
  try {
    const transaction = await transactionAdminService.getTransactionById(Number(req.params.id));
    const isAdminOrBilling = req.user.role === 'ADMIN' || req.user.role === 'FACTURACION';
    if (!isAdminOrBilling && transaction && (transaction as any).userId !== req.user.id) {
      res.status(403).json({ status: 'error', message: 'Acceso denegado a esta transacción.' });
      return;
    }
    res.status(200).json({ status: 'success', data: { transaction } });
  } catch (error) {
    handleFinanceError(res, error, 'Error al obtener la transacción.');
  }
}

export async function getBankAccounts(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const accounts = await bankAccountService.getBankAccounts();
    const isAdminOrBilling = req.user?.role === 'ADMIN' || req.user?.role === 'FACTURACION';
    const safeAccounts = isAdminOrBilling
      ? accounts
      : accounts.map((acc: any) => ({ ...acc, balance: 0 }));
    res.status(200).json({ status: 'success', data: { accounts: safeAccounts } });
  } catch (error) {
    handleFinanceError(res, error, 'Error al obtener las cuentas bancarias.');
  }
}

export async function createBankAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res, 'No autorizado.');
  if (!userId) return;
  try {
    const account = await bankAccountService.createBankAccount({
      userId,
      name: req.body.name,
      accountNumber: req.body.accountNumber,
      balance: req.body.balance !== undefined ? Number(req.body.balance) : undefined,
    });
    res.status(201).json({ status: 'success', data: { account } });
  } catch (error) {
    handleFinanceError(res, error, 'Error al crear la cuenta bancaria.');
  }
}

export async function updateBankAccount(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res, 'No autorizado.');
  if (!userId) return;
  try {
    const account = await bankAccountService.updateBankAccount({
      userId,
      bankId: Number(req.params.id),
      name: req.body.name,
      accountNumber: req.body.accountNumber,
    });
    res.status(200).json({ status: 'success', data: { account } });
  } catch (error) {
    handleFinanceError(res, error, 'Error interno al actualizar la cuenta bancaria.');
  }
}

export async function transferFunds(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const result = await bankAccountService.transferFunds({
      userId,
      amount: Number(req.body.amount),
      bankAccountId: Number(req.body.bankAccountId),
      description: req.body.description,
    });
    res.status(200).json({
      status: 'success',
      data: {
        drawerTransaction: result.outcomeTrans,
        bankTransaction: result.incomeTrans,
        bankAccount: result.updatedBank,
      },
    });
  } catch (error) {
    handleFinanceError(res, error, 'Error al depositar fondos.');
  }
}

export async function verifyTransaction(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const transaction = await transactionAdminService.verifyTransaction({
      userId,
      txId: Number(req.params.id),
      verified: Boolean(req.body.verified),
      adjustedAmount:
        req.body.adjustedAmount !== undefined && req.body.adjustedAmount !== null
          ? Number(req.body.adjustedAmount)
          : undefined,
    });
    res.status(200).json({ status: 'success', data: { transaction } });
  } catch (error) {
    handleFinanceError(res, error, 'Error al cambiar estado de verificación.');
  }
}

export async function createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  const userId = requireUserId(req, res);
  if (!userId) return;
  try {
    const transaction = await transactionAdminService.createCentralExpense({
      userId,
      amount: Number(req.body.amount),
      description: req.body.description,
      paymentMethod: req.body.paymentMethod,
      billingType: req.body.billingType,
    });
    res.status(201).json({ status: 'success', data: { transaction } });
  } catch (error) {
    handleFinanceError(res, error, 'Error interno del servidor al registrar el gasto.');
  }
}
