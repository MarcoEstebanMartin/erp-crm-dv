import { describe, it, expect, vi } from 'vitest';
import { z } from 'zod';
import { validateRequest } from '../../middlewares/validateRequest';
import {
  createSplitBillingSchema,
  updatePerceptionSchema,
  webChatMessageSchema,
} from '../../validators/misc-routes.validator';

function createMockRes() {
  const res: any = {
    statusCode: 200,
    body: null,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(payload: any) {
      this.body = payload;
      return this;
    },
  };
  return res;
}

describe('Paso A6 — Validación Zod Uniforme (strip + coerción) y Reglas de Contrato', () => {
  it('validateRequest reasigna req.body sanitizado eliminando propiedades no declaradas (anti mass-assignment)', async () => {
    const schema = z.object({
      body: z.object({
        name: z.string().trim(),
        amount: z.coerce.number().positive(),
      }),
    });
    const mw = validateRequest(schema);
    const req: any = {
      body: { name: '  Flete  ', amount: '2500', isAdmin: true, injectedRole: 'ADMIN' },
      query: {},
      params: {},
    };
    const res = createMockRes();
    const next = vi.fn();

    await mw(req, res, next);

    expect(next).toHaveBeenCalledTimes(1);
    expect(req.body).toEqual({ name: 'Flete', amount: 2500 });
    expect(req.body.isAdmin).toBeUndefined();
    expect(req.body.injectedRole).toBeUndefined();
  });

  it('createSplitBillingSchema exige que percentageOfficial + percentageInternal === 100', async () => {
    await expect(
      createSplitBillingSchema.parseAsync({
        body: { rubroId: 2, percentageOfficial: 60, percentageInternal: 50 },
      }),
    ).rejects.toThrow(/100%/);

    const ok = await createSplitBillingSchema.parseAsync({
      body: { rubroId: '2', percentageOfficial: 50, percentageInternal: 50 },
    });
    expect(ok.body.rubroId).toBe(2);
  });

  it('updatePerceptionSchema rechaza alícuotas negativas e IDs no numéricos', async () => {
    await expect(
      updatePerceptionSchema.parseAsync({
        params: { id: 'abc' },
        body: { aliquot: 3 },
      }),
    ).rejects.toThrow();

    await expect(
      updatePerceptionSchema.parseAsync({
        params: { id: '1' },
        body: { aliquot: -2 },
      }),
    ).rejects.toThrow();
  });

  it('webChatMessageSchema limita history a 30 elementos', async () => {
    const hugeHistory = Array.from({ length: 31 }, (_, i) => ({ role: 'user', text: `m${i}` }));
    await expect(
      webChatMessageSchema.parseAsync({
        body: { message: 'hola', history: hugeHistory },
      }),
    ).rejects.toThrow();
  });
});
