import { Router, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';
import prisma from '../utils/prisma';
import { AuthenticatedRequest } from '../types';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { idempotencyGuard } from '../middlewares/idempotency.middleware';
import { validateRequest } from '../middlewares/validateRequest';
import { canUserManageWeeklyPromos } from '../engines/weekly-promos.engine';
import { createWeeklyPromoSchema, promoIdParamSchema } from '../validators/weeklyPromo.validator';
import {
  getAllWeeklyPromos,
  getActiveWeeklyPromos,
  createWeeklyPromo,
  toggleWeeklyPromo,
  deleteWeeklyPromo,
} from '../controllers/weeklyPromo.controller';

const router = Router();

/** Restringe la gestión de ofertas semanales exclusivamente a admin y Darío (Administración). */
const requireWeeklyPromoManager = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
) => {
  try {
    if (!req.user) {
      return res.status(401).json({ status: 'error', message: 'Usuario no autenticado' });
    }
    let username = req.user.username;
    let role: string | undefined = req.user.role;
    if (!username) {
      const dbUser = await prisma.user.findUnique({
        where: { id: req.user.id },
        select: { username: true, role: true, isActive: true },
      });
      if (!dbUser || !dbUser.isActive) {
        return res.status(403).json({ status: 'error', message: 'Acceso denegado: cuenta inactiva' });
      }
      username = dbUser.username;
      role = dbUser.role;
    }
    if (!canUserManageWeeklyPromos({ username, role })) {
      return res.status(403).json({
        status: 'error',
        message: 'Acceso denegado: solo admin y Darío (Administración) pueden gestionar ofertas semanales',
      });
    }
    return next();
  } catch (error) {
    return next(error);
  }
};

router.use(authenticateJWT);

router.get('/active', requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR]), getActiveWeeklyPromos);
router.get('/', requireWeeklyPromoManager, getAllWeeklyPromos);
router.post('/', requireWeeklyPromoManager, idempotencyGuard, validateRequest(createWeeklyPromoSchema), createWeeklyPromo);
router.patch('/:id/toggle', requireWeeklyPromoManager, idempotencyGuard, validateRequest(promoIdParamSchema), toggleWeeklyPromo);
router.delete('/:id', requireWeeklyPromoManager, idempotencyGuard, validateRequest(promoIdParamSchema), deleteWeeklyPromo);

export default router;
