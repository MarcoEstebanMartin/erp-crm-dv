import { Router } from 'express';
import { getCRMAlerts } from '../controllers/crm.controller';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

// Todas las rutas requieren token activo
router.use(authenticateJWT);

router.get('/alerts', getCRMAlerts);

export default router;
