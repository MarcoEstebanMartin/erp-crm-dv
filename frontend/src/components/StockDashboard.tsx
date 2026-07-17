import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Coins, 
  TrendingUp, 
  AlertTriangle, 
  Search, 
  History, 
  X, 
  ArrowUpRight, 
  ArrowDownRight,
  Layers,
  Edit2,
  Trash2
} from 'lucide-react';
import { api } from '../utils/api';

interface StockDashboardProps {
  products: any[];
  onRefresh: () => Promise<void>;
}

export default function StockDashboard({ products, onRefresh }: StockDashboardProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRubro, setSelectedRubro] = useState('');
  const [stockFilter, setStockFilter] = useState<'all' | 'low' | 'out' | 'expiring'>('all');
  
  // Detalle de movimientos (Kárdex)
  const [selectedProductForHistory, setSelectedProductForHistory] = useState<any | null>(null);
  const [movementsHistory, setMovementsHistory] = useState<any[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [showHistoryPanel, setShowHistoryPanel] = useState(false);

  // Historial global reciente
  const [globalMovements, setGlobalMovements] = useState<any[]>([]);
  const [loadingGlobalMovements, setLoadingGlobalMovements] = useState(false);
  const [showGlobalMovements, setShowGlobalMovements] = useState(false);

  // Modo Inventario Rápido
  const [isQuickInventoryMode, setIsQuickInventoryMode] = useState(false);
  const [pendingAdjustments, setPendingAdjustments] = useState<{ [key: string]: number }>({});

  // Modal de ajuste de stock
  const [adjustModal, setAdjustModal] = useState<{
    open: boolean;
    product: any | null;
    quantityChange: number;
    reason: string;
    lotNumber: string;
    isNewLot: boolean;
    expirationDate: string;
  }>({
    open: false,
    product: null,
    quantityChange: 0,
    reason: '',
    lotNumber: '',
    isNewLot: false,
    expirationDate: ''
  });

  const [loadingAdjust, setLoadingAdjust] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Estados de Gestión de Lotes
  const [showEmptyLots, setShowEmptyLots] = useState(false);
  const [lotManagerModal, setLotManagerModal] = useState<{ open: boolean; product: any | null }>({ open: false, product: null });
  const [editingLot, setEditingLot] = useState<any | null>(null);
  const [editLotNumber, setEditLotNumber] = useState('');
  const [editExpirationDate, setEditExpirationDate] = useState('');
  const [editLocation, setEditLocation] = useState('');
  
  const [showTransferPanel, setShowTransferPanel] = useState(false);
  const [transferData, setTransferData] = useState<{
    fromLotId: number | '';
    toLotNumber: string;
    toExpirationDate: string;
    isNewDestLot: boolean;
    quantity: number;
  }>({
    fromLotId: '',
    toLotNumber: '',
    toExpirationDate: '',
    isNewDestLot: false,
    quantity: 0
  });


  useEffect(() => {
    if (showGlobalMovements) {
      fetchGlobalMovements();
    }
  }, [showGlobalMovements]);

  // Cargar historial de movimientos global
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

  // Cargar historial de movimientos de un producto
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

  // Procesar ajuste de stock
  const handleAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustModal.product || !adjustModal.quantityChange) return;

    setLoadingAdjust(true);
    setErrorMessage(null);
    setSuccessMessage(null);

    try {
      await api.adjustStock(
        adjustModal.product.id,
        adjustModal.quantityChange,
        adjustModal.reason || 'Ajuste manual administrativo',
        adjustModal.lotNumber || undefined,
        adjustModal.isNewLot ? adjustModal.expirationDate : undefined
      );

      setSuccessMessage(`Ajuste de stock para ${adjustModal.product.name} aplicado con éxito.`);
      setAdjustModal({
        open: false,
        product: null,
        quantityChange: 0,
        reason: '',
        lotNumber: '',
        isNewLot: false,
        expirationDate: ''
      });
      await onRefresh();
      
      // Si el panel de historial del producto está abierto para este producto, refrescarlo
      if (selectedProductForHistory && selectedProductForHistory.id === adjustModal.product.id) {
        const data = await api.getProductMovements(adjustModal.product.id);
        setMovementsHistory(data || []);
      }
      
      if (showGlobalMovements) {
        fetchGlobalMovements();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al ajustar el stock.');
    } finally {
      setLoadingAdjust(false);
    }
  };

  // Guardar todos los ajustes del modo inventario rápido
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

    // Recorrer los ajustes pendientes
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
        const p = products.find(prod => prod.id === productId);
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
      // Realizar los ajustes de forma secuencial
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

  // Mantener actualizado el producto en el modal de gestión de lotes cuando cambian los props (ej: tras refresh)
  useEffect(() => {
    if (lotManagerModal.open && lotManagerModal.product) {
      const fresh = products.find(p => p.id === lotManagerModal.product.id);
      if (fresh) {
        setLotManagerModal(prev => ({ ...prev, product: fresh }));
      }
    }
  }, [products, lotManagerModal.open]);

  // Actualizar datos del lote (Código, Fecha Vencimiento, Ubicación)
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

  // Eliminar lote físico (si tiene stock 0)
  const handleDeleteLot = async (lotId: number, lotNumber: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar permanentemente el lote "${lotNumber}"?`)) return;

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

  // Transferir stock entre lotes del mismo producto
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
      setTransferData({
        fromLotId: '',
        toLotNumber: '',
        toExpirationDate: '',
        isNewDestLot: false,
        quantity: 0
      });
      await onRefresh();
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al transferir stock.');
    } finally {
      setLoadingAdjust(false);
    }
  };


  // Extraer rubro de forma segura
  const extractRubroLabel = (p: any): string => {
    if (!p.rubro) return 'Sin Rubro';
    if (typeof p.rubro === 'string') return p.rubro;
    return p.rubro.name || 'Sin Rubro';
  };

  // Filtrar productos
  const filteredProducts = products.filter((p) => {
    // 1. Filtro de búsqueda por SKU, Nombre o Código
    const searchLower = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      !searchLower ||
      p.name.toLowerCase().includes(searchLower) ||
      p.sku.toLowerCase().includes(searchLower) ||
      (p.barcode && p.barcode.includes(searchLower));

    // 2. Filtro de Rubro
    const matchesRubro = !selectedRubro || extractRubroLabel(p) === selectedRubro;

    // 3. Filtro de Estado de Stock
    let matchesStock = true;
    if (stockFilter === 'low') {
      matchesStock = p.stock > 0 && p.stock <= p.minStock;
    } else if (stockFilter === 'out') {
      matchesStock = p.stock <= 0;
    } else if (stockFilter === 'expiring') {
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);
      matchesStock = (p.lots || []).some((l: any) => {
        if (l.stock <= 0) return false;
        const expDate = new Date(l.expirationDate);
        return expDate > new Date() && expDate <= thirtyDaysFromNow;
      });
    }

    return matchesSearch && matchesRubro && matchesStock;
  });

  // Obtener el stock reflejando los ajustes pendientes en tiempo real
  const getDisplayedStock = (p: any) => {
    if (p.lots && p.lots.length > 0) {
      return p.lots.reduce((sum: number, lot: any) => {
        const pending = pendingAdjustments[`lot-${lot.id}`];
        return sum + (pending !== undefined ? pending : lot.stock);
      }, 0);
    }
    const pending = pendingAdjustments[`prod-${p.id}`];
    return pending !== undefined ? pending : p.stock;
  };

  // Cálculos de valorización para los productos FILTRADOS
  const stats = filteredProducts.reduce((acc, p) => {
    const stockQty = getDisplayedStock(p);
    const cost = Number(p.costPrice) || 0;
    const listPrice = Number(p.listPrice) || 0;
    const minStock = Number(p.minStock) || 0;

    acc.totalUnits += stockQty;
    acc.totalCost += stockQty * cost;
    acc.totalRetailVal += stockQty * listPrice;
    
    if (stockQty <= 0) {
      acc.outOfStockCount += 1;
    } else if (stockQty <= minStock) {
      acc.lowStockCount += 1;
    }

    return acc;
  }, {
    totalUnits: 0,
    totalCost: 0,
    totalRetailVal: 0,
    lowStockCount: 0,
    outOfStockCount: 0
  });

  const latentProfit = stats.totalRetailVal - stats.totalCost;
  const latentProfitMargin = stats.totalCost > 0 ? (latentProfit / stats.totalCost) * 100 : 0;

  // Rubros únicos disponibles
  const rubrosList = Array.from(new Set(products.map(extractRubroLabel).filter(Boolean))).sort();

  return (
    <div style={{ animation: 'fadeIn 0.3s ease-out' }}>
      
      {/* Mensajes de Alerta */}
      {successMessage && (
        <div style={{
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.88rem',
          fontWeight: 500,
          marginBottom: '20px',
          border: '1px solid rgba(16, 185, 129, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{successMessage}</span>
          <button onClick={() => setSuccessMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}><X size={16} /></button>
        </div>
      )}

      {errorMessage && (
        <div style={{
          backgroundColor: 'var(--color-danger-bg)',
          color: 'var(--color-danger)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.88rem',
          fontWeight: 500,
          marginBottom: '20px',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <span>{errorMessage}</span>
          <button onClick={() => setErrorMessage(null)} style={{ background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', padding: 0 }}><X size={16} /></button>
        </div>
      )}

      {/* ====================================================================
          TARJETAS DE VALORIZACIÓN (KPIs)
          ==================================================================== */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: '16px',
        marginBottom: '24px'
      }}>
        {/* Unidades Totales */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '10px', color: 'var(--text-primary)' }}>
            <Package size={24} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Unidades Físicas</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {stats.totalUnits.toLocaleString('es-AR')} <span style={{ fontSize: '0.9rem', fontWeight: 500, color: 'var(--text-secondary)' }}>u.</span>
            </span>
          </div>
        </div>

        {/* Costo del Stock */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '10px', color: 'var(--text-primary)' }}>
            <Coins size={24} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valorización (Costo)</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              ${stats.totalCost.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Retorno Estimado (Venta) */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ backgroundColor: 'var(--bg-app)', padding: '12px', borderRadius: '10px', color: 'var(--text-primary)' }}>
            <TrendingUp size={24} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Valorización (Venta)</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              ${stats.totalRetailVal.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
            </span>
          </div>
        </div>

        {/* Margen Latente */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ 
            backgroundColor: latentProfit >= 0 ? 'rgba(16, 185, 129, 0.06)' : 'rgba(239, 68, 68, 0.06)', 
            padding: '12px', 
            borderRadius: '10px', 
            color: latentProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)' 
          }}>
            {latentProfit >= 0 ? <ArrowUpRight size={24} /> : <ArrowDownRight size={24} />}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Margen Latente</span>
            <span style={{ fontSize: '1.5rem', fontWeight: 700, color: latentProfit >= 0 ? 'var(--color-success)' : 'var(--color-danger)', marginTop: '2px' }}>
              ${latentProfit.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
              <span style={{ fontSize: '0.75rem', fontWeight: 600, marginLeft: '6px', opacity: 0.9 }}>
                +{latentProfitMargin.toFixed(0)}%
              </span>
            </span>
          </div>
        </div>

        {/* Alertas Críticas */}
        <div className="card" style={{ padding: '20px', display: 'flex', alignItems: 'center', gap: '16px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', boxShadow: 'var(--shadow-sm)' }}>
          <div style={{ 
            backgroundColor: (stats.lowStockCount > 0 || stats.outOfStockCount > 0) ? 'rgba(245, 158, 11, 0.08)' : 'var(--bg-app)', 
            padding: '12px', 
            borderRadius: '10px', 
            color: (stats.lowStockCount > 0 || stats.outOfStockCount > 0) ? 'var(--color-warning)' : 'var(--text-muted)' 
          }}>
            <AlertTriangle size={24} />
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Productos Críticos</span>
            <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '2px' }}>
              {stats.outOfStockCount} <span style={{ fontSize: '0.8rem', color: 'var(--color-danger)', fontWeight: 600 }}>Agotados</span>
              <span style={{ margin: '0 4px', color: 'var(--text-muted)' }}>|</span>
              {stats.lowStockCount} <span style={{ fontSize: '0.8rem', color: 'var(--color-warning)', fontWeight: 600 }}>Bajos</span>
            </span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          FILTROS Y BUSCADOR
          ==================================================================== */}
      <div className="actions-bar" style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '20px', backgroundColor: 'var(--bg-card)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
        <div className="search-input-wrapper" style={{ flex: 1, minWidth: '250px', position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="text"
            className="input"
            placeholder="Buscar SKU, nombre del producto o código..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ borderRadius: '8px', padding: '10px 14px 10px 42px' }}
          />
        </div>

        {/* Filtro por Rubro */}
        <select 
          className="select" 
          style={{ minWidth: '180px', borderRadius: '8px' }}
          value={selectedRubro} 
          onChange={(e) => setSelectedRubro(e.target.value)}
        >
          <option value="">Todos los Rubros</option>
          {rubrosList.map(r => (
            <option key={String(r)} value={String(r)}>{String(r)}</option>
          ))}
        </select>

        {/* Filtro por Estado Stock */}
        <div style={{ display: 'flex', border: '1px solid var(--border-color)', borderRadius: '8px', overflow: 'hidden', backgroundColor: 'var(--bg-app)', padding: '2px' }}>
          <button 
            type="button" 
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.8rem', 
              borderRadius: '6px', 
              border: 'none', 
              backgroundColor: stockFilter === 'all' ? 'var(--bg-card)' : 'transparent',
              color: stockFilter === 'all' ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontWeight: stockFilter === 'all' ? 600 : 400,
              boxShadow: stockFilter === 'all' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer'
            }}
            onClick={() => setStockFilter('all')}
          >
            Todos
          </button>
          <button 
            type="button" 
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.8rem', 
              borderRadius: '6px', 
              border: 'none', 
              backgroundColor: stockFilter === 'low' ? 'var(--bg-card)' : 'transparent',
              color: stockFilter === 'low' ? 'var(--color-warning)' : 'var(--text-secondary)',
              fontWeight: stockFilter === 'low' ? 600 : 400,
              boxShadow: stockFilter === 'low' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer'
            }}
            onClick={() => setStockFilter('low')}
          >
            Stock Bajo
          </button>
          <button 
            type="button" 
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.8rem', 
              borderRadius: '6px', 
              border: 'none', 
              backgroundColor: stockFilter === 'out' ? 'var(--bg-card)' : 'transparent',
              color: stockFilter === 'out' ? 'var(--color-danger)' : 'var(--text-secondary)',
              fontWeight: stockFilter === 'out' ? 600 : 400,
              boxShadow: stockFilter === 'out' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer'
            }}
            onClick={() => setStockFilter('out')}
          >
            Agotados
          </button>
          <button 
            type="button" 
            style={{ 
              padding: '6px 12px', 
              fontSize: '0.8rem', 
              borderRadius: '6px', 
              border: 'none', 
              backgroundColor: stockFilter === 'expiring' ? 'var(--bg-card)' : 'transparent',
              color: stockFilter === 'expiring' ? 'var(--color-info)' : 'var(--text-secondary)',
              fontWeight: stockFilter === 'expiring' ? 600 : 400,
              boxShadow: stockFilter === 'expiring' ? 'var(--shadow-sm)' : 'none',
              cursor: 'pointer'
            }}
            onClick={() => setStockFilter('expiring')}
          >
            Vencimientos
          </button>
        </div>

        {/* Toggle Modo Inventario Rápido */}
        <button 
          className="btn" 
          type="button"
          style={{ 
            borderRadius: '8px', 
            padding: '10px 14px',
            backgroundColor: isQuickInventoryMode ? '#FEF3C7' : 'var(--bg-app)',
            color: isQuickInventoryMode ? '#B45309' : 'var(--text-primary)',
            border: isQuickInventoryMode ? '1px solid #F59E0B' : '1px solid var(--border-color)',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontWeight: 600,
            cursor: 'pointer'
          }}
          onClick={() => {
            if (isQuickInventoryMode) {
              setPendingAdjustments({});
            }
            setIsQuickInventoryMode(!isQuickInventoryMode);
          }}
          title="Modificar múltiples stock a la vez"
        >
          <span>{isQuickInventoryMode ? '🚫 Cancelar Inventario' : '📝 Modo Inventario Rápido'}</span>
        </button>

        {isQuickInventoryMode && (
          <label style={{ 
            display: 'flex', 
            alignItems: 'center', 
            gap: '6px', 
            fontSize: '0.8rem', 
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            padding: '0 12px',
            height: '38px',
            backgroundColor: 'var(--bg-muted)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            userSelect: 'none',
            transition: 'all 0.2s'
          }} className="hover-bg-card">
            <input 
              type="checkbox" 
              checked={showEmptyLots} 
              onChange={(e) => setShowEmptyLots(e.target.checked)} 
              style={{ cursor: 'pointer' }}
            />
            <span>Ver lotes vacíos (0 u.)</span>
          </label>
        )}


        {/* Acciones del Historial Global */}
        <button 
          className="btn btn-secondary" 
          style={{ borderRadius: '8px', padding: '10px 14px' }}
          onClick={() => setShowGlobalMovements(!showGlobalMovements)}
          title="Ver Auditoría Global de Movimientos"
        >
          <History size={16} />
          <span>{showGlobalMovements ? 'Ocultar Auditoría' : 'Auditoría Global'}</span>
        </button>
      </div>

      {/* ====================================================================
          TABLA DE INVENTARIO Y VALORIZACIÓN
          ==================================================================== */}
      <div className="table-container" style={{ borderRadius: '12px', overflow: 'hidden', border: '1px solid var(--border-color)', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', marginBottom: '24px' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead style={{ backgroundColor: 'var(--bg-muted)' }}>
            <tr>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>SKU</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>PRODUCTO</th>
              <th style={{ padding: '12px 16px', textAlign: 'left', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>LOTES EN GÓNDOLA</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>FÍSICO</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>COSTO UNIT.</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>VALOR COSTO</th>
              <th style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>VALOR VENTA</th>
              <th style={{ padding: '12px 16px', textAlign: 'center', fontWeight: 600, fontSize: '0.82rem', color: 'var(--text-secondary)' }}>ACCIONES</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.length === 0 ? (
              <tr>
                <td colSpan={8} style={{ textAlign: 'center', padding: '48px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                  No se encontraron productos con los filtros aplicados.
                </td>
              </tr>
            ) : (
              filteredProducts.map((p) => {
                const displayedStock = getDisplayedStock(p);
                const isOutOfStock = displayedStock <= 0;
                const isLowStock = !isOutOfStock && displayedStock <= p.minStock;
                const cost = Number(p.costPrice) || 0;
                const listPrice = Number(p.listPrice) || 0;
                const stockValCost = displayedStock * cost;
                const stockValRetail = displayedStock * listPrice;
                const activeLots = (p.lots || []).filter((l: any) => {
                  const pending = pendingAdjustments[`lot-${l.id}`];
                  const st = pending !== undefined ? pending : l.stock;
                  return st > 0;
                });

                return (
                  <tr key={p.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.2s' }} className="hover-bg-muted">
                    {/* SKU */}
                    <td style={{ padding: '12px 16px', fontFamily: 'monospace', fontWeight: 600, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
                      {p.sku}
                    </td>

                    {/* Producto */}
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span style={{ backgroundColor: 'var(--bg-app)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)', fontWeight: 500 }}>
                          {extractRubroLabel(p)}
                        </span>
                        {p.description && <span>• {p.description}</span>}
                      </div>

                      {isQuickInventoryMode && p.lots && p.lots.length > 1 && (
                        <div style={{ 
                          marginTop: '8px', 
                          padding: '10px', 
                          backgroundColor: '#F3F4F6', 
                          borderRadius: '6px', 
                          fontSize: '0.78rem',
                          border: '1px dashed #D1D5DB'
                        }}>
                          <div style={{ fontWeight: 700, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                            Ajuste de Lotes Coexistentes:
                          </div>
                          {p.lots
                            .filter((lot: any) => showEmptyLots || lot.stock > 0 || pendingAdjustments[`lot-${lot.id}`] !== undefined)
                            .map((lot: any) => {
                            const val = pendingAdjustments[`lot-${lot.id}`] !== undefined ? pendingAdjustments[`lot-${lot.id}`] : lot.stock;
                            return (
                              <div key={lot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', gap: '10px' }}>
                                <span>Lote <strong>{lot.lotNumber}</strong> <span style={{ color: 'var(--text-muted)' }}>(Vence: {new Date(lot.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })})</span></span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                                  <input
                                    type="number"
                                    className="input"
                                    style={{ width: '70px', padding: '2px 4px', height: '24px', fontSize: '0.78rem', textAlign: 'center' }}
                                    value={val}
                                    onChange={(e) => setPendingAdjustments({ ...pendingAdjustments, [`lot-${lot.id}`]: Number(e.target.value) })}
                                    min={0}
                                  />
                                  <span>u.</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Lotes activos */}
                    <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
                      {activeLots.length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin lotes activos</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {activeLots.map((l: any) => {
                            const pending = pendingAdjustments[`lot-${l.id}`];
                            const st = pending !== undefined ? pending : l.stock;

                            const isL_Exp = new Date(l.expirationDate) <= new Date();
                            const thirtyDays = new Date();
                            thirtyDays.setDate(thirtyDays.getDate() + 30);
                            const isL_Warn = !isL_Exp && new Date(l.expirationDate) <= thirtyDays;

                            let badgeBg = 'var(--bg-app)';
                            let badgeColor = 'var(--text-primary)';
                            let badgeBorder = 'var(--border-color)';

                            if (isL_Exp) {
                              badgeBg = 'var(--color-danger-bg)';
                              badgeColor = 'var(--color-danger)';
                              badgeBorder = 'rgba(239, 68, 68, 0.2)';
                            } else if (isL_Warn) {
                              badgeBg = 'var(--color-warning-bg)';
                              badgeColor = 'var(--color-warning)';
                              badgeBorder = 'rgba(245, 158, 11, 0.2)';
                            }

                            return (
                              <span 
                                key={l.id} 
                                className="badge" 
                                style={{ 
                                  fontSize: '0.7rem', 
                                  padding: '2px 6px', 
                                  backgroundColor: badgeBg, 
                                  color: badgeColor, 
                                  border: `1px solid ${badgeBorder}`,
                                  borderRadius: '4px'
                                }}
                                title={`Vence: ${new Date(l.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}`}
                              >
                                {l.lotNumber} ({st} u.)
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Stock Físico */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      {isQuickInventoryMode && (!p.lots || p.lots.length <= 1) ? (
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            className="input"
                            style={{ width: '80px', padding: '4px 8px', fontSize: '0.88rem', height: '32px', textAlign: 'center', border: '1px solid var(--accent-color)', borderRadius: '6px' }}
                            value={
                              p.lots && p.lots.length === 1
                                ? (pendingAdjustments[`lot-${p.lots[0].id}`] !== undefined ? pendingAdjustments[`lot-${p.lots[0].id}`] : p.lots[0].stock)
                                : (pendingAdjustments[`prod-${p.id}`] !== undefined ? pendingAdjustments[`prod-${p.id}`] : p.stock)
                            }
                            onChange={(e) => {
                              const val = Number(e.target.value);
                              if (p.lots && p.lots.length === 1) {
                                setPendingAdjustments({ ...pendingAdjustments, [`lot-${p.lots[0].id}`]: val });
                              } else {
                                setPendingAdjustments({ ...pendingAdjustments, [`prod-${p.id}`]: val });
                              }
                            }}
                            min={0}
                          />
                          <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>u.</span>
                        </div>
                      ) : (
                        <>
                          <span style={{ 
                            fontWeight: 700, 
                            fontSize: '0.92rem', 
                            color: isOutOfStock 
                              ? 'var(--color-danger)' 
                              : isLowStock 
                                ? 'var(--color-warning)' 
                                : 'var(--text-primary)'
                          }}>
                            {displayedStock} u.
                          </span>
                          {isOutOfStock && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-danger)', fontWeight: 600, marginTop: '2px' }}>SIN STOCK</div>
                          )}
                          {isLowStock && (
                            <div style={{ fontSize: '0.68rem', color: 'var(--color-warning)', fontWeight: 600, marginTop: '2px' }}>BAJO MÍN ({p.minStock})</div>
                          )}
                        </>
                      )}
                    </td>

                    {/* Costo Unitario */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      ${cost.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </td>

                    {/* Costo Total */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                      ${stockValCost.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>

                    {/* Valor Venta */}
                    <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                      ${stockValRetail.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                    </td>

                    {/* Acciones */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <div style={{ display: 'inline-flex', gap: '6px' }}>
                        <button 
                          className="btn btn-ghost" 
                          style={{ padding: '6px', borderRadius: '6px', color: 'var(--text-secondary)' }}
                          onClick={() => fetchProductHistory(p)}
                          title="Ver Kárdex / Movimientos"
                        >
                          <History size={15} />
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ 
                            padding: '4px 10px', 
                            fontSize: '0.78rem', 
                            height: '28px', 
                            borderRadius: '6px',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px'
                          }}
                          onClick={() => setLotManagerModal({
                            open: true,
                            product: p
                          })}
                          title="Gestionar Lotes (Editar, Eliminar, Transferir)"
                        >
                          <Layers size={13} />
                          <span>Lotes</span>
                        </button>
                        <button 
                          className="btn btn-secondary" 
                          style={{ padding: '4px 10px', fontSize: '0.78rem', height: '28px', borderRadius: '6px' }}
                          onClick={() => setAdjustModal({
                            open: true,
                            product: p,
                            quantityChange: 0,
                            reason: '',
                            lotNumber: '',
                            isNewLot: false,
                            expirationDate: ''
                          })}
                          title="Ajustar Stock"
                        >
                          Ajustar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ====================================================================
          SECCIÓN AUDITORÍA GLOBAL DE MOVIMIENTOS RECIENTES
          ==================================================================== */}
      {showGlobalMovements && (
        <div className="card" style={{ padding: '20px', border: '1px solid var(--border-color)', borderRadius: 'var(--radius-md)', marginBottom: '24px', animation: 'slideDown 0.25s ease-out' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h4 style={{ margin: 0, fontSize: '0.98rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Layers size={18} />
              Registro de Auditoría Global de Stock (Últimos 50 movimientos)
            </h4>
            <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowGlobalMovements(false)}><X size={16} /></button>
          </div>

          {loadingGlobalMovements ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>Cargando auditoría...</div>
          ) : globalMovements.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>No hay movimientos registrados.</div>
          ) : (
            <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto', border: '1px solid var(--border-color)' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                <thead style={{ backgroundColor: 'var(--bg-muted)', position: 'sticky', top: 0, zIndex: 1 }}>
                  <tr>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Fecha</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Producto</th>
                    <th style={{ padding: '10px 12px', textAlign: 'center' }}>Cantidad</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Lote</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Operador</th>
                    <th style={{ padding: '10px 12px', textAlign: 'left' }}>Detalle/Motivo</th>
                  </tr>
                </thead>
                <tbody>
                  {globalMovements.map((m) => {
                    const isQtyPositive = m.quantity > 0;
                    return (
                      <tr key={m.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                          {new Date(m.createdAt).toLocaleString('es-AR')}
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>{m.product?.sku}</span>
                          <span style={{ marginLeft: '8px', color: 'var(--text-primary)' }}>{m.product?.name}</span>
                        </td>
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <span style={{ 
                            padding: '2px 8px', 
                            borderRadius: '12px', 
                            fontWeight: 700,
                            backgroundColor: isQtyPositive ? 'var(--color-success-bg)' : 'rgba(0,0,0,0.04)',
                            color: isQtyPositive ? 'var(--color-success)' : 'var(--text-secondary)'
                          }}>
                            {isQtyPositive ? `+${m.quantity}` : m.quantity} u.
                          </span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                          {m.productLot ? m.productLot.lotNumber : 'General'}
                        </td>
                        <td style={{ padding: '10px 12px', fontWeight: 500 }}>
                          {m.user?.username} <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>({m.user?.role})</span>
                        </td>
                        <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                          {m.reason}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          LÍNEA DE TIEMPO DEL PRODUCTO (KÁRDEX - SIDE DRAWER)
          ==================================================================== */}
      {showHistoryPanel && selectedProductForHistory && (
        <div style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: '420px',
          backgroundColor: 'var(--bg-card)',
          boxShadow: '-4px 0 24px rgba(0,0,0,0.08)',
          borderLeft: '1px solid var(--border-color)',
          zIndex: 1000,
          padding: '24px',
          display: 'flex',
          flexDirection: 'column',
          animation: 'slideLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          {/* Header Panel */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 700 }}>Historial de Stock (Kárdex)</h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.78rem', color: 'var(--text-secondary)', fontFamily: 'monospace' }}>
                {selectedProductForHistory.sku} • {selectedProductForHistory.name}
              </p>
            </div>
            <button 
              className="btn btn-ghost" 
              style={{ padding: '4px', borderRadius: '50%', border: 'none', cursor: 'pointer' }}
              onClick={() => { setShowHistoryPanel(false); setSelectedProductForHistory(null); }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Físico Actual */}
          <div style={{
            backgroundColor: 'var(--bg-app)',
            padding: '12px 16px',
            borderRadius: '8px',
            marginBottom: '20px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 500, color: 'var(--text-secondary)' }}>Inventario Físico Actual:</span>
            <span style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>{selectedProductForHistory.stock} u.</span>
          </div>

          {/* Timeline Content */}
          <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
            <h4 style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '14px' }}>Timeline de Movimientos</h4>
            
            {loadingHistory ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Cargando movimientos...</div>
            ) : movementsHistory.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)', fontSize: '0.85rem', fontStyle: 'italic' }}>
                Sin movimientos registrados para este producto.
              </div>
            ) : (
              <div style={{ position: 'relative', paddingLeft: '20px', borderLeft: '1px solid var(--border-color)', marginLeft: '8px' }}>
                {movementsHistory.map((m) => {
                  const isPositive = m.quantity > 0;
                  return (
                    <div key={m.id} style={{ position: 'relative', marginBottom: '24px' }}>
                      {/* Nodo timeline */}
                      <div style={{
                        position: 'absolute',
                        left: '-25px',
                        top: '4px',
                        width: '9px',
                        height: '9px',
                        borderRadius: '50%',
                        backgroundColor: isPositive ? 'var(--color-success)' : 'var(--text-muted)',
                        border: '2px solid var(--bg-card)'
                      }} />
                      
                      {/* Cabecera movimiento */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <span style={{ 
                          fontWeight: 700, 
                          fontSize: '0.85rem',
                          color: isPositive ? 'var(--color-success)' : 'var(--text-primary)'
                        }}>
                          {isPositive ? `+${m.quantity}` : m.quantity} u.
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {new Date(m.createdAt).toLocaleDateString('es-AR')} {new Date(m.createdAt).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Detalles */}
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                        <div><strong>Tipo:</strong> {m.type} • {m.reason}</div>
                        {m.productLot && <div><strong>Lote:</strong> {m.productLot.lotNumber}</div>}
                        <div style={{ color: 'var(--text-muted)', fontSize: '0.7rem', marginTop: '2px' }}>
                          Operado por: {m.user?.username} ({m.user?.role})
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL DE AJUSTE DE STOCK
          ==================================================================== */}
      {adjustModal.open && adjustModal.product && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderRadius: '16px', padding: '24px', maxWidth: '450px' }}>
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Ajustar Stock Físico</h3>
              <button 
                type="button"
                className="btn btn-ghost" 
                style={{ padding: '4px', borderRadius: '50%', border: 'none', cursor: 'pointer' }} 
                onClick={() => setAdjustModal({ open: false, product: null, quantityChange: 0, reason: '', lotNumber: '', isNewLot: false, expirationDate: '' })}
              >
                <X size={16} />
              </button>
            </div>
            
            <form onSubmit={handleAdjustSubmit}>
              <div style={{ 
                backgroundColor: 'var(--bg-app)', 
                padding: '14px', 
                borderRadius: '8px', 
                fontSize: '0.85rem', 
                marginBottom: '16px',
                border: '1px solid var(--border-color)' 
              }}>
                <div style={{ marginBottom: '4px' }}><strong>Artículo:</strong> {adjustModal.product.name}</div>
                <div style={{ marginBottom: '4px' }}><strong>SKU:</strong> {adjustModal.product.sku}</div>
                <div><strong>Stock actual en depósito:</strong> <span style={{ fontWeight: 700 }}>{adjustModal.product.stock} u.</span></div>
              </div>

              {/* Cantidad a Ajustar */}
              <div className="form-group">
                <label>Cantidad a Sumar o Restar</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Ej: 24 para ingresar, -12 para egresar"
                  value={adjustModal.quantityChange || ''}
                  onChange={(e) => setAdjustModal({ ...adjustModal, quantityChange: Number(e.target.value) })}
                  required
                  style={{ borderRadius: '8px' }}
                />
                <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                  Use valores positivos para entradas de stock y negativos para salidas.
                </span>
              </div>

              {/* Lote */}
              <div className="form-group">
                <label>Lote del Producto</label>
                <select
                  className="select"
                  value={adjustModal.isNewLot ? '__new__' : adjustModal.lotNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__new__') {
                      setAdjustModal({ ...adjustModal, isNewLot: true, lotNumber: '', expirationDate: '' });
                    } else {
                      setAdjustModal({ ...adjustModal, isNewLot: false, lotNumber: val, expirationDate: '' });
                    }
                  }}
                  style={{ borderRadius: '8px' }}
                >
                  <option value="">Sin lote (Stock Genérico / General)</option>
                  {(adjustModal.product.lots || []).map((lot: any) => (
                    <option key={lot.id} value={lot.lotNumber}>
                      Lote: {lot.lotNumber} (Stock: {lot.stock} u. - Vence: {new Date(lot.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })})
                    </option>
                  ))}
                  {Number(adjustModal.quantityChange) > 0 && (
                    <option value="__new__">+ Registrar nuevo lote...</option>
                  )}
                </select>
              </div>

              {/* Registro de Nuevo Lote */}
              {adjustModal.isNewLot && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px', animation: 'fadeIn 0.2s ease-out' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Código Lote</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Ej: L-2026-01"
                      value={adjustModal.lotNumber}
                      onChange={(e) => setAdjustModal({ ...adjustModal, lotNumber: e.target.value })}
                      required
                      style={{ borderRadius: '8px' }}
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Fecha Vencimiento</label>
                    <input
                      type="date"
                      className="input"
                      value={adjustModal.expirationDate}
                      onChange={(e) => setAdjustModal({ ...adjustModal, expirationDate: e.target.value })}
                      required
                      style={{ borderRadius: '8px' }}
                    />
                  </div>
                </div>
              )}

              {/* Motivo */}
              <div className="form-group">
                <label>Detalle / Motivo del Ajuste</label>
                <select 
                  className="select"
                  value={adjustModal.reason}
                  onChange={(e) => setAdjustModal({ ...adjustModal, reason: e.target.value })}
                  required
                  style={{ borderRadius: '8px' }}
                >
                  <option value="">Seleccione un motivo...</option>
                  <option value="Ingreso de mercadería por compras">Ingreso de mercadería por compras</option>
                  <option value="Ajuste por inventario físico mensual">Ajuste por inventario físico mensual</option>
                  <option value="Rotura / Envase dañado en depósito">Rotura / Envase dañado en depósito</option>
                  <option value="Vencimiento de mercadería">Vencimiento de mercadería</option>
                  <option value="Devolución de cliente">Devolución de cliente</option>
                  <option value="Ajuste manual administrativo">Ajuste manual administrativo</option>
                </select>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setAdjustModal({ open: false, product: null, quantityChange: 0, reason: '', lotNumber: '', isNewLot: false, expirationDate: '' })}
                  style={{ borderRadius: '8px' }}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary" 
                  disabled={loadingAdjust}
                  style={{ borderRadius: '8px' }}
                >
                  {loadingAdjust ? 'Procesando...' : 'Aplicar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL DE GESTIÓN DE LOTES
          ==================================================================== */}
      {lotManagerModal.open && lotManagerModal.product && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ borderRadius: '16px', padding: '24px', maxWidth: '650px', width: '90%' }}>
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700 }}>Gestionar Lotes</h3>
              <button 
                type="button"
                className="btn btn-ghost" 
                style={{ padding: '4px', borderRadius: '50%', border: 'none', cursor: 'pointer' }} 
                onClick={() => {
                  setLotManagerModal({ open: false, product: null });
                  setEditingLot(null);
                  setShowTransferPanel(false);
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ 
              backgroundColor: 'var(--bg-app)', 
              padding: '14px', 
              borderRadius: '8px', 
              fontSize: '0.85rem', 
              marginBottom: '20px',
              border: '1px solid var(--border-color)',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <div style={{ marginBottom: '4px' }}><strong>Artículo:</strong> {lotManagerModal.product.name}</div>
                <div><strong>SKU:</strong> {lotManagerModal.product.sku}</div>
              </div>
              <button
                type="button"
                className="btn"
                style={{ 
                  borderRadius: '6px', 
                  fontSize: '0.78rem', 
                  padding: '6px 12px',
                  backgroundColor: showTransferPanel ? 'var(--bg-muted)' : 'var(--text-primary)',
                  color: showTransferPanel ? 'var(--text-primary)' : 'var(--bg-app)',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 600
                }}
                onClick={() => {
                  setShowTransferPanel(!showTransferPanel);
                  setEditingLot(null);
                  // Inicializar los datos del transfer
                  const lotsWithStock = (lotManagerModal.product.lots || []).filter((l: any) => l.stock > 0);
                  setTransferData({
                    fromLotId: lotsWithStock.length > 0 ? lotsWithStock[0].id : '',
                    toLotNumber: '',
                    toExpirationDate: '',
                    isNewDestLot: false,
                    quantity: 0
                  });
                }}
              >
                {showTransferPanel ? 'Ver Lista de Lotes' : '⇅ Transferir Stock'}
              </button>
            </div>

            {/* SECCIÓN 1: PANEL DE TRANSFERENCIA */}
            {showTransferPanel ? (
              <form onSubmit={handleTransferSubmit} style={{ animation: 'slideDown 0.2s ease-out' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: 600 }}>Transferir / Reasignar Stock entre Lotes</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  {/* Lote Origen */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Lote de Origen</label>
                    <select
                      className="select"
                      value={transferData.fromLotId}
                      onChange={(e) => setTransferData({ ...transferData, fromLotId: Number(e.target.value) })}
                      required
                      style={{ borderRadius: '8px', width: '100%' }}
                    >
                      <option value="">Seleccione origen...</option>
                      {(lotManagerModal.product.lots || [])
                        .filter((l: any) => l.stock > 0)
                        .map((l: any) => (
                          <option key={l.id} value={l.id}>
                            Lote: {l.lotNumber} ({l.stock} u. disponibles)
                          </option>
                        ))
                      }
                    </select>
                  </div>

                  {/* Cantidad */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Cantidad a transferir</label>
                    <input
                      type="number"
                      className="input"
                      value={transferData.quantity || ''}
                      onChange={(e) => setTransferData({ ...transferData, quantity: Number(e.target.value) })}
                      required
                      min={1}
                      max={
                        transferData.fromLotId !== '' 
                          ? (lotManagerModal.product.lots || []).find((l: any) => l.id === transferData.fromLotId)?.stock || 1
                          : undefined
                      }
                      style={{ borderRadius: '8px', width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  {/* Lote Destino */}
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Lote de Destino</label>
                    <select
                      className="select"
                      value={transferData.isNewDestLot ? '__new__' : transferData.toLotNumber}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === '__new__') {
                          setTransferData({ ...transferData, isNewDestLot: true, toLotNumber: '', toExpirationDate: '' });
                        } else {
                          setTransferData({ ...transferData, isNewDestLot: false, toLotNumber: val });
                        }
                      }}
                      required
                      style={{ borderRadius: '8px', width: '100%' }}
                    >
                      <option value="">Seleccione destino...</option>
                      {(lotManagerModal.product.lots || [])
                        .filter((l: any) => l.id !== transferData.fromLotId)
                        .map((l: any) => (
                          <option key={l.id} value={l.lotNumber}>
                            Lote: {l.lotNumber} (Stock: {l.stock} u.)
                          </option>
                        ))
                      }
                      <option value="__new__">+ Crear nuevo lote...</option>
                    </select>
                  </div>

                  {/* Fecha de vencimiento (si es nuevo lote) */}
                  {transferData.isNewDestLot && (
                    <div className="form-group" style={{ marginBottom: 0, animation: 'slideDown 0.15s ease-out' }}>
                      <label>Fecha Vencimiento (Nuevo Lote)</label>
                      <input
                        type="date"
                        className="input"
                        value={transferData.toExpirationDate}
                        onChange={(e) => setTransferData({ ...transferData, toExpirationDate: e.target.value })}
                        required
                        style={{ borderRadius: '8px', width: '100%' }}
                      />
                    </div>
                  )}

                  {/* Input Código Lote Nuevo */}
                  {transferData.isNewDestLot && (
                    <div className="form-group" style={{ marginBottom: 0, animation: 'slideDown 0.15s ease-out' }}>
                      <label>Código del Nuevo Lote</label>
                      <input
                        type="text"
                        className="input"
                        placeholder="Ej: L-2026-02"
                        value={transferData.toLotNumber}
                        onChange={(e) => setTransferData({ ...transferData, toLotNumber: e.target.value })}
                        required
                        style={{ borderRadius: '8px', width: '100%' }}
                      />
                    </div>
                  )}
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setShowTransferPanel(false)}
                    style={{ borderRadius: '8px' }}
                  >
                    Volver
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={loadingAdjust}
                    style={{ borderRadius: '8px' }}
                  >
                    {loadingAdjust ? 'Transfiriendo...' : 'Confirmar Transferencia'}
                  </button>
                </div>
              </form>
            ) : editingLot ? (
              /* SECCIÓN 2: FORMULARIO DE EDICIÓN DE LOTE */
              <form onSubmit={handleUpdateLotSubmit} style={{ animation: 'slideDown 0.2s ease-out' }}>
                <h4 style={{ margin: '0 0 16px 0', fontSize: '0.9rem', fontWeight: 600 }}>Editar Propiedades del Lote</h4>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Código de Lote</label>
                    <input
                      type="text"
                      className="input"
                      value={editLotNumber}
                      onChange={(e) => setEditLotNumber(e.target.value)}
                      required
                      style={{ borderRadius: '8px', width: '100%' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Ubicación Física</label>
                    <input
                      type="text"
                      className="input"
                      value={editLocation}
                      onChange={(e) => setEditLocation(e.target.value)}
                      placeholder="Ej: A-3, B-12"
                      style={{ borderRadius: '8px', width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Fecha de Vencimiento</label>
                    <input
                      type="date"
                      className="input"
                      value={editExpirationDate}
                      onChange={(e) => setEditExpirationDate(e.target.value)}
                      required
                      style={{ borderRadius: '8px', width: '100%' }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-start', paddingBottom: '4px' }}>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Los cambios afectarán únicamente a las propiedades del lote. No se alterará la cantidad de stock.
                    </span>
                  </div>
                </div>

                <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '20px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setEditingLot(null)}
                    style={{ borderRadius: '8px' }}
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit" 
                    className="btn btn-primary" 
                    disabled={loadingAdjust}
                    style={{ borderRadius: '8px' }}
                  >
                    {loadingAdjust ? 'Guardando...' : 'Guardar Cambios'}
                  </button>
                </div>
              </form>
            ) : (
              /* SECCIÓN 3: LISTADO DE LOTES */
              <div>
                <h4 style={{ margin: '0 0 12px 0', fontSize: '0.9rem', fontWeight: 600 }}>Lotes Registrados</h4>
                <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px', maxHeight: '300px' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.82rem' }}>
                    <thead style={{ backgroundColor: 'var(--bg-muted)', position: 'sticky', top: 0, zIndex: 1 }}>
                      <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Código Lote</th>
                        <th style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 600, color: 'var(--text-secondary)' }}>Stock</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Vencimiento</th>
                        <th style={{ padding: '10px 12px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Ubicación</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: 'var(--text-secondary)' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(lotManagerModal.product.lots || []).length === 0 ? (
                        <tr>
                          <td colSpan={5} style={{ padding: '20px', textAlign: 'center', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            Sin lotes registrados
                          </td>
                        </tr>
                      ) : (
                        (lotManagerModal.product.lots || []).map((lot: any) => {
                          const isExpired = new Date(lot.expirationDate) <= new Date();
                          return (
                            <tr key={lot.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s' }} className="hover-bg-muted">
                              <td style={{ padding: '10px 12px', fontWeight: 600 }}>{lot.lotNumber}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'center', fontWeight: 700 }}>{lot.stock} u.</td>
                              <td style={{ padding: '10px 12px', color: isExpired ? 'var(--color-danger)' : 'var(--text-primary)' }}>
                                {new Date(lot.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}
                                {isExpired && <span style={{ marginLeft: '4px', fontSize: '0.68rem', backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '2px 4px', borderRadius: '4px' }}>Vencido</span>}
                              </td>
                              <td style={{ padding: '10px 12px', fontFamily: 'monospace' }}>{lot.location}</td>
                              <td style={{ padding: '10px 12px', textAlign: 'right' }}>
                                <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                  <button
                                    type="button"
                                    className="btn btn-ghost"
                                    style={{ padding: '4px', color: 'var(--text-secondary)' }}
                                    onClick={() => {
                                      setEditingLot(lot);
                                      setEditLotNumber(lot.lotNumber);
                                      setEditLocation(lot.location || 'S/U');
                                      setEditExpirationDate(new Date(lot.expirationDate).toISOString().split('T')[0]);
                                    }}
                                    title="Editar datos de lote"
                                  >
                                    <Edit2 size={14} />
                                  </button>
                                  {lot.stock === 0 && (
                                    <button
                                      type="button"
                                      className="btn btn-ghost"
                                      style={{ padding: '4px', color: 'var(--color-corp-red)' }}
                                      onClick={() => handleDeleteLot(lot.id, lot.lotNumber)}
                                      title="Eliminar lote"
                                    >
                                      <Trash2 size={14} />
                                    </button>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '16px' }}>
                  <button 
                    type="button" 
                    className="btn btn-secondary" 
                    onClick={() => setLotManagerModal({ open: false, product: null })}
                    style={{ borderRadius: '8px' }}
                  >
                    Cerrar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}


      {/* PANEL FLOTANTE DE GUARDADO DE INVENTARIO */}
      {Object.keys(pendingAdjustments).length > 0 && (
        <div style={{
          position: 'fixed',
          bottom: '24px',
          left: '50%',
          transform: 'translateX(-50%)',
          backgroundColor: '#FFFFFF',
          border: '1px solid #D1D5DB',
          boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          padding: '16px 24px',
          borderRadius: '12px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '24px',
          zIndex: 1000,
          animation: 'slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1)'
        }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
              Conciliación de Inventario Pendiente
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Has modificado {Object.keys(pendingAdjustments).length} productos/lotes. Presiona guardar para registrar los movimientos.
            </div>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button 
              type="button" 
              className="btn btn-secondary" 
              style={{ padding: '8px 16px', fontSize: '0.85rem' }} 
              onClick={() => setPendingAdjustments({})}
              disabled={loadingAdjust}
            >
              Descartar
            </button>
            <button 
              type="button" 
              className="btn btn-primary" 
              style={{ padding: '8px 20px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }} 
              onClick={handleSaveQuickInventory}
              disabled={loadingAdjust}
            >
              {loadingAdjust ? (
                <>
                  <span className="spin-anim" style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid white', borderTopColor: 'transparent', borderRadius: '50%', marginRight: '6px' }}></span>
                  <span>Guardando...</span>
                </>
              ) : (
                <>
                  💾 Guardar Ajustes
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ESTILOS EXTRA DE ANIMACIÓN */}
      <style>{`
        @keyframes slideLeft {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideUp {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
        .hover-bg-muted:hover {
          background-color: var(--bg-app) !important;
        }
      `}</style>

    </div>
  );
}
