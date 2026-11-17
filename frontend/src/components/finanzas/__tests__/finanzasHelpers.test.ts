import { describe, expect, it } from 'vitest';
import { parseCsvAmount, parseMercadoPagoCsv } from '../finanzasHelpers';

describe('parseCsvAmount', () => {
  it('parses international decimal dot amounts without multiplying by 100', () => {
    expect(parseCsvAmount('18224.50')).toBe(18224.5);
    expect(parseCsvAmount('$ 18,224.50')).toBe(18224.5);
    expect(parseCsvAmount('100.5')).toBe(100.5);
  });

  it('parses Argentine comma decimal and dot thousands amounts', () => {
    expect(parseCsvAmount('$ 18.224,50')).toBe(18224.5);
    expect(parseCsvAmount('18.224')).toBe(18224);
    expect(parseCsvAmount('1.234.567,89')).toBe(1234567.89);
    expect(parseCsvAmount('18224,5')).toBe(18224.5);
  });

  it('returns 0 for empty or invalid input', () => {
    expect(parseCsvAmount('')).toBe(0);
    expect(parseCsvAmount('abc')).toBe(0);
  });
});

describe('parseMercadoPagoCsv', () => {
  it('parses income rows and ignores negative outflows', () => {
    const csv = [
      'source_id;transaction_date;transaction_amount;payer_name;payer_id_number',
      'MP-101;2026-11-16T10:00:00Z;18224.50;ABBATE DAGA JONATHAN;20334445551',
      'MP-102;2026-11-16T11:00:00Z;-5000.00;COMISION;20334445551',
      'MP-103;2026-11-16T12:00:00Z;$ 25.500,00;CLIENTE DOS;27112223339',
    ].join('\n');

    const rows = parseMercadoPagoCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({
      id: 'MP-101',
      amount: 18224.5,
      payerName: 'ABBATE DAGA JONATHAN',
      payerCuit: '20334445551',
    });
    expect(rows[1]).toMatchObject({
      id: 'MP-103',
      amount: 25500,
      payerName: 'CLIENTE DOS',
      payerCuit: '27112223339',
    });
  });
});
