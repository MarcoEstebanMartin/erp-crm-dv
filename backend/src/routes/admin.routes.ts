import { Router } from 'express';
import {
  getFinancialReports,
  getAuditLogs,
  getUsers,
  createUser,
  toggleUserStatus,
} from '../controllers/admin.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Todas las rutas en este archivo requieren autenticación y rol ADMINISTRADOR
router.use(authenticateJWT);
router.use(requireRole([Role.ADMIN]));

router.get('/reports', getFinancialReports);
router.get('/audit-logs', getAuditLogs);
router.get('/users', getUsers);
router.post('/users', createUser);
router.post('/users/:id/toggle', toggleUserStatus);

export default router;
