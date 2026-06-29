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
import { validateRequest } from '../middlewares/validateRequest';
import {
  createUserSchema,
  toggleUserStatusSchema
} from '../validators/admin.validator';

const router = Router();

// Todas las rutas en este archivo requieren autenticación y rol ADMINISTRADOR
router.use(authenticateJWT);
router.use(requireRole([Role.ADMIN]));

router.get('/reports', getFinancialReports);
router.get('/audit-logs', getAuditLogs);
router.get('/users', getUsers);
router.post('/users', validateRequest(createUserSchema), createUser);
router.post('/users/:id/toggle', validateRequest(toggleUserStatusSchema), toggleUserStatus);

export default router;
