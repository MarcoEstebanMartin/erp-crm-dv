import { Router } from 'express';
import {
  getFinancialReports,
  getSalesChannelStats,
  getProfitabilityReport,
  getExecutivePdfReport,
  getSellerMeetingPdfReport,
  getAuditLogs,
  getDocumentAuditLogs,
  getUsers,
  createUser,
  toggleUserStatus,
  updateUser,
  deleteUser,
  getConfig,
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
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { Role } from '@prisma/client';
import { validateRequest } from '../middlewares/validateRequest';
import {
  getAuditLogsQuerySchema,
  createUserSchema,
  toggleUserStatusSchema,
  updateUserSchema,
  deleteUserSchema,
  updateSystemConfigSchema,
} from '../validators/admin.validator';
import {
  saveWeeklyReportSchema,
  deleteWeeklyReportSchema
} from '../validators/weeklyReport.validator';

const router = Router();

// Ruta de auditoría de documento (ADMIN y FACTURACION)
router.get(
  '/audit-logs/document/:entityType/:entityId',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  getDocumentAuditLogs,
);

// Todas las rutas siguientes requieren autenticación y rol ADMINISTRADOR
router.use(authenticateJWT);
router.use(requireRole([Role.ADMIN]));

router.get('/reports', getFinancialReports);
router.get('/reports/sales-channels', getSalesChannelStats);
router.get('/reports/profitability', getProfitabilityReport);
router.get('/reports/pdf/executive', getExecutivePdfReport);
router.get('/reports/pdf/seller/:sellerId', getSellerMeetingPdfReport);
router.get('/reports/zones', getZoneReports);
router.get('/reports/weekly', getWeeklyReports);
router.get('/reports/weekly/suggested-credit', getSuggestedCredit);
router.get('/reports/weekly/autofill-sales', getAutofillSales);
router.post('/reports/weekly', validateRequest(saveWeeklyReportSchema), saveWeeklyReport);
router.delete('/reports/weekly/:weekStart', validateRequest(deleteWeeklyReportSchema), deleteWeeklyReport);

router.get('/audit-logs', validateRequest(getAuditLogsQuerySchema), getAuditLogs);
router.get('/users', getUsers);
router.post('/users', idempotencyGuard, validateRequest(createUserSchema), createUser);
router.put('/users/:id', idempotencyGuard, validateRequest(updateUserSchema), updateUser);
router.post('/users/:id/toggle', validateRequest(toggleUserStatusSchema), toggleUserStatus);
router.delete('/users/:username', idempotencyGuard, validateRequest(deleteUserSchema), deleteUser);
router.get('/config', getConfig);
router.post('/config', idempotencyGuard, validateRequest(updateSystemConfigSchema), updateConfig);
router.get('/reconcile/check', checkBalancesReport);
router.post('/reconcile/sync', syncBalances);

export default router;



