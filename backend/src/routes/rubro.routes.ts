import { Router } from 'express';
import {
  getRubros,
  createRubro,
  updateRubro,
  deleteRubro,
} from '../controllers/rubro.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// Todos los usuarios autenticados pueden ver los rubros
router.get('/', authenticateJWT, getRubros);

// Solo administradores pueden crear, modificar o eliminar rubros
router.post('/', authenticateJWT, requireRole([Role.ADMIN]), createRubro);
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN]), updateRubro);
router.delete('/:id', authenticateJWT, requireRole([Role.ADMIN]), deleteRubro);

export default router;
