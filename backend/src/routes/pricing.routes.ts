import { Router } from 'express';
import { 
  getPricingRules, 
  createDiscountRule, 
  deleteDiscountRule, 
  createSplitBillingConfig, 
  deleteSplitBillingConfig 
} from '../controllers/pricing.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createDiscountRuleSchema,
  createSplitBillingSchema,
  positiveIdParamSchema,
} from '../validators/misc-routes.validator';
import { Role } from '@prisma/client';

const router = Router();

// Todas las rutas requieren autenticación y rol de ADMIN o FACTURACION
router.use(authenticateJWT);
router.use(requireRole([Role.ADMIN, Role.FACTURACION]));

router.get('/rules', getPricingRules);
router.post('/rules', validateRequest(createDiscountRuleSchema), createDiscountRule);
router.delete('/rules/:id', validateRequest(positiveIdParamSchema), deleteDiscountRule);

router.post('/split', validateRequest(createSplitBillingSchema), createSplitBillingConfig);
router.delete('/split/:id', validateRequest(positiveIdParamSchema), deleteSplitBillingConfig);

export default router;
