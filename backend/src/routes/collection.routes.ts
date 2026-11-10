import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  registerCollection,
  getReceipt,
  getPendingCollections,
  getPendingRendiciones,
  getCollectionsSummary,
  verifyRendicion,
  deleteReceipt,
} from '../controllers/collection.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { publicApiRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validateRequest } from '../middlewares/validateRequest';
import {
  registerCollectionSchema,
  verifyRendicionSchema,
} from '../validators/collection.validator';

const router = Router();

// --- RUTAS MÓVILES (Vendedores / Repartidores) ---
router.get('/pending', authenticateJWT, getPendingCollections);
router.post(
  '/register',
  authenticateJWT,
  validateRequest(registerCollectionSchema),
  registerCollection,
);

// Detalle público sanitizado de un recibo (para compartir comprobante digital)
router.get('/receipt/:id', publicApiRateLimiter, getReceipt);

// Eliminar/anular un recibo erróneo
router.delete(
  '/receipt/:id',
  authenticateJWT,
  requireRole([Role.ADMIN, Role.FACTURACION]),
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
  verifyRendicion,
);

export default router;
