import { Router } from 'express';
import { Role } from '@prisma/client';
import {
  createCampaign,
  getCampaigns,
  getCampaignById,
  updateCampaign,
  deleteCampaign,
  addOrUpdateCampaignItem,
  removeCampaignItem,
  getCampaignSuggestions,
  addBulkCampaignItems,
  getWeeklyOfferRecommendations,
  getCampaignComparison,
} from '../controllers/offersController';
import { authenticateJWT, requireRole } from '../middlewares/auth';
import { validateRequest } from '../middlewares/validate.middleware';
import {
  campaignIdParamSchema,
  createCampaignSchema,
  updateCampaignSchema,
  upsertCampaignItemSchema,
  bulkCampaignItemsSchema,
  removeCampaignItemSchema,
} from '../validators/offers.validator';

const router = Router();

// Todas las rutas internas de ofertas exigen sesión activa
router.use(authenticateJWT);

const canManageOffers = requireRole([Role.ADMIN, Role.FACTURACION]);

// Lectura de campañas (personal autenticado)
router.get('/', getCampaigns);
router.get('/suggestions', canManageOffers, getCampaignSuggestions);
router.get('/recommendations', canManageOffers, getWeeklyOfferRecommendations);
router.get('/comparison', canManageOffers, getCampaignComparison);
router.get('/:id', validateRequest(campaignIdParamSchema), getCampaignById);

// Creación, modificación y baja de campañas (exclusivo ADMIN y FACTURACION)
router.post('/', canManageOffers, validateRequest(createCampaignSchema), createCampaign);
router.put('/:id', canManageOffers, validateRequest(updateCampaignSchema), updateCampaign);
router.delete('/:id', canManageOffers, validateRequest(campaignIdParamSchema), deleteCampaign);

// Administración de artículos dentro de la campaña
router.post('/:campaignId/items', canManageOffers, validateRequest(upsertCampaignItemSchema), addOrUpdateCampaignItem);
router.post('/:campaignId/items/bulk', canManageOffers, validateRequest(bulkCampaignItemsSchema), addBulkCampaignItems);
router.delete('/:campaignId/items/:itemId', canManageOffers, validateRequest(removeCampaignItemSchema), removeCampaignItem);

export default router;
