import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '../../../utils/api';
import {
  type DirectCartItem,
  type DirectInvoiceFormState,
  INITIAL_DIRECT_INVOICE_FORM
} from './sales.types';
import {
  buildDirectInvoiceRequest,
  calculateDirectBillingTotals,
  computeClientUnitPrice,
  fetchPricingDiscountRules
} from './salesBilling.helpers';
import {
  calculateExactLineSubtotalInt,
  evaluateFrontendCartPromos
} from '../../../utils/weeklyPromoCartEvaluator';
import { divRoundHalfUp, parseScaledBigInt, SCALE } from '../../../utils/exactStockMath';
import type { WeeklyPromo } from '../../admin/config/weeklyPromo.helpers';

interface UseDirectInvoiceParams {
  personas: any[];
  products: any[];
  bankAccounts: any[];
  activeDrawers: any[];
  ivaPerceptionAliquotOverride?: number;
  loadData: () => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
  onInvoiceCreated?: (invoice: any) => void;
  onModalClosed?: () => void;
}

export function useDirectInvoice({
  personas,
  products,
  bankAccounts,
  activeDrawers,
  ivaPerceptionAliquotOverride,
  loadData,
  setErrorMsg,
  setSuccessMsg,
  onInvoiceCreated,
  onModalClosed
}: UseDirectInvoiceParams) {
  const [showDirectInvoiceModal, setShowDirectInvoiceModal] = useState(false);
  const [directInvoiceForm, setDirectInvoiceForm] = useState<DirectInvoiceFormState>(INITIAL_DIRECT_INVOICE_FORM);
  const [directCart, setDirectCart] = useState<DirectCartItem[]>([]);
  const [weeklyPromos, setWeeklyPromos] = useState<WeeklyPromo[]>([]);
  const [discountRules, setDiscountRules] = useState<any[]>([]);
  const [selectedDirectProduct, setSelectedDirectProduct] = useState('');
  const [directProductQty, setDirectProductQty] = useState('1');
  const ivaPerceptionAliquot = ivaPerceptionAliquotOverride ?? 3.0;
  const [modalError, setModalError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  const [clientSearchQuery, setClientSearchQuery] = useState('');
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [activeClientSuggestionIdx, setActiveClientSuggestionIdx] = useState<number>(0);
  const clientSearchInputRef = useRef<HTMLInputElement>(null);

  const [productSearchQuery, setProductSearchQuery] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [activeProductSuggestionIdx, setActiveProductSuggestionIdx] = useState<number>(0);
  const productSearchInputRef = useRef<HTMLInputElement>(null);
  const productQtyInputRef = useRef<HTMLInputElement>(null);

  const clientsOnly = useMemo(() => personas.filter((p) => p.isClient), [personas]);

  const filteredClients = useMemo(() => {
    if (!clientSearchQuery) return clientsOnly.slice(0, 10);
    const q = clientSearchQuery.toUpperCase();
    return clientsOnly
      .filter((c: any) => c.name.toUpperCase().includes(q) || (c.cuit && c.cuit.includes(q)))
      .slice(0, 10);
  }, [clientSearchQuery, clientsOnly]);

  const filteredProducts = useMemo(() => {
    if (!productSearchQuery) return products.slice(0, 10);
    const q = productSearchQuery.toUpperCase();
    return products
      .filter(
        (p: any) =>
          p.name.toUpperCase().includes(q) ||
          (p.sku && p.sku.toUpperCase().includes(q)) ||
          (p.barcode && p.barcode.includes(q))
      )
      .slice(0, 10);
  }, [productSearchQuery, products]);

  const selectedDirectClient = useMemo(() => {
    if (!directInvoiceForm.personaId) return null;
    return personas.find((p: any) => p.id === Number(directInvoiceForm.personaId));
  }, [directInvoiceForm.personaId, personas]);

  useEffect(() => {
    const preselected = localStorage.getItem('preselected_billing_client');
    if (!preselected) return;

    if (preselected === 'direct') {
      localStorage.removeItem('preselected_billing_client');
      setShowDirectInvoiceModal(true);
      return;
    }

    setShowDirectInvoiceModal(true);
    if (clientsOnly.length > 0) {
      const targetClient = clientsOnly.find((c: any) => String(c.id) === preselected);
      localStorage.removeItem('preselected_billing_client');
      if (targetClient) {
        setDirectInvoiceForm((prev) => ({ ...prev, personaId: String(targetClient.id) }));
        setClientSearchQuery(targetClient.name);
        setShowClientDropdown(false);
        setDirectCart([]);
        setTimeout(() => productSearchInputRef.current?.focus(), 60);
      }
    }
  }, [clientsOnly]);

  useEffect(() => {
    if (!showDirectInvoiceModal) return;
    let cancelled = false;
    api
      .getActiveWeeklyPromos()
      .then((res) => {
        if (!cancelled) setWeeklyPromos(Array.isArray(res) ? res : []);
      })
      .catch(() => {});

    fetchPricingDiscountRules()
      .then((rules) => {
        if (!cancelled) setDiscountRules(rules);
      })
      .catch(() => {});

    if (bankAccounts.length > 0) {
      setDirectInvoiceForm((prev) => ({
        ...prev,
        bankAccountId: prev.bankAccountId || bankAccounts[0].id.toString()
      }));
    }
    if (activeDrawers.length > 0) {
      setDirectInvoiceForm((prev) => ({
        ...prev,
        cashDrawerId: prev.cashDrawerId || activeDrawers[0].id.toString()
      }));
    }
    if (!directInvoiceForm.personaId) {
      setTimeout(() => clientSearchInputRef.current?.focus(), 60);
    }
    return () => {
      cancelled = true;
    };
  }, [showDirectInvoiceModal, bankAccounts, activeDrawers, directInvoiceForm.personaId]);

  const promoEval = useMemo(
    () =>
      evaluateFrontendCartPromos({
        items: directCart.map((item) => ({
          productId: item.product.id,
          productName: item.product.name,
          quantity: Number(item.quantity || 0),
          weight: item.weight,
          isPesable: Boolean(item.product.isPesable),
          approximateWeight: item.product.approximateWeight,
          baseUnitPrice: item.unitPrice
        })),
        promos: weeklyPromos
      }),
    [directCart, weeklyPromos]
  );

  useEffect(() => {
    setDirectCart((prev) => {
      if (prev.length === 0) return prev;
      let changed = false;
      const next = prev.map((item) => {
        const nextPrice = computeClientUnitPrice(
          item.product,
          selectedDirectClient,
          discountRules,
          directInvoiceForm.billingType
        );
        const qty = Number(item.quantity || 0);
        const nextSubtotal = calculateExactLineSubtotalInt({
          unitPriceInt: nextPrice,
          quantity: qty,
          isPesable: Boolean(item.product.isPesable),
          weight: item.weight,
          approximateWeight: item.product.approximateWeight
        });
        if (nextPrice !== item.unitPrice || nextSubtotal !== item.subtotal) {
          changed = true;
          return { ...item, unitPrice: nextPrice, subtotal: nextSubtotal };
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [selectedDirectClient, discountRules, directInvoiceForm.billingType]);

  const effectiveDirectSubtotalSum = useMemo(
    () =>
      directCart.reduce((acc, item) => {
        const evalLine = promoEval.byProductId[item.product.id];
        if (evalLine?.promoApplied) return acc + evalLine.lineSubtotal;
        return acc + Number(item.subtotal || 0);
      }, 0),
    [directCart, promoEval]
  );

  const directBillingTotals = useMemo(
    () =>
      calculateDirectBillingTotals(
        directCart,
        directInvoiceForm.billingType,
        selectedDirectClient,
        ivaPerceptionAliquot,
        effectiveDirectSubtotalSum
      ),
    [directCart, directInvoiceForm.billingType, selectedDirectClient, ivaPerceptionAliquot, effectiveDirectSubtotalSum]
  );

  const handleSelectClient = (c: any) => {
    setDirectInvoiceForm((prev) => ({ ...prev, personaId: String(c.id) }));
    setClientSearchQuery(c.name);
    setShowClientDropdown(false);
    setDirectCart([]);
    setTimeout(() => productSearchInputRef.current?.focus(), 50);
  };

  const handleSelectProduct = (p: any) => {
    setSelectedDirectProduct(String(p.id));
    setProductSearchQuery(p.name);
    setShowProductDropdown(false);
    setDirectProductQty(String(p.minOrderQuantity || 1));
  };

  const handleAddDirectProduct = () => {
    if (!selectedDirectProduct) return;
    const prod = products.find((p) => p.id === Number(selectedDirectProduct));
    if (!prod) return;

    let qty = Number(directProductQty);
    if (isNaN(qty) || qty <= 0) {
      setModalError('La cantidad debe ser mayor a 0.');
      return;
    }

    const minQty = prod.minOrderQuantity || 1;
    if (qty < minQty) {
      qty = minQty;
      setDirectProductQty(String(minQty));
      setModalError(`El producto "${prod.name}" exige un mínimo de ${minQty} unidades. Se ajustó automáticamente la cantidad.`);
    }

    const finalUnitPrice = computeClientUnitPrice(
      prod,
      selectedDirectClient,
      discountRules,
      directInvoiceForm.billingType
    );
    const existingIdx = directCart.findIndex((item) => item.product.id === prod.id);

    const resolveSuggestedKg = (targetQty: number): number => {
      const approxScaled = parseScaledBigInt(prod.approximateWeight);
      const safeApprox = approxScaled > 0n ? approxScaled : SCALE;
      const grams = divRoundHalfUp(BigInt(Math.max(0, Math.trunc(targetQty))) * safeApprox, 1_000n);
      return Number(grams) / 1000;
    };

    if (existingIdx !== -1) {
      const newQty = Number(directCart[existingIdx].quantity || 0) + qty;
      const newCart = [...directCart];
      const existingWeight = Number(newCart[existingIdx].weight || 0);
      const weight = prod.isPesable
        ? existingWeight > 0
          ? existingWeight
          : resolveSuggestedKg(newQty)
        : null;
      newCart[existingIdx] = {
        ...newCart[existingIdx],
        quantity: newQty,
        weight,
        unitPrice: finalUnitPrice,
        subtotal: calculateExactLineSubtotalInt({
          unitPriceInt: finalUnitPrice,
          quantity: newQty,
          isPesable: Boolean(prod.isPesable),
          weight,
          approximateWeight: prod.approximateWeight
        })
      };
      setDirectCart(newCart);
    } else {
      const weight = prod.isPesable ? resolveSuggestedKg(qty) : null;
      setDirectCart((prev) => [
        ...prev,
        {
          product: prod,
          quantity: qty,
          weight,
          unitPrice: finalUnitPrice,
          subtotal: calculateExactLineSubtotalInt({
            unitPriceInt: finalUnitPrice,
            quantity: qty,
            isPesable: Boolean(prod.isPesable),
            weight,
            approximateWeight: prod.approximateWeight
          })
        }
      ]);
    }

    setSelectedDirectProduct('');
    setProductSearchQuery('');
    setDirectProductQty('1');
  };

  const handleRemoveDirectProduct = (prodId: number) => {
    setDirectCart((prev) => prev.filter((item) => item.product.id !== prodId));
  };

  const handleCloseResetHeader = () => {
    setShowDirectInvoiceModal(false);
    setDirectCart([]);
    setDirectInvoiceForm(INITIAL_DIRECT_INVOICE_FORM);
    setClientSearchQuery('');
    setProductSearchQuery('');
    onModalClosed?.();
  };

  const handleCancelFooter = () => {
    setShowDirectInvoiceModal(false);
    setDirectCart([]);
    setClientSearchQuery('');
    setProductSearchQuery('');
    setModalError(null);
    onModalClosed?.();
  };

  const handleCreateDirectInvoiceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    setModalError(null);

    const { error, payload } = buildDirectInvoiceRequest(directInvoiceForm, directCart, activeDrawers, bankAccounts);
    if (error || !payload) {
      setErrorMsg(error || 'Datos inválidos.');
      setModalError(error || 'Datos inválidos.');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.createDirectInvoice(payload);
      setSuccessMsg(res?.invoiceNumber ? `Comprobante emitido: ${res.invoiceNumber}` : 'Comprobante emitido.');
      setShowDirectInvoiceModal(false);
      setModalError(null);
      setDirectCart([]);
      setDirectInvoiceForm(INITIAL_DIRECT_INVOICE_FORM);
      setClientSearchQuery('');
      setProductSearchQuery('');
      loadData();
      if (res) {
        onInvoiceCreated?.({ ...res, paymentMethod: payload.paymentMethod });
      }
    } catch (err: any) {
      console.error('Error al emitir factura directa:', err);
      const msg = err.message || 'Error al emitir factura directa.';
      setErrorMsg(msg);
      setModalError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return {
    showDirectInvoiceModal, setShowDirectInvoiceModal,
    directInvoiceForm, setDirectInvoiceForm,
    directCart, setDirectCart,
    selectedDirectProduct,
    directProductQty, setDirectProductQty,
    modalError, isSubmitting,
    clientSearchQuery, setClientSearchQuery,
    showClientDropdown, setShowClientDropdown,
    activeClientSuggestionIdx, setActiveClientSuggestionIdx,
    clientSearchInputRef,
    productSearchQuery, setProductSearchQuery,
    showProductDropdown, setShowProductDropdown,
    activeProductSuggestionIdx, setActiveProductSuggestionIdx,
    productSearchInputRef, productQtyInputRef,
    filteredClients, filteredProducts, selectedDirectClient, directBillingTotals, promoEval,
    handleSelectClient, handleSelectProduct,
    handleAddDirectProduct, handleRemoveDirectProduct,
    handleCloseResetHeader, handleCancelFooter,
    handleCreateDirectInvoiceSubmit
  };
}
