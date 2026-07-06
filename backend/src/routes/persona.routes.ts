import { Router } from 'express';
import {
  getPersonas,
  getPersonaById,
  createPersona,
  updatePersona,
  recordPersonaPayment,
  getPersonaLedger,
  getAfipData,
} from '../controllers/persona.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';
import { validateRequest } from '../middlewares/validateRequest';
import {
  createPersonaSchema,
  updatePersonaSchema,
  recordPersonaPaymentSchema
} from '../validators/persona.validator';

const router = Router();

// Rutas accesibles por cualquier usuario autenticado (Vendedor, Depósito, Admin)
router.get('/', authenticateJWT, getPersonas);
router.get('/afip/:cuit', authenticateJWT, getAfipData);
router.get('/:id', authenticateJWT, getPersonaById);
router.get('/:id/ledger', authenticateJWT, getPersonaLedger);


// Rutas de creación, edición y cobros (Solo ADMIN y VENDEDOR)
router.post('/', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), validateRequest(createPersonaSchema), createPersona);
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), validateRequest(updatePersonaSchema), updatePersona);
router.post('/:id/payments', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), validateRequest(recordPersonaPaymentSchema), recordPersonaPayment);

export default router;
