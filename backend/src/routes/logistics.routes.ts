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

const router = Router();

router.use(authenticateJWT);

const canManageRoutes = requireRole([Role.ADMIN, Role.FACTURACION, Role.DEPOSITO]);
const canSettleOrDeleteRoutes = requireRole([Role.ADMIN, Role.FACTURACION]);

router.get('/resources', getLogisticsResources);
router.get('/', getDeliveryRoutes);
router.post('/', canManageRoutes, createDeliveryRoute);
router.patch('/:id/status', updateRouteStatus);
router.post('/:id/custody', transferRouteCustody);
router.post('/:id/settle', canSettleOrDeleteRoutes, settleDeliveryRoute);
router.post('/:id/gps', recordRouteGpsPing);
router.get('/:id/gps-history', getRouteGpsHistory);
router.delete('/:id', canSettleOrDeleteRoutes, deleteDeliveryRoute);

export default router;
