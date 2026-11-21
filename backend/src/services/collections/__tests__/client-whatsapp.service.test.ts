import { beforeEach, describe, expect, it, vi } from 'vitest';

const { prismaMock } = vi.hoisted(() => ({
  prismaMock: {
    persona: {
      findUnique: vi.fn(),
      update: vi.fn(),
      findMany: vi.fn(),
    },
    fieldReceipt: {
      updateMany: vi.fn(),
    },
  },
}));

vi.mock('../../../utils/prisma', () => ({
  default: prismaMock,
}));

import { clientWhatsAppService } from '../client-whatsapp.service';
import { saveClientWhatsAppBodySchema } from '../../../validators/fieldReceipts.schema';

describe('clientWhatsAppService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('normalizes Argentine phone to 549..., sets whatsappVerifiedAt and marks field receipt SENT', async () => {
    prismaMock.persona.findUnique.mockResolvedValue({
      id: 42,
      name: 'Almacén López',
      isClient: true,
    });
    prismaMock.persona.update.mockImplementation(async ({ data }: any) => ({
      id: 42,
      name: 'Almacén López',
      phone: data.phone,
      whatsappVerifiedAt: data.whatsappVerifiedAt,
    }));
    prismaMock.fieldReceipt.updateMany.mockResolvedValue({ count: 1 });

    const res = await clientWhatsAppService.saveClientWhatsApp(
      42,
      { phone: '03388 41-2345', fieldReceiptId: 99 },
      7,
    );

    expect(res.phone).toBe('5493388412345');
    expect(res.whatsappVerifiedAt).toBeInstanceOf(Date);
    expect(prismaMock.persona.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 42 },
        data: expect.objectContaining({
          phone: '5493388412345',
          whatsappVerifiedAt: expect.any(Date),
        }),
      }),
    );
    expect(prismaMock.fieldReceipt.updateMany).toHaveBeenCalledWith({
      where: {
        id: 99,
        personaId: 42,
        whatsappStatus: { in: ['PENDING', 'FAILED'] },
      },
      data: {
        whatsappStatus: 'SENT',
        whatsappError: null,
      },
    });
  });

  it('rejects invalid phone numbers with 400 AppError', async () => {
    await expect(
      clientWhatsAppService.saveClientWhatsApp(42, { phone: '12345' }, 7),
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(prismaMock.persona.update).not.toHaveBeenCalled();
  });

  it('rejects non-client or missing persona with 404 AppError', async () => {
    prismaMock.persona.findUnique.mockResolvedValue(null);

    await expect(
      clientWhatsAppService.saveClientWhatsApp(999, { phone: '3388412345' }, 7),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(prismaMock.persona.update).not.toHaveBeenCalled();
  });

  it('computes active client WhatsApp coverage and readyForApi flag accurately', async () => {
    prismaMock.persona.findMany.mockResolvedValue([
      { phone: '5493388412345', whatsappVerifiedAt: new Date() },
      { phone: '5493388412346', whatsappVerifiedAt: new Date() },
      { phone: '5493388412347', whatsappVerifiedAt: new Date() },
      { phone: '5493388412348', whatsappVerifiedAt: new Date() },
      { phone: '3388412349', whatsappVerifiedAt: null },
    ]);

    const coverage = await clientWhatsAppService.getCoverage();

    expect(coverage).toEqual({
      totalActiveClients: 5,
      verifiedCount: 4,
      withPhoneUnverifiedCount: 1,
      missingPhoneCount: 0,
      verifiedPct: 80,
      readyForApi: true,
    });
  });

  it('validates saveClientWhatsAppBodySchema via Zod', () => {
    expect(saveClientWhatsAppBodySchema.safeParse({ phone: '3388412345' }).success).toBe(true);
    expect(saveClientWhatsAppBodySchema.safeParse({ phone: '123' }).success).toBe(false);
  });
});
