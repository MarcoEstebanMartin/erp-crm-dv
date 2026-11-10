import { useState, useEffect } from 'react';
import { api } from '../../utils/api';

export function useStockMovements() {
  // Detalle de movimientos (Kárdex)
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<any | null>(null);
  const [movementsHistory, setMovementsHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Historial global reciente
  const [globalMovements, setGlobalMovements] = useState<any[]>([]);
  const [loadingGlobalMovements, setLoadingGlobalMovements] = useState(false);
  const [showGlobalMovements, setShowGlobalMovements] = useState(false);

  const fetchGlobalMovements = async () => {
    setLoadingGlobalMovements(true);
    try {
      const data = await api.getGlobalStockMovements();
      setGlobalMovements(data || []);
    } catch (err) {
      console.error('Error al cargar movimientos globales de stock', err);
    } finally {
      setLoadingGlobalMovements(false);
    }
  };

  useEffect(() => {
    if (showGlobalMovements) {
      fetchGlobalMovements();
    }
  }, [showGlobalMovements]);

  const fetchProductHistory = async (product: any) => {
    setSelectedProductForHistory(product);
    setLoadingHistory(true);
    setShowHistoryPanel(true);
    try {
      const data = await api.getProductMovements(product.id);
      setMovementsHistory(data || []);
    } catch (err) {
      console.error('Error al cargar historial del producto', err);
    } finally {
      setLoadingHistory(false);
    }
  };

  const refreshAfterAdjust = async (adjustedProductId: number) => {
    if (selectedProductForHistory && selectedProductForHistory.id === adjustedProductId) {
      const data = await api.getProductMovements(adjustedProductId);
      setMovementsHistory(data || []);
    }
    if (showGlobalMovements) {
      fetchGlobalMovements();
    }
  };

  const closeHistoryPanel = () => {
    setShowHistoryPanel(false);
    setSelectedProductForHistory(null);
  };

  return {
    selectedProductForHistory,
    movementsHistory,
    loadingHistory,
    showHistoryPanel,
    fetchProductHistory,
    closeHistoryPanel,
    globalMovements,
    loadingGlobalMovements,
    showGlobalMovements,
    setShowGlobalMovements,
    refreshAfterAdjust
  };
}
