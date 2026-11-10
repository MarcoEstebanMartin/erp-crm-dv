import { Request, Response } from 'express';
import AppError from '../utils/AppError';
import { offerCampaignService } from '../services/offers/offer-campaign.service';
import { offerItemService } from '../services/offers/offer-item.service';
import { offerRecommendationsService } from '../services/offers/offer-recommendations.service';
import { offerAnalyticsService } from '../services/offers/offer-analytics.service';

function handleOffersError(res: Response, error: unknown, fallbackMessage: string): void {
  if (error instanceof AppError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error(fallbackMessage, error);
  res.status(500).json({ error: fallbackMessage });
}

export const createCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const campaign = await offerCampaignService.createCampaign(req.body);
    res.status(201).json(campaign);
  } catch (error) {
    handleOffersError(res, error, 'Error creating campaign');
  }
};

export const getCampaigns = async (_req: Request, res: Response): Promise<void> => {
  try {
    const campaigns = await offerCampaignService.getCampaigns();
    res.json(campaigns);
  } catch (error) {
    handleOffersError(res, error, 'Error fetching campaigns');
  }
};

export const getCampaignById = async (req: Request, res: Response): Promise<void> => {
  try {
    const campaign = await offerCampaignService.getCampaignById(Number(req.params.id));
    res.json(campaign);
  } catch (error) {
    handleOffersError(res, error, 'Error fetching campaign details');
  }
};

export const updateCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    const campaign = await offerCampaignService.updateCampaign(Number(req.params.id), req.body);
    res.json(campaign);
  } catch (error) {
    handleOffersError(res, error, 'Error updating campaign');
  }
};

export const deleteCampaign = async (req: Request, res: Response): Promise<void> => {
  try {
    await offerCampaignService.deleteCampaign(Number(req.params.id));
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    handleOffersError(res, error, 'Error deleting campaign');
  }
};

export const addOrUpdateCampaignItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const item = await offerItemService.addOrUpdateCampaignItem(
      Number(req.params.campaignId),
      req.body,
    );
    res.json(item);
  } catch (error) {
    handleOffersError(res, error, 'Error adding/updating product in campaign');
  }
};

export const removeCampaignItem = async (req: Request, res: Response): Promise<void> => {
  try {
    await offerItemService.removeCampaignItem(Number(req.params.itemId));
    res.json({ message: 'Item removed successfully' });
  } catch (error) {
    handleOffersError(res, error, 'Error removing item from campaign');
  }
};

export const getCampaignSuggestions = async (_req: Request, res: Response): Promise<void> => {
  try {
    const data = await offerAnalyticsService.getCampaignSuggestions();
    res.json({ status: 'success', data });
  } catch (error) {
    handleOffersError(res, error, 'Error generating suggestions');
  }
};

export const addBulkCampaignItems = async (req: Request, res: Response): Promise<void> => {
  try {
    const items = await offerItemService.addBulkCampaignItems(
      Number(req.params.campaignId),
      req.body.items,
    );
    res.json({ status: 'success', data: { items } });
  } catch (error) {
    handleOffersError(res, error, 'Error adding items to campaign');
  }
};

export const getWeeklyOfferRecommendations = async (
  req: Request,
  res: Response,
): Promise<void> => {
  try {
    const data = await offerRecommendationsService.getWeeklyOfferRecommendations({
      week: typeof req.query.week === 'string' ? req.query.week : undefined,
    });
    res.json({ status: 'success', data });
  } catch (error) {
    handleOffersError(res, error, 'Error generating weekly offer recommendations');
  }
};

export const getCampaignComparison = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = await offerAnalyticsService.getCampaignComparison({
      baselineId: typeof req.query.baselineId === 'string' ? req.query.baselineId : undefined,
      targetId: typeof req.query.targetId === 'string' ? req.query.targetId : undefined,
    });
    res.json({ status: 'success', data });
  } catch (error) {
    handleOffersError(res, error, 'Error comparing offer campaigns');
  }
};
