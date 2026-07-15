import { Router } from 'express';
import { 
  getPricingRules, 
  createDiscountRule, 
  deleteDiscountRule, 
  createSplitBillingConfig, 
  deleteSplitBillingConfig 
} from '../controllers/pricing.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Todas las rutas requieren autenticación y rol de ADMIN o FACTURACION
router.use(authenticateJWT);
router.use(requireRole([Role.ADMIN, Role.FACTURACION]));

router.get('/rules', getPricingRules);
router.post('/rules', createDiscountRule);
router.delete('/rules/:id', deleteDiscountRule);

router.post('/split', createSplitBillingConfig);
router.delete('/split/:id', deleteSplitBillingConfig);

export default router;
