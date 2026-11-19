import { describe, it, expect } from 'vitest';
import {
  DEFAULT_PUBLIC_APP_URL,
  buildPublicReceiptUrl,
  formatVerificationCode,
  normalizePublicAppUrl,
  signReceiptToken,
  verifyReceiptToken,
} from './receiptToken';

const TEST_SECRET = 'super-secret-don-venancio-test-key';

describe('receiptToken (HMAC-SHA256 anti-estafas)', () => {
  it('genera tokens determinísticos de 16 caracteres hex para el mismo recibo', () => {
    const t1 = signReceiptToken({ kind: 'office', id: 52, secret: TEST_SECRET });
    const t2 = signReceiptToken({ kind: 'office', id: 52, secret: TEST_SECRET });

    expect(t1).toBe(t2);
    expect(t1).toMatch(/^[0-9a-f]{16}$/);
  });

  it('genera tokens distintos para IDs o tipos distintos (evita enumeración)', () => {
    const t52 = signReceiptToken({ kind: 'office', id: 52, secret: TEST_SECRET });
    const t53 = signReceiptToken({ kind: 'office', id: 53, secret: TEST_SECRET });
    const tField52 = signReceiptToken({ kind: 'field', id: 52, secret: TEST_SECRET });

    expect(t52).not.toBe(t53);
    expect(t52).not.toBe(tField52);
  });

  it('valida correctamente el token exacto y rechaza tokens inválidos o de otro ID', () => {
    const valid = signReceiptToken({ kind: 'office', id: 52, secret: TEST_SECRET });

    expect(verifyReceiptToken({ kind: 'office', id: 52, token: valid, secret: TEST_SECRET })).toBe(
      true,
    );
    expect(
      verifyReceiptToken({ kind: 'office', id: 52, token: valid.toUpperCase(), secret: TEST_SECRET }),
    ).toBe(true);
    expect(verifyReceiptToken({ kind: 'office', id: 53, token: valid, secret: TEST_SECRET })).toBe(
      false,
    );
    expect(verifyReceiptToken({ kind: 'office', id: 52, token: '', secret: TEST_SECRET })).toBe(
      false,
    );
    expect(
      verifyReceiptToken({ kind: 'office', id: 52, token: undefined, secret: TEST_SECRET }),
    ).toBe(false);
    expect(
      verifyReceiptToken({ kind: 'office', id: 52, token: '0000000000000000', secret: TEST_SECRET }),
    ).toBe(false);
  });

  it('formatea el código de verificación corto en formato DV-XXXX-XXXX', () => {
    const token = '8f3a9c12b4e17d05';
    expect(formatVerificationCode(token)).toBe('DV-8F3A-9C12');
  });

  it('normaliza URLs públicas y bloquea localhost cayendo al dominio oficial', () => {
    expect(normalizePublicAppUrl('http://localhost:5174')).toBe(DEFAULT_PUBLIC_APP_URL);
    expect(normalizePublicAppUrl('http://127.0.0.1:3000/')).toBe(DEFAULT_PUBLIC_APP_URL);
    expect(normalizePublicAppUrl('')).toBe(DEFAULT_PUBLIC_APP_URL);
    expect(normalizePublicAppUrl('https://erp.donvenancio.com.ar///')).toBe(
      'https://erp.donvenancio.com.ar',
    );
  });

  it('construye la URL pública firmada correctamente', () => {
    const token = signReceiptToken({ kind: 'office', id: 52, secret: TEST_SECRET });
    const url = buildPublicReceiptUrl({
      baseUrl: 'https://erp.donvenancio.com.ar/',
      id: 52,
      token,
    });
    expect(url).toBe(`https://erp.donvenancio.com.ar/recibo/52?v=${token}`);
  });
});
