import { Router } from 'express';
import {
  getSaleRoutes,
  getSellerSaleRoutes,
  getSaleRouteById,
  createSaleRoute,
  updateSaleRoute,
  deleteSaleRoute,
  updateClientSequence,
  addClientToRoute,
  removeClientFromRoute,
  getUnassignedClients,
  recordRouteVisit,
  getTodayVisits,
  optimizeRouteSequence,
} from '../controllers/saleRoute.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { Role } from '@prisma/client';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createSaleRouteSchema,
  updateSaleRouteSchema,
  updateSequenceSchema,
  recordRouteVisitSchema,
} from '../validators/saleRoute.validator';
import {
  addClientToRouteSchema,
  positiveIdParamSchema,
  removeClientFromRouteSchema,
} from '../validators/misc-routes.validator';

const router = Router();

// Rutas generales para vendedores y administradores
router.get('/my-routes', authenticateJWT, requireRole([Role.VENDEDOR, Role.ADMIN]), getSellerSaleRoutes);
router.get('/visits/today', authenticateJWT, requireRole([Role.VENDEDOR, Role.ADMIN]), getTodayVisits);
router.get('/unassigned-clients', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getUnassignedClients);
router.get('/:id', authenticateJWT, requireRole([Role.VENDEDOR, Role.ADMIN]), getSaleRouteById);

// Registro de visitas diarias desde la ruta (idempotente para sincronización Offline PWA)
router.post('/:id/visit', authenticateJWT, requireRole([Role.VENDEDOR, Role.ADMIN]), validateRequest(recordRouteVisitSchema), idempotencyGuard, recordRouteVisit);

// Rutas de administración (Solo ADMIN o FACTURACION para configurar)
router.get('/', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), getSaleRoutes);
router.post('/', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), validateRequest(createSaleRouteSchema), idempotencyGuard, createSaleRoute);
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), validateRequest(updateSaleRouteSchema), updateSaleRoute);
router.delete('/:id', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), validateRequest(positiveIdParamSchema), deleteSaleRoute);

// Reordenamiento y asociación de clientes (Vendedor puede ordenar y quitar de su propia ruta)
router.put('/:id/sequence', authenticateJWT, requireRole([Role.VENDEDOR, Role.ADMIN, Role.FACTURACION]), validateRequest(updateSequenceSchema), updateClientSequence);
router.post('/:id/clients', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), validateRequest(addClientToRouteSchema), idempotencyGuard, addClientToRoute);
router.delete('/:id/clients/:clientId', authenticateJWT, requireRole([Role.VENDEDOR, Role.ADMIN, Role.FACTURACION]), validateRequest(removeClientFromRouteSchema), removeClientFromRoute);
router.post('/:id/optimize-sequence', authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION]), validateRequest(positiveIdParamSchema), optimizeRouteSequence);

export default router;
