import { Router } from 'express';
import { login, getMe } from '../controllers/auth.controller';
import { authenticateJWT } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validateRequest';
import { loginSchema } from '../validators/auth.validator';
import { authRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

router.post('/login', authRateLimiter, validateRequest(loginSchema), login);
router.get('/me', authenticateJWT, getMe);

export default router;
