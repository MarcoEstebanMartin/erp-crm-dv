import { Router } from 'express';
import { getDeliveryRoutes, createDeliveryRoute, updateRouteStatus, settleDeliveryRoute, deleteDeliveryRoute } from '../controllers/logistics.controller';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

// Todas las rutas requieren token activo
router.use(authenticateJWT);

router.get('/', getDeliveryRoutes);
router.post('/', createDeliveryRoute);
router.patch('/:id/status', updateRouteStatus);
router.post('/:id/settle', settleDeliveryRoute);
router.delete('/:id', deleteDeliveryRoute);

export default router;
