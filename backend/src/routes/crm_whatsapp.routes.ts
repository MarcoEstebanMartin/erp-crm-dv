import { Router } from 'express';
import { 
  getConversations, 
  getMessagesByConversation, 
  sendMessage, 
  parseOrderDraft, 
  approveOrderDraft,
  verifyWebhook,
  handleWebhook
} from '../controllers/crm_whatsapp.controller';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

// 1. Webhook Oficial Meta WhatsApp (Públicos / Verificados por Token de Meta)
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);

// 2. Rutas Internas de Gestión CRM (Protegidas con Autenticación JWT)
router.get('/conversations', authenticateJWT, getConversations);
router.get('/conversations/:id/messages', authenticateJWT, getMessagesByConversation);
router.post('/send-message', authenticateJWT, sendMessage);
router.post('/conversations/:id/parse-order', authenticateJWT, parseOrderDraft);
router.post('/drafts/:draftId/approve', authenticateJWT, approveOrderDraft);

export default router;
