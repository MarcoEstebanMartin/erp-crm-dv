import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  openDrawer,
  closeDrawer,
  getActiveDrawer,
  getActiveDrawers,
  closeJointDrawers,
  getTransactions,
  getBankAccounts,
  createBankAccount,
  updateBankAccount,
  transferFunds,
  verifyTransaction,
  getDrawersHistory,
  createExpense,
  getTransactionById,
  closeCentralDrawer,
} from '../controllers/finance.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { validateRequest } from '../middlewares/validateRequest';
import {
  closeCentralDrawerSchema,
  closeDrawerSchema,
  closeJointDrawersSchema,
  createBankAccountSchema,
  createCentralExpenseSchema,
  openDrawerSchema,
  transferFundsSchema,
  updateBankAccountSchema,
  verifyTransactionSchema,
} from '../validators/finance.validator';

const router = Router();

const canOperateDrawers = requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR, Role.DEPOSITO]);
const canViewAllDrawers = requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]);

// Rutas generales de caja
router.post('/drawers/open', authenticateJWT, canOperateDrawers, validateRequest(openDrawerSchema), idempotencyGuard, openDrawer);
router.post('/drawers/close', authenticateJWT, canOperateDrawers, validateRequest(closeDrawerSchema), idempotencyGuard, closeDrawer);
router.get('/drawers/active', authenticateJWT, canOperateDrawers, getActiveDrawer);
router.get('/drawers/active-all', authenticateJWT, canViewAllDrawers, getActiveDrawers);
router.get(
  '/drawers/history',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  getDrawersHistory,
);
router.post(
  '/drawers/close-joint',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(closeJointDrawersSchema),
  idempotencyGuard,
  closeJointDrawers,
);

// Operaciones de Caja Grande (Tesorería Central)
router.post(
  '/central-drawer/close',
  authenticateJWT,
  requireRole([Role.ADMIN]),
  validateRequest(closeCentralDrawerSchema),
  idempotencyGuard,
  closeCentralDrawer,
);

// Rutas administrativas y de cuentas bancarias
router.get('/transactions', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getTransactions);
router.get('/bank-accounts', authenticateJWT, getBankAccounts);
router.post(
  '/bank-accounts',
  authenticateJWT,
  requireRole([Role.ADMIN]),
  validateRequest(createBankAccountSchema),
  createBankAccount,
);
router.put(
  '/bank-accounts/:id',
  authenticateJWT,
  requireRole([Role.ADMIN]),
  validateRequest(updateBankAccountSchema),
  updateBankAccount,
);
router.post(
  '/bank-accounts/transfer',
  authenticateJWT,
  requireRole([Role.ADMIN]),
  validateRequest(transferFundsSchema),
  idempotencyGuard,
  transferFunds,
);
router.put(
  '/transactions/:id/verify',
  authenticateJWT,
  requireRole([Role.ADMIN]),
  validateRequest(verifyTransactionSchema),
  verifyTransaction,
);
router.get('/transactions/:id', authenticateJWT, getTransactionById);
router.post(
  '/expenses',
  authenticateJWT,
  requireRole([Role.ADMIN]),
  validateRequest(createCentralExpenseSchema),
  idempotencyGuard,
  createExpense,
);

export default router;
