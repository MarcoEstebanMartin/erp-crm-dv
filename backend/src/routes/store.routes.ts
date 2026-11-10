import { Router } from 'express';
import {
  loginClient,
  magicLoginClient,
  logoutStoreClient,
  getStoreCatalog,
  getClientAccount,
  createStoreOrder,
  getClientOrders,
} from '../controllers/store.controller';
import { authenticateStoreClientJWT } from '../middlewares/storeAuth.middleware';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { authRateLimiter, publicApiRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createStoreOrderSchema,
  storeCatalogQuerySchema,
  storeLoginSchema,
} from '../validators/store.validator';

const router = Router();

// Autenticación / Búsqueda de Cliente (con protección contra fuerza bruta de PIN)
router.post('/login', authRateLimiter, validateRequest(storeLoginSchema), loginClient);

// Autenticación Mágica sin Contraseña desde WhatsApp
router.get('/magic-login', authRateLimiter, magicLoginClient);
router.post('/magic-login', authRateLimiter, magicLoginClient);
router.post('/logout', logoutStoreClient);

// Catálogo interactivo de productos y ofertas (público con límite de peticiones)
router.get('/catalog', publicApiRateLimiter, validateRequest(storeCatalogQuerySchema), getStoreCatalog);

// Rutas privadas del cliente: protegidas por JWT de tienda y blindaje anti-IDOR
router.get('/account/:personaId', authenticateStoreClientJWT, getClientAccount);
router.get('/orders/:personaId', authenticateStoreClientJWT, getClientOrders);
router.post(
  '/orders',
  authenticateStoreClientJWT,
  validateRequest(createStoreOrderSchema),
  idempotencyGuard,
  createStoreOrder,
);

export default router;
