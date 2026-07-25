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
  simulateIncomingMessage,
  linkPersonaToConversation,
  assignConversation,
  verifyWebhook,
  handleWebhook
} from '../controllers/crm_whatsapp.controller';
import { broadcastCampaign } from '../controllers/crm_campaign.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// 1. Webhook Oficial Meta WhatsApp (Públicos / Verificados por Token)
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);

// 2. Rutas Internas de Gestión CRM (Protegidas con Autenticación JWT y Rol de Administración)
const adminOnly = [authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION])];

router.get('/conversations', adminOnly, getConversations);
router.get('/conversations/:id/messages', adminOnly, getMessagesByConversation);
router.post('/send-message', adminOnly, sendMessage);
router.post('/simulate-incoming', adminOnly, simulateIncomingMessage);
router.put('/conversations/:id/auto-reply', adminOnly, toggleAutoReply);
router.put('/conversations/:id/stage', adminOnly, updateStage);
router.put('/conversations/:id/link-persona', adminOnly, linkPersonaToConversation);
router.put('/conversations/:id/assign', adminOnly, assignConversation);
router.post('/orders/:orderId/notify-delivery', adminOnly, sendDeliveryNotification);
router.post('/conversations/:id/parse-order', adminOnly, parseOrderDraft);
router.post('/drafts/:draftId/approve', adminOnly, approveOrderDraft);
router.post('/campaigns/broadcast', adminOnly, broadcastCampaign);

export default router;
