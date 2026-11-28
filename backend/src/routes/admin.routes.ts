import { Router } from 'express';
import {
  getFinancialReports,
  getCitySalesDetail,
  getProfitabilityReport,
  getExecutivePdfReport,
  getSellerMeetingPdfReport,
  getEmployeePdfReport,
  getAuditLogs,
  getDocumentAuditLogs,
  getSensitiveEvents,
  markSensitiveEventsSeen,
  getUsers,
  createUser,
  toggleUserStatus,
  updateUser,
  deleteUser,
  getConfig,
  updateConfig,
  getZoneReports,
  checkBalancesReport,
  syncBalances,
} from '../controllers/admin.controller';
import { getCommercialOpportunities } from '../controllers/commercial-opportunities.controller';
import {
  getTripProfitabilityReport,
  updateRouteTripCosts,
} from '../controllers/trip-profitability.controller';
import { getWeeklyPulse, saveWeeklyPulse } from '../controllers/weekly-pulse.controller';
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
  getFinancialReportsQuerySchema,
  getCitySalesDetailQuerySchema,
  getProfitabilityQuerySchema,
  getExecutiveReportQuerySchema,
  getSellerMeetingQuerySchema,
  getEmployeeReportQuerySchema,
  getZoneReportsQuerySchema,
  getOpportunitiesReportQuerySchema,
  getTripProfitabilityQuerySchema,
  updateRouteTripCostsSchema,
} from '../validators/reports.validator';
import {
  getWeeklyPulseQuerySchema,
  saveWeeklyPulseSchema,
} from '../validators/weekly-pulse.validator';

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
router.get('/reports/city-sales', validateRequest(getCitySalesDetailQuerySchema), getCitySalesDetail);
router.get('/reports/profitability', validateRequest(getProfitabilityQuerySchema), getProfitabilityReport);
router.get('/reports/pdf/executive', validateRequest(getExecutiveReportQuerySchema), getExecutivePdfReport);
router.get('/reports/pdf/employee/:userId', validateRequest(getEmployeeReportQuerySchema), getEmployeePdfReport);
router.get('/reports/pdf/seller/:sellerId', validateRequest(getSellerMeetingQuerySchema), getSellerMeetingPdfReport);
router.get('/reports/zones', validateRequest(getZoneReportsQuerySchema), getZoneReports);
router.get('/reports/opportunities', validateRequest(getOpportunitiesReportQuerySchema), getCommercialOpportunities);
router.get('/reports/trips', validateRequest(getTripProfitabilityQuerySchema), getTripProfitabilityReport);
router.patch('/reports/trips/:routeId/costs', validateRequest(updateRouteTripCostsSchema), updateRouteTripCosts);
router.get('/reports/weekly-pulse', validateRequest(getWeeklyPulseQuerySchema), getWeeklyPulse);
router.put('/reports/weekly-pulse', validateRequest(saveWeeklyPulseSchema), saveWeeklyPulse);

router.get('/audit-logs', validateRequest(getAuditLogsQuerySchema), getAuditLogs);
router.get('/sensitive-events', getSensitiveEvents);
router.post('/sensitive-events/seen', markSensitiveEventsSeen);
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
