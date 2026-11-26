import prisma from '../../utils/prisma';
import {
  Role,
  TransactionType,
  BillingType,
  OrderStatus,
  CreditNoteStatus,
  LedgerSourceType,
  LedgerEntryType,
} from '@prisma/client';
import { getOfficialCityOrOther, OFFICIAL_CITIES } from '../../utils/normalize';
import { toDecimal } from '../../core/money';
import {
  computeDebtorFifoMetrics,
  createEmptyBranchFollowUp,
  type DebtorFifoMetrics,
  type DebtorOrderFifoInput,
} from '../../engines/persona-debtors.engine';

function resolveCity(
  city: string | null | undefined,
  address: string | null | undefined,
  route: string | null | undefined,
): string {
  if (city) {
    const norm = getOfficialCityOrOther(city);
    if (norm !== 'OTRAS') return norm;
  }
  if (address) {
    const norm = getOfficialCityOrOther(address);
    if (norm !== 'OTRAS') return norm;
  }
  if (route) {
    const norm = getOfficialCityOrOther(route);
    if (norm !== 'OTRAS') return norm;
  }
  return 'OTRAS';
}

export class PersonaDebtorsSubService {
  /**
   * Calcula métricas FIFO (boletas impagas y deuda discriminada A/X) en paralelo con agregaciones SQL.
   * Si ningún cliente recibido tiene saldo deudor > 0, retorna al instante con 0 consultas SQL.
   */
  async getDebtMetricsByPersonaIds(
    personas: Array<{ id: number; outstandingBalance: any }>,
    dbClient: any = prisma,
  ): Promise<Map<number, DebtorFifoMetrics>> {
    const activeDebtors = personas.filter((p) =>
      toDecimal(p.outstandingBalance?.toString() ?? 0).gt(0),
    );
    if (activeDebtors.length === 0) {
      return new Map();
    }

    const debtorIds = activeDebtors.map((p) => p.id);

    const [deliveredOrders, unallocatedTx, unallocatedCn, openingLedger] = await Promise.all([
      dbClient.order.findMany({
        where: { personaId: { in: debtorIds }, status: OrderStatus.DELIVERED },
        select: {
          id: true,
          personaId: true,
          billingType: true,
          totalAmount: true,
          deliveredAt: true,
          createdAt: true,
        },
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      dbClient.transaction.groupBy({
        by: ['personaId', 'billingType'],
        where: { personaId: { in: debtorIds }, orderId: null, type: TransactionType.INCOME, voidedAt: null },
        _sum: { amount: true },
      }),
      dbClient.creditNote.groupBy({
        by: ['personaId', 'billingType'],
        where: {
          personaId: { in: debtorIds },
          orderId: null,
          status: CreditNoteStatus.APPROVED,
        },
        _sum: { totalAmount: true },
      }),
      dbClient.accountLedger?.groupBy
        ? dbClient.accountLedger.groupBy({
            by: ['personaId', 'billingType', 'entryType'],
            where: {
              personaId: { in: debtorIds },
              sourceType: LedgerSourceType.OPENING_BALANCE,
            },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
    ]);

    const orderIds = (deliveredOrders || []).map((o: any) => o.id);
    const [directTx, directCn] =
      orderIds.length > 0
        ? await Promise.all([
            dbClient.transaction.groupBy({
              by: ['orderId'],
              where: { orderId: { in: orderIds }, type: TransactionType.INCOME, voidedAt: null },
              _sum: { amount: true },
            }),
            dbClient.creditNote.groupBy({
              by: ['orderId'],
              where: { orderId: { in: orderIds }, status: CreditNoteStatus.APPROVED },
              _sum: { totalAmount: true },
            }),
          ])
        : [[], []];

    const directIncomeByOrderId = new Map<number, string>();
    for (const row of directTx || []) {
      if (row.orderId != null) {
        directIncomeByOrderId.set(row.orderId, row._sum?.amount?.toString() ?? '0');
      }
    }

    const directCnByOrderId = new Map<number, string>();
    for (const row of directCn || []) {
      if (row.orderId != null) {
        directCnByOrderId.set(row.orderId, row._sum?.totalAmount?.toString() ?? '0');
      }
    }

    const unallocatedOfficialByPersona = new Map<number, ReturnType<typeof toDecimal>>();
    const unallocatedInternalByPersona = new Map<number, ReturnType<typeof toDecimal>>();

    const accumulateUnallocated = (
      personaId: number | null,
      billingType: BillingType,
      rawAmount: unknown,
    ) => {
      if (personaId == null) return;
      const amt = toDecimal(rawAmount?.toString() ?? '0');
      const targetMap =
        billingType === BillingType.OFFICIAL
          ? unallocatedOfficialByPersona
          : unallocatedInternalByPersona;
      targetMap.set(personaId, (targetMap.get(personaId) || toDecimal(0)).plus(amt));
    };

    for (const row of unallocatedTx || []) {
      accumulateUnallocated(row.personaId, row.billingType, row._sum?.amount);
    }
    for (const row of unallocatedCn || []) {
      accumulateUnallocated(row.personaId, row.billingType, row._sum?.totalAmount);
    }

    const ordersByPersona = new Map<number, DebtorOrderFifoInput[]>();
    for (const order of deliveredOrders || []) {
      const list = ordersByPersona.get(order.personaId) || [];
      list.push({
        id: order.id,
        billingType: order.billingType === BillingType.OFFICIAL ? 'OFFICIAL' : 'INTERNAL',
        totalAmount: order.totalAmount?.toString() ?? '0',
        directIncomeSum: directIncomeByOrderId.get(order.id) ?? '0',
        directCreditNoteSum: directCnByOrderId.get(order.id) ?? '0',
        date: order.deliveredAt ?? order.createdAt ?? null,
      });
      ordersByPersona.set(order.personaId, list);
    }

    const openingOfficialByPersona = new Map<number, ReturnType<typeof toDecimal>>();
    const openingInternalByPersona = new Map<number, ReturnType<typeof toDecimal>>();
    for (const row of openingLedger || []) {
      const amt = toDecimal(row._sum?.amount?.toString() ?? '0');
      const signed = row.entryType === LedgerEntryType.DEBIT ? amt : amt.negated();
      const targetMap =
        row.billingType === BillingType.OFFICIAL
          ? openingOfficialByPersona
          : openingInternalByPersona;
      targetMap.set(row.personaId, (targetMap.get(row.personaId) || toDecimal(0)).plus(signed));
    }

    const metricsMap = new Map<number, DebtorFifoMetrics>();
    for (const debtor of activeDebtors) {
      const metrics = computeDebtorFifoMetrics({
        outstandingBalance: debtor.outstandingBalance?.toString() ?? '0',
        orders: ordersByPersona.get(debtor.id) || [],
        unallocatedOfficialCredit: unallocatedOfficialByPersona.get(debtor.id) || 0,
        unallocatedInternalCredit: unallocatedInternalByPersona.get(debtor.id) || 0,
        openingOfficialDebt: openingOfficialByPersona.get(debtor.id) || 0,
        openingInternalDebt: openingInternalByPersona.get(debtor.id) || 0,
      });
      metricsMap.set(debtor.id, metrics);
    }

    return metricsMap;
  }

  /**
   * Calcula la cantidad exacta de boletas impagas de un cliente aplicando FIFO global.
   */
  async getPersonaPendingInvoicesCount(id: number, dbClient: any = prisma) {
    const client = await dbClient.persona.findUnique({
      where: { id },
      select: { id: true, outstandingBalance: true },
    });

    if (!client || toDecimal(client.outstandingBalance?.toString() ?? 0).lte(0)) {
      return 0;
    }

    const metricsMap = await this.getDebtMetricsByPersonaIds([client], dbClient);
    return metricsMap.get(id)?.pendingInvoicesCount ?? 0;
  }

  /**
   * Obtiene el reporte consolidado de deudores con saldo por sucursales (A / X) y advertencias.
   */
  async getDebtorsReport(userId: number, userRole: string) {
    const whereClause: any = {
      isClient: true,
      outstandingBalance: { gt: 0 },
    };

    if (userRole === Role.VENDEDOR) {
      whereClause.sellerId = userId;
    }

    const [clients, sellers] = await Promise.all([
      prisma.persona.findMany({
        where: whereClause,
        select: {
          id: true,
          name: true,
          cuit: true,
          address: true,
          city: true,
          province: true,
          zipCode: true,
          phone: true,
          email: true,
          route: true,
          outstandingBalance: true,
          sellerId: true,
          seller: { select: { id: true, username: true } },
        },
        orderBy: { name: 'asc' },
      }),
      prisma.user.findMany({
        where: { role: Role.VENDEDOR },
        select: { id: true, username: true },
      }),
    ]);

    const metricsMap = await this.getDebtMetricsByPersonaIds(clients);

    const debtors = clients.map((client) => {
      const metrics = metricsMap.get(client.id) ?? {
        outstandingBalance: 0,
        debtA: 0,
        debtX: 0,
        pendingInvoicesCount: 0,
        hasMultiplePendingInvoices: false,
        needsFollowUp: false,
        oldestPendingDays: null,
        followUpLabel: null,
        branchA: createEmptyBranchFollowUp(),
        branchX: createEmptyBranchFollowUp(),
      };

      return {
        id: client.id,
        name: client.name,
        cuit: client.cuit,
        address: client.address,
        city: resolveCity(client.city, client.address, client.route),
        province: client.province,
        zipCode: client.zipCode,
        phone: client.phone,
        email: client.email,
        route: client.route || 'Sin Ruta',
        outstandingBalance: metrics.outstandingBalance,
        debtA: metrics.debtA,
        debtX: metrics.debtX,
        pendingInvoicesCount: metrics.pendingInvoicesCount,
        hasMultiplePendingInvoices: metrics.hasMultiplePendingInvoices,
        needsFollowUp: metrics.needsFollowUp,
        oldestPendingDays: metrics.oldestPendingDays,
        followUpLabel: metrics.followUpLabel,
        branchA: metrics.branchA,
        branchX: metrics.branchX,
        sellerId: client.sellerId,
        sellerName: client.seller?.username || 'Sin Preventista',
      };
    });

    const availableRoutes = [
      ...new Set(debtors.map((d) => d.route).filter((r) => r && r !== 'Sin Ruta')),
    ].sort();
    const availableCities = [...OFFICIAL_CITIES, 'OTRAS'].sort();

    return { debtors, availableRoutes, availableCities, availableSellers: sellers };
  }
}

export const personaDebtorsSubService = new PersonaDebtorsSubService();
