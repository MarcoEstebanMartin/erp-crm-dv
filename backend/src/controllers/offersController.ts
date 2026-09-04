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

function classifyQuesoSubtype(productName: string): 'duro' | 'semiduro' | 'semiblando' | 'blando' | 'rallado' {
  const p = productName.toUpperCase();
  if (p.includes('RALLADO') || p.includes('RALL')) {
    return 'rallado';
  }
  if (
    p.includes('REGG') || p.includes('SARDO') || p.includes('SBRINZ') || 
    p.includes('PEPATO') || p.includes('PROV') || p.includes('GOYA') || 
    p.includes('PARMESANO') || p.includes('ROMANO')
  ) {
    return 'duro';
  }
  if (
    p.includes('PATE') || p.includes('CHEDDAR') || p.includes('DANBO') || 
    p.includes('GOUDA') || p.includes('EDAM') || p.includes('BANQUETE')
  ) {
    return 'semiduro';
  }
  if (
    p.includes('FONT') || p.includes('TYBO') || p.includes('HOLANDO') || 
    p.includes('BARRA') || p.includes('DANIELA')
  ) {
    return 'semiblando';
  }
  return 'blando'; // Cremoso, Por Salut, Mozzarella, Queso Azul, etc.
}

function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

// Recomendaciones semanales inteligentes de rotación paramétrica (Basado en Matrix de PARAMETROS)
export const getWeeklyOfferRecommendations = async (req: Request, res: Response) => {
  try {
    const { week = 'auto', shuffle = 'false', baselineCampaignId } = req.query;
    const isShuffle = shuffle === 'true';

    // 1. Obtener última campaña para determinar semana rotativa
    const campaigns = await prisma.offerCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      take: 1
    });

    let currentWeekNumber = 1;
    if (week === '1') currentWeekNumber = 1;
    else if (week === '2') currentWeekNumber = 2;
    else {
      // Auto-detectar basándose en el título de la última campaña o alternancia
      const last = campaigns[0];
      if (last && (last.title.includes('Semana 1') || last.title.includes('15 de Agosto'))) {
        currentWeekNumber = 2; // Si la última fue Semana 1 / 15 Ago, la siguiente es Semana 2
      } else {
        currentWeekNumber = 1;
      }
    }

    // 2. Traer todos los productos activos de la DB con lotes e historia de ofertas
    const products = await prisma.product.findMany({
      where: { isActive: true },
      include: {
        rubro: true,
        lots: {
          where: { stock: { gt: 0 } },
          orderBy: { expirationDate: 'asc' }
        },
        offerCampaignItems: {
          include: { campaign: true },
          orderBy: { createdAt: 'desc' },
          take: 1
        }
      }
    });

    const fortyFiveDaysFromNow = new Date();
    fortyFiveDaysFromNow.setDate(fortyFiveDaysFromNow.getDate() + 45);

    const helperMatch = (name: string, terms: string[]) => {
      const upper = name.toUpperCase();
      return terms.some(t => upper.includes(t.toUpperCase()));
    };

    const helperExactMatch = (name: string, terms: string[]) => {
      const upper = name.toUpperCase();
      return terms.every(t => upper.includes(t.toUpperCase()));
    };

    const mapProduct = (p: any, group: string, isFixedAlways: boolean = false, isRotatedIn: boolean = false, overrideReason?: string, overrideTag?: string) => {
      const listPriceNum = Number(p.listPrice);
      let suggestedPrice = listPriceNum;
      let tag = overrideTag || null;
      let reason = overrideReason || (isFixedAlways ? 'Fijo Obligatorio (Catálogo)' : isRotatedIn ? `Rotación Semana ${currentWeekNumber}` : 'Sugerido por Stock');

      const earliestLot = p.lots[0];
      if (earliestLot && earliestLot.expirationDate && new Date(earliestLot.expirationDate) <= fortyFiveDaysFromNow) {
        reason = `⚠️ Lote próximo a vencer (${new Date(earliestLot.expirationDate).toLocaleDateString('es-AR')})`;
        tag = tag || '🔥 OPORTUNIDAD';
        suggestedPrice = Math.round(listPriceNum * 0.9);
      } else if (p.stock > 40) {
        tag = tag || '💥 OFERTÓN';
      }

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        stock: p.stock,
        minStock: p.minStock || 5,
        listPrice: listPriceNum,
        suggestedPrice,
        suggestedTag: tag,
        campaignGroup: group,
        isFixedAlways,
        isRotatedIn,
        reason,
        stockStatus: p.stock <= 0 ? 'OUT_OF_STOCK' : p.stock <= (p.minStock || 5) ? 'LOW_STOCK' : 'OK'
      };
    };

    const resultByGroup: Record<string, any[]> = {
      'MELINCUE': [],
      'CREMIGAL': [],
      'R.P.B': [],
      'BEBIDAS': [],
      'ALMACEN': [],
      'ARTICULOS POR CANTIDAD': []
    };

    // ----------------------------------------------------
    // 1. MELINCUE
    // ----------------------------------------------------
    const melincueProds = products.filter(p => helperMatch(p.name, ['MELINCUE']));
    
    // 5 Categorías de 2 productos cada una según Matriz de Parámetros Melincué:
    // 2 Duros, 2 Semiduros, 2 Semiblandos, 2 Blandos, 2 Rallados
    const duros = melincueProds.filter(p => classifyQuesoSubtype(p.name) === 'duro').sort((a,b) => b.stock - a.stock).slice(0, 2);
    const semiduros = melincueProds.filter(p => classifyQuesoSubtype(p.name) === 'semiduro').sort((a,b) => b.stock - a.stock).slice(0, 2);
    const semiblandos = melincueProds.filter(p => classifyQuesoSubtype(p.name) === 'semiblando').sort((a,b) => b.stock - a.stock).slice(0, 2);
    const blandos = melincueProds.filter(p => classifyQuesoSubtype(p.name) === 'blando').sort((a,b) => b.stock - a.stock).slice(0, 2);
    const rallados = melincueProds.filter(p => classifyQuesoSubtype(p.name) === 'rallado').slice(0, 2);

    duros.forEach(p => resultByGroup['MELINCUE'].push(mapProduct(p, 'MELINCUE', false, true, '2 Quesos Duros')));
    semiduros.forEach(p => resultByGroup['MELINCUE'].push(mapProduct(p, 'MELINCUE', false, true, '2 Quesos Semiduros')));
    semiblandos.forEach(p => resultByGroup['MELINCUE'].push(mapProduct(p, 'MELINCUE', false, true, '2 Quesos Semiblandos')));
    blandos.forEach(p => resultByGroup['MELINCUE'].push(mapProduct(p, 'MELINCUE', false, true, '2 Quesos Blandos')));
    rallados.forEach(p => resultByGroup['MELINCUE'].push(mapProduct(p, 'MELINCUE', true, false, '2 Quesos Rallados')));

    // ----------------------------------------------------
    // 2. CREMIGAL
    // ----------------------------------------------------
    const cremigalProds = products.filter(p => helperMatch(p.name, ['CREMIGAL']));

    // Fijos: Untables y Queso Crema
    cremigalProds.filter(p => helperMatch(p.name, ['UNTABLE', 'QUESO CREMA'])).slice(0, 3).forEach(p => {
      resultByGroup['CREMIGAL'].push(mapProduct(p, 'CREMIGAL', true, false, '1 Untable / Queso Crema Obligatorio'));
    });

    // Rotación Semana 1 vs Semana 2
    if (currentWeekNumber === 1) {
      // Leche Polvo 800g, Dulce de Leche 400g, Manteca 200g
      const l800 = cremigalProds.find(p => helperMatch(p.name, ['LECHE EN POLVO', '800']));
      const d400 = cremigalProds.find(p => helperMatch(p.name, ['DULCE DE LECHE', '400']));
      const m200 = cremigalProds.find(p => helperMatch(p.name, ['MANTECA', '200']));
      if (l800) resultByGroup['CREMIGAL'].push(mapProduct(l800, 'CREMIGAL', false, true, 'Rotación Semana 1'));
      if (d400) resultByGroup['CREMIGAL'].push(mapProduct(d400, 'CREMIGAL', false, true, 'Rotación Semana 1'));
      if (m200) resultByGroup['CREMIGAL'].push(mapProduct(m200, 'CREMIGAL', false, true, 'Rotación Semana 1'));
    } else {
      // Leche Polvo 400g, Dulce de Leche 250g/Repostero, Manteca 100g
      const l400 = cremigalProds.find(p => helperMatch(p.name, ['LECHE EN POLVO', '400'])) || cremigalProds.find(p => helperMatch(p.name, ['LECHE EN POLVO']));
      const d250 = cremigalProds.find(p => helperMatch(p.name, ['DULCE DE LECHE', '250'])) || cremigalProds.find(p => helperMatch(p.name, ['REPOSTERO']));
      const m100 = cremigalProds.find(p => helperMatch(p.name, ['MANTECA', '100'])) || cremigalProds.find(p => helperMatch(p.name, ['MANTECA']));
      if (l400) resultByGroup['CREMIGAL'].push(mapProduct(l400, 'CREMIGAL', false, true, 'Rotación Semana 2'));
      if (d250) resultByGroup['CREMIGAL'].push(mapProduct(d250, 'CREMIGAL', false, true, 'Rotación Semana 2'));
      if (m100) resultByGroup['CREMIGAL'].push(mapProduct(m100, 'CREMIGAL', false, true, 'Rotación Semana 2'));
    }

    // Básicos de Cremigal (Sardo, Pategrás, Leche UAT, Yogurt)
    cremigalProds.filter(p => helperMatch(p.name, ['SARDO', 'PATEGRAS', 'LECHE UAT', 'YOGURT'])).slice(0, 5).forEach(p => {
      resultByGroup['CREMIGAL'].push(mapProduct(p, 'CREMIGAL', true, false, 'Básico Fijo Cremigal'));
    });

    // ----------------------------------------------------
    // 3. R.P.B (Baggio / Vida / Mocoretá)
    // ----------------------------------------------------
    const rpbProds = products.filter(p => helperMatch(p.name, ['BAGGIO', 'MOCORETA', 'RPB', 'VIDA']));
    rpbProds.slice(0, 6).forEach(p => {
      resultByGroup['R.P.B'].push(mapProduct(p, 'R.P.B', true, false, 'Jugo Baggio / Vida (Fijo)'));
    });

    // ----------------------------------------------------
    // 4. BEBIDAS
    // ----------------------------------------------------
    const bebidasProds = products.filter(p => helperMatch(p.name, ['FERNET', 'BRANCA', 'CAZALIS', 'CINZANO', 'GANCIA', 'SERNOVA', 'VODKA', 'GIN', 'CAMPARI', 'TERMA', 'VIÑA DE BALBO', 'SANTA JULIA', 'BIANCHI', 'ALAMBRADO', 'DON DAVID', 'PERDIZ', 'ZUCCARDI', 'LOPEZ', 'RURAL']));

    // Fernet Branca Litro y 750ml (Fijos)
    bebidasProds.filter(p => helperMatch(p.name, ['FERNET', 'BRANCA'])).forEach(p => {
      const tag = p.name.includes('1') || p.name.includes('LT') ? 'Cada 6 un. $21200' : 'Cada 12 un. $16112';
      resultByGroup['BEBIDAS'].push(mapProduct(p, 'BEBIDAS', true, false, 'Fernet Branca (Fijo)', tag));
    });

    // Aperitivos y Spirits (Rotación Semana 1 vs 2)
    if (currentWeekNumber === 1) {
      const cazalis = bebidasProds.find(p => helperMatch(p.name, ['CAZALIS', 'LEGER']));
      const sernova = bebidasProds.find(p => helperMatch(p.name, ['SERNOVA', 'VODKA']));
      if (cazalis) resultByGroup['BEBIDAS'].push(mapProduct(cazalis, 'BEBIDAS', false, true, 'Rotación Aperitivos (Semana 1)'));
      if (sernova) resultByGroup['BEBIDAS'].push(mapProduct(sernova, 'BEBIDAS', false, true, 'Rotación Vodkas (Semana 1)'));
    } else {
      const cinzano = bebidasProds.find(p => helperMatch(p.name, ['CINZANO', 'ROSSO']));
      const gancia = bebidasProds.find(p => helperMatch(p.name, ['GANCIA', 'GIN', 'CAMPARI']));
      if (cinzano) resultByGroup['BEBIDAS'].push(mapProduct(cinzano, 'BEBIDAS', false, true, 'Rotación Aperitivos (Semana 2)'));
      if (gancia) resultByGroup['BEBIDAS'].push(mapProduct(gancia, 'BEBIDAS', false, true, 'Rotación Aperitivos (Semana 2)'));
    }

    // Vinos Bodegas (Las Perdices, Zuccardi, Bianchi, López, La Rural)
    bebidasProds.filter(p => helperMatch(p.name, ['BALBO', 'JULIA', 'BIANCHI', 'ALAMBRADO', 'DON DAVID', 'PERDIZ', 'ZUCCARDI', 'LOPEZ', 'RURAL'])).slice(0, 6).forEach(p => {
      resultByGroup['BEBIDAS'].push(mapProduct(p, 'BEBIDAS', true, false, 'Vino Seleccionado de Bodega'));
    });

    // ----------------------------------------------------
    // 5. ALMACEN
    // ----------------------------------------------------
    const almacenProds = products.filter(p => !helperMatch(p.name, ['MELINCUE', 'CREMIGAL', 'BAGGIO', 'MOCORETA', 'BRANCA', 'FERNET']));

    // Giacomo (Fijo)
    almacenProds.filter(p => helperMatch(p.name, ['GIACOMO'])).slice(0, 2).forEach(p => {
      resultByGroup['ALMACEN'].push(mapProduct(p, 'ALMACEN', true, false, 'Capelettini Giacomo (Fijo)'));
    });

    // Mayonesas Natura (Rotación)
    if (currentWeekNumber === 1) {
      almacenProds.filter(p => helperMatch(p.name, ['NATURA', 'MAYONESA']) && helperMatch(p.name, ['125', '500'])).forEach(p => {
        resultByGroup['ALMACEN'].push(mapProduct(p, 'ALMACEN', false, true, 'Rotación Mayonesa Natura (Semana 1)'));
      });
    } else {
      almacenProds.filter(p => helperMatch(p.name, ['NATURA', 'MAYONESA']) && (helperMatch(p.name, ['250', 'KG', '1000']) || !p.name.includes('125'))).slice(0, 2).forEach(p => {
        resultByGroup['ALMACEN'].push(mapProduct(p, 'ALMACEN', false, true, 'Rotación Mayonesa Natura (Semana 2)'));
      });
    }

    // Aderezos, Azúcar, Yerbas, Papeles, Pastas
    const aderezo = almacenProds.find(p => helperMatch(p.name, ['MOSTAZA', 'KETCHUP', 'SALSA GOLF']));
    if (aderezo) resultByGroup['ALMACEN'].push(mapProduct(aderezo, 'ALMACEN', false, true, `Rotación Aderezos (Semana ${currentWeekNumber})`));

    // Yerbas (Andresito, Amanda, Playadito)
    almacenProds.filter(p => helperMatch(p.name, ['ANDRESITO', 'AMANDA', 'PLAYADITO'])).slice(0, 3).forEach(p => {
      resultByGroup['ALMACEN'].push(mapProduct(p, 'ALMACEN', false, true, `Rotación Yerba Mate (Semana ${currentWeekNumber})`));
    });

    // Papeles y Pastas
    almacenProds.filter(p => helperMatch(p.name, ['ROLLO', 'CAMPANITA', 'HIGIENOL', '308', 'RECORD', 'CUMANA', 'MAROLIO', 'ARLISTAN', 'VIRGINIA'])).slice(0, 8).forEach(p => {
      resultByGroup['ALMACEN'].push(mapProduct(p, 'ALMACEN', false, false, 'Almacén de Alta Rotación'));
    });

    // ----------------------------------------------------
    // 6. ARTICULOS POR CANTIDAD (Bultos / Cajas)
    // ----------------------------------------------------
    const bulkProds = products.filter(p => p.stock > 15 && (helperMatch(p.name, ['NATURA', 'ACEITE', '308', 'AZUCAR', 'AMANDA', 'FERNET']) || p.unitsPerBox > 1)).slice(0, 6);
    bulkProds.forEach(p => {
      let bulkTag = 'Llevando por caja descuento especial';
      if (p.name.includes('MAYONESA') && p.name.includes('125')) bulkTag = 'Cada 4 cajas la unidad a $599';
      else if (p.name.includes('MAYONESA') && p.name.includes('250')) bulkTag = 'Cada 3 cajas la unidad a $1369';
      else if (p.name.includes('ACEITE') && p.name.includes('NATURA')) bulkTag = 'Cada 2 cajas la unidad a $3817';
      else if (p.name.includes('308')) bulkTag = 'Cada 1 bolsón la unidad a $1099';
      else if (p.name.includes('AMANDA')) bulkTag = 'Cada 1 pack la unidad a $2699';

      resultByGroup['ARTICULOS POR CANTIDAD'].push(mapProduct(p, 'ARTICULOS POR CANTIDAD', false, false, 'Oferta por Cantidad / Bulto', bulkTag));
    });

    // Desduplicar ítems por id dentro de cada grupo
    Object.keys(resultByGroup).forEach(grp => {
      const seen = new Set<number>();
      resultByGroup[grp] = resultByGroup[grp].filter(item => {
        if (seen.has(item.id)) return false;
        seen.add(item.id);
        return true;
      });
    });

    res.json({
      status: 'success',
      data: {
        detectedWeekNumber: currentWeekNumber,
        weekLabel: `Semana ${currentWeekNumber}`,
        recommendationsByGroup: resultByGroup,
        totalSelected: Object.values(resultByGroup).flat().length
      }
    });
  } catch (error) {
    console.error('Error in getWeeklyOfferRecommendations:', error);
    res.status(500).json({ error: 'Error generating weekly offer recommendations' });
  }
};

// Comparador Side-by-Side entre Oferta Anterior y Oferta Propuesta
export const getCampaignComparison = async (req: Request, res: Response) => {
  try {
    const { baselineId, targetId } = req.query;

    const allCampaigns = await prisma.offerCampaign.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, createdAt: true }
    });

    let baselineCampaign = null;
    let targetCampaign = null;

    if (baselineId) {
      baselineCampaign = await prisma.offerCampaign.findUnique({
        where: { id: Number(baselineId) },
        include: { items: { include: { product: true } } }
      });
    } else {
      // Si hay más de 1 campaña, la anteúltima es baseline; si hay 1, esa es la baseline
      const bId = allCampaigns.length > 1 ? allCampaigns[1].id : (allCampaigns[0]?.id || null);
      if (bId) {
        baselineCampaign = await prisma.offerCampaign.findUnique({
          where: { id: bId },
          include: { items: { include: { product: true } } }
        });
      }
    }

    if (targetId) {
      targetCampaign = await prisma.offerCampaign.findUnique({
        where: { id: Number(targetId) },
        include: { items: { include: { product: true } } }
      });
    } else {
      const tId = allCampaigns[0]?.id || null;
      if (tId) {
        targetCampaign = await prisma.offerCampaign.findUnique({
          where: { id: tId },
          include: { items: { include: { product: true } } }
        });
      }
    }

    const baselineItems = baselineCampaign?.items || [];
    const targetItems = targetCampaign?.items || [];

    const baselineProductIds = new Set(baselineItems.map(i => i.productId));
    const targetProductIds = new Set(targetItems.map(i => i.productId));

    const retained = targetItems.filter(i => baselineProductIds.has(i.productId));
    const addedByRotation = targetItems.filter(i => !baselineProductIds.has(i.productId));
    const removedByRotation = baselineItems.filter(i => !targetProductIds.has(i.productId));
    const stockAlerts = targetItems.filter(i => (i.product?.stock || 0) <= 0);

    // Mapa unificado de productos para matriz Side-by-Side por Marca / Rubro
    const productMap = new Map<number, {
      productId: number;
      productName: string;
      sku: string;
      group: string;
      baselinePrice: number | null;
      baselineTag: string | null;
      targetPrice: number | null;
      targetTag: string | null;
      priceDiff: number | null;
      priceDiffPercent: number | null;
      status: 'NEW' | 'REMOVED' | 'INCREASE' | 'DECREASE' | 'UNCHANGED';
    }>();

    const helperGroup = (item: any): string => {
      if (item.campaignGroup) return item.campaignGroup.toUpperCase();
      const pName = (item.product?.name || '').toUpperCase();
      if (pName.includes('MELINCUE')) return 'MELINCUE';
      if (pName.includes('CREMIGAL')) return 'CREMIGAL';
      if (pName.includes('BAGGIO') || pName.includes('MOCORETA') || pName.includes('VIDA') || pName.includes('RPB')) return 'R.P.B';
      if (pName.includes('FERNET') || pName.includes('BRANCA') || pName.includes('VINO') || pName.includes('BALBO') || pName.includes('BIANCHI') || pName.includes('SERNOVA') || pName.includes('CAZALIS') || pName.includes('CINZANO')) return 'BEBIDAS';
      return 'ALMACEN';
    };

    // Agregar ítems de baseline
    for (const bItem of baselineItems) {
      const pid = bItem.productId;
      const grp = helperGroup(bItem);
      const bPrice = Number(bItem.offerPrice);
      productMap.set(pid, {
        productId: pid,
        productName: bItem.product?.name || `Producto #${pid}`,
        sku: bItem.product?.sku || '',
        group: grp,
        baselinePrice: bPrice,
        baselineTag: bItem.specialTag || null,
        targetPrice: null,
        targetTag: null,
        priceDiff: null,
        priceDiffPercent: null,
        status: 'REMOVED'
      });
    }

    // Agregar/cruzar ítems de target
    for (const tItem of targetItems) {
      const pid = tItem.productId;
      const grp = helperGroup(tItem);
      const tPrice = Number(tItem.offerPrice);
      const existing = productMap.get(pid);

      if (existing) {
        existing.targetPrice = tPrice;
        existing.targetTag = tItem.specialTag || null;
        const bPrice = existing.baselinePrice;
        if (bPrice !== null) {
          const diff = tPrice - bPrice;
          existing.priceDiff = diff;
          existing.priceDiffPercent = bPrice > 0 ? Number(((diff / bPrice) * 100).toFixed(1)) : 0;
          if (diff > 0.01) existing.status = 'INCREASE';
          else if (diff < -0.01) existing.status = 'DECREASE';
          else existing.status = 'UNCHANGED';
        }
      } else {
        productMap.set(pid, {
          productId: pid,
          productName: tItem.product?.name || `Producto #${pid}`,
          sku: tItem.product?.sku || '',
          group: grp,
          baselinePrice: null,
          baselineTag: null,
          targetPrice: tPrice,
          targetTag: tItem.specialTag || null,
          priceDiff: null,
          priceDiffPercent: null,
          status: 'NEW'
        });
      }
    }

    // Agrupar la matriz por Marca/Rubro
    const comparisonByGroup: Record<string, any[]> = {
      'MELINCUE': [],
      'CREMIGAL': [],
      'R.P.B': [],
      'BEBIDAS': [],
      'ALMACEN': [],
      'ARTICULOS POR CANTIDAD': [],
      'OTROS': []
    };

    for (const row of productMap.values()) {
      const gKey = comparisonByGroup[row.group] ? row.group : 'OTROS';
      comparisonByGroup[gKey].push(row);
    }

    // Eliminar grupos vacíos
    Object.keys(comparisonByGroup).forEach(k => {
      if (comparisonByGroup[k].length === 0) delete comparisonByGroup[k];
    });

    res.json({
      status: 'success',
      data: {
        baselineId: baselineCampaign?.id || null,
        baselineTitle: baselineCampaign?.title || 'Oferta Semana Anterior (15-08)',
        targetId: targetCampaign?.id || null,
        targetTitle: targetCampaign?.title || 'Ofertas Nuevas Esta Semana',
        allCampaigns,
        retainedCount: retained.length,
        addedCount: addedByRotation.length,
        removedCount: removedByRotation.length,
        stockAlertsCount: stockAlerts.length,
        comparisonByGroup,
        details: {
          retained,
          addedByRotation,
          removedByRotation,
          stockAlerts
        }
      }
    });
  } catch (error) {
    console.error('Error in getCampaignComparison:', error);
    res.status(500).json({ error: 'Error comparing offer campaigns' });
  }
};


