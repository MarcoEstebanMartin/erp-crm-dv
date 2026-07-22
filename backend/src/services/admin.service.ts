import prisma from '../utils/prisma';
import bcrypt from 'bcryptjs';
import { Role, BillingType, TransactionType } from '@prisma/client';
import { logAudit } from '../utils/audit';
import { standardizeCityName } from '../utils/normalize';


export class AdminService {
  /**
   * Obtener reporte consolidado financiero.
   */
  async getFinancialReports(year?: number, month?: number) {
    const whereClause: any = { status: 'DELIVERED' };
    
    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      const startOfPeriod = new Date(y, m - 1, 1);
      const endOfPeriod = new Date(y, m, 0, 23, 59, 59, 999);
      whereClause.createdAt = {
        gte: startOfPeriod,
        lte: endOfPeriod
      };
    }

    const deliveredOrders = await prisma.order.findMany({
      where: whereClause,
      include: { items: { include: { product: true } } }
    });

    let officialSales = 0;
    let officialCost = 0;
    let officialCount = 0;
    let internalSales = 0;
    let internalCost = 0;
    let internalCount = 0;

    for (const order of deliveredOrders) {
      const amount = Number(order.totalAmount) || 0;
      let cost = 0;
      for (const item of order.items) {
        const qtyOrWeight = item.product.isPesable && item.weight ? Number(item.weight) : item.quantity;
        cost += Math.round(Number(item.product.costPrice || 0) * qtyOrWeight);
      }

      if (order.billingType === BillingType.OFFICIAL) {
        officialSales += amount;
        officialCost += cost;
        officialCount++;
      } else {
        internalSales += amount;
        internalCost += cost;
        internalCount++;
      }
    }

    // Filtro para el flujo de fondos (Transactions)
    const transactionWhereClause: any = {};
    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      transactionWhereClause.createdAt = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59, 999)
      };
    }

    const transactionsGrouped = await prisma.transaction.groupBy({
      by: ['billingType', 'type'],
      where: transactionWhereClause,
      _sum: { amount: true },
    });

    const paymentMethodsGrouped = await prisma.transaction.groupBy({
      by: ['billingType', 'paymentMethod'],
      where: {
        ...transactionWhereClause,
        type: TransactionType.INCOME
      },
      _sum: { amount: true },
    });

    // Obtener gastos del periodo y agruparlos por categoría
    const expenseWhereClause: any = {};
    if (year && month) {
      const y = Number(year);
      const m = Number(month);
      expenseWhereClause.date = {
        gte: new Date(y, m - 1, 1),
        lte: new Date(y, m, 0, 23, 59, 59, 999)
      };
    }

    const expenses = await prisma.expense.findMany({
      where: expenseWhereClause,
      include: { category: true }
    });

    let totalExpenses = 0;
    const expensesByCategoryMap: { [key: string]: number } = {};

    expenses.forEach((e) => {
      const amount = Number(e.amount) || 0;
      totalExpenses += amount;
      const catName = e.category.name;
      expensesByCategoryMap[catName] = (expensesByCategoryMap[catName] || 0) + amount;
    });

    const expensesByCategory = Object.keys(expensesByCategoryMap).map((name) => ({
      name,
      value: Math.round(expensesByCategoryMap[name])
    }));

    return {
      sales: {
        official: Math.round(officialSales),
        officialCost: Math.round(officialCost),
        officialCount: officialCount,
        internal: Math.round(internalSales),
        internalCost: Math.round(internalCost),
        internalCount: internalCount,
      },
      cashflow: {
        officialIncome: transactionsGrouped.find(g => g.billingType === BillingType.OFFICIAL && g.type === TransactionType.INCOME)?._sum.amount || 0,
        officialOutcome: transactionsGrouped.find(g => g.billingType === BillingType.OFFICIAL && g.type === TransactionType.OUTCOME)?._sum.amount || 0,
        internalIncome: transactionsGrouped.find(g => g.billingType === BillingType.INTERNAL && g.type === TransactionType.INCOME)?._sum.amount || 0,
        internalOutcome: transactionsGrouped.find(g => g.billingType === BillingType.INTERNAL && g.type === TransactionType.OUTCOME)?._sum.amount || 0,
      },
      paymentMethods: paymentMethodsGrouped.map(m => ({
        channel: m.billingType,
        method: m.paymentMethod,
        total: m._sum.amount || 0,
      })),
      expenses: {
        total: Math.round(totalExpenses),
        byCategory: expensesByCategory
      }
    };
  }

  /**
   * Obtener logs de auditoría.
   */
  async getAuditLogs(page: number, limit: number) {
    const skip = (page - 1) * limit;

    const [logs, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, username: true, role: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.auditLog.count(),
    ]);

    return {
      logs,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * Obtener listado de usuarios.
   */
  async getUsers() {
    return prisma.user.findMany({
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
      orderBy: { username: 'asc' },
    });
  }

  /**
   * Crear un nuevo usuario.
   */
  async createUser(data: any, adminId?: number) {
    const { username, password, role } = data;

    const existing = await prisma.user.findUnique({ where: { username } });
    if (existing) {
      throw new Error('El nombre de usuario ya está registrado.');
    }

    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    const newUser = await prisma.user.create({
      data: {
        username,
        passwordHash,
        role: role as Role,
      },
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'CREATE_USER',
        entityType: 'User',
        entityId: newUser.id,
        newValues: { username: newUser.username, role: newUser.role },
      });
    }

    return newUser;
  }

  /**
   * Habilitar/Deshabilitar usuario.
   */
  async toggleUserStatus(id: number, adminId?: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('Usuario no encontrado.');

    if (user.id === adminId) {
      throw new Error('No podés desactivar tu propio usuario administrador.');
    }

    const updated = await prisma.user.update({
      where: { id: user.id },
      data: { isActive: !user.isActive },
      select: { id: true, username: true, isActive: true },
    });

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'TOGGLE_USER_STATUS',
        entityType: 'User',
        entityId: user.id,
        oldValues: { isActive: user.isActive },
        newValues: { isActive: updated.isActive },
      });
    }

    return updated;
  }

  /**
   * Actualizar nombre de usuario, rol y/o contraseña de un usuario.
   */
  async updateUser(id: number, data: { username?: string; role?: Role; password?: string }, adminId?: number) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new Error('Usuario no encontrado.');

    const updateData: any = {};
    if (data.username && data.username.trim() !== '' && data.username.trim() !== user.username) {
      const existing = await prisma.user.findUnique({ where: { username: data.username.trim() } });
      if (existing) {
        throw new Error('El nombre de usuario ya está registrado.');
      }
      updateData.username = data.username.trim();
    }
    if (data.role) {
      updateData.role = data.role;
    }
    if (data.password && data.password.trim().length >= 6) {
      const salt = await bcrypt.genSalt(10);
      updateData.passwordHash = await bcrypt.hash(data.password, salt);
    }

    const updated = await prisma.user.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        username: true,
        role: true,
        isActive: true,
        createdAt: true,
      },
    });

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'UPDATE_USER',
        entityType: 'User',
        entityId: user.id,
        oldValues: { role: user.role },
        newValues: { role: updated.role, passwordChanged: !!data.password },
      });
    }

    return updated;
  }

  /**
   * Eliminar usuario por username o ID.
   */
  async deleteUser(usernameOrId: string | number, adminId?: number) {
    let user;
    if (typeof usernameOrId === 'number' || !isNaN(Number(usernameOrId))) {
      user = await prisma.user.findUnique({ where: { id: Number(usernameOrId) } });
    } else {
      user = await prisma.user.findUnique({ where: { username: String(usernameOrId) } });
    }

    if (!user) throw new Error('Usuario no encontrado.');

    if (user.id === adminId) {
      throw new Error('No podés eliminar tu propio usuario administrador en sesión.');
    }

    // Soft/Hard delete: delete user from database
    await prisma.user.delete({
      where: { id: user.id },
    });

    if (adminId) {
      await logAudit({
        userId: adminId,
        action: 'DELETE_USER',
        entityType: 'User',
        entityId: user.id,
        oldValues: { username: user.username, role: user.role },
      });
    }

    return { success: true, username: user.username };
  }


  /**
   * Obtener reportes por zonas (estadísticas robustas).
   */
  async getZoneReports(filters: { sellerId?: number; city?: string; cities?: string[]; startDate?: string; endDate?: string }) {
    const whereClause: any = { isClient: true };
    if (filters.sellerId) whereClause.sellerId = filters.sellerId;
    if (filters.cities && filters.cities.length > 0) {
      whereClause.city = { in: filters.cities };
    } else if (filters.city && filters.city.trim() !== '') {
      whereClause.city = { contains: filters.city, mode: 'insensitive' };
    }

    const clients = await prisma.persona.findMany({
      where: whereClause,
      include: {
        seller: { select: { id: true, username: true } }
      },
      orderBy: { city: 'asc' }
    });

    const totalClients = clients.length;
    const totalDebt = clients.reduce((acc, curr) => acc + Number(curr.outstandingBalance || 0), 0);

    // Query orders for this zone to build metrics
    const orderWhereClause: any = {
      status: 'DELIVERED',
    };
    if (filters.cities && filters.cities.length > 0) {
      orderWhereClause.persona = {
        city: { in: filters.cities }
      };
    } else if (filters.city && filters.city.trim() !== '') {
      orderWhereClause.persona = {
        city: { contains: filters.city, mode: 'insensitive' }
      };
    }
    if (filters.sellerId) {
      if (!orderWhereClause.persona) {
        orderWhereClause.persona = {};
      }
      orderWhereClause.persona.sellerId = filters.sellerId;
    }
    if (filters.startDate || filters.endDate) {
      orderWhereClause.createdAt = {};
      if (filters.startDate) {
        orderWhereClause.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        orderWhereClause.createdAt.lte = end;
      }
    }

    const orders = await prisma.order.findMany({
      where: orderWhereClause,
      include: {
        persona: {
          select: {
            id: true,
            name: true,
            city: true,
            seller: {
              select: { id: true, username: true }
            }
          }
        },
        items: {
          include: {
            product: {
              select: { 
                id: true, 
                sku: true, 
                name: true, 
                isPesable: true,
                rubroId: true,
                rubro: {
                  select: { id: true, name: true }
                }
              }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Aggregations
    const clientMap = new Map<number, { id: number; name: string; city: string; sellerName: string; totalSpent: number; ordersCount: number }>();
    const productMap = new Map<number, { id: number; sku: string; name: string; qty: number; revenue: number; rubroId: number | null; rubroName: string }>();
    const weeklyMap = new Map<string, { weekStart: string; dateObj: Date; total: number; count: number }>();
    const weeklyRubroMap = new Map<string, Map<string, number>>();
    const rubrosAccumulatedMap = new Map<string, { id: number | null; name: string; totalSales: number; itemsCount: number }>();
    const clientRubroMap = new Map<number, Map<string, number>>();

    for (const order of orders) {
      const totalAmount = Number(order.totalAmount) || 0;
      const clientId = order.personaId;
      const clientName = order.persona.name;
      const clientCity = order.persona.city || 'Sin especificar';
      const sellerName = order.persona.seller?.username || 'Sin preventista';

      // 1. Client
      const clientData = clientMap.get(clientId) || {
        id: clientId,
        name: clientName,
        city: clientCity,
        sellerName: sellerName,
        totalSpent: 0,
        ordersCount: 0
      };
      clientData.totalSpent += totalAmount;
      clientData.ordersCount += 1;
      clientMap.set(clientId, clientData);

      // 2. Weekly
      const orderDate = new Date(order.createdAt);
      const day = orderDate.getDay();
      const diff = orderDate.getDate() - day + (day === 0 ? -6 : 1); // Monday
      const monday = new Date(orderDate.setDate(diff));
      monday.setHours(0, 0, 0, 0);
      const weekKey = monday.toISOString().split('T')[0];

      const weekData = weeklyMap.get(weekKey) || {
        weekStart: weekKey,
        dateObj: monday,
        total: 0,
        count: 0
      };
      weekData.total += totalAmount;
      weekData.count += 1;
      weeklyMap.set(weekKey, weekData);

      // 3. Products & Rubros
      let clientRubro = clientRubroMap.get(clientId);
      if (!clientRubro) {
        clientRubro = new Map<string, number>();
        clientRubroMap.set(clientId, clientRubro);
      }

      for (const item of order.items) {
        const prodId = item.productId;
        const qty = item.product.isPesable && item.weight ? Number(item.weight) : item.quantity;
        const subtotal = Number(item.subtotal) || 0;
        const rubroName = item.product.rubro?.name || 'OTROS';
        const rubroId = item.product.rubroId || null;

        const prodData = productMap.get(prodId) || {
          id: prodId,
          sku: item.product.sku,
          name: item.product.name,
          qty: 0,
          revenue: 0,
          rubroId,
          rubroName
        };
        prodData.qty += qty;
        prodData.revenue += subtotal;
        productMap.set(prodId, prodData);

        // Weekly rubro map
        let weekRubro = weeklyRubroMap.get(weekKey);
        if (!weekRubro) {
          weekRubro = new Map<string, number>();
          weeklyRubroMap.set(weekKey, weekRubro);
        }
        weekRubro.set(rubroName, (weekRubro.get(rubroName) || 0) + subtotal);

        // Rubros accumulated map
        const rAcc = rubrosAccumulatedMap.get(rubroName) || {
          id: rubroId,
          name: rubroName,
          totalSales: 0,
          itemsCount: 0
        };
        rAcc.totalSales += subtotal;
        rAcc.itemsCount += 1;
        rubrosAccumulatedMap.set(rubroName, rAcc);

        // Client rubro purchases map
        clientRubro.set(rubroName, (clientRubro.get(rubroName) || 0) + subtotal);
      }
    }

    const clientsWithMovements = Array.from(clientMap.values())
      .sort((a, b) => b.totalSpent - a.totalSpent);

    const topClients = clientsWithMovements.slice(0, 10);

    const topProducts = Array.from(productMap.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 10);

    const bottomProducts = Array.from(productMap.values())
      .sort((a, b) => a.qty - b.qty)
      .slice(0, 10);

    const weeklyInvoicing = Array.from(weeklyMap.values())
      .sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime())
      .map(w => {
        const weekRubro = weeklyRubroMap.get(w.weekStart);
        const rubrosBreakdown: { [name: string]: number } = {};
        if (weekRubro) {
          for (const [rName, amount] of weekRubro.entries()) {
            rubrosBreakdown[rName] = Math.round(amount);
          }
        }
        return {
          weekStart: w.weekStart,
          total: w.total,
          count: w.count,
          rubros: rubrosBreakdown
        };
      });

    const totalInvoicedInZone = weeklyInvoicing.reduce((sum, w) => sum + w.total, 0);

    // Calculate Rubro Metrics and Trends
    const rubroMetrics = Array.from(rubrosAccumulatedMap.values())
      .map(r => {
        const weekSales = weeklyInvoicing.map(w => w.rubros[r.name] || 0);
        let trend = 0;
        if (weekSales.length > 1) {
          const half = Math.floor(weekSales.length / 2);
          const firstHalf = weekSales.slice(0, half);
          const secondHalf = weekSales.slice(half);
          const sum1 = firstHalf.reduce((s, v) => s + v, 0);
          const sum2 = secondHalf.reduce((s, v) => s + v, 0);
          const avg1 = sum1 / firstHalf.length;
          const avg2 = sum2 / secondHalf.length;
          trend = avg1 > 0 ? Math.round(((avg2 - avg1) / avg1) * 100) : 0;
        }

        const topProdsInRubro = Array.from(productMap.values())
          .filter(p => p.rubroName === r.name)
          .sort((a, b) => b.revenue - a.revenue)
          .slice(0, 3)
          .map(p => ({
            id: p.id,
            sku: p.sku,
            name: p.name,
            qty: p.qty,
            revenue: Math.round(p.revenue)
          }));

        return {
          id: r.id,
          name: r.name,
          totalSales: Math.round(r.totalSales),
          percentageOfTotal: totalInvoicedInZone > 0 ? Math.round((r.totalSales / totalInvoicedInZone) * 100) : 0,
          trend,
          topProducts: topProdsInRubro
        };
      })
      .sort((a, b) => b.totalSales - a.totalSales);

    // Get unique sellers
    const sellers = await prisma.user.findMany({
      where: { role: 'VENDEDOR' },
      select: { id: true, username: true }
    });

    // Query active products in deposit (stock > 0) to check for zero sales in this zone
    const activeProducts = await prisma.product.findMany({
      where: { stock: { gt: 0 } },
      select: { 
        id: true, 
        sku: true, 
        name: true, 
        stock: true,
        rubro: {
          select: { name: true }
        }
      }
    });

    const deadStockProducts = activeProducts
      .filter(p => !productMap.has(p.id))
      .map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        stock: p.stock,
        rubroName: p.rubro?.name || 'OTROS',
        qty: 0,
        revenue: 0
      }))
      .sort((a, b) => b.stock - a.stock)
      .slice(0, 10);

    // Generate Smart Recommendations
    const salesRecommendations: any[] = [];
    
    // 1. Alertas de caída crítica
    for (const r of rubroMetrics) {
      if (r.totalSales > 10000 && r.trend <= -12) {
        const topProduct = r.topProducts[0]?.name || 'productos de la línea';
        salesRecommendations.push({
          type: 'CRITICAL_DROP',
          title: `Caída de ventas en ${r.name}`,
          description: `Las ventas de la categoría ${r.name} bajaron un ${Math.abs(r.trend)}% en el período.`,
          action: `Reforzar la oferta de ${r.name}. Impulsar proactivamente el artículo estrella: ${topProduct}.`,
          script: `Vendedor: "¿Cómo venís de stock de la línea de ${r.name}? Justo tenemos en oferta ${topProduct} esta semana, si te interesa llevar más te puedo acomodar el precio. Te va a convenir antes de que aumente."`,
          rubroName: r.name,
          severity: 'high'
        });
      }
    }

    // 2. Oportunidades de venta cruzada (Cross-selling) en la zona
    const correlationPairs = [
      { a: 'REMOTTI', b: 'SODECAR' },
      { a: 'SANCOR y CREMIGAL', b: 'SODECAR' },
      { a: 'SODECAR', b: 'REMOTTI' },
      { a: 'PASTAS SECAS', b: 'A.G.D Y NIZA' },
      { a: 'LECHES', b: 'CAFE' }
    ];

    const topZoneClients = clientsWithMovements.slice(0, 15);
    for (const client of topZoneClients) {
      const clientRubros = clientRubroMap.get(client.id);
      if (!clientRubros) continue;

      for (const pair of correlationPairs) {
        const spentA = clientRubros.get(pair.a) || 0;
        const spentB = clientRubros.get(pair.b) || 0;

        if (spentA > 15000 && spentB === 0) {
          const rubroBProducts = Array.from(productMap.values())
            .filter(p => p.rubroName === pair.b)
            .sort((a, b) => b.revenue - a.revenue);
          const suggestProduct = rubroBProducts[0]?.name || `línea de ${pair.b}`;

          salesRecommendations.push({
            type: 'CROSS_SELLING',
            title: `Venta cruzada: ${client.name}`,
            description: `El cliente es muy fuerte comprando ${pair.a} ($${Math.round(spentA).toLocaleString()}), pero no registra compras de ${pair.b}.`,
            action: `Ofrecer una muestra de ${suggestProduct} o combo especial en la próxima visita.`,
            script: `Vendedor: "Hola, vi que nos estás comprando muy bien la mercadería de ${pair.a}. Quería aprovechar para dejarte una muestra de la línea de ${pair.b} que estamos trayendo directo de fábrica, tiene excelente salida y te va a dejar mejor margen. ¿Te armo un combo chico para probar?"`,
            rubroName: pair.b,
            clientName: client.name,
            severity: 'medium'
          });

          // Limitar a máximo 4 recomendaciones de venta cruzada para no abrumar
          if (salesRecommendations.filter(rec => rec.type === 'CROSS_SELLING').length >= 4) {
            break;
          }
        }
      }
      if (salesRecommendations.filter(rec => rec.type === 'CROSS_SELLING').length >= 4) {
        break;
      }
    }

    // 3. Sugerencias de rotación de stock inmovilizado
    for (const deadProd of deadStockProducts) {
      const rAcc = rubrosAccumulatedMap.get(deadProd.rubroName);
      // Si el rubro tiene ventas activas pero este producto está clavado
      if (rAcc && rAcc.totalSales > 15000 && deadProd.stock >= 5) {
        const sameCategoryProds = Array.from(productMap.values())
          .filter(p => p.rubroName === deadProd.rubroName)
          .sort((a, b) => b.revenue - a.revenue);
        const topPartner = sameCategoryProds[0]?.name || 'línea estrella';

        salesRecommendations.push({
          type: 'DEAD_STOCK',
          title: `Rotación de Stock: ${deadProd.name}`,
          description: `La categoría ${deadProd.rubroName} tiene ventas de $${Math.round(rAcc.totalSales).toLocaleString()} en la zona, pero ${deadProd.name} tiene ${deadProd.stock} unidades paradas en depósito.`,
          action: `Armar un combo promocional: Llevando ${topPartner}, bonificar 15% en la segunda unidad de ${deadProd.name}.`,
          script: `Vendedor: "Mirá, esta semana tenemos una oferta promocional de fábrica. Llevando la cantidad habitual de ${topPartner}, te puedo dejar ${deadProd.name} con un 15% de descuento en la factura. Es una gran oportunidad para rotar stock con mejor precio."`,
          rubroName: deadProd.rubroName,
          productName: deadProd.name,
          severity: 'low'
        });

        // Limitar a 3 recomendaciones de stock
        if (salesRecommendations.filter(rec => rec.type === 'DEAD_STOCK').length >= 3) {
          break;
        }
      }
    }

    return {
      totalClients,
      totalDebt,
      clients,
      availableCities: [...MAIN_CITIES, 'OTRAS'].sort(),
      availableSellers: sellers,
      topClients,
      clientsWithMovements,
      topProducts,
      bottomProducts,
      weeklyInvoicing,
      rubroMetrics,
      salesRecommendations,
      deadStockProducts
    };
  }

  async getAutofillSalesForWeek(weekStart: string) {
    const startDate = new Date(weekStart + 'T00:00:00');
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + 7);

    const orders = await prisma.order.findMany({
      where: {
        status: 'DELIVERED',
        createdAt: {
          gte: startDate,
          lt: endDate
        }
      },
      include: {
        persona: {
          select: { city: true }
        }
      }
    });

    const localityMap = new Map<string, { locality: string, date: string, amountA: number, amountX: number }>();

    for (const order of orders) {
      const city = standardizeCityName(order.persona?.city || 'SIN ESPECIFICAR');
      const amount = Math.round(Number(order.totalAmount) || 0);
      const isOfficial = order.billingType === BillingType.OFFICIAL;

      const current = localityMap.get(city) || {
        locality: city,
        date: '',
        amountA: 0,
        amountX: 0
      };

      if (isOfficial) {
        current.amountA += amount;
      } else {
        current.amountX += amount;
      }

      if (order.createdAt) {
        const orderDateObj = new Date(order.createdAt);
        const day = String(orderDateObj.getDate()).padStart(2, '0');
        const month = String(orderDateObj.getMonth() + 1).padStart(2, '0');
        current.date = `${day}/${month}`;
      }

      localityMap.set(city, current);
    }

    return Array.from(localityMap.values()).sort((a, b) => a.locality.localeCompare(b.locality));
  }

  async getWeeklyReports() {
    return prisma.weeklyReport.findMany({
      orderBy: { weekStart: 'asc' }
    });
  }

  async saveWeeklyReport(data: {
    weekStart: string;
    purchases: any[];
    sales: any[];
    credit: number;
    buffer: number;
  }) {
    const { weekStart, purchases, sales, credit, buffer } = data;
    
    const parsedPurchases = purchases.map(p => ({
      company: String(p.company),
      date: p.date ? String(p.date) : null,
      amount: Math.round(Number(p.amount) || 0)
    }));

    const parsedSales = sales.map(s => ({
      locality: String(s.locality),
      date: s.date ? String(s.date) : null,
      amountA: Math.round(Number(s.amountA) || 0),
      amountX: Math.round(Number(s.amountX) || 0)
    }));

    return prisma.weeklyReport.upsert({
      where: { weekStart },
      create: {
        weekStart,
        purchases: parsedPurchases,
        sales: parsedSales,
        credit: Math.round(credit),
        buffer: Math.round(buffer)
      },
      update: {
        purchases: parsedPurchases,
        sales: parsedSales,
        credit: Math.round(credit),
        buffer: Math.round(buffer)
      }
    });
  }

  async deleteWeeklyReport(weekStart: string) {
    return prisma.weeklyReport.delete({
      where: { weekStart }
    });
  }

  async getSuggestedCreditForWeek(weekStart: string): Promise<number> {
    const date = new Date(weekStart + 'T00:00:00');
    date.setDate(date.getDate() - 7);
    const prevWeekStart = date.toISOString().split('T')[0];

    const prevReport = await prisma.weeklyReport.findUnique({
      where: { weekStart: prevWeekStart }
    });

    if (!prevReport) {
      return 0;
    }

    const salesList = (prevReport.sales as any[]) || [];
    const purchasesList = (prevReport.purchases as any[]) || [];

    const prevTotalSales = salesList.reduce((sum, s) => sum + (Number(s.amountA) || 0) + (Number(s.amountX) || 0), 0);
    const prevActualPurchases = purchasesList.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    
    const prevCredit = Number(prevReport.credit) || 0;
    const prevTotalPurchases = prevActualPurchases + prevCredit;
    const prevBuffer = Number(prevReport.buffer) || 0;

    const suggested = (prevTotalPurchases + prevBuffer) - prevTotalSales;
    return Math.round(suggested);
  }

  /**
   * Obtener logs de auditoría para un documento o entidad específica.
   */
  async getDocumentAuditLogs(entityType: string, entityId: number) {
    return prisma.auditLog.findMany({
      where: {
        entityType,
        entityId: Number(entityId),
      },
      include: {
        user: {
          select: { id: true, username: true, role: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  /**
   * Obtener reporte de rentabilidad por Clientes y Productos.
   */
  async getProfitabilityReport(filters: {
    startDate?: string;
    endDate?: string;
    sellerId?: number;
    city?: string;
    rubroId?: number;
    billingType?: string;
  }) {
    const whereOrder: any = { status: 'DELIVERED' };

    if (filters.startDate || filters.endDate) {
      whereOrder.createdAt = {};
      if (filters.startDate) whereOrder.createdAt.gte = new Date(filters.startDate);
      if (filters.endDate) {
        const end = new Date(filters.endDate);
        end.setHours(23, 59, 59, 999);
        whereOrder.createdAt.lte = end;
      }
    }

    if (filters.sellerId) {
      whereOrder.sellerId = Number(filters.sellerId);
    }

    if (filters.billingType && filters.billingType !== 'ALL') {
      whereOrder.billingType = filters.billingType;
    }

    const orders = await prisma.order.findMany({
      where: whereOrder,
      include: {
        persona: {
          select: {
            id: true,
            businessName: true,
            city: true,
            sellerId: true,
            seller: { select: { username: true } },
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                costPrice: true,
                profitMargin: true,
                isPesable: true,
                rubroId: true,
                rubro: { select: { id: true, name: true, profitMargin: true } },
              },
            },
          },
        },
      },
    });

    const whereCreditNote: any = { status: 'APPROVED' };
    if (whereOrder.createdAt) {
      whereCreditNote.createdAt = whereOrder.createdAt;
    }
    const creditNotes = await prisma.creditNote.findMany({
      where: whereCreditNote,
      include: {
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                costPrice: true,
                isPesable: true,
                rubroId: true,
                rubro: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    const clientMap = new Map<number, {
      id: number;
      businessName: string;
      city: string;
      sellerName: string;
      totalRevenue: number;
      totalCost: number;
      orderCount: number;
    }>();

    const productMap = new Map<number, {
      id: number;
      sku: string;
      name: string;
      rubroName: string;
      rubroId: number | null;
      targetMargin: number;
      quantitySold: number;
      totalRevenue: number;
      totalCost: number;
    }>();

    for (const order of orders) {
      const personaCity = normalizeCity(order.persona.city);
      if (filters.city && filters.city !== 'ALL' && personaCity !== filters.city) {
        continue;
      }

      if (!clientMap.has(order.personaId)) {
        clientMap.set(order.personaId, {
          id: order.persona.id,
          businessName: order.persona.businessName || 'Cliente sin nombre',
          city: personaCity,
          sellerName: order.persona.seller?.username || 'Sin Vendedor',
          totalRevenue: 0,
          totalCost: 0,
          orderCount: 0,
        });
      }

      const clientData = clientMap.get(order.personaId)!;
      clientData.orderCount += 1;

      for (const item of order.items) {
        if (filters.rubroId && item.product.rubroId !== Number(filters.rubroId)) {
          continue;
        }

        const qtyOrWeight = item.product.isPesable && item.weight ? Number(item.weight) : item.quantity;
        const itemRevenue = Number(item.subtotal) || 0;
        const itemCost = Math.round(Number(item.product.costPrice || 0) * qtyOrWeight);

        clientData.totalRevenue += itemRevenue;
        clientData.totalCost += itemCost;

        if (!productMap.has(item.productId)) {
          const targetMargin = Number(item.product.profitMargin) || 
            (item.product.rubro?.profitMargin ? (Number(item.product.rubro.profitMargin) - 1) * 100 : 30);

          productMap.set(item.productId, {
            id: item.product.id,
            sku: item.product.sku,
            name: item.product.name,
            rubroName: item.product.rubro?.name || 'Sin Rubro',
            rubroId: item.product.rubroId,
            targetMargin,
            quantitySold: 0,
            totalRevenue: 0,
            totalCost: 0,
          });
        }

        const prodData = productMap.get(item.productId)!;
        prodData.quantitySold += qtyOrWeight;
        prodData.totalRevenue += itemRevenue;
        prodData.totalCost += itemCost;
      }
    }

    for (const cn of creditNotes) {
      if (clientMap.has(cn.personaId)) {
        const clientData = clientMap.get(cn.personaId)!;
        for (const item of cn.items) {
          const qtyOrWeight = item.product.isPesable && item.weight ? Number(item.weight) : item.quantity;
          const itemRevenue = Number(item.subtotal) || 0;
          const itemCost = Math.round(Number(item.product.costPrice || 0) * qtyOrWeight);

          clientData.totalRevenue -= itemRevenue;
          clientData.totalCost -= itemCost;

          if (productMap.has(item.productId)) {
            const prodData = productMap.get(item.productId)!;
            prodData.quantitySold -= qtyOrWeight;
            prodData.totalRevenue -= itemRevenue;
            prodData.totalCost -= itemCost;
          }
        }
      }
    }

    const clients = Array.from(clientMap.values()).map((c) => {
      const grossProfit = Math.round(c.totalRevenue - c.totalCost);
      const marginPercent = c.totalRevenue > 0 ? (grossProfit / c.totalRevenue) * 100 : 0;
      const averageTicket = c.orderCount > 0 ? Math.round(c.totalRevenue / c.orderCount) : 0;

      return {
        ...c,
        grossProfit,
        marginPercent: Math.round(marginPercent * 100) / 100,
        averageTicket,
      };
    }).sort((a, b) => b.grossProfit - a.grossProfit);

    const products = Array.from(productMap.values()).map((p) => {
      const grossProfit = Math.round(p.totalRevenue - p.totalCost);
      const marginPercent = p.totalRevenue > 0 ? (grossProfit / p.totalRevenue) * 100 : 0;
      const marginGap = Math.round((marginPercent - p.targetMargin) * 100) / 100;

      let classification: 'STAR' | 'VOLUME' | 'OPPORTUNITY' | 'LOW_MARGIN' = 'OPPORTUNITY';
      if (marginPercent >= 25 && grossProfit > 50000) classification = 'STAR';
      else if (marginPercent < 20 && grossProfit > 50000) classification = 'VOLUME';
      else if (marginPercent < 15) classification = 'LOW_MARGIN';

      return {
        ...p,
        quantitySold: Math.round(p.quantitySold * 100) / 100,
        grossProfit,
        marginPercent: Math.round(marginPercent * 100) / 100,
        marginGap,
        classification,
      };
    }).sort((a, b) => b.grossProfit - a.grossProfit);

    const totalRevenue = clients.reduce((acc, c) => acc + c.totalRevenue, 0);
    const totalCost = clients.reduce((acc, c) => acc + c.totalCost, 0);
    const totalGrossProfit = Math.round(totalRevenue - totalCost);
    const overallMarginPercent = totalRevenue > 0 ? Math.round(((totalGrossProfit / totalRevenue) * 100) * 100) / 100 : 0;

    const topClient = clients.length > 0 ? clients[0] : null;
    const topProduct = products.length > 0 ? products[0] : null;
    const lowMarginProductsCount = products.filter((p) => p.marginPercent < 15).length;

    return {
      kpis: {
        totalRevenue,
        totalCost,
        totalGrossProfit,
        overallMarginPercent,
        topClient,
        topProduct,
        lowMarginProductsCount,
      },
      clients,
      products,
    };
  }
}

const MAIN_CITIES = [
  'GENERAL VILLEGAS',
  'EMILIO V. BUNGE',
  'BANDERALO',
  'INTENDENTE ALVEAR',
  'PIEDRITAS',
  'CEBALLOS',
  'RUFINO',
  'BUCHARDO',
  'CHARLONE',
  'LARROUDE',
  'SAUCE',
  'SANSINENA',
  'TRES ALGARROBOS',
  'AMEGHINO',
  'BLAQUIER',
  'AMERICA',
  'FORTIN',
  'CARLOS TEJEDOR'
];

function normalizeCity(city: string | null | undefined): string {
  if (!city) return 'Sin Localidad';
  const upper = city.toUpperCase().trim();
  
  for (const mainCity of MAIN_CITIES) {
    if (upper.includes(mainCity)) {
      return mainCity;
    }
  }

  // Alternativas de nombres comunes
  if (upper.includes('BUNGE')) return 'EMILIO V. BUNGE';
  if (upper.includes('ALVEAR')) return 'INTENDENTE ALVEAR';
  if (upper.includes('VILLEGAS')) return 'GENERAL VILLEGAS';
  if (upper.includes('LARROUDE')) return 'LARROUDE';
  if (upper.includes('TEJEDOR')) return 'CARLOS TEJEDOR';

  // Si no coincide con ninguna principal y parece una dirección sucia (empieza con paréntesis o tiene números), poner Sin Localidad
  if (upper.startsWith('(') || /\d/.test(upper)) {
    return 'Sin Localidad';
  }

  return upper;
}

export const adminService = new AdminService();
