import { Router } from 'express';
import {
  getPersonas,
  getPersonaById,
  createPersona,
  updatePersona,
  recordPersonaPayment,
  getPersonaLedger,
} from '../controllers/persona.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Rutas accesibles por cualquier usuario autenticado (Vendedor, Depósito, Admin)
router.get('/', authenticateJWT, getPersonas);
router.get('/:id', authenticateJWT, getPersonaById);
router.get('/:id/ledger', authenticateJWT, getPersonaLedger);

// Rutas de creación, edición y cobros (Solo ADMIN y VENDEDOR)
router.post('/', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), createPersona);
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), updatePersona);
router.post('/:id/payments', authenticateJWT, requireRole([Role.ADMIN, Role.VENDEDOR]), recordPersonaPayment);

export default router;
