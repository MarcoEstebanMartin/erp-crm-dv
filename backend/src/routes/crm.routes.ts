import { Router } from 'express';
import { Role } from '@prisma/client';
import { getCRMAlerts } from '../controllers/crm.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';

const router = Router();

// Todas las rutas requieren token activo y rol comercial/administrativo
router.use(authenticateJWT);
router.use(requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR]));

router.get('/alerts', getCRMAlerts);

export default router;
