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

// Rutas generales de caja
router.post('/drawers/open', authenticateJWT, validateRequest(openDrawerSchema), openDrawer);
router.post('/drawers/close', authenticateJWT, validateRequest(closeDrawerSchema), closeDrawer);
router.get('/drawers/active', authenticateJWT, getActiveDrawer);
router.get('/drawers/active-all', authenticateJWT, getActiveDrawers);
router.get('/drawers/history', authenticateJWT, getDrawersHistory);
router.post('/drawers/close-joint', authenticateJWT, validateRequest(closeJointDrawersSchema), closeJointDrawers);

// Operaciones de Caja Grande (Tesorería Central)
router.post(
  '/central-drawer/close',
  authenticateJWT,
  requireRole([Role.ADMIN]),
  validateRequest(closeCentralDrawerSchema),
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
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(updateBankAccountSchema),
  updateBankAccount,
);
router.post(
  '/bank-accounts/transfer',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(transferFundsSchema),
  transferFunds,
);
router.put(
  '/transactions/:id/verify',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(verifyTransactionSchema),
  verifyTransaction,
);
router.get('/transactions/:id', authenticateJWT, getTransactionById);
router.post(
  '/expenses',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(createCentralExpenseSchema),
  createExpense,
);

export default router;
