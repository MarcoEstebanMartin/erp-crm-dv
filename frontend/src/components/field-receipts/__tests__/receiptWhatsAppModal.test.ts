import { describe, expect, it } from 'vitest';
import { isValidArgentinaWhatsAppPhone } from '../ReceiptWhatsAppSendModal';
import { normalizeArgentinaWhatsAppPhone, buildWhatsAppDeepLink } from '../../../utils/receiptWhatsApp';

describe('ReceiptWhatsAppSendModal helpers', () => {
  it('validates Argentine WhatsApp phone numbers accurately', () => {
    expect(isValidArgentinaWhatsAppPhone('3388412345')).toBe(true);
    expect(isValidArgentinaWhatsAppPhone('03388 41-2345')).toBe(true);
    expect(isValidArgentinaWhatsAppPhone('+54 9 11 5555-6666')).toBe(true);
    expect(isValidArgentinaWhatsAppPhone('12345')).toBe(false);
    expect(isValidArgentinaWhatsAppPhone('')).toBe(false);
  });

  it('builds a normalized wa.me deep link ready to persist and open', () => {
    const normalized = normalizeArgentinaWhatsAppPhone('03388 41-2345');
    expect(normalized).toBe('5493388412345');
    expect(buildWhatsAppDeepLink(normalized, 'Recibo RC-0001')).toBe(
      'https://wa.me/5493388412345?text=Recibo%20RC-0001',
    );
  });
});
