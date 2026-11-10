import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  getDeliveryRoutes,
  createDeliveryRoute,
  updateRouteStatus,
  settleDeliveryRoute,
  deleteDeliveryRoute,
  getLogisticsResources,
  transferRouteCustody,
  recordRouteGpsPing,
  getRouteGpsHistory,
} from '../controllers/logistics.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createDeliveryRouteSchema,
  recordRouteGpsPingSchema,
  routeIdParamSchema,
  settleDeliveryRouteSchema,
  transferRouteCustodySchema,
  updateRouteStatusSchema,
} from '../validators/logistics.validator';

const router = Router();

router.use(authenticateJWT);

const canManageRoutes = requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]);
const canSettleOrDeleteRoutes = requireRole([Role.ADMIN, Role.FACTURACION]);

router.get('/resources', getLogisticsResources);
router.get('/', getDeliveryRoutes);
router.post('/', canManageRoutes, validateRequest(createDeliveryRouteSchema), createDeliveryRoute);
router.patch('/:id/status', validateRequest(updateRouteStatusSchema), updateRouteStatus);
router.post('/:id/custody', validateRequest(transferRouteCustodySchema), transferRouteCustody);
router.post(
  '/:id/settle',
  canSettleOrDeleteRoutes,
  validateRequest(settleDeliveryRouteSchema),
  settleDeliveryRoute,
);
router.post('/:id/gps', validateRequest(recordRouteGpsPingSchema), recordRouteGpsPing);
router.get('/:id/gps-history', validateRequest(routeIdParamSchema), getRouteGpsHistory);
router.delete(
  '/:id',
  canSettleOrDeleteRoutes,
  validateRequest(routeIdParamSchema),
  deleteDeliveryRoute,
);

export default router;
