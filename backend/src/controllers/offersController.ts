import { Request, Response } from 'express';
import prisma from '../utils/prisma';

// Crear una nueva campaña
export const createCampaign = async (req: Request, res: Response) => {
  try {
    const { title, startDate, endDate, isActive } = req.body;
    
    const campaign = await prisma.offerCampaign.create({
      data: {
        title,
        startDate: startDate ? new Date(startDate) : new Date(),
        endDate: endDate ? new Date(endDate) : null,
        isActive: isActive !== undefined ? isActive : true
      }
    });
    
    res.status(201).json(campaign);
  } catch (error) {
    console.error('Error creating campaign:', error);
    res.status(500).json({ error: 'Error creating campaign' });
  }
};

// Obtener todas las campañas
export const getCampaigns = async (req: Request, res: Response) => {
  try {
    const campaigns = await prisma.offerCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true }
        }
      }
    });
    res.json(campaigns);
  } catch (error) {
    console.error('Error getting campaigns:', error);
    res.status(500).json({ error: 'Error fetching campaigns' });
  }
};

// Obtener una campaña por ID (con todos sus items)
export const getCampaignById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const campaign = await prisma.offerCampaign.findUnique({
      where: { id: parseInt(id as string) },
      include: {
        items: {
          include: {
            product: {
              include: {
                rubro: true
              }
            }
          }
        }
      }
    });
    
    if (!campaign) {
      return res.status(404).json({ error: 'Campaign not found' });
    }
    
    res.json(campaign);
  } catch (error) {
    console.error('Error fetching campaign:', error);
    res.status(500).json({ error: 'Error fetching campaign details' });
  }
};

// Actualizar campaña (título, fechas, etc)
export const updateCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, startDate, endDate, isActive, customRubroOrder } = req.body;
    
    const campaign = await prisma.offerCampaign.update({
      where: { id: parseInt(id as string) },
      data: {
        title,
        startDate: startDate ? new Date(startDate) : undefined,
        endDate: endDate ? new Date(endDate) : null,
        isActive,
        customRubroOrder: customRubroOrder !== undefined ? customRubroOrder : undefined
      }
    });
    
    res.json(campaign);
  } catch (error) {
    console.error('Error updating campaign:', error);
    res.status(500).json({ error: 'Error updating campaign' });
  }
};

// Eliminar campaña
export const deleteCampaign = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.offerCampaign.delete({
      where: { id: parseInt(id as string) }
    });
    res.json({ message: 'Campaign deleted successfully' });
  } catch (error) {
    console.error('Error deleting campaign:', error);
    res.status(500).json({ error: 'Error deleting campaign' });
  }
};

// Agregar o actualizar un producto dentro de una campaña
export const addOrUpdateCampaignItem = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { productId, offerPrice, previousPrice, specialTag, showListPrice, campaignGroup } = req.body;
    
    const item = await prisma.offerCampaignItem.upsert({
      where: {
        campaignId_productId: {
          campaignId: parseInt(campaignId as string),
          productId: parseInt(productId as string)
        }
      },
      update: {
        offerPrice,
        previousPrice: previousPrice !== undefined ? previousPrice : null,
        specialTag,
        showListPrice: showListPrice !== undefined ? showListPrice : false,
        campaignGroup: campaignGroup || null
      },
      create: {
        campaignId: parseInt(campaignId as string),
        productId: parseInt(productId as string),
        offerPrice,
        previousPrice: previousPrice !== undefined ? previousPrice : null,
        specialTag,
        showListPrice: showListPrice !== undefined ? showListPrice : false,
        campaignGroup: campaignGroup || null
      },
      include: {
        product: true
      }
    });
    
    res.json(item);
  } catch (error) {
    console.error('Error adding/updating campaign item:', error);
    res.status(500).json({ error: 'Error adding/updating product in campaign' });
  }
};

// Quitar un producto de una campaña
export const removeCampaignItem = async (req: Request, res: Response) => {
  try {
    const { itemId } = req.params;
    
    await prisma.offerCampaignItem.delete({
      where: { id: parseInt(itemId as string) }
    });
    
    res.json({ message: 'Item removed successfully' });
  } catch (error) {
    console.error('Error removing campaign item:', error);
    res.status(500).json({ error: 'Error removing item from campaign' });
  }
};

// Generar sugerencias inteligentes
export const getCampaignSuggestions = async (req: Request, res: Response) => {
  try {
    // 1. Próximos a Vencer (Lotes < 45 días)
    const fortyFiveDaysFromNow = new Date();
    fortyFiveDaysFromNow.setDate(fortyFiveDaysFromNow.getDate() + 45);

    const expiringLots = await prisma.productLot.findMany({
      where: {
        stock: { gt: 0 },
        expirationDate: { lte: fortyFiveDaysFromNow }
      },
      include: {
        product: true
      },
      orderBy: { expirationDate: 'asc' },
      take: 20
    });

    const expiringProductsMap = new Map();
    expiringLots.forEach(lot => {
      if (!expiringProductsMap.has(lot.productId) && lot.product.isActive) {
        expiringProductsMap.set(lot.productId, lot.product);
      }
    });
    const expiringSuggestions = Array.from(expiringProductsMap.values()).slice(0, 10);

    // 2. Sobre Stock (stock > 50 y stock > minStock * 2)
    const overstockProducts = await prisma.product.findMany({
      where: {
        isActive: true,
        stock: { gt: 50 },
      },
      orderBy: { stock: 'desc' },
      take: 50
    });
    
    // Filtrar los que tengan stock > max(20, minStock * 2)
    const overstockSuggestions = overstockProducts
      .filter(p => p.stock > Math.max(20, p.minStock * 2))
      .filter(p => !expiringProductsMap.has(p.id)) // evitar repetidos
      .slice(0, 10);

    // 3. Estructuras (Quesos, Fiambres) con más stock
    const quesos = await prisma.product.findMany({
      where: {
        isActive: true,
        rubro: { name: { contains: 'queso', mode: 'insensitive' } },
        stock: { gt: 0 }
      },
      orderBy: { stock: 'desc' },
      take: 8
    });

    const fiambres = await prisma.product.findMany({
      where: {
        isActive: true,
        rubro: { name: { contains: 'fiambre', mode: 'insensitive' } },
        stock: { gt: 0 }
      },
      orderBy: { stock: 'desc' },
      take: 5
    });

    const almacen = await prisma.product.findMany({
      where: {
        isActive: true,
        rubro: { name: { contains: 'almacen', mode: 'insensitive' } },
        stock: { gt: 0 }
      },
      orderBy: { stock: 'desc' },
      take: 4
    });

    const frescos = await prisma.product.findMany({
      where: {
        isActive: true,
        rubro: { name: { contains: 'lacteo', mode: 'insensitive' } },
        stock: { gt: 0 }
      },
      orderBy: { stock: 'desc' },
      take: 3
    });

    res.json({
      status: 'success',
      data: {
        expiring: expiringSuggestions,
        overstock: overstockSuggestions,
        structures: {
          quesos,
          fiambres,
          almacen,
          frescos
        }
      }
    });
  } catch (error) {
    console.error('Error generating suggestions:', error);
    res.status(500).json({ error: 'Error generating suggestions' });
  }
};

// Agregar múltiples items a una campaña
export const addBulkCampaignItems = async (req: Request, res: Response) => {
  try {
    const { campaignId } = req.params;
    const { items } = req.body;
    
    if (!Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'No items provided' });
    }

    const cid = parseInt(campaignId as string);

    // Upsert each item
    const results = await Promise.all(
      items.map(async (item: any) => {
        return prisma.offerCampaignItem.upsert({
          where: {
            campaignId_productId: {
              campaignId: cid,
              productId: parseInt(item.productId)
            }
          },
          update: {
            offerPrice: item.offerPrice,
            previousPrice: item.previousPrice !== undefined ? item.previousPrice : null,
            specialTag: item.specialTag,
            showListPrice: item.showListPrice !== undefined ? item.showListPrice : false,
            campaignGroup: item.campaignGroup || null
          },
          create: {
            campaignId: cid,
            productId: parseInt(item.productId),
            offerPrice: item.offerPrice,
            previousPrice: item.previousPrice !== undefined ? item.previousPrice : null,
            specialTag: item.specialTag,
            showListPrice: item.showListPrice !== undefined ? item.showListPrice : false,
            campaignGroup: item.campaignGroup || null
          }
        });
      })
    );

    res.json({ status: 'success', data: { items: results } });
  } catch (error) {
    console.error('Error adding bulk items:', error);
    res.status(500).json({ error: 'Error adding items to campaign' });
  }
};

// Recomendaciones semanales inteligentes de rotación
export const getWeeklyOfferRecommendations = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        rubro: true,
        lots: {
          where: { stock: { gt: 0 } },
          orderBy: { expirationDate: 'asc' }
        },
        offerCampaignItems: {
          include: {
            campaign: true
          },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    const fortyFiveDaysFromNow = new Date();
    fortyFiveDaysFromNow.setDate(fortyFiveDaysFromNow.getDate() + 45);

    const groupedMap: Record<string, any[]> = {};

    for (const p of products) {
      const category = p.commercialCategory || p.rubro?.name || 'Varios';
      if (!groupedMap[category]) groupedMap[category] = [];

      let reason = 'Rotación regular de catálogo';
      let score = 50;
      let suggestedTag: string | null = null;
      let suggestedPrice = Number(p.listPrice);

      const earliestLot = p.lots[0];
      if (earliestLot && earliestLot.expirationDate && new Date(earliestLot.expirationDate) <= fortyFiveDaysFromNow) {
        reason = `Lote próximo a vencer (${new Date(earliestLot.expirationDate).toLocaleDateString('es-AR')})`;
        score += 40;
        suggestedTag = '🔥 OPORTUNIDAD';
        suggestedPrice = Math.round(Number(p.listPrice) * 0.9);
      } else if (p.stock > 40) {
        reason = `Exceso de inventario (${p.stock} un.)`;
        score += 30;
        suggestedTag = '💥 MEGA OFERTA';
      } else if (!p.offerCampaignItems || p.offerCampaignItems.length === 0) {
        reason = 'Sin oferta en campañas previas';
        score += 20;
      } else {
        const lastCampaignDate = p.offerCampaignItems[0]?.campaign?.createdAt;
        if (lastCampaignDate) {
          const daysDiff = Math.floor((Date.now() - new Date(lastCampaignDate).getTime()) / (1000 * 60 * 60 * 24));
          if (daysDiff > 14) {
            reason = `Rotación (${Math.floor(daysDiff / 7)} sem. sin oferta)`;
            score += 25;
          }
        }
      }

      groupedMap[category].push({
        id: p.id,
        sku: p.sku,
        name: p.name,
        stock: p.stock,
        listPrice: Number(p.listPrice),
        suggestedPrice,
        suggestedTag,
        category,
        reason,
        score
      });
    }

    const resultByGroup: Record<string, any[]> = {};
    for (const [cat, items] of Object.entries(groupedMap)) {
      items.sort((a, b) => b.score - a.score);
      resultByGroup[cat] = items.slice(0, 6);
    }

    res.json({
      status: 'success',
      data: {
        recommendationsByGroup: resultByGroup
      }
    });
  } catch (error) {
    console.error('Error in getWeeklyOfferRecommendations:', error);
    res.status(500).json({ error: 'Error generating weekly offer recommendations' });
  }
};

