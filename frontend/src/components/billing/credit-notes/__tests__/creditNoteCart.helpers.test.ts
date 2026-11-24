import { describe, it, expect } from 'vitest';
import {
  buildCartItemsFromEligibleOrder,
  computeCreditNoteCartTotal,
  formatInvoiceShortCode,
} from '../creditNoteCart.helpers';
import type { EligibleOrderForCreditNote } from '../../../../api/billing.api';

describe('creditNoteCart.helpers', () => {
  const sampleOrder: EligibleOrderForCreditNote = {
    id: 42,
    invoiceNumber: '0001-00001234',
    invoiceType: 'FACTURA_A',
    billingType: 'OFFICIAL',
    cae: '74123456789012',
    createdAt: '2026-11-20T12:00:00Z',
    invoicedAt: '2026-11-20T12:05:00Z',
    totalAmount: 25000,
    alreadyCreditedAmount: 6000,
    remainingCreditableAmount: 19000,
    items: [
      {
        productId: 1,
        name: 'Queso Cremoso',
        sku: 'QC-1',
        isPesable: false,
        approximateWeight: 1,
        orderQuantity: 5,
        alreadyReturnedQuantity: 2,
        remainingReturnableQuantity: 3,
        orderWeight: null,
        unitPrice: 3000,
        subtotal: 15000,
      },
      {
        productId: 2,
        name: 'Salame Milán',
        sku: 'SM-1',
        isPesable: false,
        approximateWeight: 1,
        orderQuantity: 2,
        alreadyReturnedQuantity: 2,
        remainingReturnableQuantity: 0,
        orderWeight: null,
        unitPrice: 5000,
        subtotal: 10000,
      },
    ],
  };

  it('precarga cantidades restantes y desmarca automáticamente ítems ya devueltos al 100%', () => {
    const items = buildCartItemsFromEligibleOrder(sampleOrder);
    expect(items).toHaveLength(2);
    expect(items[0]).toMatchObject({
      productId: 1,
      selected: true,
      quantity: 3,
      remainingReturnableQuantity: 3,
      subtotal: 9000,
    });
    expect(items[1]).toMatchObject({
      productId: 2,
      selected: false,
      quantity: 0,
      remainingReturnableQuantity: 0,
      subtotal: 0,
    });
  });

  it('suma solo los ítems seleccionados en computeCreditNoteCartTotal', () => {
    const items = buildCartItemsFromEligibleOrder(sampleOrder);
    expect(computeCreditNoteCartTotal(items)).toBe(9000);
    items[0].selected = false;
    expect(computeCreditNoteCartTotal(items)).toBe(0);
  });

  it('formatea códigos cortos de factura oficial e interna', () => {
    expect(formatInvoiceShortCode(sampleOrder)).toBe('FA 0001-00001234');
    expect(
      formatInvoiceShortCode({
        id: 77,
        invoiceNumber: null,
        invoiceType: 'PRESUPUESTO',
        billingType: 'INTERNAL',
      }),
    ).toBe('INT #77');
  });
});
