import React, { useMemo, useState } from 'react';
import { api } from '../../../utils/api';
import { useConfirm } from '../../../context/ConfirmContext';
import { calculateExactLineSubtotalInt } from '../../../utils/weeklyPromoCartEvaluator';
import { matchesSmartSearch } from '../../../utils/orderSearchAndStatus.helper';

export interface UseCreditNotesControllerParams {
  personas: any[];
  products: any[];
  creditNoteForm: any;
  setCreditNoteForm: React.Dispatch<React.SetStateAction<any>>;
  creditNoteCart: any[];
  setCreditNoteCart: React.Dispatch<React.SetStateAction<any[]>>;
  cnClientSearchQuery: string;
  setCnClientSearchQuery: (query: string) => void;
  setShowCreditNoteModal: (show: boolean) => void;
  setViewCreditNoteModal: (note: any | null) => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
  loadData: () => void;
}

/**
 * Controla búsquedas inteligentes, armado del carrito, aprobaciones y emisión de Notas de Crédito.
 */
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
    return personas.find((p: any) => p.id === Number(creditNoteForm.personaId));
  }, [creditNoteForm.personaId, personas]);

  const handleSelectCNClient = (c: any) => {
    setCreditNoteForm((prev: any) => ({
      ...prev,
      personaId: String(c.id),
      billingType: c.cuit ? 'OFFICIAL' : 'INTERNAL',
    }));
    setCnClientSearchQuery(c.name);
    setShowCNClientDropdown(false);
    setCreditNoteCart([]);
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
        sku: prod.sku,
        quantity: qty,
        weight,
        isPesable: prod.isPesable,
        approximateWeight: prod.approximateWeight,
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
        '¿Está seguro de que desea APROBAR esta Nota de Crédito? Se emitirá el comprobante oficial/interno, se registrará el stock y se descontará del saldo del cliente.',
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
      setViewCreditNoteModal(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al aprobar la Nota de Crédito.');
    }
  };

  const handleRejectCreditNote = async (id: number) => {
    if (
      !(await confirm(
        '¿Está seguro de que desea RECHAZAR esta Nota de Crédito? Quedará anulada de manera permanente.',
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
    setErrorMsg(null);
    setSuccessMsg(null);

    if (!creditNoteForm.personaId) {
      setErrorMsg('Debe seleccionar un cliente.');
      return;
    }

    const itemsToSend = creditNoteCart.filter((item) =>
      item.isPesable ? Boolean(item.weight && item.weight > 0) : item.quantity > 0,
    );
    if (itemsToSend.length === 0) {
      setErrorMsg('Debe agregar al menos un producto con cantidad/peso a devolver o bonificar.');
      return;
    }

    if (creditNoteForm.orderId) {
      for (const item of itemsToSend) {
        if (item.quantity > item.orderQuantity) {
          setErrorMsg(
            `La cantidad a devolver de ${item.name} (${item.quantity}) no puede superar la cantidad original (${item.orderQuantity}).`,
          );
          return;
        }
        if (item.isPesable && item.weight && item.orderWeight && item.weight > item.orderWeight) {
          setErrorMsg(
            `El peso a devolver de ${item.name} (${item.weight} kg) no puede superar el peso original (${item.orderWeight} kg).`,
          );
          return;
        }
      }
    }

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
      setSuccessMsg(`Nota de Crédito emitida correctamente (#${result.creditNoteNumber || result.id})`);

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
      setViewCreditNoteModal(result);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al emitir la Nota de Crédito.');
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
