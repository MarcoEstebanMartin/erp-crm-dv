import type { DirectBillingTotals, DirectCartItem, DirectInvoiceFormState } from './sales.types';
import { SCALE, divRoundHalfUp, parseScaledBigInt } from '../../../utils/exactStockMath';
import { roundHalfUpInteger } from '../../../utils/currency';
import { calculateExactLineSubtotalInt } from '../../../utils/weeklyPromoCartEvaluator';

const SCALE_SQUARED = SCALE * SCALE;

export function isOfficialInvoice(inv: any): boolean {
  return (
    inv.billingType === 'OFFICIAL' ||
    inv.invoiceType === 'FACTURA_A' ||
    inv.invoiceType === 'FACTURA_B' ||
    inv.invoiceType === 'FACTURA_C'
  );
}

export function getClientPriceListLabel(priceList?: unknown): string {
  if (typeof priceList !== 'string' || !priceList || priceList === 'A' || priceList === '4' || priceList === 'SUCURSAL A') {
    return 'Lista 4';
  }
  if (priceList === 'B' || priceList === 'Especial') {
    return 'Lista Especial';
  }
  if (priceList === 'C' || priceList === 'Especial 2') {
    return 'Lista Especial 2';
  }
  return priceList;
}

export async function fetchPricingDiscountRules(): Promise<any[]> {
  try {
    const res = await fetch('/api/pricing/rules', { credentials: 'include' });
    if (!res.ok) return [];
    const json = await res.json();
    return Array.isArray(json?.data?.discountRules) ? json.data.discountRules : [];
  } catch {
    return [];
  }
}

function resolveDiscountPctFromRules(
  prod: any,
  client: any,
  discountRules: any[],
  billingType?: string,
): number {
  let discountPct = Number(client?.discount || 0);
  if (!client || !Array.isArray(discountRules) || discountRules.length === 0) {
    return discountPct;
  }

  let maxSpecificity = -1;
  for (const rule of discountRules) {
    if (rule.billingType && (!billingType || rule.billingType !== billingType)) continue;

    let specificity = 0;
    if (rule.productId) {
      if (Number(rule.productId) !== Number(prod.id)) continue;
      specificity += 100;
    }
    if (rule.rubroId) {
      if (Number(rule.rubroId) !== Number(prod.rubroId)) continue;
      specificity += 50;
    }
    if (rule.personaId) {
      if (Number(rule.personaId) !== Number(client.id)) continue;
      specificity += 10;
    } else if (rule.priceList) {
      if (rule.priceList !== client.priceList) continue;
      specificity += 5;
    }
    if (rule.billingType) {
      specificity += 2;
    }

    if (specificity > maxSpecificity) {
      maxSpecificity = specificity;
      discountPct = Number(rule.discount || 0);
    }
  }

  return discountPct;
}

/**
 * Calcula precio unitario por cliente con BigInt (ROUND_HALF_UP en Pesos Enteros en Origen),
 * replicando la especificidad de `PricingService.calculatePriceAndDiscountInMemory` + reglas DB.
 */
export function computeClientUnitPrice(
  prod: any,
  selectedDirectClient: any,
  discountRules: any[] = [],
  billingType?: string,
): number {
  let selectedPrice = Number(prod?.listPrice || 0);
  if (selectedDirectClient) {
    if (selectedDirectClient.priceList === 'B' && Number(prod?.listPriceB) > 0) {
      selectedPrice = Number(prod.listPriceB);
    } else if (selectedDirectClient.priceList === 'C' && Number(prod?.listPriceC) > 0) {
      selectedPrice = Number(prod.listPriceC);
    }
  }

  const itemDiscountPct = resolveDiscountPctFromRules(
    prod,
    selectedDirectClient,
    discountRules,
    billingType,
  );

  const baseScaled = parseScaledBigInt(selectedPrice);
  const clampedPctScaled = parseScaledBigInt(Math.max(0, Math.min(100, itemDiscountPct)));
  const cents = divRoundHalfUp(baseScaled * (100n * SCALE - clampedPctScaled), SCALE_SQUARED);
  return Number(divRoundHalfUp(cents, 100n));
}

function normalizePesableSuggestedWeightKg(product: any, qty: number): number | null {
  if (!product?.isPesable) return null;
  const approxScaled = parseScaledBigInt(product.approximateWeight);
  const safeApprox = approxScaled > 0n ? approxScaled : SCALE;
  const grams = divRoundHalfUp(BigInt(Math.max(0, Math.trunc(qty))) * safeApprox, 1_000n);
  return Number(grams) / 1000;
}

/**
 * Desglose fiscal exacto en BigInt (centavos) alineado al centavo con
 * `computeInvoiceTaxBreakdown` del backend y `integer-peso-harmony.test.ts`.
 */
export function calculateDirectBillingTotals(
  directCart: DirectCartItem[],
  billingType: string,
  selectedDirectClient: any,
  ivaPerceptionAliquot: number,
  overrideSubtotalSum?: number,
): DirectBillingTotals {
  const rawSum =
    overrideSubtotalSum !== undefined
      ? overrideSubtotalSum
      : directCart.reduce((sum, item) => sum + roundHalfUpInteger(item.subtotal), 0);

  const subtotalInt = Math.max(0, roundHalfUpInteger(rawSum));
  const totalBaseCents = BigInt(subtotalInt) * 100n;

  if (billingType !== 'OFFICIAL') {
    return {
      net: subtotalInt,
      tax: 0,
      percepcion: 0,
      percepcionIva: 0,
      total: subtotalInt,
    };
  }

  const cleanCuit = selectedDirectClient?.cuit
    ? String(selectedDirectClient.cuit).replace(/-/g, '')
    : '';
  const isFacturaA = cleanCuit.length === 11;
  const netCents = divRoundHalfUp(totalBaseCents * 100n, 121n);
  const taxCents = totalBaseCents - netCents;

  if (!isFacturaA) {
    return {
      net: Number(divRoundHalfUp(netCents, 100n)),
      tax: Number(divRoundHalfUp(taxCents, 100n)),
      percepcion: 0,
      percepcionIva: 0,
      total: subtotalInt,
    };
  }

  const iibbAliquotScaled = parseScaledBigInt(selectedDirectClient?.iibbAliquot ?? 0);
  const percepIIBBCents = divRoundHalfUp(netCents * iibbAliquotScaled, 100n * SCALE);

  const applyIvaPerc = totalBaseCents > 10_000_000n;
  const ivaAliquotScaled = applyIvaPerc ? parseScaledBigInt(ivaPerceptionAliquot ?? 3) : 0n;
  const percepIVACents = divRoundHalfUp(netCents * ivaAliquotScaled, 100n * SCALE);

  const finalTotalCents = netCents + taxCents + percepIIBBCents + percepIVACents;

  return {
    net: Number(netCents) / 100,
    tax: Number(taxCents) / 100,
    percepcion: Number(percepIIBBCents) / 100,
    percepcionIva: Number(percepIVACents) / 100,
    total: Number(finalTotalCents) / 100,
  };
}

export function updateCartRowQty(
  cart: DirectCartItem[],
  index: number,
  rawVal: string,
): DirectCartItem[] {
  const item = cart[index];
  const next = [...cart];
  if (rawVal === '') {
    next[index] = { ...item, quantity: '', subtotal: 0 };
    return next;
  }

  const val = Math.max(0, Math.trunc(Number(rawVal) || 0));
  const weight = normalizePesableSuggestedWeightKg(item.product, val);
  const subtotal = calculateExactLineSubtotalInt({
    unitPriceInt: item.unitPrice,
    quantity: val,
    isPesable: Boolean(item.product.isPesable),
    weight,
    approximateWeight: item.product.approximateWeight,
  });

  next[index] = { ...item, quantity: val, weight, subtotal };
  return next;
}

export function updateCartRowWeight(
  cart: DirectCartItem[],
  index: number,
  rawWeightVal: string,
): DirectCartItem[] {
  const item = cart[index];
  if (!item) return cart;
  const parsed = parseFloat(rawWeightVal);
  const nextWeight = Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
  const weightGrams = divRoundHalfUp(parseScaledBigInt(nextWeight), 1_000n);
  const cleanWeight = Number(weightGrams) / 1000;

  const subtotal = calculateExactLineSubtotalInt({
    unitPriceInt: item.unitPrice,
    quantity: Math.max(1, Number(item.quantity || 1)),
    isPesable: true,
    weight: cleanWeight,
    approximateWeight: item.product.approximateWeight,
  });

  const next = [...cart];
  next[index] = { ...item, weight: cleanWeight, subtotal };
  return next;
}

export function buildDirectInvoiceRequest(
  form: DirectInvoiceFormState,
  directCart: DirectCartItem[],
  activeDrawers: any[],
  bankAccounts: any[],
): { error?: string; payload?: any } {
  const { personaId, billingType, immediatePayment, paymentMethod, cashDrawerId, bankAccountId } = form;
  if (!personaId || !billingType || directCart.length === 0) {
    return { error: 'Por favor selecciona un cliente y añade al menos un producto.' };
  }

  const effectiveCashDrawerId =
    immediatePayment && paymentMethod === 'CASH' && !cashDrawerId && activeDrawers.length > 0
      ? activeDrawers[0].id.toString()
      : cashDrawerId;

  const effectiveBankAccountId =
    immediatePayment && paymentMethod === 'BANK_TRANSFER' && !bankAccountId && bankAccounts.length > 0
      ? bankAccounts[0].id.toString()
      : bankAccountId;

  if (immediatePayment && paymentMethod === 'CASH' && (!effectiveCashDrawerId || activeDrawers.length === 0)) {
    return {
      error:
        activeDrawers.length === 0
          ? 'No se puede cobrar en efectivo. Verifique que posee una caja operativa abierta.'
          : 'No se puede cobrar en efectivo. Por favor, seleccione una caja operativa.',
    };
  }

  const deliveryMethod = form.deliveryMethod === 'DELIVERY' ? 'DELIVERY' : 'PICKUP';
  const payload: any = {
    personaId: Number(personaId),
    billingType,
    deliveryMethod,
    markDelivered: deliveryMethod === 'PICKUP',
    paymentMethod: immediatePayment ? paymentMethod : undefined,
    cashDrawerId: immediatePayment && paymentMethod === 'CASH' ? Number(effectiveCashDrawerId) : undefined,
    bankAccountId: immediatePayment && paymentMethod === 'BANK_TRANSFER' ? Number(effectiveBankAccountId) : undefined,
    items: directCart.map((item) => ({
      productId: item.product.id,
      quantity: Number(item.quantity),
      weight: item.weight || null,
      isEmergencyOverride: Boolean(
        item.isEmergencyOverride || Number(item.quantity) < (item.product.minOrderQuantity || 1),
      ),
    })),
  };

  if (immediatePayment && paymentMethod === 'CHECK') {
    payload.checkNumber = form.checkNumber;
    payload.checkIssuer = form.isEcheq ? `${form.checkIssuer} (Echeq)` : form.checkIssuer;
  }

  return { payload };
}
