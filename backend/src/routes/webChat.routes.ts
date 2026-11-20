import { Router } from 'express';
import { handleWebChatMessage } from '../controllers/webChat.controller';
import { publicApiRateLimiter } from '../middlewares/rateLimiter.middleware';
import { validateRequest } from '../middlewares/validateRequest';
import { webChatMessageSchema } from '../validators/misc-routes.validator';

const router = Router();

// Endpoint público para el chat flotante de la tienda Web con Rate Limiting y validación Zod
router.post('/message', publicApiRateLimiter, validateRequest(webChatMessageSchema), handleWebChatMessage);

export default router;
