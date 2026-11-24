import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseArcaCertStatusFromPem } from '../../utils/arca-wsaa-cms.util';

describe('Monitoreo de vencimiento del certificado AFIP/ARCA', () => {
  const certPath = path.resolve(process.cwd(), 'certs/arca.crt');
  const hasRealCert = fs.existsSync(certPath);

  it('devuelve MISSING ante un PEM vacío o inválido', () => {
    expect(parseArcaCertStatusFromPem('')).toMatchObject({
      configured: false,
      status: 'MISSING',
      daysRemaining: null,
    });
    expect(parseArcaCertStatusFromPem('NO-ES-UN-CERT')).toMatchObject({
      configured: false,
      status: 'MISSING',
    });
  });

  it.skipIf(!hasRealCert)('clasifica OK, EXPIRING_SOON (<=30 días) y EXPIRED sobre certs/arca.crt', () => {
    const pem = fs.readFileSync(certPath, 'utf8');
    const baseline = parseArcaCertStatusFromPem(pem, Date.parse('2026-11-24T12:00:00Z'));

    expect(baseline.configured).toBe(true);
    expect(baseline.alias).toBe('erpdv2026');
    expect(baseline.cuit).toBe('20163165059');
    expect(baseline.status).toBe('OK');
    expect((baseline.daysRemaining ?? 0)).toBeGreaterThan(700);

    const validToMs = Date.parse(baseline.validTo!);
    const expiring = parseArcaCertStatusFromPem(pem, validToMs - 15 * 86_400_000, 30);
    expect(expiring.status).toBe('EXPIRING_SOON');
    expect(expiring.daysRemaining).toBe(15);

    const expired = parseArcaCertStatusFromPem(pem, validToMs + 2 * 86_400_000, 30);
    expect(expired.status).toBe('EXPIRED');
    expect(expired.daysRemaining).toBeLessThan(0);
  });
});
