import { Router } from 'express';
import {
  getPerceptionTypes,
  updatePerceptionType,
} from '../controllers/perception.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { updatePerceptionSchema } from '../validators/misc-routes.validator';
import { Role } from '@prisma/client';

const router = Router();

// Todos los usuarios autenticados pueden ver los tipos de percepciones
router.get('/', authenticateJWT, getPerceptionTypes);

// Solo administradores pueden modificar los tipos de percepciones
router.put('/:id', authenticateJWT, requireRole([Role.ADMIN]), validateRequest(updatePerceptionSchema), updatePerceptionType);

export default router;
