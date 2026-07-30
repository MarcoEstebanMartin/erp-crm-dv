import { Router } from 'express';
import { 
  getDeliveryRoutes, 
  createDeliveryRoute, 
  updateRouteStatus, 
  settleDeliveryRoute, 
  deleteDeliveryRoute, 
  getLogisticsResources, 
  transferRouteCustody,
  recordRouteGpsPing,
  getRouteGpsHistory
} from '../controllers/logistics.controller';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

// Todas las rutas requieren token activo
router.use(authenticateJWT);

router.get('/resources', getLogisticsResources);
router.get('/', getDeliveryRoutes);
router.post('/', createDeliveryRoute);
router.patch('/:id/status', updateRouteStatus);
router.post('/:id/custody', transferRouteCustody);
router.post('/:id/settle', settleDeliveryRoute);
router.post('/:id/gps', recordRouteGpsPing);
router.get('/:id/gps-history', getRouteGpsHistory);
router.delete('/:id', deleteDeliveryRoute);

export default router;
