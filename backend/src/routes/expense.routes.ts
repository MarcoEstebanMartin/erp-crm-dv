import { Router } from 'express';
import {
  getCategories,
  createCategory,
  getExpenses,
  createExpense,
  createBulkExpenses,
  deleteExpense,
  importExpenses
} from '../controllers/expense.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';
import multer from 'multer';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

// Rutas de categorías de gastos
router.get('/categories', authenticateJWT, getCategories);
router.post('/categories', authenticateJWT, requireRole([Role.ADMIN]), createCategory);

// Rutas de gastos
router.get('/', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getExpenses);
router.post('/', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), createExpense);
router.post('/bulk', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), createBulkExpenses);
router.delete('/:id', authenticateJWT, requireRole([Role.ADMIN]), deleteExpense);

// Importación desde Excel
router.post('/import', authenticateJWT, requireRole([Role.ADMIN]), upload.single('file'), importExpenses);

export default router;
