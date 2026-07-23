import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { Role, OrderStatus, BillingType, InvoiceType } from '@prisma/client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'seguridad-erp-distribuidora-2026-key-local-development';

/**
 * Mapeo oficial exacto respetando los Títulos del Gestor de Ofertas
 */
const RUBRO_TO_COMMERCIAL_FAMILY: Record<string, { family: string; icon: string }> = {
  'REMOTTI': { family: 'Refrigerados', icon: '❄️' },
  'LECHES': { family: 'Refrigerados', icon: '❄️' },
  'SANCOR y CREMIGAL': { family: 'Refrigerados', icon: '❄️' },
  'QUESOS RALLADOS': { family: 'Refrigerados', icon: '❄️' },
  'SODECAR': { family: 'Fiambres', icon: '🧀' },
  'A.G.D Y NIZA': { family: 'Aderezos y Aceites', icon: '🌻' },
  'BEBIDAS': { family: 'Bebidas', icon: '🥤' },
  'PASTAS SECAS': { family: 'Pastas Secas', icon: '🍝' },
  'CONSERVAS': { family: 'Conservas', icon: '🥫' },
  'PESCADERIA': { family: 'Pescadería', icon: '🐟' },
  'PAPELES': { family: 'Papeles', icon: '🧻' },
  'NO COMESTIBLES': { family: 'No comestibles', icon: '📦' },
  'REGALERIA': { family: 'Estucheria y Regalerìa', icon: '🎁' },
  'ARROZ': { family: 'Pastas Secas', icon: '🌾' },
  'CAFE': { family: 'Varios', icon: '☕' },
  'YERBAS': { family: 'Varios', icon: '🧉' },
  'AZUCAR': { family: 'Varios', icon: '🍬' },
  'EDULCORANTES': { family: 'Varios', icon: '☕' }
};

/**
 * Obtener o crear de forma transparente el usuario Vendedor "tienda_online"
 */
async function getTiendaOnlineUser() {
  let user = await prisma.user.findFirst({
    where: { username: 'tienda_online' }
  });

  if (!user) {
    user = await prisma.user.create({
      data: {
        username: 'tienda_online',
        passwordHash: '$2b$10$TiendaOnlineSystemVirtualSellerHashKey2026',
        role: Role.VENDEDOR,
        isActive: true
      }
    });
  }

  return user;
}

/**
 * Autenticación / Ingreso de Cliente para la Tienda Online
 */
export async function loginClient(req: Request, res: Response): Promise<void> {
  try {
    const { cuitOrCode, search } = req.body;
    const queryTerm = (cuitOrCode || search || '').trim();

    if (!queryTerm) {
      res.status(200).json({
        status: 'success',
        data: { clients: [] }
      });
      return;
    }

    const clients = await prisma.persona.findMany({
      where: {
        isClient: true,
        isActive: true,
        OR: [
          { cuit: { contains: queryTerm } },
          { name: { contains: queryTerm, mode: 'insensitive' } },
          ...(isNaN(Number(queryTerm)) ? [] : [{ id: Number(queryTerm) }])
        ]
      },
      select: {
        id: true,
        name: true,
        cuit: true,
        address: true,
        city: true,
        priceList: true,
        discount: true,
        outstandingBalance: true,
        creditLimit: true,
        paymentTermDays: true
      },
      take: 10,
      orderBy: { name: 'asc' }
    });

    if (clients.length === 0) {
      res.status(404).json({
        status: 'error',
        message: 'No se encontró ningún cliente activo con el CUIT o nombre ingresado.'
      });
      return;
    }

    if (clients.length === 1) {
      const client = clients[0];
      const token = jwt.sign(
        {
          personaId: client.id,
          name: client.name,
          cuit: client.cuit,
          priceList: client.priceList || 'A',
          role: 'CLIENTE'
        },
        JWT_SECRET,
        { expiresIn: '30d' }
      );

      res.status(200).json({
        status: 'success',
        data: {
          token,
          client: {
            id: client.id,
            name: client.name,
            cuit: client.cuit,
            address: client.address,
            city: client.city,
            priceList: client.priceList || 'A',
            discount: Number(client.discount || 0),
            outstandingBalance: Number(client.outstandingBalance || 0),
            creditLimit: Number(client.creditLimit || 0),
            paymentTermDays: client.paymentTermDays || 30
          }
        }
      });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: { clients }
    });
  } catch (error: any) {
    console.error('⚠️ Error en loginClient:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al iniciar sesión de cliente en la tienda.'
    });
  }
}

/**
 * Obtener el catálogo interactivo para la Tienda Online
 * Respetando los Títulos del Gestor de Ofertas con "Refrigerados" al principio.
 */
export async function getStoreCatalog(req: Request, res: Response): Promise<void> {
  try {
    const { priceList = 'A', rubroId, search } = req.query;
    const requestedList = String(priceList).toUpperCase();

    const whereClause: any = {
      isActive: true
    };

    if (rubroId) {
      whereClause.rubroId = Number(rubroId);
    }

    if (search && String(search).trim() !== '') {
      const term = String(search).trim();
      whereClause.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { sku: { contains: term, mode: 'insensitive' } },
        { barcode: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } }
      ];
    }

    const [products, rubros, activeCampaigns] = await Promise.all([
      prisma.product.findMany({
        where: whereClause,
        include: {
          rubro: { select: { id: true, name: true } },
          offerCampaignItems: {
            include: { campaign: { select: { id: true, title: true, isActive: true } } }
          }
        },
        orderBy: { name: 'asc' }
      }),
      prisma.rubro.findMany({
        orderBy: { name: 'asc' }
      }),
      prisma.offerCampaign.findMany({
        where: { isActive: true },
        include: {
          items: {
            include: {
              product: { select: { id: true, rubro: { select: { name: true } } } }
            }
          }
        }
      })
    ]);

    const productCampaignGroupMap = new Map<number, string>();
    const configuredGroupsSet = new Set<string>();
    let campaignCustomOrder: string[] = [];

    activeCampaigns.forEach((camp) => {
      if (camp.customRubroOrder && Array.isArray(camp.customRubroOrder) && camp.customRubroOrder.length > 0) {
        campaignCustomOrder = camp.customRubroOrder;
        camp.customRubroOrder.forEach((g) => configuredGroupsSet.add(g));
      }
      camp.items.forEach((item) => {
        const groupName = item.campaignGroup || item.product?.rubro?.name || 'Varios';
        productCampaignGroupMap.set(item.productId, groupName);
        configuredGroupsSet.add(groupName);
      });
    });

    const groupIconsMap: Record<string, string> = {
      'Refrigerados': '❄️',
      'Fiambres': '🧀',
      'Bebidas': '🥤',
      'Bebidas Alcoholicas': '🍺',
      'Vinos': '🍷',
      'Aderezos y Aceites': '🌻',
      'Pastas Secas': '🍝',
      'Conservas': '🥫',
      'Pescadería': '🐟',
      'PESCADERIA': '🐟',
      'Papeles': '🧻',
      'No comestibles': '📦',
      'Estucheria y Regalerìa': '🎁',
      'Varios': '🏷️'
    };

    const formattedProducts = products.map((p) => {
      let finalPrice = Number(p.listPrice);
      if (requestedList.includes('B') && Number(p.listPriceB) > 0) {
        finalPrice = Number(p.listPriceB);
      } else if (requestedList.includes('C') && Number(p.listPriceC) > 0) {
        finalPrice = Number(p.listPriceC);
      }

      const activeOfferItem = p.offerCampaignItems.find((item) => item.campaign && item.campaign.isActive);
      const isOffer = !!activeOfferItem;
      if (activeOfferItem && Number(activeOfferItem.offerPrice) > 0) {
        finalPrice = Number(activeOfferItem.offerPrice);
      }

      // Asignación de grupo respetando los Títulos de Ofertas
      let assignedGroup = productCampaignGroupMap.get(p.id);
      if (!assignedGroup && p.rubro?.name) {
        const mapped = RUBRO_TO_COMMERCIAL_FAMILY[p.rubro.name.toUpperCase().trim()];
        if (mapped) {
          assignedGroup = mapped.family;
        } else {
          assignedGroup = p.rubro.name;
        }
      }
      if (!assignedGroup) assignedGroup = 'Varios';

      const groupIcon = groupIconsMap[assignedGroup] || (RUBRO_TO_COMMERCIAL_FAMILY[p.rubro?.name || '']?.icon) || '📦';

      return {
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        barcode: p.barcode,
        price: finalPrice,
        listPriceA: Number(p.listPrice),
        listPriceB: Number(p.listPriceB),
        listPriceC: Number(p.listPriceC),
        stock: p.stock,
        isPesable: p.isPesable,
        unitsPerBox: p.unitsPerBox || 1,
        imageUrl: p.imageUrl,
        rubroId: p.rubroId,
        rubroName: p.rubro?.name || 'General',
        commercialGroupId: assignedGroup.toLowerCase().replace(/\s+/g, '-'),
        commercialGroupName: assignedGroup,
        commercialGroupIcon: groupIcon,
        isOffer,
        offerDiscount: 0,
        offerName: activeOfferItem ? activeOfferItem.campaign.title : null
      };
    });

    // Orden por defecto respetando "Refrigerados" al principio
    const defaultPriorityOrder = [
      'Refrigerados',
      'Fiambres',
      'Bebidas',
      'Bebidas Alcoholicas',
      'Aderezos y Aceites',
      'Pastas Secas',
      'Conservas',
      'Pescadería',
      'Papeles',
      'No comestibles',
      'Estucheria y Regalerìa',
      'Varios'
    ];

    const uniqueGroupNames: string[] = [];

    // Priorizar customRubroOrder si fue configurado en la campaña activa
    if (campaignCustomOrder.length > 0) {
      campaignCustomOrder.forEach((g) => {
        if (!uniqueGroupNames.includes(g)) uniqueGroupNames.push(g);
      });
    } else {
      defaultPriorityOrder.forEach((g) => {
        if (!uniqueGroupNames.includes(g)) uniqueGroupNames.push(g);
      });
    }

    configuredGroupsSet.forEach((g) => {
      if (!uniqueGroupNames.includes(g)) uniqueGroupNames.push(g);
    });

    formattedProducts.forEach((p) => {
      if (p.commercialGroupName && !uniqueGroupNames.includes(p.commercialGroupName)) {
        uniqueGroupNames.push(p.commercialGroupName);
      }
    });

    const commercialGroups = [
      { id: 'all', name: 'Todas las Ofertas', icon: '🔥' },
      ...uniqueGroupNames.map((groupName) => ({
        id: groupName.toLowerCase().replace(/\s+/g, '-'),
        name: groupName,
        icon: groupIconsMap[groupName] || (RUBRO_TO_COMMERCIAL_FAMILY[groupName]?.icon) || '📦'
      }))
    ];

    res.status(200).json({
      status: 'success',
      data: {
        products: formattedProducts,
        commercialGroups,
        rubros
      }
    });
  } catch (error: any) {
    console.error('⚠️ Error en getStoreCatalog:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener catálogo de productos.'
    });
  }
}

/**
 * Obtener estado de Cuenta Corriente e información del cliente
 */
export async function getClientAccount(req: Request, res: Response): Promise<void> {
  try {
    const personaId = Number(req.params.personaId || req.query.personaId);

    if (!personaId) {
      res.status(400).json({ status: 'error', message: 'Se requiere personaId.' });
      return;
    }

    const client = await prisma.persona.findUnique({
      where: { id: personaId },
      include: {
        orders: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            movementId: true,
            status: true,
            totalAmount: true,
            createdAt: true,
            invoiceType: true,
            invoiceNumber: true
          }
        }
      }
    });

    if (!client) {
      res.status(404).json({ status: 'error', message: 'Cliente no encontrado.' });
      return;
    }

    res.status(200).json({
      status: 'success',
      data: {
        client: {
          id: client.id,
          name: client.name,
          cuit: client.cuit,
          address: client.address,
          city: client.city,
          outstandingBalance: Number(client.outstandingBalance || 0),
          creditLimit: Number(client.creditLimit || 0),
          priceList: client.priceList || 'A',
          discount: Number(client.discount || 0)
        },
        recentOrders: client.orders
      }
    });
  } catch (error: any) {
    console.error('⚠️ Error en getClientAccount:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener estado de cuenta del cliente.'
    });
  }
}

/**
 * Cargar un pedido desde la Tienda Online
 */
export async function createStoreOrder(req: Request, res: Response): Promise<void> {
  try {
    const { personaId, items, notes } = req.body;

    if (!personaId || !items || !Array.isArray(items) || items.length === 0) {
      res.status(400).json({
        status: 'error',
        message: 'Faltan datos requeridos (personaId e items).'
      });
      return;
    }

    const client = await prisma.persona.findUnique({
      where: { id: Number(personaId) }
    });

    if (!client) {
      res.status(404).json({ status: 'error', message: 'Cliente no encontrado.' });
      return;
    }

    const tiendaUser = await getTiendaOnlineUser();

    let totalNeto = 0;
    const orderItemsData = [];
    let totalBultos = 0;

    for (const item of items) {
      const product = await prisma.product.findUnique({
        where: { id: Number(item.productId) }
      });

      if (!product) continue;

      const qty = Math.max(1, Number(item.quantity || 1));
      const price = Number(item.unitPrice || product.listPrice);
      const subtotal = price * qty;

      totalNeto += subtotal;
      totalBultos += Math.ceil(qty / (product.unitsPerBox || 1));

      orderItemsData.push({
        productId: product.id,
        quantity: qty,
        unitPrice: price,
        subtotal: subtotal
      });
    }

    if (orderItemsData.length === 0) {
      res.status(400).json({ status: 'error', message: 'Los productos seleccionados no son válidos.' });
      return;
    }

    const taxAmount = totalNeto * 0.21;
    const totalAmount = totalNeto + taxAmount;

    const newOrder = await prisma.order.create({
      data: {
        personaId: client.id,
        sellerId: tiendaUser.id,
        billingType: BillingType.INTERNAL,
        invoiceType: InvoiceType.PRESUPUESTO,
        status: OrderStatus.PENDING,
        netAmount: totalNeto,
        taxAmount: taxAmount,
        totalAmount: totalAmount,
        bultosCount: totalBultos,
        bultosDetails: {
          notes: notes ? String(notes).trim() : '',
          channel: 'Tienda Online',
          isWebOrder: true,
          clientName: client.name,
          createdFromWeb: new Date().toISOString()
        },
        items: {
          create: orderItemsData
        }
      },
      include: {
        persona: { select: { id: true, name: true, cuit: true } },
        items: { include: { product: { select: { name: true, sku: true } } } }
      }
    });

    res.status(201).json({
      status: 'success',
      message: '¡Pedido enviado con éxito! Un representante procesará tu solicitud.',
      data: newOrder
    });
  } catch (error: any) {
    console.error('⚠️ Error en createStoreOrder:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al procesar el pedido de la tienda online.'
    });
  }
}

/**
 * Obtener historial de pedidos del cliente
 */
export async function getClientOrders(req: Request, res: Response): Promise<void> {
  try {
    const personaId = Number(req.params.personaId || req.query.personaId);

    if (!personaId) {
      res.status(400).json({ status: 'error', message: 'Se requiere personaId.' });
      return;
    }

    const orders = await prisma.order.findMany({
      where: { personaId },
      orderBy: { createdAt: 'desc' },
      include: {
        items: {
          include: {
            product: { select: { id: true, name: true, sku: true, imageUrl: true } }
          }
        }
      }
    });

    res.status(200).json({
      status: 'success',
      data: { orders }
    });
  } catch (error: any) {
    console.error('⚠️ Error en getClientOrders:', error);
    res.status(500).json({
      status: 'error',
      message: 'Error al obtener historial de pedidos.'
    });
  }
}
