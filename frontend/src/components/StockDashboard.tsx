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
  Layers
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

  // Cálculos de valorización para los productos FILTRADOS
  const stats = filteredProducts.reduce((acc, p) => {
    const stockQty = Number(p.stock) || 0;
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
                const isOutOfStock = p.stock <= 0;
                const isLowStock = !isOutOfStock && p.stock <= p.minStock;
                const cost = Number(p.costPrice) || 0;
                const listPrice = Number(p.listPrice) || 0;
                const stockValCost = p.stock * cost;
                const stockValRetail = p.stock * listPrice;
                const activeLots = (p.lots || []).filter((l: any) => l.stock > 0);

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
                    </td>

                    {/* Lotes activos */}
                    <td style={{ padding: '12px 16px', maxWidth: '280px' }}>
                      {activeLots.length === 0 ? (
                        <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Sin lotes activos</span>
                      ) : (
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                          {activeLots.map((l: any) => {
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
                                {l.lotNumber} ({l.stock} u.)
                              </span>
                            );
                          })}
                        </div>
                      )}
                    </td>

                    {/* Stock Físico */}
                    <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                      <span style={{ 
                        fontWeight: 700, 
                        fontSize: '0.92rem', 
                        color: isOutOfStock 
                          ? 'var(--color-danger)' 
                          : isLowStock 
                            ? 'var(--color-warning)' 
                            : 'var(--text-primary)'
                      }}>
                        {p.stock} u.
                      </span>
                      {isOutOfStock && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-danger)', fontWeight: 600, marginTop: '2px' }}>SIN STOCK</div>
                      )}
                      {isLowStock && (
                        <div style={{ fontSize: '0.68rem', color: 'var(--color-warning)', fontWeight: 600, marginTop: '2px' }}>BAJO MÍN ({p.minStock})</div>
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
        .hover-bg-muted:hover {
          background-color: var(--bg-app) !important;
        }
      `}</style>

    </div>
  );
}
