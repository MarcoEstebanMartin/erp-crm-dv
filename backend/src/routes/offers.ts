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

const router = Router();

// Todas las rutas internas de ofertas exigen sesión activa
router.use(authenticateJWT);

const canManageOffers = requireRole([Role.ADMIN, Role.FACTURACION]);

// Lectura de campañas (personal autenticado)
router.get('/', getCampaigns);
router.get('/suggestions', canManageOffers, getCampaignSuggestions);
router.get('/recommendations', canManageOffers, getWeeklyOfferRecommendations);
router.get('/comparison', canManageOffers, getCampaignComparison);
router.get('/:id', getCampaignById);

// Creación, modificación y baja de campañas (exclusivo ADMIN y FACTURACION)
router.post('/', canManageOffers, createCampaign);
router.put('/:id', canManageOffers, updateCampaign);
router.delete('/:id', canManageOffers, deleteCampaign);

// Administración de artículos dentro de la campaña
router.post('/:campaignId/items', canManageOffers, addOrUpdateCampaignItem);
router.post('/:campaignId/items/bulk', canManageOffers, addBulkCampaignItems);
router.delete('/:campaignId/items/:itemId', canManageOffers, removeCampaignItem);

export default router;
