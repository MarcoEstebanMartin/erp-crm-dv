import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import {
  INITIAL_TRANSFER_DATA,
  type LotManagerModalState,
  type TransferLotData
} from './types';

interface UseLotManagerParams {
  products: any[];
  onRefresh: () => Promise<void>;
  setLoadingAdjust: (val: boolean) => void;
  setErrorMessage: (msg: string | null) => void;
  setSuccessMessage: (msg: string | null) => void;
}

export function useLotManager({
  products,
  onRefresh,
  setLoadingAdjust,
  setErrorMessage,
  setSuccessMessage
}: UseLotManagerParams) {
  const confirm = useConfirm();

  const [lotManagerModal, setLotManagerModal] = useState<LotManagerModalState>({
    open: false,
    product: null
  });
  const [editingLot, setEditingLot] = useState<any | null>(null);
  const [editLotNumber, setEditLotNumber] = useState('');
  const [editExpirationDate, setEditExpirationDate] = useState('');
  const [editLocation, setEditLocation] = useState('');

  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const [transferData, setTransferData] = useState<TransferLotData>(INITIAL_TRANSFER_DATA);

  // Mantener actualizado el producto en el modal de gestión de lotes cuando cambian los props (ej: tras refresh)
  useEffect(() => {
    if (lotManagerModal.open && lotManagerModal.product) {
      const fresh = products.find((p) => p.id === lotManagerModal.product.id);
      if (fresh) {
        setLotManagerModal((prev) => ({ ...prev, product: fresh }));
      }
    }
  }, [products, lotManagerModal.open]);

  const openLotManager = (product: any) => {
    setLotManagerModal({ open: true, product });
  };

  const closeLotManager = () => {
    setLotManagerModal({ open: false, product: null });
    setEditingLot(null);
    setShowTransferPanel(false);
  };

  const startEditingLot = (lot: any) => {
    setEditingLot(lot);
    setEditLotNumber(lot.lotNumber);
    setEditLocation(lot.location || 'S/U');
    setEditExpirationDate(new Date(lot.expirationDate).toISOString().split('T')[0]);
  };

  const toggleTransferPanel = () => {
    const next = !showTransferPanel;
    setShowTransferPanel(next);
    setEditingLot(null);
    const lotsWithStock = (lotManagerModal.product?.lots || []).filter((l: any) => l.stock > 0);
    setTransferData({
      fromLotId: lotsWithStock.length > 0 ? lotsWithStock[0].id : '',
      toLotNumber: '',
      toExpirationDate: '',
      isNewDestLot: false,
      quantity: 0
    });
  };

  const handleUpdateLotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingLot) return;

    setLoadingAdjust(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.updateLot(editingLot.id, {
        lotNumber: editLotNumber,
        expirationDate: editExpirationDate,
        location: editLocation
      });

      setSuccessMessage(`Lote "${editLotNumber}" actualizado con éxito.`);
      setEditingLot(null);
      await onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al actualizar el lote.');
    } finally {
      setLoadingAdjust(false);
    }
  };

  const handleVacateLot = async (lotId: number, lotNumber: string, currentStock: number) => {
    if (!lotManagerModal.product || currentStock <= 0) return;
    if (
      !(await confirm(
        `¿Estás seguro de que deseas vaciar las ${currentStock} u. del lote "${lotNumber}" dejándolo en 0 u.?`,
        { type: 'danger' }
      ))
    )
      return;

    setLoadingAdjust(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.adjustStock(lotManagerModal.product.id, {
        lotId,
        lotNumber,
        mode: 'VACATE_LOT',
        reason: `Vaciamiento controlado de lote ${lotNumber}`
      });
      setSuccessMessage(`Lote "${lotNumber}" vaciado a 0 u. con éxito.`);
      await onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al vaciar el lote.');
    } finally {
      setLoadingAdjust(false);
    }
  };

  const handleDeleteLot = async (lotId: number, lotNumber: string) => {
    if (
      !(await confirm(
        `¿Estás seguro de que deseas eliminar permanentemente el lote "${lotNumber}"?`,
        { type: 'danger' }
      ))
    )
      return;

    setLoadingAdjust(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.deleteLot(lotId);
      setSuccessMessage(`Lote "${lotNumber}" eliminado con éxito.`);
      await onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al eliminar el lote.');
    } finally {
      setLoadingAdjust(false);
    }
  };

  const handleTransferSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!lotManagerModal.product || transferData.fromLotId === '') return;

    setLoadingAdjust(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.transferLotStock(lotManagerModal.product.id, {
        fromLotId: Number(transferData.fromLotId),
        toLotNumber: transferData.toLotNumber,
        toExpirationDate: transferData.isNewDestLot ? transferData.toExpirationDate : undefined,
        quantity: Number(transferData.quantity)
      });

      setSuccessMessage(`Transferencia de stock de lote aplicada con éxito.`);
      setShowTransferPanel(false);
      setTransferData(INITIAL_TRANSFER_DATA);
      await onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al transferir stock.');
    } finally {
      setLoadingAdjust(false);
    }
  };

  return {
    lotManagerModal,
    openLotManager,
    closeLotManager,
    editingLot,
    setEditingLot,
    editLotNumber,
    setEditLotNumber,
    editExpirationDate,
    setEditExpirationDate,
    editLocation,
    setEditLocation,
    startEditingLot,
    showTransferPanel,
    setShowTransferPanel,
    toggleTransferPanel,
    transferData,
    setTransferData,
    handleUpdateLotSubmit,
    handleVacateLot,
    handleDeleteLot,
    handleTransferSubmit
  };
}
