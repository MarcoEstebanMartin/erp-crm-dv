import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getDeliveryRoutes,
  createDeliveryRoute,
  updateDeliveryRoute,
  updateRouteStatus,
  settleDeliveryRoute,
  deleteDeliveryRoute,
  getLogisticsResources,
  transferRouteCustody,
  recordRouteGpsPing,
  recordUserGpsPings,
  getRouteGpsHistory,
  getLiveMap,
} from '../controllers/logistics.controller';
import { authenticateJWT, requireRole, requireRoleOrPermission } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createDeliveryRouteSchema,
  liveMapQuerySchema,
  recordRouteGpsPingSchema,
  recordUserGpsPingsSchema,
  routeIdParamSchema,
  settleDeliveryRouteSchema,
  transferRouteCustodySchema,
  updateDeliveryRouteSchema,
  updateRouteStatusSchema,
} from '../validators/logistics.validator';

const router = Router();

router.use(authenticateJWT);

const canManageRoutes = requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]);
const canOperateDeliveryRoutes = requireRoleOrPermission(
  [Role.ADMIN, Role.FACTURACION, Role.DEPOSITO],
  'canDeliver',
);
const canSettleOrDeleteRoutes = requireRole([Role.ADMIN, Role.FACTURACION]);

router.get('/resources', getLogisticsResources);
router.get('/live-map', canManageRoutes, validateRequest(liveMapQuerySchema), getLiveMap);
router.post('/user-gps', validateRequest(recordUserGpsPingsSchema), recordUserGpsPings);
router.get('/', getDeliveryRoutes);
router.post('/', canManageRoutes, validateRequest(createDeliveryRouteSchema), idempotencyGuard, createDeliveryRoute);
router.patch(
  '/:id',
  canManageRoutes,
  validateRequest(updateDeliveryRouteSchema),
  idempotencyGuard,
  updateDeliveryRoute,
);
router.patch('/:id/status', canOperateDeliveryRoutes, validateRequest(updateRouteStatusSchema), updateRouteStatus);
router.post('/:id/custody', canOperateDeliveryRoutes, validateRequest(transferRouteCustodySchema), transferRouteCustody);
router.post(
  '/:id/settle',
  canSettleOrDeleteRoutes,
  validateRequest(settleDeliveryRouteSchema),
  idempotencyGuard,
  settleDeliveryRoute,
);
router.post('/:id/gps', canOperateDeliveryRoutes, validateRequest(recordRouteGpsPingSchema), recordRouteGpsPing);
router.get('/:id/gps-history', canOperateDeliveryRoutes, validateRequest(routeIdParamSchema), getRouteGpsHistory);
router.delete(
  '/:id',
  canSettleOrDeleteRoutes,
  validateRequest(routeIdParamSchema),
  deleteDeliveryRoute,
);

export default router;
