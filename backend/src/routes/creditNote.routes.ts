import { Router } from 'express';
import { getCreditNotes, createCreditNote, getCreditNoteById } from '../controllers/creditNote.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Todas las rutas de Notas de Crédito requieren autenticación JWT
router.use(authenticateJWT);

// Ruta para obtener una Nota de Crédito por ID (Accesible por cualquier usuario autenticado)
router.get('/:id', getCreditNoteById);

// Rutas accesibles por ADMIN y personal de FACTURACION
router.get('/', requireRole([Role.ADMIN, Role.FACTURACION]), getCreditNotes);
router.post('/', requireRole([Role.ADMIN, Role.FACTURACION]), createCreditNote);

export default router;
