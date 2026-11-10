import { describe, it, expect } from 'vitest';
import {
  calculateCreditNoteTotals,
  calculatePurchaseOrderTotals,
  calculateSupplierInvoiceBreakdown,
  formatInternalCreditNoteNumber,
} from './credit-purchase.engine';

describe('Motor Matemático de Notas de Crédito, Órdenes de Compra y Facturas de Proveedor', () => {
  it('formatea numeración correlativa interna inmutable desde movementId', () => {
    expect(formatInternalCreditNoteNumber(1)).toBe('NCI-00001');
    expect(formatInternalCreditNoteNumber(482)).toBe('NCI-00482');
  });

  it('calcula renglones unitarios y pesables en Nota de Crédito Oficial garantizando ImpNeto + ImpIVA === ImpTotal', () => {
    const res = calculateCreditNoteTotals(
      [
        {
          productId: 10,
          quantity: 2,
          isPesable: true,
          weight: '3.845', // 3.845 kg * $4.500 = $17.302,50 -> redondeo entero origen $17.303
          unitPrice: 4500,
        },
        {
          productId: 11,
          quantity: 3,
          isPesable: false,
          unitPrice: 1200, // 3 * $1.200 = $3.600
        },
      ],
      true,
    );

    expect(res.lines[0].subtotal).toBe(17303);
    expect(res.lines[1].subtotal).toBe(3600);
    expect(res.totalAmount).toBe(20903);
    // Invariante AFIP exacta al centavo:
    expect(Number((res.netAmount + res.taxAmount).toFixed(2))).toBe(res.totalAmount);
  });

  it('preserva los 2 decimales exactos en costos unitarios y subtotales de Órdenes de Compra', () => {
    const po = calculatePurchaseOrderTotals([
      { productId: 1, quantity: 10, costPrice: '1450.55' },
      { productId: 2, quantity: 3, costPrice: '999.10' },
    ]);

    expect(po.parsedItems).toEqual([
      { productId: 1, quantity: 10, costPrice: 1450.55, subtotal: 14505.5 },
      { productId: 2, quantity: 3, costPrice: 999.1, subtotal: 2997.3 },
    ]);
    expect(po.totalAmount).toBe(17502.8);
  });

  it('consolida percepciones de IIBB (La Pampa + Bs As) e IVA (RG 3337 + RG 5329) sin deriva flotante', () => {
    const breakdown = calculateSupplierInvoiceBreakdown({
      netAmount: '100000.10',
      taxAmount: '21000.02',
      percepcionPampa: '1500.10',
      percepcionBsAs: '2500.20',
      percepcionIva: '3000.05',
      percepcionIva5329: '1500.05',
      impuestosInternos: '800.00',
      totalAmount: '130300.52',
    });

    expect(breakdown.finalIIBB).toBe(4000.3);
    expect(breakdown.totalPercIva).toBe(4500.1);
    expect(breakdown.totalAmount).toBe(130300.52);
  });
});
