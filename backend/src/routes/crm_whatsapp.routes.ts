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
  deleteConversation,
} from '../controllers/crm_whatsapp.controller';
import { verifyWebhook, handleWebhook } from '../controllers/crm_whatsapp_webhook.controller';
import { broadcastCampaign } from '../controllers/crm_campaign.controller';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { Role } from '@prisma/client';

const router = Router();

// 1. Webhook Oficial Meta WhatsApp (Públicos / Verificados por Token)
router.get('/webhook', verifyWebhook);
router.post('/webhook', handleWebhook);

// 2. Rutas Internas de Gestión CRM (Protegidas con Autenticación JWT y Roles de Sistema)
const crmOperational = [authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION, Role.VENDEDOR, Role.DEPOSITO])];
const crmAdminOnly = [authenticateJWT, requireRole([Role.ADMIN, Role.FACTURACION])];

router.get('/conversations', crmOperational, getConversations);
router.get('/conversations/:id/messages', crmOperational, getMessagesByConversation);
router.post('/send-message', crmOperational, sendMessage);
router.post('/simulate-incoming', crmAdminOnly, simulateIncomingMessage);
router.put('/conversations/:id/auto-reply', crmOperational, toggleAutoReply);
router.put('/conversations/:id/stage', crmOperational, updateStage);
router.put('/conversations/:id/link-persona', crmOperational, linkPersonaToConversation);
router.put('/conversations/:id/assign', crmAdminOnly, assignConversation);
router.delete('/conversations/:id', crmAdminOnly, deleteConversation);
router.post('/orders/:orderId/notify-delivery', crmOperational, sendDeliveryNotification);
router.post('/conversations/:id/parse-order', crmOperational, parseOrderDraft);
router.post('/drafts/:draftId/approve', crmOperational, approveOrderDraft);
router.post('/campaigns/broadcast', crmAdminOnly, broadcastCampaign);

export default router;
