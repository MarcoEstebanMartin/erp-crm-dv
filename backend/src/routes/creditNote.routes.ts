import { Router } from 'express';
import { getCreditNotes, createCreditNote } from '../controllers/creditNote.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Todas las rutas de Notas de Crédito requieren autenticación JWT
router.use(authenticateJWT);

// Rutas accesibles por ADMIN y personal de FACTURACION
router.get('/', requireRole([Role.ADMIN, Role.FACTURACION]), getCreditNotes);
router.post('/', requireRole([Role.ADMIN, Role.FACTURACION]), createCreditNote);

export default router;
