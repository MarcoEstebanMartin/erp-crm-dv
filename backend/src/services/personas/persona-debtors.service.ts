import prisma from '../../utils/prisma';
import { Role, TransactionType, BillingType, OrderStatus } from '@prisma/client';
import { getOfficialCityOrOther, OFFICIAL_CITIES } from '../../utils/normalize';
import { roundToIntegerPeso } from '../../core/money';

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
   * Calcula la cantidad exacta de boletas impagas de un cliente aplicando FIFO global.
   */
  async getPersonaPendingInvoicesCount(id: number, dbClient: any = prisma) {
    const client = await dbClient.persona.findUnique({
      where: { id },
      include: {
        orders: {
          where: { status: OrderStatus.DELIVERED },
          include: {
            transactions: { where: { type: TransactionType.INCOME } },
            creditNotes: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        transactions: { where: { type: TransactionType.INCOME, orderId: null } },
        creditNotes: { where: { orderId: null } },
      },
    });

    if (!client || Number(client.outstandingBalance) <= 0) return 0;

    const officialOrders = client.orders.filter(
      (o: any) => o.billingType === BillingType.OFFICIAL,
    );
    const internalOrders = client.orders.filter(
      (o: any) => o.billingType === BillingType.INTERNAL,
    );

    const totalOfficialCredit =
      client.transactions
        .filter((t: any) => t.billingType === BillingType.OFFICIAL)
        .reduce((acc: number, t: any) => acc + Number(t.amount), 0) +
      client.creditNotes
        .filter((cn: any) => cn.billingType === BillingType.OFFICIAL)
        .reduce((acc: number, cn: any) => acc + Number(cn.totalAmount), 0);

    const totalInternalCredit =
      client.transactions
        .filter((t: any) => t.billingType === BillingType.INTERNAL)
        .reduce((acc: number, t: any) => acc + Number(t.amount), 0) +
      client.creditNotes
        .filter((cn: any) => cn.billingType === BillingType.INTERNAL)
        .reduce((acc: number, cn: any) => acc + Number(cn.totalAmount), 0);

    const calculateFIFO = (orders: any[], unallocatedCredit: number) => {
      let pool = unallocatedCredit;
      let pendingInvoicesCount = 0;
      orders.forEach((order: any) => {
        const directPayments = (order.transactions || []).reduce(
          (acc: number, t: any) => acc + Number(t.amount),
          0,
        );
        const directCreditNotes = (order.creditNotes || []).reduce(
          (acc: number, cn: any) => acc + Number(cn.totalAmount),
          0,
        );
        let debt = Math.max(0, Number(order.totalAmount) - directPayments - directCreditNotes);

        if (pool > 0) {
          if (debt <= pool) {
            pool -= debt;
            debt = 0;
          } else {
            debt -= pool;
            pool = 0;
          }
        }
        if (debt > 0.5) pendingInvoicesCount++;
      });
      return pendingInvoicesCount;
    };

    return (
      calculateFIFO(officialOrders, totalOfficialCredit) +
      calculateFIFO(internalOrders, totalInternalCredit)
    );
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

    const clients = await prisma.persona.findMany({
      where: whereClause,
      include: {
        seller: { select: { id: true, username: true } },
        orders: {
          where: { status: OrderStatus.DELIVERED },
          include: {
            transactions: { where: { type: TransactionType.INCOME } },
            creditNotes: true,
          },
          orderBy: { createdAt: 'asc' },
        },
        transactions: { where: { type: TransactionType.INCOME, orderId: null } },
        creditNotes: { where: { orderId: null } },
      },
      orderBy: { name: 'asc' },
    });

    const debtors = clients.map((client) => {
      const officialOrders = client.orders.filter(
        (o) => o.billingType === BillingType.OFFICIAL,
      );
      const internalOrders = client.orders.filter(
        (o) => o.billingType === BillingType.INTERNAL,
      );

      const officialIncomes = client.transactions.filter(
        (t) => t.billingType === BillingType.OFFICIAL,
      );
      const internalIncomes = client.transactions.filter(
        (t) => t.billingType === BillingType.INTERNAL,
      );

      const officialCreditNotes = client.creditNotes.filter(
        (cn) => cn.billingType === BillingType.OFFICIAL,
      );
      const internalCreditNotes = client.creditNotes.filter(
        (cn) => cn.billingType === BillingType.INTERNAL,
      );

      const totalOfficialCredit =
        officialIncomes.reduce((acc, t) => acc + Number(t.amount), 0) +
        officialCreditNotes.reduce((acc, cn) => acc + Number(cn.totalAmount), 0);

      const totalInternalCredit =
        internalIncomes.reduce((acc, t) => acc + Number(t.amount), 0) +
        internalCreditNotes.reduce((acc, cn) => acc + Number(cn.totalAmount), 0);

      const calculateFIFO = (orders: typeof client.orders, unallocatedCredit: number) => {
        let pool = unallocatedCredit;
        let pendingInvoicesCount = 0;
        let remainingDebt = 0;

        orders.forEach((order) => {
          const directPayments = order.transactions.reduce(
            (acc, t) => acc + Number(t.amount),
            0,
          );
          const directCreditNotes = order.creditNotes.reduce(
            (acc, cn) => acc + Number(cn.totalAmount),
            0,
          );

          let debt = Math.max(0, Number(order.totalAmount) - directPayments - directCreditNotes);
          if (pool > 0) {
            if (debt <= pool) {
              pool -= debt;
              debt = 0;
            } else {
              debt -= pool;
              pool = 0;
            }
          }

          if (debt > 0.5) {
            pendingInvoicesCount++;
            remainingDebt += debt;
          }
        });

        return { remainingDebt, pendingInvoicesCount };
      };

      const officialResult = calculateFIFO(officialOrders, totalOfficialCredit);
      const internalResult = calculateFIFO(internalOrders, totalInternalCredit);

      let debtA = officialResult.remainingDebt;
      let debtX = internalResult.remainingDebt;
      const totalCalculated = debtA + debtX;
      const dbOutstanding = roundToIntegerPeso(client.outstandingBalance).toNumber();

      if (dbOutstanding > 0) {
        if (totalCalculated > 0) {
          const ratioA = debtA / totalCalculated;
          debtA = roundToIntegerPeso(ratioA * dbOutstanding).toNumber();
          debtX = dbOutstanding - debtA;
        } else {
          debtX = dbOutstanding;
          debtA = 0;
        }
      } else {
        debtA = 0;
        debtX = 0;
      }

      const pendingCount =
        officialResult.pendingInvoicesCount + internalResult.pendingInvoicesCount;

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
        outstandingBalance: dbOutstanding,
        debtA: Math.max(0, debtA),
        debtX: Math.max(0, debtX),
        pendingInvoicesCount: pendingCount,
        hasMultiplePendingInvoices: pendingCount > 1,
        sellerId: client.sellerId,
        sellerName: client.seller?.username || 'Sin Preventista',
      };
    });

    const availableRoutes = [
      ...new Set(debtors.map((d) => d.route).filter((r) => r && r !== 'Sin Ruta')),
    ].sort();
    const availableCities = [...OFFICIAL_CITIES, 'OTRAS'].sort();

    const sellers = await prisma.user.findMany({
      where: { role: 'VENDEDOR' },
      select: { id: true, username: true },
    });

    return { debtors, availableRoutes, availableCities, availableSellers: sellers };
  }
}

export const personaDebtorsSubService = new PersonaDebtorsSubService();
