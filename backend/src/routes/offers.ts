import { Router } from 'express';
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
  getCampaignComparison
} from '../controllers/offersController';

const router = Router();

// Rutas de campañas
router.post('/', createCampaign);
router.get('/', getCampaigns);
router.get('/suggestions', getCampaignSuggestions);
router.get('/recommendations', getWeeklyOfferRecommendations);
router.get('/comparison', getCampaignComparison);
router.get('/:id', getCampaignById);
router.put('/:id', updateCampaign);
router.delete('/:id', deleteCampaign);

// Rutas de items (productos dentro de la campaña)
router.post('/:campaignId/items', addOrUpdateCampaignItem);
router.post('/:campaignId/items/bulk', addBulkCampaignItems);
router.delete('/:campaignId/items/:itemId', removeCampaignItem);

export default router;

