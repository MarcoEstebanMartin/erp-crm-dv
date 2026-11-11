import { Router } from 'express';
import {
  getWeeklySchedule,
  setCurrentWeek,
  createScheduleEntry,
  updateScheduleEntry,
  deleteScheduleEntry,
  seedDefaultSchedule
} from '../controllers/weeklySchedule.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { toggleWeekSchema } from '../validators/weeklySchedule.validator';
import { Role } from '@prisma/client';

const router = Router();

// Todas las rutas requieren usuario autenticado
router.use(authenticateJWT);

// Lectura general (Vendedor, Admin, Facturación, Depósito)
router.get('/', getWeeklySchedule);

// Cambiar la semana activa (ADMIN, FACTURACION, VENDEDOR)
router.post(
  '/toggle-week',
  requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR]),
  validateRequest(toggleWeekSchema),
  setCurrentWeek,
);

// Administrar cronograma (ADMIN, FACTURACION)
router.post('/', requireRole([Role.ADMIN, Role.FACTURACION]), createScheduleEntry);
router.put('/:id', requireRole([Role.ADMIN, Role.FACTURACION]), updateScheduleEntry);
router.delete('/:id', requireRole([Role.ADMIN, Role.FACTURACION]), deleteScheduleEntry);
router.post('/seed-defaults', requireRole([Role.ADMIN, Role.FACTURACION]), seedDefaultSchedule);

export default router;
