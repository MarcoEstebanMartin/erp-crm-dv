import { describe, expect, it } from 'vitest';
import {
  isLikelyNonStockDescription,
  normalizeExtractedInvoiceItems,
} from './purchase-invoice-extraction.engine';
import { extractedInvoiceValidator } from '../validators/ai-schemas.validator';

describe('purchase-invoice-extraction.engine (casos reales de proveedores)', () => {
  it('Factura La Virginia: convierte bultos a unidades cuando el precio unitario está por unidad (4 × 6 = 24)', () => {
    const items = normalizeExtractedInvoiceItems({
      netAmount: 1096566.03,
      items: [
        {
          code: '10078',
          ean: '7790150100783',
          description: 'INST LV CLASICO ESPUMA INSTANTANEA FRAS 6/100G',
          quantity: 4,
          unitOfMeasure: null,
          unitsPerPack: 6,
          unitPrice: 3344.79,
          subtotal: 80274.86,
        },
        {
          code: '10176',
          ean: '7790150101773',
          description: 'INST LV SUAVE ESPUMA INSTANTANEA FRASCO 6/100G',
          quantity: 6,
          unitOfMeasure: null,
          unitsPerPack: 6,
          unitPrice: 3344.79,
          subtotal: 120412.28,
        },
        {
          code: '62106',
          ean: '7792390620700',
          description: 'GIACOMO CARNE NR 12/500G',
          quantity: 5,
          unitOfMeasure: null,
          unitsPerPack: 12,
          unitPrice: 2986.26,
          subtotal: 179175.78,
        },
        {
          code: '62110',
          ean: '7792390620786',
          description: 'GIACOMO QUESO Y JAMON NR 12/500G',
          quantity: 5,
          unitOfMeasure: null,
          unitsPerPack: 12,
          unitPrice: 2986.26,
          subtotal: 179175.78,
        },
        {
          code: '62114',
          ean: '7792390620823',
          description: 'GIACOMO TRIDICCI NR 12/500G',
          quantity: 5,
          unitOfMeasure: null,
          unitsPerPack: 12,
          unitPrice: 2986.26,
          subtotal: 179175.78,
        },
        {
          code: '62116',
          ean: '7792390620748',
          description: 'GIACOMO VERDURA NR 12/500G',
          quantity: 10,
          unitOfMeasure: null,
          unitsPerPack: 12,
          unitPrice: 2986.26,
          subtotal: 358351.55,
        },
      ],
    });

    expect(items[0].billedQuantity).toBe(4);
    expect(items[0].unitsPerPack).toBe(6);
    expect(items[0].quantity).toBe(24);
    expect(items[0].unitPrice).toBe(3344.79);
    expect(items[0].ean).toBe('7790150100783');
    expect(items[0].globalDiscountApplied).toBe(false);

    expect(items[5].quantity).toBe(120);
    expect(items[5].unitPrice).toBe(2986.26);
  });

  it('Factura Fratelli Branca: convierte cajas a botellas y prorratea descuentos globales (8% canal + 2.5% financ.)', () => {
    const items = normalizeExtractedInvoiceItems({
      netAmount: 20534621.45,
      items: [
        {
          code: '202010',
          description: 'PUNT E MES 6/75 CL. 16°',
          quantity: 1,
          unitOfMeasure: 'CAJ',
          unitsPerPack: 6,
          unitPrice: 38388.11,
          subtotal: 38388.11,
        },
        {
          code: '120115',
          description: 'BRANCAMENTA RI 6/75 CL. 28°',
          quantity: 1,
          unitOfMeasure: 'CAJ',
          unitsPerPack: 6,
          unitPrice: 60671.85,
          subtotal: 60671.85,
        },
        {
          code: '110115',
          description: 'FERNET BRANCA 12/75 CL. 39°',
          quantity: 100,
          unitOfMeasure: 'CAJ',
          unitsPerPack: 12,
          unitPrice: 113453.36,
          subtotal: 11345335.83,
        },
        {
          code: '110111',
          description: 'FERNET BRANCA 12/45 CL. 39°',
          quantity: 100,
          unitOfMeasure: 'CAJ',
          unitsPerPack: 12,
          unitPrice: 75241.08,
          subtotal: 7524107.69,
        },
        {
          code: '110114',
          description: 'FERNET BRANCA 6/100 CL. 39°',
          quantity: 40,
          unitOfMeasure: 'CAJ',
          unitsPerPack: 6,
          unitPrice: 75787.71,
          subtotal: 3031508.23,
        },
        {
          code: '565213',
          description: 'SERNOVA WILD BERRIES 6/70 CL. 29°',
          quantity: 28,
          unitOfMeasure: 'CAJ',
          unitsPerPack: 6,
          unitPrice: 31876.53,
          subtotal: 892542.87,
        },
      ],
    });

    // 100 cajas de 12 botellas = 1200 botellas con 10.30% de descuento global prorrateado
    expect(items[2].billedQuantity).toBe(100);
    expect(items[2].unitsPerPack).toBe(12);
    expect(items[2].quantity).toBe(1200);
    expect(items[2].globalDiscountApplied).toBe(true);
    // 11345335.83 * 0.897 = 10176766.24 -> / 1200 = 8480.64 por botella neta
    expect(items[2].subtotal).toBeCloseTo(10176766.24, 1);
    expect(items[2].unitPrice).toBeCloseTo(8480.64, 1);
  });

  it('Factura SanCor: preserva pesables en KG sin multiplicar packs y auto-marca FLETE como Sin Stock', () => {
    const items = normalizeExtractedInvoiceItems({
      netAmount: 1272662.38,
      items: [
        {
          code: '7790080013221',
          ean: '7790080013221',
          description: '1322 - QUESO SARDO ESP HOR SANCOR',
          quantity: 14.05,
          unitOfMeasure: 'KG',
          unitsPerPack: 1,
          unitPrice: 15625.93,
          subtotal: 219559.94,
        },
        {
          code: '7790080014693',
          ean: '7790080014693',
          description: '1469 - REGTO TRAD+C RALL.100G SANCOR',
          quantity: 300,
          unitOfMeasure: 'CU',
          unitsPerPack: 1,
          unitPrice: 2294.26,
          subtotal: 688278,
        },
        {
          code: '7790001001146',
          ean: '7790001001146',
          description: '9844 - FLETE TERRESTRE NACIONAL',
          quantity: 1,
          unitOfMeasure: 'UN',
          unitsPerPack: 1,
          unitPrice: 37067.84,
          subtotal: 37067.84,
        },
      ],
    });

    expect(items[0].quantity).toBe(14.05);
    expect(items[0].unitPrice).toBe(15625.93);
    expect(items[0].isNonStock).toBe(false);

    expect(items[2].isNonStock).toBe(true);
    expect(isLikelyNonStockDescription('FLETE TERRESTRE NACIONAL')).toBe(true);
    expect(isLikelyNonStockDescription('MAYONESA NATURA 12X500')).toBe(false);
  });

  it('Factura Niza: convierte 100 CA × 12 en 1200 unidades y calcula costo neto unitario exacto', () => {
    const items = normalizeExtractedInvoiceItems({
      netAmount: 3063531.12,
      items: [
        {
          code: '6030010019',
          ean: '7791866001364',
          description: 'MAYONESA NATURA 12X500 CC-DP-CT',
          quantity: 100,
          unitOfMeasure: 'CA',
          unitsPerPack: 12,
          unitPrice: 30635.31,
          subtotal: 3063531.12,
        },
      ],
    });

    expect(items[0].billedQuantity).toBe(100);
    expect(items[0].unitsPerPack).toBe(12);
    expect(items[0].quantity).toBe(1200);
    expect(items[0].unitPrice).toBe(2552.94);
    expect(items[0].subtotal).toBe(3063531.12);
    expect(items[0].ean).toBe('7791866001364');
  });

  it('extractedInvoiceValidator valida impuestosInternos, dueDate, ean, unitsPerPack e isNonStock', () => {
    const parsed = extractedInvoiceValidator.parse({
      supplierName: 'FRATELLI BRANCA DESTILERIAS S.A.',
      cuit: '30-50415535-4',
      receiverCuit: '20-16316505-9',
      receiverName: 'MARTIN PABLO DAVID',
      documentType: 'FACTURA_A',
      documentNumber: '0026-00370621',
      issueDate: '2026-10-28',
      dueDate: '2026-10-28',
      items: [
        {
          code: '110115',
          ean: null,
          description: 'FERNET BRANCA 12/75 CL. 39°',
          quantity: 100,
          unitOfMeasure: 'caj',
          unitsPerPack: 12,
          unitPrice: 113453.36,
          subtotal: 11345335.83,
          isNonStock: false,
        },
      ],
      netAmount: 20534621.45,
      taxAmount: 4312270.5,
      impuestosInternos: 7116083.16,
      percepcionAmount: 1642769.72,
      percepcionIIBBAmount: 1026731.07,
      percepcionIvaAmount: 616038.65,
      percepcionIva5329Amount: 0,
      percepcionJurisdiction: 'Buenos Aires',
      totalAmount: 33605744.83,
    });

    expect(parsed.impuestosInternos).toBe(7116083.16);
    expect(parsed.dueDate).toBe('2026-10-28');
    expect(parsed.items[0].unitOfMeasure).toBe('CAJ');
    expect(parsed.items[0].unitsPerPack).toBe(12);
    expect(parsed.items[0].isNonStock).toBe(false);
  });
});
