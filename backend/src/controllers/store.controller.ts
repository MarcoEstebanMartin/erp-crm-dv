import { Request, Response } from 'express';
import prisma from '../utils/prisma';
import { Role, OrderStatus, BillingType, InvoiceType } from '@prisma/client';
import jwt from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'seguridad-erp-distribuidora-2026-key-local-development';

/**
 * Mapeo oficial de Rubros del ERP a la Categoría Comercial de la Tienda Online
 */
const RUBRO_TO_COMMERCIAL_CATEGORY: Record<string, { category: string; icon: string }> = {
  'REMOTTI': { category: 'REFRIGERADOS', icon: '❄️' },
  'LECHES': { category: 'REFRIGERADOS', icon: '❄️' },
  'SANCOR y CREMIGAL': { category: 'REFRIGERADOS', icon: '❄️' },
  'SANCOR Y CREMIGAL': { category: 'REFRIGERADOS', icon: '❄️' },
  'QUESOS RALLADOS': { category: 'REFRIGERADOS', icon: '❄️' },
  'SODECAR': { category: 'FIAMBRES', icon: '🥓' },
  'A.G.D Y NIZA': { category: 'ADEREZOS Y ACEITES', icon: '🌻' },
  'BEBIDAS': { category: 'BEBIDAS', icon: '🥤' },
  'PASTAS SECAS': { category: 'PASTAS SECAS', icon: '🍝' },
  'CONSERVAS': { category: 'CONSERVAS', icon: '🥫' },
  'PESCADERIA': { category: 'PESCADERÍA', icon: '🐟' },
  'PESCADERÍA': { category: 'PESCADERÍA', icon: '🐟' },
  'PAPELES': { category: 'PAPELES', icon: '🧻' },
  'NO COMESTIBLES': { category: 'NO COMESTIBLES', icon: '📦' },
  'REGALERIA': { category: 'ESTUCHERIA Y REGALERÍA', icon: '🎁' },
  'ARROZ': { category: 'PASTAS SECAS', icon: '🌾' },
  'CAFE': { category: 'CONSERVAS', icon: '☕' },
  'YERBAS': { category: 'PASTAS SECAS', icon: '🧉' },
  'AZUCAR': { category: 'PASTAS SECAS', icon: '🍬' },
  'EDULCORANTES': { category: 'PASTAS SECAS', icon: '☕' }
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
    const { cuitOrCode, search, pin, clientId } = req.body;
    const queryTerm = (cuitOrCode || search || '').trim();
    const providedPin = (pin || '').trim();

    if (!queryTerm && !clientId) {
      res.status(200).json({
        status: 'success',
        data: { clients: [] }
      });
      return;
    }

    let client: any = null;

    if (clientId) {
      client = await prisma.persona.findUnique({
        where: { id: Number(clientId) },
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
          paymentTermDays: true,
          webPin: true
        }
      });
    } else {
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
          paymentTermDays: true,
          webPin: true
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

      if (clients.length > 1 && !providedPin) {
        res.status(200).json({
          status: 'success',
          data: {
            clients: clients.map((c) => ({
              id: c.id,
              name: c.name,
              cuit: c.cuit,
              city: c.city,
              hasPin: !!c.webPin
            }))
          }
        });
        return;
      }

      client = clients[0];
    }

    if (!client) {
      res.status(404).json({
        status: 'error',
        message: 'Cliente no encontrado.'
      });
      return;
    }

    // VALIDACIÓN O SETEO DE PIN SEGÚN SI TIENE CLAVE GUARDADA
    if (client.webPin) {
      if (!providedPin) {
        res.status(200).json({
          status: 'requires_pin',
          message: 'Ingresá tu PIN secreto para ingresar a la tienda.',
          hasPin: true,
          client: { id: client.id, name: client.name, cuit: client.cuit }
        });
        return;
      }

      if (providedPin !== client.webPin) {
        res.status(401).json({
          status: 'error',
          message: '🔒 PIN de acceso incorrecto. Verificá tu clave o consultá con administración.'
        });
        return;
      }
    } else {
      // Cliente NO tiene PIN configurado todavía
      if (!providedPin) {
        res.status(200).json({
          status: 'requires_pin',
          message: 'Es tu primer ingreso. Creá un PIN secreto de 4 dígitos para proteger tu cuenta.',
          hasPin: false,
          client: { id: client.id, name: client.name, cuit: client.cuit }
        });
        return;
      }

      if (providedPin.length < 4 || providedPin.length > 8) {
        res.status(400).json({
          status: 'error',
          message: 'El PIN debe tener entre 4 y 6 dígitos.'
        });
        return;
      }

      // Guardar el PIN en el primer ingreso
      await prisma.persona.update({
        where: { id: client.id },
        data: { webPin: providedPin }
      });
      client.webPin = providedPin;
    }

    // TOKEN JWT Y RESPUESTA
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
 * Sincronizado por "Categoría Comercial" con los Títulos del Gestor de Ofertas.
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
        orderBy: { sku: 'asc' }
      }),
      prisma.rubro.findMany({
        orderBy: { name: 'asc' }
      }),
      prisma.offerCampaign.findMany({
        where: { isActive: true },
        include: {
          items: {
            include: {
              product: { select: { id: true, commercialCategory: true, rubro: { select: { name: true } } } }
            }
          }
        }
      })
    ]);

    const productCampaignGroupMap = new Map<number, string>();
    const configuredCategoriesSet = new Set<string>();
    let campaignCustomOrder: string[] = [];

    activeCampaigns.forEach((camp) => {
      if (camp.customRubroOrder && Array.isArray(camp.customRubroOrder) && camp.customRubroOrder.length > 0) {
        campaignCustomOrder = camp.customRubroOrder;
        camp.customRubroOrder.forEach((g) => configuredCategoriesSet.add(g));
      }
      camp.items.forEach((item) => {
        if (item.campaignGroup && item.campaignGroup.trim() !== '') {
          const groupName = item.campaignGroup.trim();
          productCampaignGroupMap.set(item.productId, groupName);
          configuredCategoriesSet.add(groupName);
        }
      });
    });

    const categoryIconsMap: Record<string, string> = {
      'REMOTTI': '🧀',
      'LECHES': '🥛',
      'SANCOR y CREMIGAL': '🧈',
      'SANCOR Y CREMIGAL': '🧈',
      'QUESOS RALLADOS': '🧀',
      'SODECAR': '🥓',
      'A.G.D Y NIZA': '🌻',
      'BEBIDAS': '🥤',
      'BEBIDAS ALCOHOLICAS': '🍺',
      'BEBIDAS ALCOHÓLICAS': '🍺',
      'VINOS': '🍷',
      'ADEREZOS Y ACEITES': '🌻',
      'PASTAS SECAS': '🍝',
      'CONSERVAS': '🥫',
      'PESCADERÍA': '🐟',
      'PESCADERIA': '🐟',
      'PAPELES': '🧻',
      'NO COMESTIBLES': '📦',
      'REGALERIA': '🎁',
      'ESTUCHERIA Y REGALERÍA': '🎁',
      'ESTUCHERIA Y REGALERIA': '🎁',
      'CAFE': '☕',
      'ARROZ': '🌾',
      'YERBAS': '🧉',
      'AZUCAR': '🍬',
      'EDULCORANTES': '☕',
      'REFRIGERADOS': '❄️',
      'FIAMBRES': '🥓',
      'VARIOS': '🏷️'
    };

    const formattedProducts = products.map((p) => {
      let listBasePrice = Number(p.listPrice);
      if (requestedList.includes('B') && Number(p.listPriceB) > 0) {
        listBasePrice = Number(p.listPriceB);
      } else if (requestedList.includes('C') && Number(p.listPriceC) > 0) {
        listBasePrice = Number(p.listPriceC);
      }

      let finalPrice = listBasePrice;
      let previousPrice: number | null = null;
      let specialTag: string | null = null;

      const activeOfferItem = p.offerCampaignItems.find((item) => item.campaign && item.campaign.isActive);
      const isOffer = !!activeOfferItem;

      if (activeOfferItem) {
        if (Number(activeOfferItem.offerPrice) > 0) {
          finalPrice = Number(activeOfferItem.offerPrice);
        }
        if (activeOfferItem.previousPrice && Number(activeOfferItem.previousPrice) > finalPrice) {
          previousPrice = Number(activeOfferItem.previousPrice);
        } else if (listBasePrice > finalPrice) {
          previousPrice = listBasePrice;
        }
        if (activeOfferItem.specialTag && activeOfferItem.specialTag.trim() !== '') {
          specialTag = activeOfferItem.specialTag.trim();
        }
      }

      let offerDiscount = 0;
      if (previousPrice && previousPrice > finalPrice) {
        offerDiscount = Math.round(((previousPrice - finalPrice) / previousPrice) * 100);
      }

      // Asignación de Categoría Comercial (siempre en Mayúsculas)
      let rawCategory = productCampaignGroupMap.get(p.id) || p.commercialCategory;
      if (!rawCategory && p.rubro?.name) {
        const mapped = RUBRO_TO_COMMERCIAL_CATEGORY[p.rubro.name.toUpperCase().trim()];
        if (mapped) {
          rawCategory = mapped.category;
        } else {
          rawCategory = p.rubro.name;
        }
      }
      if (!rawCategory) rawCategory = 'VARIOS';
      const assignedCategory = rawCategory.toUpperCase().trim();

      const catIcon = categoryIconsMap[assignedCategory] || (RUBRO_TO_COMMERCIAL_CATEGORY[p.rubro?.name || '']?.icon) || '📦';

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
        minOrderQuantity: p.minOrderQuantity || 1,
        imageUrl: p.imageUrl,
        rubroId: p.rubroId,
        rubroName: p.rubro?.name || 'General',
        commercialCategoryId: assignedCategory.toLowerCase().replace(/\s+/g, '-'),
        commercialCategoryName: assignedCategory,
        commercialCategoryIcon: catIcon,
        // Compatibilidad con propiedades anteriores
        commercialGroupId: assignedCategory.toLowerCase().replace(/\s+/g, '-'),
        commercialGroupName: assignedCategory,
        commercialGroupIcon: catIcon,
        isOffer,
        offerDiscount,
        previousPrice,
        specialTag,
        offerName: activeOfferItem ? activeOfferItem.campaign.title : null
      };
    });

    // Ordenar productos por SKU numéricamente (desde el más bajo hasta el más alto)
    formattedProducts.sort((a, b) => {
      const strA = String(a.sku || '').trim();
      const strB = String(b.sku || '').trim();
      const matchA = strA.match(/\d+/);
      const matchB = strB.match(/\d+/);
      if (matchA && matchB) {
        const numA = parseInt(matchA[0], 10);
        const numB = parseInt(matchB[0], 10);
        if (numA !== numB) {
          return numA - numB;
        }
      }
      return strA.localeCompare(strB, undefined, { numeric: true, sensitivity: 'base' });
    });

    const defaultPriorityOrder = [
      'REFRIGERADOS',
      'FIAMBRES',
      'ADEREZOS Y ACEITES',
      'CONSERVAS',
      'PESCADERÍA',
      'PASTAS SECAS',
      'BEBIDAS',
      'BEBIDAS ALCOHOLICAS',
      'PAPELES',
      'NO COMESTIBLES',
      'ESTUCHERIA Y REGALERÍA',
      'VARIOS'
    ];

    const productCategoryCounts = new Map<string, number>();
    formattedProducts.forEach((p) => {
      if (p.commercialCategoryName) {
        const cleanName = p.commercialCategoryName.toUpperCase().trim();
        const normKey = cleanName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
        productCategoryCounts.set(normKey, (productCategoryCounts.get(normKey) || 0) + 1);
      }
    });

    const uniqueCategoryMap = new Map<string, string>();
    const addCategory = (name: string) => {
      if (!name) return;
      const cleanName = name.toUpperCase().trim();
      const normKey = cleanName.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      if ((productCategoryCounts.get(normKey) || 0) > 0 || configuredCategoriesSet.has(cleanName)) {
        if (!uniqueCategoryMap.has(normKey)) {
          uniqueCategoryMap.set(normKey, cleanName);
        }
      }
    };

    if (campaignCustomOrder.length > 0) {
      campaignCustomOrder.forEach(addCategory);
    } else {
      defaultPriorityOrder.forEach(addCategory);
    }

    configuredCategoriesSet.forEach(addCategory);

    formattedProducts.forEach((p) => {
      if (p.commercialCategoryName) {
        addCategory(p.commercialCategoryName);
      }
    });

    const getCategoryRank = (catName: string) => {
      const normCat = catName.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
      const idx = defaultPriorityOrder.findIndex(
        (p) => p.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim() === normCat
      );
      return idx !== -1 ? idx : 999;
    };

    const sortedCategoryNames = Array.from(uniqueCategoryMap.values()).sort(
      (a, b) => getCategoryRank(a) - getCategoryRank(b)
    );

    const commercialCategories = [
      { id: 'all', name: 'TODOS LOS PRODUCTOS', icon: '📦' },
      ...sortedCategoryNames.map((catName) => ({
        id: catName.toLowerCase().replace(/\s+/g, '-'),
        name: catName,
        icon: categoryIconsMap[catName] || (RUBRO_TO_COMMERCIAL_CATEGORY[catName]?.icon) || '📦'
      }))
    ];

    res.status(200).json({
      status: 'success',
      data: {
        products: formattedProducts,
        commercialCategories,
        commercialGroups: commercialCategories,
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
        notes: notes ? String(notes).trim() : null,
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
