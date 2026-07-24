import { Router } from 'express';
import { 
  getConversations, 
  getMessagesByConversation, 
  sendMessage, 
  parseOrderDraft, 
  approveOrderDraft,
  toggleAutoReply,
  updateStage,
  sendDeliveryNotification,
  verifyWebhook,
  handleWebhook
} from '../controllers/crm_whatsapp.controller';
import { authenticateJWT } from '../middlewares/auth';

const router = Router();

// 1. Webhook Oficial Meta WhatsApp (Públicos / Verificados por Token)
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);

// 2. Rutas Internas de Gestión CRM (Protegidas con Autenticación JWT)
router.get('/conversations', authenticateJWT, getConversations);
router.get('/conversations/:id/messages', authenticateJWT, getMessagesByConversation);
router.post('/send-message', authenticateJWT, sendMessage);
router.put('/conversations/:id/auto-reply', authenticateJWT, toggleAutoReply);
router.put('/conversations/:id/stage', authenticateJWT, updateStage);
router.post('/orders/:orderId/notify-delivery', authenticateJWT, sendDeliveryNotification);
router.post('/conversations/:id/parse-order', authenticateJWT, parseOrderDraft);
router.post('/drafts/:draftId/approve', authenticateJWT, approveOrderDraft);

export default router;
