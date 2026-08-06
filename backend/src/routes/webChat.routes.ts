import { Router } from 'express';
import { handleWebChatMessage } from '../controllers/webChat.controller';

const router = Router();

// Endpoint público para el chat flotante de la tienda Web
router.post('/message', handleWebChatMessage);

export default router;
