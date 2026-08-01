import prisma from '../utils/prisma';
import bcrypt from 'bcryptjs';
import { Role, BillingType, TransactionType, OrderStatus, SalesChannel } from '@prisma/client';
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
        permissions: true,
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
    const { username, password, role, permissions } = data;

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
        permissions: permissions || null,
      },
      select: {
        id: true,
        username: true,
        role: true,
        permissions: true,
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
        newValues: { username: newUser.username, role: newUser.role, permissions: newUser.permissions },
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
  async updateUser(id: number, data: { username?: string; role?: Role; password?: string; permissions?: any }, adminId?: number) {
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
    if (data.permissions !== undefined) {
      updateData.permissions = data.permissions;
    }
    if (data.password && data.password.trim().length >= 4) {
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
        permissions: true,
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
            route: true,
            saleRoute: {
              select: { id: true, name: true }
            },
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
        const rubroName = item.product.rubro?.name || 'VARIOS';
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
        rubroName: p.rubro?.name || 'VARIOS',
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
            name: true,
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
          businessName: order.persona.name || 'Cliente sin nombre',
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

  /**
   * Obtener estadísticas avanzadas por Canales de Venta (Depósito/Mostrador vs Preventa/Ruta vs Tienda Web vs Telefónico)
   */
  async getSalesChannelStats(year?: number, month?: number) {
    const whereClause: any = { status: OrderStatus.DELIVERED };

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

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        persona: { select: { id: true, name: true, city: true } },
        items: {
          include: {
            product: {
              select: {
                id: true,
                sku: true,
                name: true,
                imageUrl: true,
                costPrice: true,
                commercialCategory: true,
                isPesable: true
              }
            }
          }
        },
        transactions: {
          select: {
            id: true,
            paymentMethod: true,
            amount: true,
            cashDrawerId: true
          }
        }
      }
    });

    const channelSummaryMap: Record<string, {
      sales: number;
      cost: number;
      profit: number;
      ordersCount: number;
    }> = {
      MOSTRADOR: { sales: 0, cost: 0, profit: 0, ordersCount: 0 },
      PREVENTA_RUTA: { sales: 0, cost: 0, profit: 0, ordersCount: 0 },
      TIENDA_WEB: { sales: 0, cost: 0, profit: 0, ordersCount: 0 },
      TELEFONICO: { sales: 0, cost: 0, profit: 0, ordersCount: 0 },
    };

    const topMostradorProductsMap: Record<number, {
      product: any;
      unitsSold: number;
      weightSold: number;
      totalRevenue: number;
    }> = {};

    const topMostradorClientsMap: Record<number, {
      id: number;
      name: string;
      city: string | null;
      ordersCount: number;
      totalAmount: number;
    }> = {};

    const mostradorPaymentMethods: Record<string, number> = {
      CASH: 0,
      BANK_TRANSFER: 0,
      CHECK: 0,
      CTA_CORRIENTE: 0,
      OTHER: 0,
    };

    let totalRevenueOverall = 0;

    for (const order of orders) {
      const channelKey = (order.salesChannel || (order.deliveryRouteId ? 'PREVENTA_RUTA' : 'MOSTRADOR')) as string;
      if (!channelSummaryMap[channelKey]) {
        channelSummaryMap[channelKey] = { sales: 0, cost: 0, profit: 0, ordersCount: 0 };
      }

      const orderTotal = Number(order.totalAmount || 0);
      let orderCost = 0;

      for (const item of order.items) {
        const qtyOrWeight = item.product.isPesable && item.weight ? Number(item.weight) : item.quantity;
        const itemCost = Math.round(Number(item.product.costPrice || 0) * qtyOrWeight);
        orderCost += itemCost;

        if (channelKey === 'MOSTRADOR') {
          const pId = item.productId;
          if (!topMostradorProductsMap[pId]) {
            topMostradorProductsMap[pId] = {
              product: item.product,
              unitsSold: 0,
              weightSold: 0,
              totalRevenue: 0,
            };
          }
          topMostradorProductsMap[pId].unitsSold += item.quantity;
          topMostradorProductsMap[pId].weightSold += item.weight ? Number(item.weight) : 0;
          topMostradorProductsMap[pId].totalRevenue += Number(item.subtotal || 0);
        }
      }

      channelSummaryMap[channelKey].sales += orderTotal;
      channelSummaryMap[channelKey].cost += orderCost;
      channelSummaryMap[channelKey].profit += (orderTotal - orderCost);
      channelSummaryMap[channelKey].ordersCount += 1;
      totalRevenueOverall += orderTotal;

      if (channelKey === 'MOSTRADOR') {
        const cId = order.personaId;
        if (!topMostradorClientsMap[cId]) {
          topMostradorClientsMap[cId] = {
            id: order.persona.id,
            name: order.persona.name,
            city: order.persona.city,
            ordersCount: 0,
            totalAmount: 0,
          };
        }
        topMostradorClientsMap[cId].ordersCount += 1;
        topMostradorClientsMap[cId].totalAmount += orderTotal;

        if (order.transactions && order.transactions.length > 0) {
          for (const tx of order.transactions) {
            const method = tx.paymentMethod || 'OTHER';
            mostradorPaymentMethods[method] = (mostradorPaymentMethods[method] || 0) + Number(tx.amount || 0);
          }
        } else {
          mostradorPaymentMethods['CTA_CORRIENTE'] = (mostradorPaymentMethods['CTA_CORRIENTE'] || 0) + orderTotal;
        }
      }
    }

    const topProducts = Object.values(topMostradorProductsMap)
      .sort((a, b) => b.totalRevenue - a.totalRevenue)
      .slice(0, 10);

    const topClients = Object.values(topMostradorClientsMap)
      .sort((a, b) => b.totalAmount - a.totalAmount)
      .slice(0, 10);

    return {
      period: { year, month },
      channels: Object.entries(channelSummaryMap).map(([channel, data]) => ({
        channel,
        sales: Math.round(data.sales),
        cost: Math.round(data.cost),
        profit: Math.round(data.profit),
        ordersCount: data.ordersCount,
        averageTicket: data.ordersCount > 0 ? Math.round(data.sales / data.ordersCount) : 0,
        percentage: totalRevenueOverall > 0 ? Math.round((data.sales / totalRevenueOverall) * 100) : 0
      })),
      mostrador: {
        totalSales: Math.round(channelSummaryMap['MOSTRADOR']?.sales || 0),
        totalOrders: channelSummaryMap['MOSTRADOR']?.ordersCount || 0,
        averageTicket: channelSummaryMap['MOSTRADOR']?.ordersCount ? Math.round(channelSummaryMap['MOSTRADOR'].sales / channelSummaryMap['MOSTRADOR'].ordersCount) : 0,
        topProducts,
        topClients,
        paymentMethods: Object.entries(mostradorPaymentMethods).map(([method, amount]) => ({
          method,
          amount: Math.round(amount)
        }))
      }
    };
  }

  /**
   * Obtener datos consolidados para el Reporte Ejecutivo (PDF para la Dirección).
   */
  async getExecutivePdfReportData(startDateStr?: string, endDateStr?: string) {
    let start: Date;
    let end: Date;

    if (startDateStr && endDateStr) {
      start = new Date(startDateStr);
      end = new Date(endDateStr);
      if (isNaN(start.getTime())) start = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
      if (isNaN(end.getTime())) end = new Date();
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const durationMs = end.getTime() - start.getTime();
    const prevStart = new Date(start.getTime() - durationMs);
    const prevEnd = new Date(start.getTime() - 1);

    // 1. Pedidos entregados en el período actual
    const currentOrders = await prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        createdAt: { gte: start, lte: end }
      },
      include: {
        persona: true,
        items: { include: { product: { include: { rubro: true } } } }
      }
    });
    // 2. Pedidos en período anterior (para comparar)
    const prevOrders = await prisma.order.findMany({
      where: {
        status: OrderStatus.DELIVERED,
        createdAt: { gte: prevStart, lte: prevEnd }
      }
    });

    let totalSales = 0;
    let totalCost = 0;
    let totalBultos = 0;
    let officialSales = 0;
    let officialCost = 0;
    let officialCount = 0;
    let internalSales = 0;
    let internalCost = 0;
    let internalCount = 0;

    const productSalesMap: { [key: number]: { name: string; category: string; quantity: number; amount: number; cost: number } } = {};
    const categorySalesMap: { [key: string]: { amount: number; cost: number; itemsCount: number } } = {};
    const citySalesMap: { [key: string]: { officialSales: number; internalSales: number; totalSales: number; count: number; clients: Set<number> } } = {};
    const clientSalesMap: { [key: number]: { name: string; city: string; officialSales: number; internalSales: number; totalSales: number; cost: number; ordersCount: number } } = {};

    for (const order of currentOrders) {
      const orderTotal = Number(order.totalAmount) || 0;
      totalSales += orderTotal;
      let orderCost = 0;

      const cityName = normalizeCity(order.persona?.city || order.persona?.route);
      if (!citySalesMap[cityName]) {
        citySalesMap[cityName] = { officialSales: 0, internalSales: 0, totalSales: 0, count: 0, clients: new Set() };
      }
      citySalesMap[cityName].totalSales += orderTotal;
      citySalesMap[cityName].count += 1;
      if (order.personaId) citySalesMap[cityName].clients.add(order.personaId);
      if (order.billingType === BillingType.OFFICIAL) {
        citySalesMap[cityName].officialSales += orderTotal;
      } else {
        citySalesMap[cityName].internalSales += orderTotal;
      }

      for (const item of order.items) {
        const qty = item.product.isPesable && item.weight ? Number(item.weight) : item.quantity;
        const itemAmount = Number(item.subtotal || Number(item.unitPrice) * qty) || 0;
        const itemCost = Math.round(Number(item.product.costPrice || 0) * qty);
        orderCost += itemCost;
        totalBultos += item.quantity;

        // Mapeo Producto
        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            name: item.product.name,
            category: item.product.rubro?.name || 'Sin Categoría',
            quantity: 0,
            amount: 0,
            cost: 0
          };
        }
        productSalesMap[item.productId].quantity += item.quantity;
        productSalesMap[item.productId].amount += itemAmount;
        productSalesMap[item.productId].cost += itemCost;

        // Mapeo Categoría
        const catName = item.product.rubro?.name || 'Sin Categoría';
        if (!categorySalesMap[catName]) {
          categorySalesMap[catName] = { amount: 0, cost: 0, itemsCount: 0 };
        }
        categorySalesMap[catName].amount += itemAmount;
        categorySalesMap[catName].cost += itemCost;
        categorySalesMap[catName].itemsCount += item.quantity;
      }

      totalCost += orderCost;

      if (order.billingType === BillingType.OFFICIAL) {
        officialSales += orderTotal;
        officialCost += orderCost;
        officialCount++;
      } else {
        internalSales += orderTotal;
        internalCost += orderCost;
        internalCount++;
      }

      // Mapeo por Cliente (Rentabilidad)
      if (order.personaId) {
        const clientName = order.persona?.name || `Cliente #${order.personaId}`;
        if (!clientSalesMap[order.personaId]) {
          clientSalesMap[order.personaId] = {
            name: clientName,
            city: cityName,
            officialSales: 0,
            internalSales: 0,
            totalSales: 0,
            cost: 0,
            ordersCount: 0
          };
        }
        clientSalesMap[order.personaId].totalSales += orderTotal;
        clientSalesMap[order.personaId].cost += orderCost;
        clientSalesMap[order.personaId].ordersCount += 1;
        if (order.billingType === BillingType.OFFICIAL) {
          clientSalesMap[order.personaId].officialSales += orderTotal;
        } else {
          clientSalesMap[order.personaId].internalSales += orderTotal;
        }
      }
    }

    // Totales período anterior
    const prevTotalSales = prevOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const salesGrowthPct = prevTotalSales > 0 ? Math.round(((totalSales - prevTotalSales) / prevTotalSales) * 100) : 0;

    // Cobranzas en el período
    const collections = await prisma.transaction.groupBy({
      by: ['paymentMethod'],
      where: {
        type: TransactionType.INCOME,
        createdAt: { gte: start, lte: end }
      },
      _sum: { amount: true }
    });

    let totalCollected = 0;
    const collectionsByMethod: { [key: string]: number } = { CASH: 0, CHECK: 0, BANK_TRANSFER: 0, OTHER: 0 };

    collections.forEach(c => {
      const amt = Math.round(Number(c._sum.amount || 0));
      totalCollected += amt;
      const method = c.paymentMethod || 'OTHER';
      collectionsByMethod[method] = (collectionsByMethod[method] || 0) + amt;
    });

    // Deuda pendiente en calle (Saldo total de clientes)
    const debtors = await prisma.persona.aggregate({
      where: { outstandingBalance: { gt: 0 } },
      _sum: { outstandingBalance: true }
    });
    const totalPendingDebt = Math.round(Number(debtors._sum?.outstandingBalance || 0));

    const expenses = await prisma.expense.findMany({
      where: { date: { gte: start, lte: end } },
      include: { category: true }
    });
    let totalExpenses = 0;
    const expensesByCategoryMap: { [key: string]: number } = {};
    expenses.forEach(e => {
      const amt = Number(e.amount) || 0;
      totalExpenses += amt;
      const cat = e.category?.name || 'General';
      expensesByCategoryMap[cat] = (expensesByCategoryMap[cat] || 0) + amt;
    });

    // Top 10 Productos
    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 10)
      .map(p => ({
        ...p,
        amount: Math.round(p.amount),
        cost: Math.round(p.cost),
        profit: Math.round(p.amount - p.cost),
        marginPct: p.amount > 0 ? Math.round(((p.amount - p.cost) / p.amount) * 100) : 0
      }));

    // Top 10 Clientes Más Rentables
    const topClients = Object.values(clientSalesMap)
      .map(c => ({
        ...c,
        officialSales: Math.round(c.officialSales),
        internalSales: Math.round(c.internalSales),
        totalSales: Math.round(c.totalSales),
        cost: Math.round(c.cost),
        profit: Math.round(c.totalSales - c.cost),
        marginPct: c.totalSales > 0 ? Math.round(((c.totalSales - c.cost) / c.totalSales) * 100) : 0
      }))
      .sort((a, b) => b.profit - a.profit)
      .slice(0, 10);

    // Top Categorías
    const topCategories = Object.entries(categorySalesMap)
      .map(([name, data]) => ({
        name,
        amount: Math.round(data.amount),
        cost: Math.round(data.cost),
        profit: Math.round(data.amount - data.cost),
        marginPct: data.amount > 0 ? Math.round(((data.amount - data.cost) / data.amount) * 100) : 0,
        itemsCount: data.itemsCount
      }))
      .sort((a, b) => b.amount - a.amount);

    // Zonas / Ciudades con desglose Sucursal A (Oficial), Sucursal X (Interna) y Total
    const citiesSummary = Object.entries(citySalesMap)
      .map(([cityName, data]) => ({
        cityName,
        officialSales: Math.round(data.officialSales),
        internalSales: Math.round(data.internalSales),
        totalSales: Math.round(data.totalSales),
        ordersCount: data.count,
        activeClientsCount: data.clients.size
      }))
      .sort((a, b) => b.totalSales - a.totalSales);

    const grossProfit = totalSales - totalCost;
    const netProfit = grossProfit - totalExpenses;
    const grossMarginPct = totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0;

    return {
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString(),
        durationDays: Math.ceil(durationMs / (1000 * 60 * 60 * 24))
      },
      summary: {
        totalSales: Math.round(totalSales),
        totalCost: Math.round(totalCost),
        grossProfit: Math.round(grossProfit),
        grossMarginPct,
        totalExpenses: Math.round(totalExpenses),
        netProfit: Math.round(netProfit),
        totalOrders: currentOrders.length,
        totalBultos,
        salesGrowthPct,
        prevTotalSales: Math.round(prevTotalSales)
      },
      billingBreakdown: {
        official: {
          sales: Math.round(officialSales),
          cost: Math.round(officialCost),
          grossProfit: Math.round(officialSales - officialCost),
          count: officialCount
        },
        internal: {
          sales: Math.round(internalSales),
          cost: Math.round(internalCost),
          grossProfit: Math.round(internalSales - internalCost),
          count: internalCount
        }
      },
      collections: {
        totalCollected,
        byMethod: {
          cash: collectionsByMethod['CASH'] || 0,
          check: collectionsByMethod['CHECK'] || 0,
          transfer: collectionsByMethod['BANK_TRANSFER'] || 0,
          other: collectionsByMethod['OTHER'] || 0
        },
        totalPendingDebt
      },
      topProducts,
      topClients,
      topCategories,
      citiesSummary,
      expensesSummary: {
        total: Math.round(totalExpenses),
        byCategory: Object.entries(expensesByCategoryMap).map(([name, amount]) => ({ name, amount: Math.round(amount) }))
      }
    };
  }

  async getSellerMeetingPdfReportData(sellerId: number, startDateStr?: string, endDateStr?: string) {
    let start: Date;
    let end: Date;

    if (startDateStr && endDateStr) {
      start = new Date(startDateStr);
      end = new Date(endDateStr);
    } else {
      const now = new Date();
      start = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
    }

    const sellerUser = await prisma.user.findUnique({ where: { id: sellerId } });
    const sellerPersona = await prisma.persona.findFirst({
      where: { OR: [{ id: sellerId }, { name: { contains: sellerUser?.username || '', mode: 'insensitive' } }] }
    });

    const sellerName = sellerUser?.username ? sellerUser.username.toUpperCase() : sellerPersona?.name || `Vendedor #${sellerId}`;

    const assignedClients = await prisma.persona.findMany({
      where: { sellerId: sellerId },
      include: { saleRoute: true }
    });

    const totalClientsCount = assignedClients.length;

    const sellerOrders = await prisma.order.findMany({
      where: {
        sellerId: sellerId,
        status: OrderStatus.DELIVERED,
        createdAt: { gte: start, lte: end }
      },
      include: {
        persona: true,
        items: { include: { product: { include: { rubro: true } } } }
      }
    });

    let totalSales = 0;
    let totalCost = 0;
    let totalBultos = 0;
    let officialSales = 0;
    let internalSales = 0;
    const buyingClientsSet = new Set<number>();
    const productSalesMap: { [key: number]: { name: string; category: string; quantity: number; amount: number } } = {};

    sellerOrders.forEach(order => {
      const orderAmt = Number(order.totalAmount) || 0;
      totalSales += orderAmt;
      if (order.personaId) buyingClientsSet.add(order.personaId);

      if (order.billingType === BillingType.OFFICIAL) {
        officialSales += orderAmt;
      } else {
        internalSales += orderAmt;
      }

      order.items.forEach(item => {
        const qty = item.product.isPesable && item.weight ? Number(item.weight) : item.quantity;
        const itemAmt = Number(item.subtotal || Number(item.unitPrice) * qty) || 0;
        const cost = Math.round(Number(item.product.costPrice || 0) * qty);
        totalCost += cost;
        totalBultos += item.quantity;

        if (!productSalesMap[item.productId]) {
          productSalesMap[item.productId] = {
            name: item.product.name,
            category: item.product.rubro?.name || 'Sin Categoría',
            quantity: 0,
            amount: 0
          };
        }
        productSalesMap[item.productId].quantity += item.quantity;
        productSalesMap[item.productId].amount += itemAmt;
      });
    });

    const activeBuyingClientsCount = buyingClientsSet.size;
    const portfolioCoveragePct = totalClientsCount > 0 ? Math.round((activeBuyingClientsCount / totalClientsCount) * 100) : 0;
    const averageTicketPerClient = activeBuyingClientsCount > 0 ? Math.round(totalSales / activeBuyingClientsCount) : 0;

    const sellerCollections = await prisma.transaction.aggregate({
      where: {
        userId: sellerId,
        type: TransactionType.INCOME,
        createdAt: { gte: start, lte: end }
      },
      _sum: { amount: true }
    });
    const totalCollected = Math.round(Number(sellerCollections._sum.amount || 0));

    const clientIds = assignedClients.map(c => c.id);
    const carteraDebtAggregate = await prisma.persona.aggregate({
      where: { id: { in: clientIds }, outstandingBalance: { gt: 0 } },
      _sum: { outstandingBalance: true }
    });
    const totalCarteraDebt = Math.round(Number(carteraDebtAggregate._sum?.outstandingBalance || 0));

    const inactiveClients = assignedClients
      .filter(c => !buyingClientsSet.has(c.id))
      .map(c => ({
        id: c.id,
        name: c.name,
        city: normalizeCity(c.city || c.route),
        balance: Math.round(Number(c.outstandingBalance || 0))
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 10);

    const debtorClients = assignedClients
      .filter(c => Number(c.outstandingBalance || 0) > 0)
      .map(c => ({
        id: c.id,
        name: c.name,
        city: normalizeCity(c.city || c.route),
        balance: Math.round(Number(c.outstandingBalance || 0))
      }))
      .sort((a, b) => b.balance - a.balance)
      .slice(0, 8);

    const topProducts = Object.values(productSalesMap)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 6)
      .map(p => ({ ...p, amount: Math.round(p.amount) }));

    const actionInsights: Array<{ type: 'warning' | 'opportunity' | 'success'; title: string; description: string }> = [];

    if (portfolioCoveragePct < 60) {
      actionInsights.push({
        type: 'warning',
        title: 'Baja Cobertura de Cartera',
        description: `Solo el ${portfolioCoveragePct}% de los clientes asignados (${activeBuyingClientsCount} de ${totalClientsCount}) realizaron compras en el período. Hay ${inactiveClients.length} clientes inactivos para revisar.`
      });
    } else {
      actionInsights.push({
        type: 'success',
        title: 'Buena Cobertura de Cartera',
        description: `El vendedor registró ventas en el ${portfolioCoveragePct}% de su cartera (${activeBuyingClientsCount} clientes).`
      });
    }

    if (totalCarteraDebt > 2000000) {
      actionInsights.push({
        type: 'warning',
        title: 'Deuda Acumulada en Cartera',
        description: `Los clientes asignados acumulan $${totalCarteraDebt.toLocaleString('es-AR')} en cuenta corriente. Revisar prioridad de cobranza antes de autorizar nuevos créditos.`
      });
    }

    if (inactiveClients.length > 0) {
      actionInsights.push({
        type: 'opportunity',
        title: 'Recuperación de Clientes Inactivos',
        description: `Identificados ${inactiveClients.length} clientes principales que no compraron este período. Planificar visitas en ruta para reactivar pedidos.`
      });
    }

    const grossProfit = totalSales - totalCost;
    const grossMarginPct = totalSales > 0 ? Math.round((grossProfit / totalSales) * 100) : 0;

    return {
      seller: {
        id: sellerId,
        name: sellerName,
        totalAssignedClients: totalClientsCount,
      },
      period: {
        startDate: start.toISOString(),
        endDate: end.toISOString()
      },
      performance: {
        totalSales: Math.round(totalSales),
        totalCost: Math.round(totalCost),
        grossProfit: Math.round(grossProfit),
        grossMarginPct,
        totalOrders: sellerOrders.length,
        totalBultos,
        activeBuyingClientsCount,
        portfolioCoveragePct,
        averageTicketPerClient,
        officialSales: Math.round(officialSales),
        internalSales: Math.round(internalSales)
      },
      collections: {
        totalCollected,
        totalCarteraDebt
      },
      topProducts,
      inactiveClients,
      debtorClients,
      actionInsights
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
