import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { OrderStatus } from '../utils/types';
import { Play, Check, RefreshCw, Eye } from 'lucide-react';

interface DepositoDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

// Reproducción de sonido de éxito/error usando Web Audio API
const playBeep = (type: 'success' | 'error') => {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    
    if (type === 'success') {
      osc.frequency.setValueAtTime(880, ctx.currentTime); // Sonido agudo (La 5)
      gain.gain.setValueAtTime(0.08, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.12);
    } else {
      osc.frequency.setValueAtTime(220, ctx.currentTime); // Sonido grave (La 3)
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      osc.start();
      osc.stop(ctx.currentTime + 0.25);
    }
  } catch (e) {
    console.error('Audio context error:', e);
  }
};

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
  
  // WMS Picking States
  const [selectedZone, setSelectedZone] = useState<string>('ALL');
  const [showBultoModal, setShowBultoModal] = useState(false);
  const [bultosData, setBultosData] = useState({
    frio: 0,
    secos: 0,
    tabla: 0,
    cajasCerradas: 0
  });
  const [labelsToPrint, setLabelsToPrint] = useState<any[]>([]);

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

  // --- LOGICA DE ESCANEO DE CODIGO DE BARRA / SKU (PICKING MANOS LIBRES) ---
  const processScannedCode = (code: string) => {
    if (!selectedOrder) return;

    // Buscar coincidencia en productos del pedido
    const item = selectedOrder.items.find((i: any) => 
      i.product && (
        i.product.barcode === code || 
        i.product.sku === code || 
        i.product.name.toLowerCase() === code.toLowerCase()
      )
    );

    if (!item) {
      playBeep('error');
      setErrorMsg(`Producto con código o SKU "${code}" no pertenece a este pedido.`);
      return;
    }

    const productLots = item.product?.lots || [];
    if (productLots.length === 0) {
      playBeep('error');
      setErrorMsg(`El producto "${item.product.name}" no tiene lotes registrados en depósito.`);
      return;
    }

    const itemAssignments = { ...(lotAssignments[item.id] || {}) };
    const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);

    if (assignedSum >= item.quantity) {
      playBeep('error');
      setErrorMsg(`La cantidad para "${item.product.name}" ya está completamente asignada.`);
      return;
    }

    // FIFO: Asignar al primer lote con stock disponible
    let assigned = false;
    for (const lot of productLots) {
      const currentLotQty = itemAssignments[lot.id] || 0;
      if (lot.stock > currentLotQty) {
        itemAssignments[lot.id] = currentLotQty + 1;
        assigned = true;
        break;
      }
    }

    if (!assigned) {
      playBeep('error');
      setErrorMsg(`No hay suficiente stock físico en los lotes del producto "${item.product.name}".`);
      return;
    }

    setLotAssignments(prev => ({
      ...prev,
      [item.id]: itemAssignments
    }));

    playBeep('success');
    setSuccessMsg(`Escaneado: +1 u. de "${item.product.name}"`);
  };

  useEffect(() => {
    if (!selectedOrder) return;

    let buffer = '';
    let lastKeyTime = Date.now();

    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignorar entrada si está posicionado en algún input o select
      const activeEl = document.activeElement;
      if (activeEl && (activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.tagName === 'SELECT')) {
        return;
      }

      const now = Date.now();
      // Si el tiempo de separación entre teclas supera los 150ms, consideramos que es un nuevo escaneo
      if (now - lastKeyTime > 150) {
        buffer = '';
      }
      lastKeyTime = now;

      if (e.key === 'Enter') {
        const code = buffer.trim();
        if (code.length > 0) {
          processScannedCode(code);
        }
        buffer = '';
        e.preventDefault();
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedOrder, lotAssignments]);

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
      setSelectedZone('ALL');
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
    let hasShortages = false;
    let totalAssignedAll = 0;
    
    for (const item of selectedOrder.items) {
      const itemAssignments = lotAssignments[item.id] || {};
      const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
      
      if (assignedSum > item.quantity) {
        setErrorMsg(`La cantidad asignada para "${item.product?.name}" (${assignedSum}) excede la cantidad pedida (${item.quantity}).`);
        return;
      }
      
      if (assignedSum < item.quantity) {
        hasShortages = true;
      }
      totalAssignedAll += assignedSum;
    }

    if (totalAssignedAll === 0) {
      setErrorMsg("No podés finalizar el armado con 0 unidades asignadas en total.");
      return;
    }

    if (hasShortages) {
      const confirmShortage = window.confirm("Atención: Hay productos con faltantes (se asignó menos de la cantidad pedida). ¿Deseás continuar y cerrar el bulto con estos faltantes? El stock sobrante se liberará.");
      if (!confirmShortage) return;
    }

    // Inicializar sugerencias de bulto y abrir el modal
    let suggestedFrio = 0;
    let suggestedSecos = 0;
    let suggestedTabla = 0;
    let suggestedCajas = 0;

    selectedOrder.items.forEach((item: any) => {
      const itemZone = item.product?.rubro?.pickingZone || 'CAJAS';
      const unitsPerBox = item.product?.unitsPerBox || 1;
      
      const itemAssignments = lotAssignments[item.id] || {};
      const assignedQty = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
      
      if (assignedQty === 0) return; // No sugerir bultos si no se armó nada de este item

      if (unitsPerBox > 1 && assignedQty % unitsPerBox === 0) {
        suggestedCajas += (assignedQty / unitsPerBox);
      } else {
        if (itemZone === 'FRIO') suggestedFrio = 1; // Al menos 1 bandeja de frío si hay sueltos
        else if (itemZone === 'TABLA') suggestedTabla += 1;
        else suggestedSecos = 1; // Al menos 1 bandeja de secos si hay sueltos
      }
    });

    setBultosData({
      frio: suggestedFrio,
      secos: suggestedSecos,
      tabla: suggestedTabla,
      cajasCerradas: suggestedCajas
    });
    setShowBultoModal(true);
  };

  const handleConfirmBultosAndFinish = async () => {
    if (!selectedOrder) return;
    setErrorMsg(null);
    setLoading(true);

    const totalBultos = Number(bultosData.frio) + Number(bultosData.secos) + Number(bultosData.tabla) + Number(bultosData.cajasCerradas);
    if (totalBultos <= 0) {
      setErrorMsg("Debés ingresar al menos 1 bulto para finalizar el pedido.");
      setLoading(false);
      return;
    }

    // Armar asignaciones para payload
    const assignmentsPayload: any = {};
    for (const item of selectedOrder.items) {
      const itemAssignments = lotAssignments[item.id] || {};
      assignmentsPayload[item.id] = Object.entries(itemAssignments)
        .filter(([_, qty]) => (qty as number) > 0)
        .map(([lotId, qty]) => ({
          lotId: Number(lotId),
          quantity: qty
        }));
    }

    try {
      // 1. Enviar pesos exactos si existen
      const weightItems = Object.entries(pesableWeights).map(([orderItemId, weight]) => ({
        orderItemId: Number(orderItemId),
        weight: Number(weight)
      })).filter(i => i.weight > 0);
      
      if (weightItems.length > 0) {
        await api.updateOrderWeights(selectedOrder.id, weightItems);
      }
      
      // 2. Finalizar pedido enviando la cantidad de bultos y el desglose
      await api.updateOrderStatus(selectedOrder.id, OrderStatus.PREPARED, assignmentsPayload, totalBultos, bultosData);
      
      // 3. Generar etiquetas de bulto
      const generatedLabels: any[] = [];
      let index = 1;

      for (let i = 0; i < bultosData.frio; i++) {
        generatedLabels.push({
          index: index++,
          total: totalBultos,
          zone: '❄️ SECTOR FRÍO (FRACCIONADO)',
          client: selectedOrder.persona?.name || selectedOrder.client?.name || 'Cliente',
          route: selectedOrder.persona?.route || 'RETIRO EN DEPÓSITO',
          sequence: selectedOrder.persona?.routeSequence ? `VISITA #${selectedOrder.persona.routeSequence}` : 'S/D',
          orderId: selectedOrder.id
        });
      }
      for (let i = 0; i < bultosData.secos; i++) {
        generatedLabels.push({
          index: index++,
          total: totalBultos,
          zone: '📥 SECTOR SECOS (FRACCIONADO)',
          client: selectedOrder.persona?.name || selectedOrder.client?.name || 'Cliente',
          route: selectedOrder.persona?.route || 'RETIRO EN DEPÓSITO',
          sequence: selectedOrder.persona?.routeSequence ? `VISITA #${selectedOrder.persona.routeSequence}` : 'S/D',
          orderId: selectedOrder.id
        });
      }
      for (let i = 0; i < bultosData.tabla; i++) {
        generatedLabels.push({
          index: index++,
          total: totalBultos,
          zone: '🍾 BEBIDAS / TABLA (CONSOLID.)',
          client: selectedOrder.persona?.name || selectedOrder.client?.name || 'Cliente',
          route: selectedOrder.persona?.route || 'RETIRO EN DEPÓSITO',
          sequence: selectedOrder.persona?.routeSequence ? `VISITA #${selectedOrder.persona.routeSequence}` : 'S/D',
          orderId: selectedOrder.id
        });
      }
      for (let i = 0; i < bultosData.cajasCerradas; i++) {
        generatedLabels.push({
          index: index++,
          total: totalBultos,
          zone: '📦 CAJA CERRADA / ORIGINAL',
          client: selectedOrder.persona?.name || selectedOrder.client?.name || 'Cliente',
          route: selectedOrder.persona?.route || 'RETIRO EN DEPÓSITO',
          sequence: selectedOrder.persona?.routeSequence ? `VISITA #${selectedOrder.persona.routeSequence}` : 'S/D',
          orderId: selectedOrder.id
        });
      }

      setSuccessMsg(`Pedido #${selectedOrder.id} preparado con éxito. Se enviaron ${totalBultos} bultos.`);
      setShowBultoModal(false);
      setSelectedOrder(null);
      fetchData();

      // Iniciar el proceso de impresión
      if (generatedLabels.length > 0) {
        setLabelsToPrint(generatedLabels);
        setTimeout(() => {
          window.print();
          setLabelsToPrint([]);
        }, 500);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar detalles de bultos.');
    } finally {
      setLoading(false);
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

  // Verificar si todas las asignaciones de todos los artículos son menores o iguales a la pedida y hay al menos algo asignado
  const isOrderFullyAssigned = selectedOrder?.items.every((item: any) => {
    const itemAssignments = lotAssignments[item.id] || {};
    const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
    return assignedSum <= item.quantity;
  }) && selectedOrder?.items.some((item: any) => {
    const itemAssignments = lotAssignments[item.id] || {};
    const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
    return assignedSum > 0;
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
          {selectedOrder ? (() => {
            const filteredItems = selectedOrder.items.filter((item: any) => selectedZone === 'ALL' || (item.product?.rubro?.pickingZone || 'CAJAS') === selectedZone);
            const countZone = (zId: string) => {
              if (zId === 'ALL') return selectedOrder.items.length;
              return selectedOrder.items.filter((i: any) => (i.product?.rubro?.pickingZone || 'CAJAS') === zId).length;
            };

            const totalItemsCount = selectedOrder.items.length;
            const itemsPreparedCount = selectedOrder.items.filter((item: any) => {
              const itemAssignments = lotAssignments[item.id] || {};
              const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
              return assignedSum === item.quantity;
            }).length;
            const itemsPartialCount = selectedOrder.items.filter((item: any) => {
              const itemAssignments = lotAssignments[item.id] || {};
              const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
              return assignedSum > 0 && assignedSum < item.quantity;
            }).length;
            
            const progressPercent = totalItemsCount > 0 
              ? Math.round(((itemsPreparedCount + itemsPartialCount) / totalItemsCount) * 100) 
              : 0;

            return (
              <div className="card">
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                  <h3>Preparando Pedido #{selectedOrder.id}</h3>
                  <button className="btn btn-secondary" onClick={() => setSelectedOrder(null)}>Regresar al Listado</button>
                </div>

                <div style={{ marginBottom: '20px', fontSize: '0.9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                  <div>
                    <p><strong>Cliente:</strong> {selectedOrder.client?.name || selectedOrder.persona?.name}</p>
                    <p><strong>Dirección:</strong> {selectedOrder.client?.address || selectedOrder.persona?.address || 'Retiro en depósito'}</p>
                  </div>
                  <div>
                    <p><strong>Fecha pedido:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString('es-AR')}</p>
                    <p><strong>Vendedor:</strong> {selectedOrder.seller?.username || 'S/D'}</p>
                  </div>
                </div>

                {/* Barra de progreso de armado */}
                <div style={{ 
                  marginBottom: '24px', 
                  backgroundColor: 'var(--bg-secondary)', 
                  padding: '14px 18px', 
                  borderRadius: '6px', 
                  border: '1px solid var(--border-color)' 
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>
                      Progreso de Preparación
                    </span>
                    <span style={{ fontSize: '0.88rem', fontWeight: 800, color: progressPercent === 100 ? 'var(--color-success)' : 'var(--text-primary)' }}>
                      {itemsPreparedCount} listos, {itemsPartialCount} parciales de {totalItemsCount} productos ({progressPercent}%)
                    </span>
                  </div>
                  <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                    <div style={{ 
                      width: `${progressPercent}%`, 
                      height: '100%', 
                      backgroundColor: progressPercent === 100 ? 'var(--color-success)' : '#4A5568', 
                      transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' 
                    }} />
                  </div>
                </div>

                {/* Filtros de Sectores del Depósito */}
                <div style={{ 
                  display: 'flex', 
                  gap: '8px', 
                  marginBottom: '16px', 
                  borderBottom: '1px solid var(--border-color)',
                  paddingBottom: '12px',
                  flexWrap: 'wrap'
                }}>
                  {[
                    { id: 'ALL', label: '🌐 Todos los Sectores', color: '#1e293b' },
                    { id: 'FRIO', label: '❄️ Sector Frío', color: '#007AFF' },
                    { id: 'TABLA', label: '🍾 Sector Tabla/Bebidas', color: '#FF9500' },
                    { id: 'CAJAS', label: '📦 Sector Secos/Cajas', color: '#8E8E93' }
                  ].map(zone => {
                    const count = countZone(zone.id);
                    return (
                      <button
                        key={zone.id}
                        type="button"
                        className="btn"
                        style={{
                          padding: '6px 14px',
                          fontSize: '0.85rem',
                          borderRadius: '20px',
                          backgroundColor: selectedZone === zone.id ? zone.color : 'var(--bg-secondary)',
                          color: selectedZone === zone.id ? '#fff' : 'var(--text-primary)',
                          border: selectedZone === zone.id ? `1px solid ${zone.color}` : '1px solid var(--border-color)',
                          fontWeight: 600,
                          cursor: 'pointer',
                          transition: 'all 0.2s'
                        }}
                        onClick={() => setSelectedZone(zone.id)}
                      >
                        {zone.label} ({count})
                      </button>
                    );
                  })}
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
                      {filteredItems.map((item: any, idx: number) => {
                        const isLowStock = item.product ? item.product.stock < item.quantity : false;
                        const productLots = item.product?.lots || [];
                        const itemAssignments = lotAssignments[item.id] || {};
                        
                        const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
                        const isValidAssignment = assignedSum === item.quantity;
                        
                        const itemZone = item.product?.rubro?.pickingZone || 'CAJAS';
                        const unitsPerBox = item.product?.unitsPerBox || 1;
                        
                        // Determinar tipo de empaque para visualización
                        let packingType = '';
                        let badgeStyle: React.CSSProperties = {};
                        
                        if (unitsPerBox > 1 && item.quantity % unitsPerBox === 0) {
                          const boxes = item.quantity / unitsPerBox;
                          packingType = `📦 ${boxes} Caja(s) Cerrada(s)`;
                          badgeStyle = { backgroundColor: 'rgba(52, 199, 89, 0.08)', color: '#34C759', border: '1px solid rgba(52, 199, 89, 0.15)' };
                        } else {
                          if (itemZone === 'FRIO') {
                            packingType = '❄️ Fracc. Frío';
                            badgeStyle = { backgroundColor: 'rgba(0, 122, 255, 0.08)', color: '#007AFF', border: '1px solid rgba(0, 122, 255, 0.15)' };
                          } else if (itemZone === 'TABLA') {
                            packingType = '🍾 Tabla/Consol.';
                            badgeStyle = { backgroundColor: 'rgba(255, 149, 0, 0.08)', color: '#FF9500', border: '1px solid rgba(255, 149, 0, 0.15)' };
                          } else {
                            packingType = '📥 Fracc. Secos';
                            badgeStyle = { backgroundColor: 'rgba(142, 142, 147, 0.08)', color: '#8E8E93', border: '1px solid rgba(142, 142, 147, 0.15)' };
                          }
                        }

                        return (
                          <tr key={idx} style={{ backgroundColor: isLowStock ? 'var(--accent-bg-light)' : 'transparent', borderBottom: '1px solid var(--border-color)' }}>
                            <td style={{ 
                              padding: '16px 12px', 
                              borderLeft: assignedSum === item.quantity 
                                ? '4px solid var(--color-success)' 
                                : assignedSum > 0 
                                  ? '4px solid var(--color-warning)' 
                                  : '4px solid #CBD5E0',
                              transition: 'border-left-color 0.3s ease'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.product?.name}</span>
                                <span style={{
                                  padding: '2px 8px',
                                  borderRadius: '4px',
                                  fontSize: '0.7rem',
                                  fontWeight: 700,
                                  textTransform: 'uppercase',
                                  ...badgeStyle
                                }}>
                                  {packingType}
                                </span>
                              </div>
                            
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
                                  color: assignedSum === item.quantity 
                                    ? 'var(--color-success)' 
                                    : assignedSum > 0 
                                      ? 'var(--color-warning)' 
                                      : 'var(--accent-color)' 
                                }}>
                                  {assignedSum === item.quantity 
                                    ? '✓ Completado' 
                                    : assignedSum > 0 
                                      ? `⚠️ Armado parcial (Faltante de ${item.quantity - assignedSum} u.)` 
                                      : `⚠️ Pendiente de asignación`}
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
            );
          })() : (
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

      {/* MODAL DE CONTROL Y CIERRE DE BULTOS */}
      {showBultoModal && (
        <div className="modal-overlay">
          <div className="modal-content" style={{ maxWidth: '450px' }}>
            <div className="modal-header">
              <h3>Confirmación de Bultos Físicos</h3>
              <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setShowBultoModal(false)}>✕</button>
            </div>
            
            <div style={{ padding: '10px 0 20px 0' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
                Ingresá la cantidad de paquetes, bandejas o bultos armados para pegar las etiquetas de reparto:
              </p>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                
                {/* Bandejas de Frio */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>❄️</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Bandejas de Frío (Lácteos sueltos)</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Productos sueltos de heladera</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '70px', textAlign: 'center', fontWeight: 'bold' }}
                    min={0}
                    value={bultosData.frio || ''}
                    onChange={(e) => setBultosData({ ...bultosData, frio: Math.max(0, Number(e.target.value)) })}
                    placeholder="0"
                  />
                </div>

                {/* Bandejas de Secos */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📥</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Bandejas de Secos (Mercadería suelta)</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Paquetes o latas sueltas</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '70px', textAlign: 'center', fontWeight: 'bold' }}
                    min={0}
                    value={bultosData.secos || ''}
                    onChange={(e) => setBultosData({ ...bultosData, secos: Math.max(0, Number(e.target.value)) })}
                    placeholder="0"
                  />
                </div>

                {/* Atados de Tabla */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>🍾</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Bebidas / Tabla (Atados/Bolsones)</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Packs grandes o bolsas pesadas</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '70px', textAlign: 'center', fontWeight: 'bold' }}
                    min={0}
                    value={bultosData.tabla || ''}
                    onChange={(e) => setBultosData({ ...bultosData, tabla: Math.max(0, Number(e.target.value)) })}
                    placeholder="0"
                  />
                </div>

                {/* Cajas Cerradas */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: 'var(--bg-secondary)', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '1.2rem' }}>📦</span>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>Cajas Cerradas (Bultos cerrados)</div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Cajas originales de fábrica</span>
                    </div>
                  </div>
                  <input
                    type="number"
                    className="input"
                    style={{ width: '70px', textAlign: 'center', fontWeight: 'bold' }}
                    min={0}
                    value={bultosData.cajasCerradas || ''}
                    onChange={(e) => setBultosData({ ...bultosData, cajasCerradas: Math.max(0, Number(e.target.value)) })}
                    placeholder="0"
                  />
                </div>

              </div>
              
              <div style={{ marginTop: '20px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 600, fontSize: '1rem' }}>Total Bultos:</span>
                <span style={{ 
                  fontSize: '1.4rem', 
                  fontWeight: 800, 
                  backgroundColor: 'rgba(227, 6, 19, 0.08)', 
                  color: 'var(--accent-color)', 
                  padding: '2px 14px', 
                  borderRadius: '20px',
                  border: '1px solid rgba(227, 6, 19, 0.1)'
                }}>
                  {Number(bultosData.frio) + Number(bultosData.secos) + Number(bultosData.tabla) + Number(bultosData.cajasCerradas)}
                </span>
              </div>
            </div>

            <div className="modal-footer">
              <button type="button" className="btn btn-secondary" onClick={() => setShowBultoModal(false)}>Cancelar</button>
              <button 
                type="button" 
                className="btn btn-primary" 
                onClick={handleConfirmBultosAndFinish}
                disabled={loading || (Number(bultosData.frio) + Number(bultosData.secos) + Number(bultosData.tabla) + Number(bultosData.cajasCerradas)) <= 0}
              >
                {loading ? 'Finalizando...' : 'Confirmar y Generar Etiquetas 🖨️'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Contenedor de impresión de etiquetas térmicas */}
      {labelsToPrint.length > 0 && (
        <div className="print-only-layout" style={{ display: 'none' }}>
          {labelsToPrint.map((label, idx) => (
            <div key={idx} className="label-card" style={{
              width: '80mm',
              height: '80mm',
              border: '2px solid #000',
              padding: '16px',
              margin: '0 auto 20px auto',
              boxSizing: 'border-box',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
              fontFamily: 'monospace',
              fontSize: '11px',
              backgroundColor: '#fff',
              color: '#000',
              pageBreakAfter: 'always'
            }}>
              <div>
                <div style={{ borderBottom: '1px solid #000', paddingBottom: '6px', marginBottom: '8px', textAlign: 'center' }}>
                  <span style={{ fontSize: '14px', fontWeight: 'bold' }}>ARMADO DE PEDIDOS</span>
                </div>
                <div style={{ marginBottom: '6px' }}>
                  <strong>CLIENTE:</strong>
                  <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>{label.client}</div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
                  <div>
                    <strong>RUTA:</strong>
                    <div style={{ fontWeight: 'bold' }}>{label.route}</div>
                  </div>
                  <div>
                    <strong>ORDEN RUTA:</strong>
                    <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{label.sequence}</div>
                  </div>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
                  <div>
                    <strong>PEDIDO:</strong>
                    <div style={{ fontWeight: 'bold' }}>#{label.orderId}</div>
                  </div>
                  <div>
                    <strong>FECHA:</strong>
                    <div>{new Date().toLocaleDateString('es-AR')}</div>
                  </div>
                </div>
              </div>
              <div style={{ borderTop: '2px dashed #000', paddingTop: '10px', marginTop: '10px' }}>
                <div style={{ fontSize: '12px', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '4px', border: '1px solid #000', marginBottom: '6px' }}>
                  {label.zone}
                </div>
                <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}>
                  BULTO: {label.index} de {label.total}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          /* Ocultar todo el sitio principal para imprimir solo las etiquetas */
          body > * {
            display: none !important;
          }
          .print-only-layout {
            display: block !important;
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
          }
          .label-card {
            page-break-after: always;
            box-shadow: none !important;
            border: 2px solid #000 !important;
          }
        }
      `}} />
    </div>
  );
}
