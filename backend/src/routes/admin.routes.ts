import { Router } from 'express';
import {
  getFinancialReports,
  getAuditLogs,
  getUsers,
  createUser,
  toggleUserStatus,
  updateConfig,
  getZoneReports,
  getWeeklyReports,
  saveWeeklyReport,
  deleteWeeklyReport,
  getSuggestedCredit,
  getAutofillSales,
  checkBalancesReport,
  syncBalances,
} from '../controllers/admin.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createUserSchema,
  toggleUserStatusSchema
} from '../validators/admin.validator';
import {
  saveWeeklyReportSchema,
  deleteWeeklyReportSchema
} from '../validators/weeklyReport.validator';

const router = Router();

// Todas las rutas en este archivo requieren autenticación y rol ADMINISTRADOR
router.use(authenticateJWT);
router.use(requireRole([Role.ADMIN]));

router.get('/reports', getFinancialReports);
router.get('/reports/zones', getZoneReports);
router.get('/reports/weekly', getWeeklyReports);
router.get('/reports/weekly/suggested-credit', getSuggestedCredit);
router.get('/reports/weekly/autofill-sales', getAutofillSales);
router.post('/reports/weekly', validateRequest(saveWeeklyReportSchema), saveWeeklyReport);
router.delete('/reports/weekly/:weekStart', validateRequest(deleteWeeklyReportSchema), deleteWeeklyReport);

router.get('/audit-logs', getAuditLogs);
router.get('/users', getUsers);
router.post('/users', validateRequest(createUserSchema), createUser);
router.post('/users/:id/toggle', validateRequest(toggleUserStatusSchema), toggleUserStatus);
router.post('/config', updateConfig);
router.get('/reconcile/check', checkBalancesReport);
router.post('/reconcile/sync', syncBalances);

export default router;


