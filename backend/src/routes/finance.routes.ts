import { Router } from 'express';
import {
  openDrawer,
  closeDrawer,
  getActiveDrawer,
  getActiveDrawers,
  closeJointDrawers,
  getTransactions,
  getBankAccounts,
  createBankAccount,
  transferFunds,
} from '../controllers/finance.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Rutas generales de caja
router.post('/drawers/open', authenticateJWT, openDrawer);
router.post('/drawers/close', authenticateJWT, closeDrawer);
router.get('/drawers/active', authenticateJWT, getActiveDrawer);
router.get('/drawers/active-all', authenticateJWT, getActiveDrawers);
router.post('/drawers/close-joint', authenticateJWT, closeJointDrawers);

// Rutas administrativas
router.get('/transactions', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getTransactions);
router.get('/bank-accounts', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getBankAccounts);
router.post('/bank-accounts', authenticateJWT, requireRole([Role.ADMIN]), createBankAccount);
router.post('/bank-accounts/transfer', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), transferFunds);

export default router;
