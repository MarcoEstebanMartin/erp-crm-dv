import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';

export interface CreateCampaignInput {
  title: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  isActive?: boolean;
}

export interface UpdateCampaignInput {
  title?: string;
  startDate?: string | Date | null;
  endDate?: string | Date | null;
  isActive?: boolean;
  customRubroOrder?: any;
}

export const offerCampaignService = {
  async createCampaign(input: CreateCampaignInput) {
    if (!input.title || !input.title.trim()) {
      throw new AppError('Campaign title is required', 400);
    }

    return prisma.offerCampaign.create({
      data: {
        title: input.title.trim(),
        startDate: input.startDate ? new Date(input.startDate) : new Date(),
        endDate: input.endDate ? new Date(input.endDate) : null,
        isActive: input.isActive !== undefined ? input.isActive : true,
      },
    });
  },

  async getCampaigns() {
    return prisma.offerCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true },
        },
      },
    });
  },

  async getCampaignById(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('Invalid campaign ID', 400);
    }

    const campaign = await prisma.offerCampaign.findUnique({
      where: { id },
      include: {
        items: {
          include: {
            product: {
              include: {
                rubro: true,
              },
            },
          },
        },
      },
    });

    if (!campaign) {
      throw new AppError('Campaign not found', 404);
    }

    return campaign;
  },

  async updateCampaign(id: number, input: UpdateCampaignInput) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('Invalid campaign ID', 400);
    }

    return prisma.offerCampaign.update({
      where: { id },
      data: {
        title: input.title,
        startDate: input.startDate ? new Date(input.startDate) : undefined,
        endDate: input.endDate ? new Date(input.endDate) : null,
        isActive: input.isActive,
        customRubroOrder:
          input.customRubroOrder !== undefined ? input.customRubroOrder : undefined,
      },
    });
  },

  async deleteCampaign(id: number) {
    if (!Number.isInteger(id) || id <= 0) {
      throw new AppError('Invalid campaign ID', 400);
    }

    await prisma.offerCampaign.delete({
      where: { id },
    });
  },
};
