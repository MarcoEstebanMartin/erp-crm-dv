import { describe, expect, it } from 'vitest';
import { recordPersonaPaymentSchema } from '../persona.validator';

describe('recordPersonaPaymentSchema', () => {
  it('conserva allowCreditOnAccount e isCreditOnAccount al validar el cobro', () => {
    const parsed = recordPersonaPaymentSchema.parse({
      params: { id: '42' },
      body: {
        amount: 15000,
        paymentMethod: 'CASH',
        allowCreditOnAccount: true,
        isCreditOnAccount: true,
      },
    });

    expect(parsed.body.allowCreditOnAccount).toBe(true);
    expect(parsed.body.isCreditOnAccount).toBe(true);
  });
});
