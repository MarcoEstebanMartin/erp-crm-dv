import React, { useEffect, useMemo, useRef, useState } from 'react';
import { api } from '../../../utils/api';
import { billingApi, type EligibleOrderForCreditNote } from '../../../api/billing.api';
import { useConfirm } from '../../../context/ConfirmContext';
import { calculateExactLineSubtotalInt } from '../../../utils/weeklyPromoCartEvaluator';
import { matchesSmartSearch } from '../../../utils/orderSearchAndStatus.helper';
import {
  buildCartItemsFromEligibleOrder,
  computeCreditNoteCartTotal,
  type CreditNoteCartItem,
} from './creditNoteCart.helpers';

export interface UseCreditNotesControllerParams {
  personas: any[];
  products: any[];
  creditNoteForm: any;
  setCreditNoteForm: React.Dispatch<React.SetStateAction<any>>;
  creditNoteCart: CreditNoteCartItem[];
  setCreditNoteCart: React.Dispatch<React.SetStateAction<CreditNoteCartItem[]>>;
  cnClientSearchQuery: string;
  setCnClientSearchQuery: (query: string) => void;
  setShowCreditNoteModal: (show: boolean) => void;
  setViewCreditNoteModal?: (note: any | null) => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
  loadData: () => void;
  onSubmitted?: (creditNote: any) => void;
}

export function useCreditNotesController({
  personas,
  products,
  creditNoteForm,
  setCreditNoteForm,
  creditNoteCart,
  setCreditNoteCart,
  cnClientSearchQuery,
  setCnClientSearchQuery,
  setShowCreditNoteModal,
  setViewCreditNoteModal,
  setErrorMsg,
  setSuccessMsg,
  loadData,
  onSubmitted,
}: UseCreditNotesControllerParams) {
  const isAdmin = api.getCurrentUser()?.role === 'ADMIN';
  const confirm = useConfirm();

  const [cnProductSearchQuery, setCnProductSearchQuery] = useState('');
  const [showCNClientDropdown, setShowCNClientDropdown] = useState(false);
  const [activeCNClientSuggestionIdx, setActiveCNClientSuggestionIdx] = useState(0);
  const [showCNProductDropdown, setShowCNProductDropdown] = useState(false);
  const [activeCNProductSuggestionIdx, setActiveCNProductSuggestionIdx] = useState(0);

  const [selectedCNProduct, setSelectedCNProduct] = useState('');
  const [cnProductQty, setCnProductQty] = useState('1');
  const [cnProductPrice, setCnProductPrice] = useState('');
  const [cnProductWeight, setCnProductWeight] = useState('');

  const [eligibleOrders, setEligibleOrders] = useState<EligibleOrderForCreditNote[]>([]);
  const [loadingEligibleOrders, setLoadingEligibleOrders] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const eligibleReqSeqRef = useRef(0);

  const clientsOnly = useMemo(() => personas.filter((p) => p.isClient), [personas]);

  const filteredCNClients = useMemo(() => {
    if (!cnClientSearchQuery) return clientsOnly.slice(0, 10);
    return clientsOnly
      .filter((c: any) => matchesSmartSearch(`${c.name || ''} ${c.cuit || ''}`, cnClientSearchQuery))
      .slice(0, 10);
  }, [cnClientSearchQuery, clientsOnly]);

  const filteredCNProducts = useMemo(() => {
    if (!cnProductSearchQuery) return products.slice(0, 10);
    return products
      .filter((p: any) => matchesSmartSearch(`${p.name || ''} ${p.sku || ''}`, cnProductSearchQuery))
      .slice(0, 10);
  }, [cnProductSearchQuery, products]);

  const selectedCNClient = useMemo(() => {
    if (!creditNoteForm.personaId) return null;
    return personas.find((p: any) => p.id === Number(creditNoteForm.personaId)) || null;
  }, [creditNoteForm.personaId, personas]);

  const selectedEligibleOrder = useMemo(() => {
    if (!creditNoteForm.orderId) return null;
    return eligibleOrders.find((o) => o.id === Number(creditNoteForm.orderId)) || null;
  }, [creditNoteForm.orderId, eligibleOrders]);

  useEffect(() => {
    const personaIdNum = Number(creditNoteForm.personaId);
    if (!personaIdNum || Number.isNaN(personaIdNum)) {
      setEligibleOrders([]);
      setLoadingEligibleOrders(false);
      return;
    }

    const seq = ++eligibleReqSeqRef.current;
    setLoadingEligibleOrders(true);
    billingApi
      .getEligibleOrdersForCreditNote(personaIdNum)
      .then((orders) => {
        if (eligibleReqSeqRef.current === seq) {
          setEligibleOrders(orders);
        }
      })
      .catch(() => {
        if (eligibleReqSeqRef.current === seq) {
          setEligibleOrders([]);
        }
      })
      .finally(() => {
        if (eligibleReqSeqRef.current === seq) {
          setLoadingEligibleOrders(false);
        }
      });
  }, [creditNoteForm.personaId]);

  const handleSelectCNClient = (c: any) => {
    setCreditNoteForm((prev: any) => ({
      ...prev,
      personaId: String(c.id),
      orderId: '',
      billingType: 'INTERNAL',
      comments: '',
    }));
    setCnClientSearchQuery(c.name);
    setShowCNClientDropdown(false);
    setCreditNoteCart([]);
  };

  const handleSelectEligibleOrder = (order: EligibleOrderForCreditNote | null) => {
    if (!order) {
      setCreditNoteForm((prev: any) => ({
        ...prev,
        orderId: '',
        billingType: 'INTERNAL',
        comments: '',
      }));
      setCreditNoteCart([]);
      return;
    }

    setCreditNoteForm((prev: any) => ({
      ...prev,
      orderId: String(order.id),
      billingType: order.billingType,
      comments: prev.comments || '',
    }));
    setCreditNoteCart(buildCartItemsFromEligibleOrder(order));
  };

  const handleSelectCNProduct = (p: any) => {
    setSelectedCNProduct(String(p.id));
    setCnProductSearchQuery(p.name);
    setCnProductPrice(String(p.listPrice));
    setCnProductWeight(p.isPesable ? String(p.approximateWeight || '') : '');
    setShowCNProductDropdown(false);
  };

  const handleAddCNProduct = () => {
    if (!selectedCNProduct) return;
    const prod = products.find((p) => p.id === Number(selectedCNProduct));
    if (!prod) return;

    const qty = Number(cnProductQty);
    const price = Number(cnProductPrice);
    const weight = cnProductWeight ? Number(cnProductWeight) : null;

    if (qty <= 0) {
      setErrorMsg('La cantidad debe ser mayor a 0.');
      return;
    }
    if (price < 0) {
      setErrorMsg('El precio no puede ser negativo.');
      return;
    }

    const subtotal = calculateExactLineSubtotalInt({
      unitPriceInt: price,
      quantity: qty,
      isPesable: Boolean(prod.isPesable),
      weight,
      approximateWeight: prod.approximateWeight,
    });

    setCreditNoteCart((prev) => [
      ...prev,
      {
        productId: prod.id,
        name: prod.name,
        sku: prod.sku || '',
        selected: true,
        quantity: qty,
        weight,
        isPesable: Boolean(prod.isPesable),
        approximateWeight: prod.approximateWeight ?? 1,
        unitPrice: price,
        subtotal,
      },
    ]);

    setSelectedCNProduct('');
    setCnProductSearchQuery('');
    setCnProductQty('1');
    setCnProductPrice('');
    setCnProductWeight('');
  };

  const handleRemoveCNProduct = (prodId: number) => {
    setCreditNoteCart((prev) => prev.filter((item) => item.productId !== prodId));
  };

  const handleApproveCreditNote = async (id: number) => {
    if (
      !(await confirm(
        '¿Aprobar esta Nota de Crédito? Se emitirá el comprobante, se ajustará stock si corresponde y se acreditará en cuenta corriente.',
        { type: 'success' },
      ))
    ) {
      return;
    }
    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      const result = await api.approveCreditNote(id);
      setSuccessMsg('Nota de Crédito aprobada correctamente.');
      loadData();
      setViewCreditNoteModal?.(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al aprobar la Nota de Crédito.');
    }
  };

  const handleRejectCreditNote = async (id: number) => {
    if (
      !(await confirm(
        '¿Rechazar esta Nota de Crédito? Quedará anulada de manera permanente.',
        { type: 'danger' },
      ))
    ) {
      return;
    }
    try {
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.rejectCreditNote(id);
      setSuccessMsg('Nota de Crédito rechazada.');
      loadData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al rechazar la Nota de Crédito.');
    }
  };

  const handleCreateCreditNoteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!creditNoteForm.personaId) {
      setErrorMsg('Debe seleccionar un cliente.');
      return;
    }

    if (creditNoteForm.billingType === 'OFFICIAL' && !creditNoteForm.orderId) {
      setErrorMsg('Para emitir una Nota de Crédito Oficial (ARCA/AFIP) es obligatorio seleccionar una factura asociada.');
      return;
    }

    const itemsToSend = creditNoteCart.filter(
      (item) =>
        item.selected !== false &&
        (item.isPesable ? Boolean(item.weight && item.weight > 0) : item.quantity > 0),
    );
    if (itemsToSend.length === 0) {
      setErrorMsg('Debe incluir al menos un ítem con cantidad/peso válido.');
      return;
    }

    if (creditNoteForm.orderId) {
      const totalToCredit = computeCreditNoteCartTotal(itemsToSend);
      if (
        selectedEligibleOrder &&
        totalToCredit > Math.round(selectedEligibleOrder.remainingCreditableAmount)
      ) {
        setErrorMsg(
          `El importe ($${totalToCredit.toLocaleString('es-AR')}) supera el saldo acreditable ($${Math.round(selectedEligibleOrder.remainingCreditableAmount).toLocaleString('es-AR')}).`,
        );
        return;
      }

      if (creditNoteForm.reason === 'DEVOLUCION') {
        for (const item of itemsToSend) {
          const maxQty = item.remainingReturnableQuantity ?? item.orderQuantity;
          if (maxQty !== undefined && item.quantity > maxQty) {
            setErrorMsg(
              `La cantidad de ${item.name} (${item.quantity}) supera el disponible para devolver (${maxQty}).`,
            );
            return;
          }
          if (item.isPesable && item.weight && item.orderWeight && item.weight > item.orderWeight) {
            setErrorMsg(
              `El peso de ${item.name} (${item.weight} kg) supera el disponible (${item.orderWeight} kg).`,
            );
            return;
          }
        }
      }
    }

    setSubmitting(true);
    try {
      const payload = {
        personaId: Number(creditNoteForm.personaId),
        orderId: creditNoteForm.orderId ? Number(creditNoteForm.orderId) : null,
        billingType: creditNoteForm.billingType,
        reason: creditNoteForm.reason,
        comments: creditNoteForm.comments,
        items: itemsToSend.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          weight: item.isPesable ? item.weight || null : null,
          unitPrice: item.unitPrice,
        })),
      };

      const result = await api.createCreditNote(payload);
      setSuccessMsg(`Nota de Crédito emitida (#${result.creditNoteNumber || result.id})`);

      setShowCreditNoteModal(false);
      setCreditNoteCart([]);
      setCreditNoteForm({
        personaId: '',
        orderId: '',
        billingType: 'INTERNAL',
        reason: 'DEVOLUCION',
        comments: '',
      });
      setCnClientSearchQuery('');
      setCnProductSearchQuery('');
      loadData();
      setViewCreditNoteModal?.(result);
      onSubmitted?.(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al emitir la Nota de Crédito.');
    } finally {
      setSubmitting(false);
    }
  };

  const openFreeCreditNoteModal = () => {
    setCreditNoteForm({
      personaId: '',
      orderId: '',
      billingType: 'INTERNAL',
      reason: 'DEVOLUCION',
      comments: '',
    });
    setCnClientSearchQuery('');
    setCreditNoteCart([]);
    setShowCreditNoteModal(true);
  };

  return {
    isAdmin,
    submitting,
    eligibleOrders,
    loadingEligibleOrders,
    selectedEligibleOrder,
    handleSelectEligibleOrder,
    cnProductSearchQuery,
    setCnProductSearchQuery,
    showCNClientDropdown,
    setShowCNClientDropdown,
    activeCNClientSuggestionIdx,
    setActiveCNClientSuggestionIdx,
    showCNProductDropdown,
    setShowCNProductDropdown,
    activeCNProductSuggestionIdx,
    setActiveCNProductSuggestionIdx,
    cnProductQty,
    setCnProductQty,
    cnProductPrice,
    setCnProductPrice,
    cnProductWeight,
    setCnProductWeight,
    filteredCNClients,
    filteredCNProducts,
    selectedCNClient,
    handleSelectCNClient,
    handleSelectCNProduct,
    handleAddCNProduct,
    handleRemoveCNProduct,
    handleApproveCreditNote,
    handleRejectCreditNote,
    handleCreateCreditNoteSubmit,
    openFreeCreditNoteModal,
  };
}
