import { Router } from 'express';
import { handleWebChatMessage } from '../controllers/webChat.controller';
import { publicApiRateLimiter } from '../middlewares/rateLimiter.middleware';

const router = Router();

// Endpoint público para el chat flotante de la tienda Web con Rate Limiting
router.post('/message', publicApiRateLimiter, handleWebChatMessage);

export default router;
