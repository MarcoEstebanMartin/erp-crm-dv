import {
  NumericInput,
  calculateAfipBreakdown,
  roundToIntegerPeso,
  roundToThreeDecimalsWeight,
  roundToTwoDecimals,
  toDecimal,
} from '../core/money';

export interface CreditNoteLineInput {
  productId: number;
  quantity: NumericInput;
  weight?: NumericInput | null;
  isPesable: boolean;
  approximateWeight?: NumericInput | null;
  unitPrice: NumericInput;
}

export interface CalculatedCreditNoteLine {
  productId: number;
  quantity: number;
  weight: number | null;
  unitPrice: number;
  subtotal: number;
}

export interface CalculatedCreditNoteTotals {
  lines: CalculatedCreditNoteLine[];
  totalAmount: number;
  netAmount: number;
  taxAmount: number;
}

/**
 * Formatea el número correlativo inmutable de Nota de Crédito Interna a partir de movement_seq.
 * Reemplaza el antipatrón frágil `count + 1` sujeto a colisiones y condiciones de carrera.
 */
export function formatInternalCreditNoteNumber(movementId: number): string {
  return `NCI-${String(movementId).padStart(5, '0')}`;
}

/**
 * Calcula renglones y totales de una Nota de Crédito usando Decimal.js:
 * - Subtotales en pesos enteros en origen (ROUND_HALF_UP).
 * - Si es OFFICIAL (AFIP), desglosa Neto + IVA 21% al centavo exacto (ImpNeto + ImpIVA === ImpTotal).
 */
export function calculateCreditNoteTotals(
  items: CreditNoteLineInput[],
  isOfficial: boolean,
): CalculatedCreditNoteTotals {
  let totalDec = toDecimal(0);
  const lines: CalculatedCreditNoteLine[] = [];

  for (const item of items) {
    const qtyDec = toDecimal(item.quantity);
    const approxDec = toDecimal(item.approximateWeight ?? 1);
    const billableQtyDec = item.isPesable
      ? roundToThreeDecimalsWeight(
          item.weight !== undefined && item.weight !== null && Number(item.weight) > 0
            ? item.weight
            : qtyDec.times(approxDec),
        )
      : qtyDec;

    const unitPriceDec = roundToTwoDecimals(item.unitPrice);
    const subtotalDec = roundToIntegerPeso(billableQtyDec.times(unitPriceDec));
    totalDec = totalDec.plus(subtotalDec);

    lines.push({
      productId: Number(item.productId),
      quantity: Number(item.quantity),
      weight: item.isPesable ? billableQtyDec.toNumber() : null,
      unitPrice: unitPriceDec.toNumber(),
      subtotal: subtotalDec.toNumber(),
    });
  }

  if (isOfficial) {
    const afip = calculateAfipBreakdown(totalDec, 21, 0);
    return {
      lines,
      totalAmount: afip.totalAmount.toNumber(),
      netAmount: afip.netAmount.toNumber(),
      taxAmount: afip.ivaAmount.toNumber(),
    };
  }

  const netIntDec = roundToIntegerPeso(totalDec.dividedBy(1.21));
  const taxIntDec = totalDec.minus(netIntDec);

  return {
    lines,
    totalAmount: totalDec.toNumber(),
    netAmount: netIntDec.toNumber(),
    taxAmount: taxIntDec.toNumber(),
  };
}

/**
 * Calcula los renglones y total de una Orden de Compra preservando los 2 decimales del costo de proveedor.
 */
export function calculatePurchaseOrderTotals(
  items: Array<{ productId: number; quantity: NumericInput; costPrice: NumericInput }>,
): {
  parsedItems: Array<{
    productId: number;
    quantity: number;
    costPrice: number;
    subtotal: number;
  }>;
  totalAmount: number;
} {
  let totalDec = toDecimal(0);

  const parsedItems = items.map((item) => {
    const qtyDec = toDecimal(item.quantity);
    const costDec = roundToTwoDecimals(item.costPrice);
    const subDec = roundToTwoDecimals(qtyDec.times(costDec));
    totalDec = totalDec.plus(subDec);

    return {
      productId: Number(item.productId),
      quantity: qtyDec.toNumber(),
      costPrice: costDec.toNumber(),
      subtotal: subDec.toNumber(),
    };
  });

  return {
    parsedItems,
    totalAmount: roundToTwoDecimals(totalDec).toNumber(),
  };
}

/**
 * Calcula los importes impositivos exactos (Neto, IVA, IIBB La Pampa/BsAs, Perc. IVA RG 3337/5329 e Imp. Internos)
 * de una Factura de Proveedor con Decimal.js (2 decimales).
 */
export function calculateSupplierInvoiceBreakdown(input: {
  netAmount?: NumericInput;
  taxAmount?: NumericInput;
  percepcionAmount?: NumericInput;
  percepcionPampa?: NumericInput;
  percepcionBsAs?: NumericInput;
  percepcionIva?: NumericInput;
  percepcionIvaAmount?: NumericInput;
  percepcionIva5329?: NumericInput;
  impuestosInternos?: NumericInput;
  totalAmount?: NumericInput;
}) {
  const pampaDec = roundToTwoDecimals(input.percepcionPampa || 0);
  const bsasDec = roundToTwoDecimals(input.percepcionBsAs || 0);
  const iva3337Dec = roundToTwoDecimals(input.percepcionIva ?? input.percepcionIvaAmount ?? 0);
  const iva5329Dec = roundToTwoDecimals(input.percepcionIva5329 || 0);
  const totalPercIvaDec = roundToTwoDecimals(iva3337Dec.plus(iva5329Dec));
  const internosDec = roundToTwoDecimals(input.impuestosInternos || 0);

  const genericIibbDec = roundToTwoDecimals(input.percepcionAmount || 0);
  const finalIibbDec =
    pampaDec.gt(0) || bsasDec.gt(0)
      ? roundToTwoDecimals(pampaDec.plus(bsasDec))
      : genericIibbDec;

  return {
    netAmount: roundToTwoDecimals(input.netAmount || 0).toNumber(),
    taxAmount: roundToTwoDecimals(input.taxAmount || 0).toNumber(),
    pampa: pampaDec.toNumber(),
    bsas: bsasDec.toNumber(),
    iva3337: iva3337Dec.toNumber(),
    iva5329: iva5329Dec.toNumber(),
    totalPercIva: totalPercIvaDec.toNumber(),
    impuestosInternos: internosDec.toNumber(),
    finalIIBB: finalIibbDec.toNumber(),
    totalAmount: roundToTwoDecimals(input.totalAmount || 0).toNumber(),
  };
}
