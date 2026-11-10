import { Response } from 'express';
import { PaymentMethod } from '@prisma/client';
import { AuthenticatedRequest } from '../types';
import AppError from '../utils/AppError';
import { expenseService } from '../services/expenses/expense.service';
import { createBulkExpensesRecords } from '../services/expenses/expense-bulk.service';
import { importExpensesFromExcel } from '../services/expenses/expense-import.service';

function handleExpenseError(res: Response, error: unknown, fallbackMessage: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ status: 'error', message: error.message });
    return;
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ status: 'error', message: fallbackMessage });
}

export async function getCategories(_req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const categories = await expenseService.getCategories();
    res.status(200).json({ status: 'success', data: { categories } });
  } catch (error) {
    handleExpenseError(res, error, 'Error interno del servidor.');
  }
}

export async function createCategory(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    const category = await expenseService.createCategory({
      name: req.body.name,
      description: req.body.description,
    });
    res.status(201).json({ status: 'success', data: { category } });
  } catch (error) {
    handleExpenseError(res, error, 'Error al crear la categoría.');
  }
}

export async function getExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  try {
    const expenses = await expenseService.getExpenses(req.query as Record<string, string>);
    res.status(200).json({ status: 'success', data: { expenses } });
  } catch (error) {
    handleExpenseError(res, error, 'Error al obtener los gastos.');
  }
}

export async function createExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    const expense = await expenseService.createExpense({
      userId: req.user.id,
      amount: Number(req.body.amount),
      categoryId: Number(req.body.categoryId),
      description: req.body.description,
      date: req.body.date,
      paymentMethod: req.body.paymentMethod as PaymentMethod,
      cashDrawerId: req.body.cashDrawerId ? Number(req.body.cashDrawerId) : null,
      bankAccountId: req.body.bankAccountId ? Number(req.body.bankAccountId) : null,
      vehicleId: req.body.vehicleId ? Number(req.body.vehicleId) : null,
      billingType: req.body.billingType,
    });
    res.status(201).json({ status: 'success', data: { expense } });
  } catch (error) {
    handleExpenseError(res, error, 'Error al guardar el gasto.');
  }
}

export async function deleteExpense(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    await expenseService.deleteExpense({
      userId: req.user.id,
      expenseId: Number(req.params.id),
    });
    res.status(200).json({ status: 'success', message: 'Gasto eliminado y fondos revertidos.' });
  } catch (error) {
    handleExpenseError(res, error, 'Error interno al eliminar el gasto.');
  }
}

export async function importExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  if (!req.file) {
    res.status(400).json({ status: 'error', message: 'No se subió ningún archivo Excel.' });
    return;
  }
  try {
    const count = await importExpensesFromExcel({
      userId: req.user.id,
      fileBuffer: req.file.buffer,
    });
    res.status(200).json({
      status: 'success',
      message: `Se importaron con éxito ${count} registros de gastos correspondientes a Mayo de 2026.`,
      data: { count },
    });
  } catch (error) {
    handleExpenseError(res, error, 'Error interno al procesar el archivo Excel.');
  }
}

export async function createBulkExpenses(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user?.id) {
    res.status(401).json({ status: 'error', message: 'No autenticado.' });
    return;
  }
  try {
    const insertedExpenses = await createBulkExpensesRecords({
      userId: req.user.id,
      expenses: req.body.expenses,
      targetDate: req.body.targetDate,
    });
    res.status(201).json({
      status: 'success',
      message: `Se crearon ${insertedExpenses.length} gastos con éxito.`,
      data: { count: insertedExpenses.length, expenses: insertedExpenses },
    });
  } catch (error) {
    handleExpenseError(res, error, 'Error al guardar el lote de gastos.');
  }
}
