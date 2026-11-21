import prisma from '../../utils/prisma';
import AppError from '../../utils/AppError';
import { normalizeArgentinaWhatsAppPhone } from '../whatsappDispatch.service';
import type { SaveClientWhatsAppInput } from '../../validators/fieldReceipts.schema';

export interface ClientWhatsAppCoverage {
  totalActiveClients: number;
  verifiedCount: number;
  withPhoneUnverifiedCount: number;
  missingPhoneCount: number;
  verifiedPct: number;
  readyForApi: boolean;
}

const API_READINESS_THRESHOLD_PCT = 80;

export const clientWhatsAppService = {
  /**
   * Guarda y normaliza el WhatsApp de un cliente (549...), registra `whatsappVerifiedAt`
   * y, si se informó un recibo de calle, deja asentado su envío manual sin pisar `DELIVERED`.
   */
  async saveClientWhatsApp(
    personaId: number,
    input: SaveClientWhatsAppInput,
    _actorUserId: number,
  ) {
    if (!Number.isInteger(personaId) || personaId <= 0) {
      throw new AppError('Cliente inválido', 400);
    }

    const normalizedPhone = normalizeArgentinaWhatsAppPhone(input.phone);
    if (!normalizedPhone || normalizedPhone.length < 11 || normalizedPhone.length > 15) {
      throw new AppError('Número de WhatsApp inválido. Ingresá código de área + número (ej: 3388412345).', 400);
    }

    const existing = await prisma.persona.findUnique({
      where: { id: personaId },
      select: { id: true, name: true, isClient: true },
    });

    if (!existing || !existing.isClient) {
      throw new AppError('Cliente no encontrado', 404);
    }

    const now = new Date();

    const updated = await prisma.persona.update({
      where: { id: personaId },
      data: {
        phone: normalizedPhone,
        whatsappVerifiedAt: now,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        whatsappVerifiedAt: true,
      },
    });

    if (input.fieldReceiptId) {
      await prisma.fieldReceipt.updateMany({
        where: {
          id: input.fieldReceiptId,
          personaId,
          whatsappStatus: { in: ['PENDING', 'FAILED'] },
        },
        data: {
          whatsappStatus: 'SENT',
          whatsappError: null,
        },
      });
    }

    return updated;
  },

  /**
   * Calcula la cobertura real de clientes activos con WhatsApp verificado
   * para monitorear el avance de la Fase 1 antes de activar Meta Cloud API.
   */
  async getCoverage(): Promise<ClientWhatsAppCoverage> {
    const clients = await prisma.persona.findMany({
      where: { isClient: true, isActive: true },
      select: { phone: true, whatsappVerifiedAt: true },
    });

    const totalActiveClients = clients.length;
    let verifiedCount = 0;
    let withPhoneUnverifiedCount = 0;
    let missingPhoneCount = 0;

    for (const client of clients) {
      const hasValidPhone = Boolean(normalizeArgentinaWhatsAppPhone(client.phone));
      if (client.whatsappVerifiedAt && hasValidPhone) {
        verifiedCount += 1;
      } else if (hasValidPhone) {
        withPhoneUnverifiedCount += 1;
      } else {
        missingPhoneCount += 1;
      }
    }

    const verifiedPct =
      totalActiveClients > 0 ? Math.round((verifiedCount / totalActiveClients) * 100) : 0;

    return {
      totalActiveClients,
      verifiedCount,
      withPhoneUnverifiedCount,
      missingPhoneCount,
      verifiedPct,
      readyForApi: verifiedPct >= API_READINESS_THRESHOLD_PCT,
    };
  },
};
