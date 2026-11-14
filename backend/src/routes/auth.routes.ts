import { Router } from 'express';
import { Role } from '@prisma/client';
import { login, logout, getMe, changeOwnPassword } from '../controllers/auth.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { loginSchema, changeOwnPasswordSchema } from '../validators/auth.validator';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/login', authRateLimiter, validateRequest(loginSchema), login);
router.post('/logout', logout);
router.get('/me', authenticateJWT, getMe);
router.post('/change-password', authenticateJWT, requireRole([Role.ADMIN]), validateRequest(changeOwnPasswordSchema), changeOwnPassword);

export default router;
