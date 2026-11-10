import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getCategories,
  createCategory,
  getExpenses,
  createExpense,
  createBulkExpenses,
  deleteExpense,
  importExpenses,
} from '../controllers/expense.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { uploadExcelFile } from '../middlewares/upload';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createBulkExpensesSchema,
  createCategorySchema,
  createExpenseSchema,
} from '../validators/expense.validator';

const router = Router();

// Rutas de categorías de gastos
router.get('/categories', authenticateJWT, getCategories);
router.post(
  '/categories',
  authenticateJWT,
  requireRole([Role.ADMIN]),
  validateRequest(createCategorySchema),
  idempotencyGuard,
  createCategory,
);

// Rutas de gastos
router.get('/', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getExpenses);
router.post(
  '/',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(createExpenseSchema),
  idempotencyGuard,
  createExpense,
);
router.post(
  '/bulk',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(createBulkExpensesSchema),
  idempotencyGuard,
  createBulkExpenses,
);
router.delete('/:id', authenticateJWT, requireRole([Role.ADMIN]), deleteExpense);

// Importación segura desde Excel (.xlsx / .csv)
router.post(
  '/import',
  authenticateJWT,
  requireRole([Role.ADMIN]),
  uploadExcelFile,
  importExpenses,
);

export default router;
