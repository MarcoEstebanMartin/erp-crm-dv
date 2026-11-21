import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  approveSettlement,
  getOfflineBundle,
  getWhatsAppCoverage,
  listAllSettlements,
  listMySettlements,
  rejectCheckPayment,
  resendWhatsAppReceipt,
  saveClientWhatsApp,
  syncFieldReceipt,
  verifyTransferPayment,
  voidFieldReceipt,
} from '../controllers/fieldReceipts.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { validateRequest } from '../middlewares/validateRequest';
import {
  approveSettlementSchema,
  rejectCheckSchema,
  saveClientWhatsAppSchema,
  syncFieldReceiptSchema,
  verifyTransferSchema,
  voidFieldReceiptSchema,
} from '../validators/fieldReceipts.schema';

const router = Router();

const COLLECTOR_ROLES = [Role.ADMIN, Role.FACTURACION, Role.VENDEDOR, Role.DEPOSITO];
const TREASURY_ROLES = [Role.ADMIN, Role.FACTURACION];

// Rutas operativas en calle (vendedores y repartidores)
router.get('/offline-bundle', authenticateJWT, requireRole(COLLECTOR_ROLES), getOfflineBundle);
router.post(
  '/sync',
  authenticateJWT,
  requireRole(COLLECTOR_ROLES),
  validateRequest(syncFieldReceiptSchema),
  syncFieldReceipt,
);
router.get('/my-settlements', authenticateJWT, requireRole(COLLECTOR_ROLES), listMySettlements);
router.post('/:id/resend-whatsapp', authenticateJWT, requireRole(COLLECTOR_ROLES), resendWhatsAppReceipt);
router.patch(
  '/clients/:personaId/whatsapp',
  authenticateJWT,
  requireRole(COLLECTOR_ROLES),
  validateRequest(saveClientWhatsAppSchema),
  saveClientWhatsApp,
);
router.get('/whatsapp-coverage', authenticateJWT, requireRole(TREASURY_ROLES), getWhatsAppCoverage);

// Rutas administrativas y de tesorería (oficina)
router.get('/settlements', authenticateJWT, requireRole(TREASURY_ROLES), listAllSettlements);
router.post(
  '/settlements/:id/approve',
  authenticateJWT,
  requireRole(TREASURY_ROLES),
  validateRequest(approveSettlementSchema),
  idempotencyGuard,
  approveSettlement,
);
router.post(
  '/payments/:paymentId/verify-transfer',
  authenticateJWT,
  requireRole(TREASURY_ROLES),
  validateRequest(verifyTransferSchema),
  idempotencyGuard,
  verifyTransferPayment,
);
router.post(
  '/payments/:paymentId/reject-check',
  authenticateJWT,
  requireRole(TREASURY_ROLES),
  validateRequest(rejectCheckSchema),
  idempotencyGuard,
  rejectCheckPayment,
);
router.post(
  '/:id/void',
  authenticateJWT,
  requireRole(TREASURY_ROLES),
  validateRequest(voidFieldReceiptSchema),
  idempotencyGuard,
  voidFieldReceipt,
);

export default router;
