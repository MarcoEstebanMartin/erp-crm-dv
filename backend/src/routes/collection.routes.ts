import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  registerCollection,
  listReceipts,
  getReceipt,
  getPendingCollections,
  getPendingRendiciones,
  getCollectionsSummary,
  verifyRendicion,
  voidReceipt,
  deleteReceipt,
} from '../controllers/collection.controller';
import { authenticateJWT, optionalAuthenticateJWT, requireRole } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { publicApiRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validateRequest } from '../middlewares/validateRequest';
import {
  registerCollectionSchema,
  verifyRendicionSchema,
  voidReceiptSchema,
} from '../validators/collection.validator';

const router = Router();

// --- RUTAS MÓVILES / COBRANZAS (Vendedores, Facturación y Admin) ---
router.get(
  '/pending',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR]),
  getPendingCollections,
);
router.post(
  '/register',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR]),
  validateRequest(registerCollectionSchema),
  idempotencyGuard,
  registerCollection,
);

// Listado de recibos de cobro (Oficina / Mostrador / Cuenta Corriente)
router.get(
  '/receipts',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  listReceipts,
);

// Detalle público sanitizado de un recibo (exige token HMAC `?v=...` salvo staff autenticado)
router.get('/receipt/:id', publicApiRateLimiter, optionalAuthenticateJWT, getReceipt);

// Anular un recibo erróneo (soft-void auditable con motivo obligatorio; nunca borrado físico)
router.post(
  '/receipt/:id/void',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(voidReceiptSchema),
  voidReceipt,
);

// Alias retrocompatible (también exige motivo obligatorio y realiza soft-void)
router.delete(
  '/receipt/:id',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(voidReceiptSchema),
  deleteReceipt,
);

// --- RUTAS ADMINISTRATIVAS (Cajeros / Administración) ---
router.get(
  '/summary',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  getCollectionsSummary,
);
router.get(
  '/rendiciones',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  getPendingRendiciones,
);
router.post(
  '/rendiciones/verify',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
  validateRequest(verifyRendicionSchema),
  idempotencyGuard,
  verifyRendicion,
);

export default router;
