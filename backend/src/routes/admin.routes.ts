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
import {
  getFinancialReportsQuerySchema,
  getLocalSalesQuerySchema,
  getProfitabilityQuerySchema,
  getExecutiveReportQuerySchema,
  getSellerMeetingQuerySchema,
  getZoneReportsQuerySchema,
  weeklyQuerySchema,
} from '../validators/reports.validator';

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

router.get('/reports', validateRequest(getFinancialReportsQuerySchema), getFinancialReports);
router.get('/reports/sales-channels', validateRequest(getLocalSalesQuerySchema), getSalesChannelStats);
router.get('/reports/local-sales', validateRequest(getLocalSalesQuerySchema), getSalesChannelStats);
router.get('/reports/profitability', validateRequest(getProfitabilityQuerySchema), getProfitabilityReport);
router.get('/reports/pdf/executive', validateRequest(getExecutiveReportQuerySchema), getExecutivePdfReport);
router.get('/reports/pdf/seller/:sellerId', validateRequest(getSellerMeetingQuerySchema), getSellerMeetingPdfReport);
router.get('/reports/zones', validateRequest(getZoneReportsQuerySchema), getZoneReports);
router.get('/reports/weekly', getWeeklyReports);
router.get('/reports/weekly/suggested-credit', validateRequest(weeklyQuerySchema), getSuggestedCredit);
router.get('/reports/weekly/autofill-sales', validateRequest(weeklyQuerySchema), getAutofillSales);
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



