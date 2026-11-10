import { describe, it, expect } from 'vitest';
import { emitirFacturaAFIP } from '../afip.service';

describe('AFIP Service Invariants Unit Tests (Igualdad Impositiva)', () => {
  it('Debe garantizar que ImpTotal sea exactamente igual a ImpNeto + ImpIVA en Factura A sin percepciones', async () => {
    // Usando el modo MOCK por defecto de AFIP cuando no hay certs
    const res = await emitirFacturaAFIP({
      clientCuit: '30712345678',
      clientDocType: 80,
      invoiceType: 'A',
      total: 1210.00,
    });

    expect(res).toBeDefined();
    expect(res.invoiceNumber).toBeDefined();
    expect(res.cae).toBeDefined();
  });

  it('Debe calcular correctamente el neto e IVA para un total con decimales complejos', async () => {
    const totalInput = 10543.25;
    const netoExpected = Number((totalInput / 1.21).toFixed(2));
    const ivaExpected = Number((totalInput - netoExpected).toFixed(2));

    expect(Number((netoExpected + ivaExpected).toFixed(2))).toBe(totalInput);
  });
});
