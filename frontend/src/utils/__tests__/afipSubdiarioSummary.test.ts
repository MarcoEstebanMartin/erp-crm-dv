import { describe, expect, it } from 'vitest';
import {
  buildBookLedger,
  buildConceptSummary,
  buildTaxConditionSummary,
  formatIduoARS,
  formatTriLine,
  formatVoucherDisplay,
} from '../afipSubdiarioSummary.helper';

describe('Paso 2 — Réplica exacta del PDF Subdiario IVA de Iduo (BigInt centavos)', () => {
  const sampleVentas = [
    {
      fecha: '2026-10-01T14:00:00.000Z',
      tipo: 'FACTURA_A',
      numero: '00005-00008396',
      persona: { name: 'BROCCO AMALIIA LEONOR', cuit: '27-06048540-8', taxCondition: 'RESPONSABLE_INSCRIPTO' },
      taxCondition: 'RESPONSABLE_INSCRIPTO',
      neto: '177659.09',
      iva: '37308.41',
      percepciones: '0.00',
      percepcionesIva: '5329.77',
      total: '220297.27',
      sign: 1,
    },
    {
      fecha: '2026-10-01T16:00:00.000Z',
      tipo: 'FACTURA_B',
      numero: '00005-00000102',
      persona: { name: 'FUNDACION ARGENINTA', cuit: '30-67630365-7', taxCondition: 'EXENTO' },
      taxCondition: 'EXENTO',
      neto: '61145.45',
      iva: '12840.55',
      percepciones: '0.00',
      percepcionesIva: '0.00',
      total: '73986.00',
      sign: 1,
    },
    {
      fecha: '2026-10-07T15:00:00.000Z',
      tipo: 'NOTA_CREDITO_A',
      numero: '00005-00000407',
      persona: { name: 'CAMERINI VILLARRUEL', cuit: '24-36577658-6', taxCondition: 'RESPONSABLE_INSCRIPTO' },
      taxCondition: 'RESPONSABLE_INSCRIPTO',
      neto: '100000.00',
      iva: '21000.00',
      percepciones: '0.00',
      percepcionesIva: '3000.00',
      total: '124000.00',
      sign: -1,
    },
  ];

  const sampleRetenciones = [
    {
      fecha: '2026-10-01T15:00:00.000Z',
      tipo: 'Retencion Ganancias',
      taxType: 'GANANCIAS',
      jurisdiction: null,
      numero: '00005-00000558',
      persona: { name: 'FANBERLIAN SA (CENTRO 1)', cuit: '30-70737682-8', taxCondition: 'RESPONSABLE_INSCRIPTO' },
      taxCondition: 'RESPONSABLE_INSCRIPTO',
      amount: '6968.49',
      sign: -1,
    },
  ];

  it('formatea comprobantes y moneda exactamente igual a Iduo', () => {
    expect(formatVoucherDisplay('FACTURA_A', '00005-00008396')).toEqual({
      comprobante: 'Factura',
      numero: 'A 00005-00008396',
    });
    expect(formatVoucherDisplay('NOTA_CREDITO_A', '00005-00000407')).toEqual({
      comprobante: 'Nota de Credito',
      numero: 'A 00005-00000407',
    });
    expect(formatIduoARS(22029727n)).toBe('$ 220.297,27');
    expect(formatIduoARS(-696849n)).toBe('$ -6.968,49');
  });

  it('suma percepciones IIBB + RG 5329, intercala retenciones en negativo y cierra TOTALES al centavo exacto', () => {
    const ledger = buildBookLedger({
      records: sampleVentas,
      retenciones: sampleRetenciones,
      formatDate: () => '01/10/2026',
    });

    expect(ledger.rows).toHaveLength(4);
    // Orden cronológico: Factura A (14h), Retencion (15h), Factura B (16h), NC A (07/10)
    expect(ledger.rows[0].comprobante).toBe('Factura');
    expect(ledger.rows[0].percepcionesCents).toBe(532977n);
    expect(ledger.rows[1].comprobante).toBe('Retencion Ganancias');
    expect(ledger.rows[1].retencionesCents).toBe(-696849n);
    expect(ledger.rows[1].totalCents).toBe(-696849n);
    expect(ledger.rows[3].comprobante).toBe('Nota de Credito');
    expect(ledger.rows[3].percepcionesCents).toBe(-300000n);

    // Ecuación contable estricta: Neto + Exento + IVA + Percepciones + Retenciones === Total
    const { netoCents, exentoCents, ivaCents, percepcionesCents, retencionesCents, totalCents } =
      ledger.totals;
    expect(netoCents + exentoCents + ivaCents + percepcionesCents + retencionesCents).toBe(totalCents);
    expect(percepcionesCents).toBe(232977n); // 5329.77 - 3000.00
    expect(retencionesCents).toBe(-696849n);
  });

  it('construye el cuadro Resumen por Condición IVA (Hoja 32 Iduo) con 3 líneas (pos / neg / neto)', () => {
    const summary = buildTaxConditionSummary(sampleVentas, sampleRetenciones);

    expect(summary.rows.map((r) => r.label)).toEqual([
      'Consumidor Final',
      'Exento',
      'Monotributo',
      'Responsable\nInscripto',
    ]);

    const ri = summary.rows[3];
    expect(formatTriLine(ri.percepIva)).toBe('5.329,77\n-3.000,00\n2.329,77');
    expect(ri.otrasRet.net).toBe(-696849n);
    expect(summary.totals.percepIva.net).toBe(232977n);
    expect(summary.totals.otrasRet.net).toBe(-696849n);
  });

  it('construye el cuadro Resumen por Concepto (Hoja 30 Iduo) separando Ventas 21%, RG 5329 y Retenciones', () => {
    const summary = buildConceptSummary(sampleVentas, sampleRetenciones);
    expect(summary.rows.map((r) => r.label)).toEqual([
      'VENTAS GRAVADAS 21%',
      'Percep. de IVA RG\n5329',
      'Retencion Ganancias',
    ]);
    expect(summary.totals.percepIva.net).toBe(232977n);
    expect(summary.totals.otrasRet.net).toBe(-696849n);
  });
});
