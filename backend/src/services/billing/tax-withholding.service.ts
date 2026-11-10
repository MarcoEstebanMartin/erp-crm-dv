import prisma from '../../utils/prisma';
import { logAudit } from '../../utils/audit';
import { roundToTwoDecimals } from '../../core/money';

export const taxWithholdingService = {
  async getTaxWithholdings(query: {
    type?: string;
    taxType?: string;
    startDate?: string;
    endDate?: string;
  }) {
    const whereClause: Record<string, any> = {};

    if (query.type) whereClause.type = String(query.type);
    if (query.taxType) whereClause.taxType = String(query.taxType);

    if (query.startDate && query.endDate) {
      whereClause.date = {
        gte: new Date(String(query.startDate)),
        lte: new Date(String(query.endDate)),
      };
    }

    return prisma.taxWithholding.findMany({
      where: whereClause,
      include: { persona: true },
      orderBy: { date: 'desc' },
    });
  },

  async createTaxWithholding(params: {
    userId?: number;
    type: string;
    taxType: string;
    personaId: number;
    number: string;
    date: string;
    amount: number;
    jurisdiction?: string | null;
  }) {
    const exactAmount = roundToTwoDecimals(params.amount).toNumber();
    const personaIdNum = Number(params.personaId);

    const withholding = await prisma.$transaction(async (tx) => {
      const record = await tx.taxWithholding.create({
        data: {
          type: params.type,
          taxType: params.taxType,
          personaId: personaIdNum,
          number: params.number.trim(),
          date: new Date(params.date),
          amount: exactAmount,
          jurisdiction: params.jurisdiction || null,
        },
      });

      if (params.type === 'RETENCION_SUFRIDA') {
        await tx.persona.update({
          where: { id: personaIdNum },
          data: { outstandingBalance: { decrement: exactAmount } },
        });
      } else if (params.type === 'RETENCION_PRACTICADA') {
        await tx.persona.update({
          where: { id: personaIdNum },
          data: { outstandingBalance: { increment: exactAmount } },
        });
      }

      return record;
    });

    if (params.userId) {
      await logAudit({
        userId: params.userId,
        action: 'CREATE_TAX_WITHHOLDING',
        entityType: 'TaxWithholding',
        entityId: withholding.id,
        newValues: withholding,
      });
    }

    return withholding;
  },
};
