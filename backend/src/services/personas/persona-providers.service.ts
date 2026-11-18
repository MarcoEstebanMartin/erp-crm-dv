import { LedgerEntryType, LedgerSourceType } from '@prisma/client';
import prisma from '../../utils/prisma';
import { toDecimal } from '../../core/money';
import {
  computeProviderBalanceView,
  formatSupplierCuit,
} from '../../engines/provider-ledger.engine';

const PROVIDER_LEDGER_SOURCES = [
  LedgerSourceType.SUPPLIER_INVOICE,
  LedgerSourceType.SUPPLIER_INVOICE_REVERSAL,
  LedgerSourceType.SUPPLIER_PAYMENT,
];

export class PersonaProvidersSubService {
  /**
   * Enriquece el listado de proveedores en 2–3 consultas agregadas paralelas (sin N+1):
   *  - productsCount: cantidad de productos activos asociados al proveedor.
   *  - pendingInvoicesCount / overdueInvoicesCount: facturas abiertas y vencidas.
   *  - payableBalance / favorBalance: saldo en perspectiva de proveedor con Decimal.js.
   */
  async enrichProvidersMetrics(providers: any[], dbClient: any = prisma): Promise<any[]> {
    if (!Array.isArray(providers) || providers.length === 0) {
      return providers;
    }

    const supportsBatchQueries =
      Boolean(dbClient?.product?.groupBy) && Boolean(dbClient?.supplierInvoice?.findMany);
    if (!supportsBatchQueries) {
      return providers.map((p) => {
        const balanceView = computeProviderBalanceView({
          outstandingBalance: p.outstandingBalance?.toString() ?? '0',
          isClient: Boolean(p.isClient),
        });
        return {
          ...p,
          productsCount: p.productsCount ?? 0,
          pendingInvoicesCount: p.pendingInvoicesCount ?? 0,
          overdueInvoicesCount: p.overdueInvoicesCount ?? 0,
          payableBalance: balanceView.payableBalance,
          favorBalance: balanceView.favorBalance,
        };
      });
    }

    const providerIds = providers.map((p) => Number(p.id)).filter((id) => Number.isFinite(id));
    const dualIds = providers
      .filter((p) => Boolean(p.isClient))
      .map((p) => Number(p.id))
      .filter((id) => Number.isFinite(id));

    const [productCounts, openInvoices, dualLedgerGroups] = await Promise.all([
      dbClient.product.groupBy({
        by: ['providerId'],
        where: { providerId: { in: providerIds }, isActive: true },
        _count: { _all: true },
      }),
      dbClient.supplierInvoice.findMany({
        where: { personaId: { in: providerIds }, status: { not: 'PAID' } },
        select: { personaId: true, dueDate: true, totalAmount: true, paidAmount: true },
      }),
      dualIds.length > 0 && dbClient?.accountLedger?.groupBy
        ? dbClient.accountLedger.groupBy({
            by: ['personaId', 'entryType'],
            where: {
              personaId: { in: dualIds },
              sourceType: { in: PROVIDER_LEDGER_SOURCES },
            },
            _sum: { amount: true },
          })
        : Promise.resolve([]),
    ]);

    const prodCountMap = new Map<number, number>();
    for (const row of productCounts || []) {
      if (row.providerId != null) {
        prodCountMap.set(Number(row.providerId), Number(row._count?._all ?? 0));
      }
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const invStatsMap = new Map<number, { pending: number; overdue: number }>();
    for (const inv of openInvoices || []) {
      const pendingAmt = toDecimal(inv.totalAmount?.toString() ?? 0).minus(
        inv.paidAmount?.toString() ?? 0,
      );
      if (pendingAmt.lte(0)) continue;
      const pid = Number(inv.personaId);
      const current = invStatsMap.get(pid) || { pending: 0, overdue: 0 };
      current.pending += 1;
      if (inv.dueDate && new Date(inv.dueDate) < today) {
        current.overdue += 1;
      }
      invStatsMap.set(pid, current);
    }

    const dualSumsMap = new Map<number, { debit: string; credit: string }>();
    for (const row of dualLedgerGroups || []) {
      const pid = Number(row.personaId);
      const prev = dualSumsMap.get(pid) || { debit: '0', credit: '0' };
      const sumStr = row._sum?.amount?.toString() ?? '0';
      if (row.entryType === LedgerEntryType.DEBIT) {
        prev.debit = toDecimal(prev.debit).plus(sumStr).toString();
      } else {
        prev.credit = toDecimal(prev.credit).plus(sumStr).toString();
      }
      dualSumsMap.set(pid, prev);
    }

    return providers.map((p) => {
      const pid = Number(p.id);
      const isDual = Boolean(p.isClient);
      const dualSums = dualSumsMap.get(pid);
      const balanceView = computeProviderBalanceView({
        outstandingBalance: p.outstandingBalance?.toString() ?? '0',
        isClient: isDual,
        providerDebits: isDual ? (dualSums?.debit ?? '0') : undefined,
        providerCredits: isDual ? (dualSums?.credit ?? '0') : undefined,
      });
      const invStats = invStatsMap.get(pid) || { pending: 0, overdue: 0 };

      return {
        ...p,
        productsCount: prodCountMap.get(pid) ?? 0,
        pendingInvoicesCount: invStats.pending,
        overdueInvoicesCount: invStats.overdue,
        payableBalance: balanceView.payableBalance,
        favorBalance: balanceView.favorBalance,
      };
    });
  }

  /**
   * Normaliza el CUIT del proveedor a XX-XXXXXXXX-X y evita crear/editar duplicados por CUIT.
   */
  async validateAndNormalizeProviderInput(
    params: { excludeId?: number; cuit?: string | null; isProvider?: boolean },
    dbClient: any = prisma,
  ): Promise<{ normalizedCuit: string | null }> {
    const normalizedCuit = formatSupplierCuit(params.cuit);
    const cleanDigits = (normalizedCuit || '').replace(/\D/g, '');

    if (params.isProvider && cleanDigits.length === 11 && dbClient?.persona?.findFirst) {
      const existing = await dbClient.persona.findFirst({
        where: {
          isProvider: true,
          ...(params.excludeId ? { id: { not: params.excludeId } } : {}),
          OR: [{ cuit: cleanDigits }, { cuit: normalizedCuit }],
        },
        select: { id: true, name: true },
      });

      if (existing) {
        throw new Error(
          `Ya existe un proveedor registrado con el CUIT ${normalizedCuit} (${existing.name}).`,
        );
      }
    }

    return { normalizedCuit };
  }
}

export const personaProvidersSubService = new PersonaProvidersSubService();
