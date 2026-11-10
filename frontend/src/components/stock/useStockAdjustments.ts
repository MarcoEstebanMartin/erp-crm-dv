import React, { useState } from 'react';
import { api } from '../../utils/api';
import { type AdjustModalState, INITIAL_ADJUST_MODAL } from './types';

interface UseStockAdjustmentsParams {
  products: any[];
  onRefresh: () => Promise<void>;
  onAfterAdjust: (productId: number) => Promise<void>;
}

export function useStockAdjustments({
  products,
  onRefresh,
  onAfterAdjust
}: UseStockAdjustmentsParams) {
  const [isQuickInventoryMode, setIsQuickInventoryMode] = useState(false);
  const [pendingAdjustments, setPendingAdjustments] = useState<{ [key: string]: number }>({});
  const [showEmptyLots, setShowEmptyLots] = useState(false);

  const [adjustModal, setAdjustModal] = useState<AdjustModalState>(INITIAL_ADJUST_MODAL);
  const [loadingAdjust, setLoadingAdjust] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const openAdjustModal = (product: any) => {
    setAdjustModal({
      ...INITIAL_ADJUST_MODAL,
      open: true,
      product
    });
  };

  const closeAdjustModal = () => {
    setAdjustModal(INITIAL_ADJUST_MODAL);
  };

  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModal.product || !adjustModal.quantityChange) return;

    const targetProduct = adjustModal.product;
    setLoadingAdjust(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.adjustStock(
        targetProduct.id,
        adjustModal.quantityChange,
        adjustModal.reason || 'Ajuste manual administrativo',
        adjustModal.lotNumber || undefined,
        adjustModal.isNewLot ? adjustModal.expirationDate : undefined
      );

      setSuccessMessage(`Ajuste de stock para ${targetProduct.name} aplicado con éxito.`);
      setAdjustModal(INITIAL_ADJUST_MODAL);
      await onRefresh();
      await onAfterAdjust(targetProduct.id);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al ajustar el stock.');
    } finally {
      setLoadingAdjust(false);
    }
  };

  const handleSaveQuickInventory = async () => {
    setLoadingAdjust(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    const adjustmentsToMake: Array<{
      productId: number;
      quantityChange: number;
      reason: string;
      lotNumber?: string;
      expirationDate?: string;
      productName: string;
    }> = [];

    for (const [key, val] of Object.entries(pendingAdjustments)) {
      if (key.startsWith('lot-')) {
        const lotId = Number(key.replace('lot-', ''));
        for (const p of products) {
          const lot = (p.lots || []).find((l: any) => l.id === lotId);
          if (lot) {
            const diff = val - lot.stock;
            if (diff !== 0) {
              adjustmentsToMake.push({
                productId: p.id,
                quantityChange: diff,
                reason: 'Ajuste rápido de inventario (Lote)',
                lotNumber: lot.lotNumber,
                productName: p.name
              });
            }
            break;
          }
        }
      } else if (key.startsWith('prod-')) {
        const productId = Number(key.replace('prod-', ''));
        const p = products.find((prod) => prod.id === productId);
        if (p) {
          const diff = val - p.stock;
          if (diff !== 0) {
            adjustmentsToMake.push({
              productId: p.id,
              quantityChange: diff,
              reason: 'Ajuste rápido de inventario (Stock inicial)',
              lotNumber: 'S/L',
              expirationDate: '2036-12-31',
              productName: p.name
            });
          }
        }
      }
    }

    if (adjustmentsToMake.length === 0) {
      setErrorMessage('No hay cambios pendientes de guardar.');
      setLoadingAdjust(false);
      return;
    }

    try {
      for (const adj of adjustmentsToMake) {
        await api.adjustStock(
          adj.productId,
          adj.quantityChange,
          adj.reason,
          adj.lotNumber,
          adj.expirationDate
        );
      }

      setSuccessMessage(`Se aplicaron con éxito ${adjustmentsToMake.length} ajustes de inventario.`);
      setPendingAdjustments({});
      setIsQuickInventoryMode(false);
      await onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Ocurrió un error al guardar los ajustes.');
    } finally {
      setLoadingAdjust(false);
    }
  };

  return {
    isQuickInventoryMode,
    setIsQuickInventoryMode,
    pendingAdjustments,
    setPendingAdjustments,
    showEmptyLots,
    setShowEmptyLots,
    adjustModal,
    setAdjustModal,
    openAdjustModal,
    closeAdjustModal,
    loadingAdjust,
    setLoadingAdjust,
    errorMessage,
    setErrorMessage,
    successMessage,
    setSuccessMessage,
    handleAdjustSubmit,
    handleSaveQuickInventory
  };
}
