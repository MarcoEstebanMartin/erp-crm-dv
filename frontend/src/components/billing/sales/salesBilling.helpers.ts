import type { DirectBillingTotals, DirectCartItem, DirectInvoiceFormState } from './sales.types';

export function isOfficialInvoice(inv: any): boolean {
  return (
    inv.billingType === 'OFFICIAL' ||
    inv.invoiceType === 'FACTURA_A' ||
    inv.invoiceType === 'FACTURA_B' ||
    inv.invoiceType === 'FACTURA_C'
  );
}

export function getClientPriceListLabel(priceList?: string | null): string {
  if (!priceList || priceList === 'A' || priceList === '4' || priceList === 'SUCURSAL A') {
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

export function computeClientUnitPrice(prod: any, selectedDirectClient: any): number {
  let selectedPrice = Number(prod.listPrice);
  let itemDiscount = Number(selectedDirectClient?.discount || 0);

  if (selectedDirectClient) {
    if (selectedDirectClient.priceList === 'B') {
      selectedPrice = Number(prod.listPriceB) > 0 ? Number(prod.listPriceB) : Number(prod.listPrice);
      const isMelincue =
        prod.description?.toUpperCase() === 'MELINCUE' ||
        prod.name?.toUpperCase().includes('MELINCUE');
      itemDiscount = isMelincue ? 3 : 0;
    } else if (selectedDirectClient.priceList === 'C') {
      selectedPrice = Number(prod.listPriceC) > 0 ? Number(prod.listPriceC) : Number(prod.listPrice);
    }
  }

  return selectedPrice * (1 - itemDiscount / 100);
}

export function calculateDirectBillingTotals(
  directCart: DirectCartItem[],
  billingType: string,
  selectedDirectClient: any,
  ivaPerceptionAliquot: number
): DirectBillingTotals {
  const subtotalSum = directCart.reduce((sum, item) => sum + item.subtotal, 0);
  let net = subtotalSum;
  let tax = 0;
  let percepIIBB = 0;
  let percepIVA = 0;
  const total = subtotalSum;

  const hasValidCuit11 =
    selectedDirectClient &&
    selectedDirectClient.cuit &&
    selectedDirectClient.cuit.replace(/-/g, '').length === 11;

  if (billingType === 'OFFICIAL') {
    if (hasValidCuit11) {
      const iibbAliquot = Number(selectedDirectClient.iibbAliquot || 0);
      const currentIvaPerc = subtotalSum > 100000 ? ivaPerceptionAliquot : 0;
      net = subtotalSum / (1.21 + iibbAliquot / 100 + currentIvaPerc / 100);
      tax = net * 0.21;
      percepIIBB = net * (iibbAliquot / 100);
      percepIVA = net * (currentIvaPerc / 100);
    } else {
      net = subtotalSum / 1.21;
      tax = subtotalSum - net;
    }
  }

  const isFacturaA = billingType === 'OFFICIAL' && Boolean(hasValidCuit11);

  return {
    net: isFacturaA ? Number(net.toFixed(2)) : Math.round(net),
    tax: isFacturaA ? Number(tax.toFixed(2)) : Math.round(tax),
    percepcion: isFacturaA ? Number(percepIIBB.toFixed(2)) : Math.round(percepIIBB),
    percepcionIva: isFacturaA ? Number(percepIVA.toFixed(2)) : Math.round(percepIVA),
    total: Math.round(total)
  };
}

export function updateCartRowQty(cart: DirectCartItem[], index: number, rawVal: string): DirectCartItem[] {
  const item = cart[index];
  const next = [...cart];
  if (rawVal === '') {
    next[index] = { ...item, quantity: '', subtotal: 0 };
    return next;
  }
  const val = Math.max(0, Number(rawVal));
  const weight = item.product.isPesable ? val * (item.product.approximateWeight || 1) : null;
  next[index] = {
    ...item,
    quantity: val,
    weight,
    subtotal: Number((item.unitPrice * (item.product.isPesable ? (weight || 0) : val)).toFixed(2))
  };
  return next;
}

export function buildDirectInvoiceRequest(
  form: DirectInvoiceFormState,
  directCart: DirectCartItem[],
  activeDrawers: any[],
  bankAccounts: any[]
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
          : 'No se puede cobrar en efectivo. Por favor, seleccione una caja operativa.'
    };
  }

  const payload: any = {
    personaId: Number(personaId),
    billingType,
    paymentMethod: immediatePayment ? paymentMethod : undefined,
    cashDrawerId: immediatePayment && paymentMethod === 'CASH' ? Number(effectiveCashDrawerId) : undefined,
    bankAccountId: immediatePayment && paymentMethod === 'BANK_TRANSFER' ? Number(effectiveBankAccountId) : undefined,
    items: directCart.map((item) => ({
      productId: item.product.id,
      quantity: Number(item.quantity),
      weight: item.weight || null,
      isEmergencyOverride: Boolean(
        item.isEmergencyOverride || Number(item.quantity) < (item.product.minOrderQuantity || 1)
      )
    }))
  };

  if (immediatePayment && paymentMethod === 'CHECK') {
    payload.checkNumber = form.checkNumber;
    payload.checkIssuer = form.isEcheq ? `${form.checkIssuer} (Echeq)` : form.checkIssuer;
  }

  return { payload };
}
