import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { OrderStatus } from '../utils/types';
import { Play, Check, RefreshCw, Eye } from 'lucide-react';

interface DepositoDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function DepositoDashboard({ activeTab }: DepositoDashboardProps) {
  const normalizedTab = activeTab === 'deposito' ? 'prepare-orders' : 'stock-adjust';
  
  const [orders, setOrders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<any | null>(null);
  
  // Modal de ajuste de stock
  const [stockModal, setStockModal] = useState({
    open: false,
    product: null as any,
    quantityChange: 0,
    reason: '',
    lotNumber: '',
    isNewLot: false,
    expirationDate: ''
  });
  
  // Asignaciones de lote para el pedido en picking
  // Formato: { [orderItemId: number]: { [lotId: number]: number } }
  const [lotAssignments, setLotAssignments] = useState<{ [orderItemId: number]: { [lotId: number]: number } }>({});
  
  // Pesos exactos para productos pesables
  const [pesableWeights, setPesableWeights] = useState<{ [orderItemId: number]: number }>({});
  
  const [searchQuery, setSearchQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [expiringLots, setExpiringLots] = useState<any[]>([]);

  useEffect(() => {
    fetchData();
  }, [normalizedTab, searchQuery]);

  // Limpiar mensajes al cambiar de pestaña
  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [normalizedTab, activeTab]);

  // Auto-abrir modal de ajuste si se escanea/busca un SKU o código de barra exacto
  useEffect(() => {
    if (normalizedTab === 'stock-adjust' && products.length === 1 && searchQuery.trim() !== '') {
      const match = products[0];
      const term = searchQuery.trim();
      if (match.barcode === term || match.sku === term) {
        setStockModal({
          open: true,
          product: match,
          quantityChange: 0,
          reason: 'Ajuste por escaneo rápido',
          lotNumber: '',
          isNewLot: false,
          expirationDate: ''
        });
        setSearchQuery('');
      }
    }
  }, [products, searchQuery, normalizedTab]);

  // Sincronizar lotAssignments al seleccionar o cambiar el pedido
  useEffect(() => {
    if (selectedOrder) {
      const initial: any = {};
      const initialWeights: any = {};
      
      selectedOrder.items.forEach((item: any) => {
        initial[item.id] = {};
        
        // Si el pedido ya tiene asignaciones registradas (ej: recarga), cargarlas
        if (item.orderItemLots && item.orderItemLots.length > 0) {
          item.orderItemLots.forEach((oil: any) => {
            initial[item.id][oil.productLotId] = oil.quantity;
          });
        }
        
        if (item.weight) {
          initialWeights[item.id] = Number(item.weight);
        }
      });
      setLotAssignments(initial);
      setPesableWeights(initialWeights);
    } else {
      setLotAssignments({});
      setPesableWeights({});
    }
  }, [selectedOrder]);

  const fetchData = async () => {
    setErrorMsg(null);
    try {
      if (normalizedTab === 'prepare-orders') {
        const data = await api.getOrders();
        // Filtrar solo los pendientes y en preparación para picking
        const filtered = data.filter((o: any) => o.status === OrderStatus.PENDING || o.status === OrderStatus.PREPARING);
        setOrders(filtered);
        try {
          const lotsRes = await api.getExpiringLots();
          setExpiringLots(lotsRes.lots || []);
        } catch (lotErr) {
          console.error('Error al obtener lotes vencidos:', lotErr);
        }
      } else if (normalizedTab === 'stock-adjust') {
        const data = await api.getProducts(searchQuery);
        setProducts(data);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al obtener datos.');
    }
  };

  // --- LOGICA DE PICKING ---
  const handleStartPicking = async (orderId: number) => {
    setErrorMsg(null);
    try {
      await api.updateOrderStatus(orderId, OrderStatus.PREPARING);
      setSuccessMsg(`Pedido #${orderId} en preparación.`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al iniciar picking.');
    }
  };

  const handleLotQtyChange = (orderItemId: number, lotId: number, value: number, maxStock: number) => {
    const val = isNaN(value) || value < 0 ? 0 : value;
    const qty = val > maxStock ? maxStock : val;
    
    setLotAssignments(prev => ({
      ...prev,
      [orderItemId]: {
        ...(prev[orderItemId] || {}),
        [lotId]: qty
      }
    }));
  };

  const handleFIFOAutoFill = (item: any) => {
    const productLots = item.product?.lots || [];
    let remaining = item.quantity;
    const itemAssignments: { [lotId: number]: number } = {};

    // Asignar prioritariamente por fecha de vencimiento (los lotes ya vienen ordenados por vencimiento de menor a mayor)
    for (const lot of productLots) {
      if (remaining <= 0) break;
      const toTake = Math.min(lot.stock, remaining);
      if (toTake > 0) {
        itemAssignments[lot.id] = toTake;
        remaining -= toTake;
      }
    }

    setLotAssignments(prev => ({
      ...prev,
      [item.id]: itemAssignments
    }));
  };

  const handleFIFOAutoFillAll = () => {
    if (!selectedOrder) return;
    const newAssignments = { ...lotAssignments };
    
    selectedOrder.items.forEach((item: any) => {
      const productLots = item.product?.lots || [];
      let remaining = item.quantity;
      const itemAssignments: { [lotId: number]: number } = {};

      for (const lot of productLots) {
        if (remaining <= 0) break;
        const toTake = Math.min(lot.stock, remaining);
        if (toTake > 0) {
          itemAssignments[lot.id] = toTake;
          remaining -= toTake;
        }
      }
      newAssignments[item.id] = itemAssignments;
    });
    
    setLotAssignments(newAssignments);
  };

  const handleFinishPicking = async (orderId: number) => {
    setErrorMsg(null);
    
    // Validar asignaciones
    let isAllValid = true;
    const assignmentsPayload: any = {};
    
    for (const item of selectedOrder.items) {
      const itemAssignments = lotAssignments[item.id] || {};
      const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
      if (assignedSum !== item.quantity) {
        isAllValid = false;
        break;
      }
      
      assignmentsPayload[item.id] = Object.entries(itemAssignments)
        .filter(([_, qty]) => (qty as number) > 0)
        .map(([lotId, qty]) => ({
          lotId: Number(lotId),
          quantity: qty
        }));
    }

    if (!isAllValid) {
      setErrorMsg("Por favor, completá la asignación de lotes para todos los artículos. La cantidad asignada debe coincidir con la pedida.");
      return;
    }

    try {
      // 1. Enviar pesos exactos si existen
      const weightItems = Object.entries(pesableWeights).map(([orderItemId, weight]) => ({
        orderItemId: Number(orderItemId),
        weight: Number(weight)
      })).filter(i => i.weight > 0);
      
      if (weightItems.length > 0) {
        await api.updateOrderWeights(orderId, weightItems);
      }
      
      await api.updateOrderStatus(orderId, OrderStatus.PREPARED, assignmentsPayload);
      setSuccessMsg(`Pedido #${orderId} preparado correctamente. Esperando facturación.`);
      setSelectedOrder(null);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al finalizar picking.');
    }
  };

  // --- LOGICA DE AJUSTE DE STOCK ---
  const handleStockAdjustSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!stockModal.product || !stockModal.quantityChange) return;

    setErrorMsg(null);
    setSuccessMsg(null);
    setLoading(true);

    try {
      await api.adjustStock(
        stockModal.product.id,
        Number(stockModal.quantityChange),
        stockModal.reason || 'Ajuste manual depósito',
        stockModal.lotNumber || undefined,
        stockModal.isNewLot ? stockModal.expirationDate : undefined
      );
      setSuccessMsg(`Stock de ${stockModal.product.name} ajustado con éxito.`);
      setStockModal({
        open: false,
        product: null,
        quantityChange: 0,
        reason: '',
        lotNumber: '',
        isNewLot: false,
        expirationDate: ''
      });
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al ajustar stock.');
    } finally {
      setLoading(false);
    }
  };

  // Verificar si todas las asignaciones de todos los artículos son correctas para activar el cierre de bulto
  const isOrderFullyAssigned = selectedOrder?.items.every((item: any) => {
    const itemAssignments = lotAssignments[item.id] || {};
    const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
    return assignedSum === item.quantity;
  }) || false;

  return (
    <div style={{ width: '100%' }}>
      {errorMsg && (
        <div style={{
          backgroundColor: 'var(--accent-bg-light)',
          color: 'var(--accent-color)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          marginBottom: '20px',
          border: '1px solid rgba(227, 6, 19, 0.15)'
        }}>
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div style={{
          backgroundColor: 'var(--color-success-bg)',
          color: 'var(--color-success)',
          padding: '12px',
          borderRadius: 'var(--radius-sm)',
          fontSize: '0.85rem',
          marginBottom: '20px',
          border: '1px solid rgba(52, 199, 89, 0.15)'
        }} onClick={() => setSuccessMsg(null)}>
          {successMsg}
        </div>
      )}

      {/* ====================================================================
          1. PREPARACIÓN DE PEDIDOS (PICKING LIST)
          ==================================================================== */}
      {normalizedTab === 'prepare-orders' && (
        <div>
          {selectedOrder ? (
            <div className="card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <h3>Preparando Pedido #{selectedOrder.id}</h3>
                <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Regresar al Listado</button>
              </div>

              <div style={{ marginBottom: '20px', fontSize: '0.9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <p><strong>Cliente:</strong> {selectedOrder.client?.name}</p>
                  <p><strong>Dirección:</strong> {selectedOrder.client?.address || 'Retiro en depósito'}</p>
                </div>
                <div>
                  <p><strong>Fecha pedido:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString('es-AR')}</p>
                  <p><strong>Vendedor:</strong> {selectedOrder.seller?.username || 'S/D'}</p>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
                <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Lista de Artículos a Preparar (Picking List)</h4>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'var(--bg-secondary)' }}
                  onClick={handleFIFOAutoFillAll}
                >
                  ⚡ Auto-completar Todo (FIFO)
                </button>
              </div>
              
              <div className="table-container" style={{ border: '1px solid var(--border-color)', marginBottom: '20px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Artículo y Trazabilidad de Lotes</th>
                      <th>Cantidad Pedida</th>
                      <th>Stock General</th>
                      <th>Código SKU</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedOrder.items.map((item: any, idx: number) => {
                      const isLowStock = item.product ? item.product.stock < item.quantity : false;
                      const productLots = item.product?.lots || [];
                      const itemAssignments = lotAssignments[item.id] || {};
                      
                      const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
                      const isValidAssignment = assignedSum === item.quantity;
                      
                      return (
                        <tr key={idx} style={{ backgroundColor: isLowStock ? 'var(--accent-bg-light)' : 'transparent', borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '16px 12px' }}>
                            <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.product?.name}</div>
                            
                            {/* Selector de Lotes */}
                            <div style={{ 
                              backgroundColor: 'var(--bg-secondary)', 
                              padding: '12px', 
                              borderRadius: 'var(--radius-sm)', 
                              border: '1px solid var(--border-color)',
                              marginTop: '10px'
                            }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                                  Lotes Disponibles en Góndola:
                                </span>
                                <button 
                                  type="button" 
                                  className="btn btn-ghost" 
                                  style={{ padding: '2px 8px', fontSize: '0.75rem', height: 'auto', color: 'var(--accent-color)' }}
                                  onClick={() => handleFIFOAutoFill(item)}
                                >
                                  ⚡ Auto-completar (FIFO)
                                </button>
                              </div>
                              
                              {productLots.length === 0 ? (
                                <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)' }}>
                                  ⚠️ Sin lotes registrados en depósito. Ajustá stock y creá un lote primero.
                                </div>
                              ) : (
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                  {productLots.map((lot: any) => {
                                    const qty = itemAssignments[lot.id] || 0;
                                    return (
                                      <div key={lot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                        <span>
                                          <strong>Lote: {lot.lotNumber}</strong> (Físico: {lot.stock} u.) 
                                          <span style={{ color: 'var(--text-secondary)', marginLeft: '6px' }}>
                                            [Vence: {new Date(lot.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}]
                                          </span>
                                        </span>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                          <input
                                            type="number"
                                            className="input"
                                            style={{ width: '70px', padding: '4px 6px', fontSize: '0.8rem', height: '28px', textAlign: 'center' }}
                                            min={0}
                                            max={lot.stock}
                                            value={qty || ''}
                                            onChange={(e) => handleLotQtyChange(item.id, lot.id, Number(e.target.value), lot.stock)}
                                            placeholder="0"
                                          />
                                          <span style={{ color: 'var(--text-secondary)' }}>u.</span>
                                        </div>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                              
                              {/* Estado asignación */}
                              <div style={{ 
                                marginTop: '10px', 
                                display: 'flex', 
                                justifyContent: 'space-between', 
                                alignItems: 'center', 
                                fontSize: '0.8rem',
                                borderTop: '1px solid var(--border-color)',
                                paddingTop: '8px'
                              }}>
                                <span style={{ 
                                  fontWeight: 600, 
                                  color: isValidAssignment ? 'var(--color-success)' : 'var(--accent-color)' 
                                }}>
                                  {isValidAssignment ? '✓ Asignado correctamente' : `⚠️ Pendiente de asignación`}
                                </span>
                                <span style={{ fontWeight: 700 }}>
                                  {assignedSum} de {item.quantity} u.
                                </span>
                              </div>

                              {/* Input de peso exacto si es pesable */}
                              {item.product?.isPesable && (
                                <div style={{
                                  marginTop: '10px',
                                  paddingTop: '10px',
                                  borderTop: '1px solid var(--border-color)',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  alignItems: 'center'
                                }}>
                                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)' }}>
                                    ⚖️ Peso Exacto Total:
                                  </span>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                    <input
                                      type="number"
                                      step="0.001"
                                      className="input"
                                      style={{ width: '90px', textAlign: 'right' }}
                                      placeholder={item.product?.approximateWeight ? `Aprox: ${Number(item.quantity) * Number(item.product.approximateWeight)}` : "Ej: 4.250"}
                                      value={pesableWeights[item.id] || ''}
                                      onChange={(e) => setPesableWeights(prev => ({ ...prev, [item.id]: Number(e.target.value) }))}
                                    />
                                    <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Kg</span>
                                  </div>
                                </div>
                              )}
                            </div>
                          </td>
                          <td style={{ fontWeight: 700, verticalAlign: 'top', paddingTop: '16px' }}>{item.quantity} u.</td>
                          <td style={{ verticalAlign: 'top', paddingTop: '16px' }}>{item.product ? `${item.product.stock} u.` : 'S/D'}</td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', verticalAlign: 'top', paddingTop: '16px' }}>{item.product?.sku}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
                <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Cancelar Picking</button>
                <button 
                  className="btn btn-primary" 
                  onClick={() => handleFinishPicking(selectedOrder.id)}
                  disabled={!isOrderFullyAssigned}
                >
                  <Check size={16} />
                  <span>Marcar como Armado y Cerrar Bulto</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              {expiringLots.length > 0 && (
                <div className="card" style={{ 
                  backgroundColor: '#FFF2F2', 
                  border: '1px solid #FFD1D1', 
                  borderRadius: '8px', 
                  padding: '16px', 
                  marginBottom: '20px'
                }}>
                  <h4 style={{ margin: '0 0 8px 0', color: '#C0392B', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    ⚠️ Lotes Próximos a Vencer (Menos de 30 días)
                  </h4>
                  <div style={{ maxHeight: '160px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {expiringLots.map((lot) => {
                      const daysLeft = Math.ceil((new Date(lot.expirationDate).getTime() - new Date().getTime()) / (1000 * 3600 * 24));
                      const isExpired = daysLeft <= 0;
                      return (
                        <div key={lot.id} style={{ 
                          display: 'flex', 
                          justifyContent: 'space-between', 
                          alignItems: 'center', 
                          fontSize: '0.85rem', 
                          padding: '6px 10px', 
                          backgroundColor: '#fff', 
                          borderRadius: '4px',
                          borderLeft: isExpired ? '4px solid #C0392B' : '4px solid #F39C12'
                        }}>
                          <div>
                            <strong>{lot.product.name}</strong> <span style={{ color: 'var(--text-secondary)' }}>(SKU: {lot.product.sku})</span>
                            <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                              Lote: <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{lot.lotNumber}</span> | Vence: {new Date(lot.expirationDate).toLocaleDateString('es-AR')}
                            </div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ 
                              fontWeight: 'bold', 
                              color: isExpired ? '#C0392B' : '#E67E22', 
                              backgroundColor: isExpired ? '#FDEDEC' : '#FEF9E7',
                              padding: '2px 8px',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              display: 'inline-block',
                              marginBottom: '2px'
                            }}>
                              {isExpired ? 'VENCIDO' : `Vence en ${daysLeft} días`}
                            </span>
                            <div style={{ fontWeight: 600 }}>Stock: {lot.stock} u.</div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: '20px' }}>
                Pedidos en cola de distribución cargados por vendedores. Iniciá el picking para armar bultos físicos.
              </p>

              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th>Nro Pedido</th>
                      <th>Cliente</th>
                      <th>Items a preparar</th>
                      <th>Estado</th>
                      <th>Acción</th>
                    </tr>
                  </thead>
                  <tbody>
                    {orders.length === 0 ? (
                      <tr>
                        <td colSpan={5} style={{ textAlign: 'center', padding: '24px 0' }}>No hay pedidos pendientes de armado.</td>
                      </tr>
                    ) : (
                      orders.map((o) => (
                        <tr key={o.id}>
                          <td style={{ fontWeight: 700 }}>#{o.id}</td>
                          <td style={{ fontWeight: 600 }}>{o.client?.name}</td>
                          <td>{o.items.length} artículos distintos</td>
                          <td>
                            <span className={`badge ${o.status === 'PENDING' ? 'badge-pending' : 'badge-preparing'}`}>
                              {o.status === 'PENDING' ? 'Esperando Picking' : 'En Preparación'}
                            </span>
                          </td>
                          <td>
                            {o.status === 'PENDING' ? (
                              <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => handleStartPicking(o.id)}>
                                <Play size={12} />
                                <span>Iniciar Armado</span>
                              </button>
                            ) : (
                              <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setSelectedOrder(o)}>
                                <Eye size={12} />
                                <span>Ver Picking List</span>
                              </button>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ====================================================================
          2. CONTROL DE STOCK (DEPÓSITO)
          ==================================================================== */}
      {normalizedTab === 'stock-adjust' && (
        <div>
          <div className="actions-bar">
            <div className="search-input-wrapper">
              <input
                type="text"
                className="input"
                placeholder="Buscar por SKU, nombre o código de barra..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            <button className="btn btn-secondary" onClick={() => fetchData()}>
              <RefreshCw size={16} />
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Artículo</th>
                  <th>Lotes en Góndola</th>
                  <th>Stock Físico Total</th>
                  <th>Stock Mínimo</th>
                  <th>Estado</th>
                  <th>Ajuste</th>
                </tr>
              </thead>
              <tbody>
                {products.length === 0 ? (
                  <tr>
                    <td colSpan={7} style={{ textAlign: 'center', padding: '24px 0' }}>No se encontraron productos.</td>
                  </tr>
                ) : (
                  products.map((p) => {
                    const isLow = p.stock <= p.minStock;
                    const activeLots = (p.lots || []).filter((l: any) => l.stock > 0);
                    return (
                      <tr key={p.id}>
                        <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{p.sku}</td>
                        <td style={{ fontWeight: 500 }}>{p.name}</td>
                        <td>
                          {activeLots.length === 0 ? (
                            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sin lotes activos</span>
                          ) : (
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                              {activeLots.map((l: any) => (
                                <span key={l.id} className="badge" style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)', color: 'var(--text-primary)' }}>
                                  {l.lotNumber} ({l.stock} u. - V: {new Date(l.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })})
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 700, color: isLow ? 'var(--accent-color)' : 'inherit' }}>{p.stock} u.</td>
                        <td>{p.minStock} u.</td>
                        <td>
                          <span style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 500,
                            color: isLow ? 'var(--color-warning)' : 'var(--color-success)'
                          }}>
                            <span style={{
                              width: '8px',
                              height: '8px',
                              borderRadius: '50%',
                              backgroundColor: isLow ? 'var(--color-warning)' : 'var(--color-success)'
                            }} />
                            {isLow ? 'Stock Crítico' : 'Stock Saludable'}
                          </span>
                        </td>
                        <td>
                          <button className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem' }} onClick={() => setStockModal({ open: true, product: p, quantityChange: 0, reason: '', lotNumber: '', isNewLot: false, expirationDate: '' })}>
                            Modificar Stock
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* MODAL DE AJUSTE DE STOCK */}
      {stockModal.open && stockModal.product && (
        <div className="modal-overlay">
          <div className="modal-content">
            <div className="modal-header">
              <h3>Ajustar Stock Físico</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setStockModal({ open: false, product: null, quantityChange: 0, reason: '', lotNumber: '', isNewLot: false, expirationDate: '' })}>✕</button>
            </div>
            <form onSubmit={handleStockAdjustSubmit}>
              <div style={{ marginBottom: '16px', fontSize: '0.9rem' }}>
                <p><strong>Artículo:</strong> {stockModal.product.name}</p>
                <p><strong>SKU:</strong> {stockModal.product.sku}</p>
                <p><strong>Stock actual total:</strong> {stockModal.product.stock} u.</p>
              </div>

              <div className="form-group">
                <label>Cantidad a Sumar o Restar</label>
                <input
                  type="number"
                  className="input"
                  placeholder="Ej: 50 para sumar, -20 para restar"
                  value={stockModal.quantityChange || ''}
                  onChange={(e) => setStockModal({ ...stockModal, quantityChange: Number(e.target.value) })}
                  required
                />
              </div>

              {/* Selector de Lotes */}
              <div className="form-group">
                <label>Lote Asociado</label>
                <select
                  className="select"
                  value={stockModal.isNewLot ? '__new__' : stockModal.lotNumber}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '__new__') {
                      setStockModal({ ...stockModal, isNewLot: true, lotNumber: '', expirationDate: '' });
                    } else {
                      setStockModal({ ...stockModal, isNewLot: false, lotNumber: val, expirationDate: '' });
                    }
                  }}
                >
                  <option value="">Sin lote (Stock Genérico / General)</option>
                  {(stockModal.product.lots || []).map((lot: any) => (
                    <option key={lot.id} value={lot.lotNumber}>
                      Lote: {lot.lotNumber} (Stock: {lot.stock} u. - Vence: {new Date(lot.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })})
                    </option>
                  ))}
                  {Number(stockModal.quantityChange) > 0 && (
                    <option value="__new__">+ Crear nuevo lote...</option>
                  )}
                </select>
              </div>

              {stockModal.isNewLot && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Nro de Lote Nuevo</label>
                    <input
                      type="text"
                      className="input"
                      placeholder="Ej: L-VENC-01"
                      value={stockModal.lotNumber}
                      onChange={(e) => setStockModal({ ...stockModal, lotNumber: e.target.value })}
                      required
                    />
                  </div>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label>Fecha de Vencimiento</label>
                    <input
                      type="date"
                      className="input"
                      value={stockModal.expirationDate}
                      onChange={(e) => setStockModal({ ...stockModal, expirationDate: e.target.value })}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="form-group">
                <label>Motivo del Ajuste de Stock</label>
                <select 
                  className="select"
                  value={stockModal.reason}
                  onChange={(e) => setStockModal({ ...stockModal, reason: e.target.value })}
                  required
                >
                  <option value="">Seleccionar motivo...</option>
                  <option value="Ingreso de mercadería por compras">Ingreso de mercadería por compras</option>
                  <option value="Ajuste por inventario físico mensual">Ajuste por inventario físico mensual</option>
                  <option value="Rotura / Vencimiento de lote">Rotura / Vencimiento de lote</option>
                  <option value="Devolución de cliente">Devolución de cliente</option>
                </select>
              </div>

              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setStockModal({ open: false, product: null, quantityChange: 0, reason: '', lotNumber: '', isNewLot: false, expirationDate: '' })}>Cancelar</button>
                <button type="submit" className="btn btn-primary" disabled={loading}>
                  {loading ? 'Ajustando...' : 'Aplicar Ajuste'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
