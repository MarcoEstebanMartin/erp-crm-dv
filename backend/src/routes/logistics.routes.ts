import { Router } from 'express';
import { getDeliveryRoutes, createDeliveryRoute, updateRouteStatus } from '../controllers/logistics.controller';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

// Todas las rutas requieren token activo
router.use(authenticateJWT);

router.get('/', getDeliveryRoutes);
router.post('/', createDeliveryRoute);
router.patch('/:id/status', updateRouteStatus);

export default router;
