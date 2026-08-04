import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Printer, CheckSquare, Search, RefreshCw, Eye, CheckCircle, Zap } from 'lucide-react';
import { printPickingList, printOrderReceipt, printRemitoX, printFacturaOficialA4, printBatchPickingA4, printConsolidatedPickingA4, printShippingLabelsBultos } from '../../utils/printHelpers';
import OrderFulfillmentModal from '../modals/OrderFulfillmentModal';
import ConfirmModal from '../modals/ConfirmModal';
import { getOrderStatusInfo } from '../../utils/orderStatusHelper';

export default function FulfillmentDashboard() {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [fulfillmentModalOrder, setFulfillmentModalOrder] = useState<any | null>(null);

  // Filtros de oficina de administración
  const [selectedSeller, setSelectedSeller] = useState<string>('ALL');
  const [selectedRoute, setSelectedRoute] = useState<string>('ALL');
  const [selectedZone, setSelectedZone] = useState<string>('ALL');

  // Estado para diálogos ConfirmModal estilizados
  const [confirmState, setConfirmState] = useState<{
    isOpen: boolean;
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    isAlert?: boolean;
    onConfirm: () => void;
    onCancel: () => void;
  }>({
    isOpen: false,
    message: '',
    onConfirm: () => {},
    onCancel: () => {}
  });

  const showConfirm = ({
    title = 'Confirmar Acción',
    message,
    confirmText = 'Aceptar',
    cancelText = 'Cancelar',
    type = 'info',
    isAlert = false,
    onConfirm
  }: {
    title?: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'warning' | 'info' | 'success';
    isAlert?: boolean;
    onConfirm: () => void;
  }) => {
    setConfirmState({
      isOpen: true,
      title,
      message,
      confirmText,
      cancelText,
      type,
      isAlert,
      onConfirm: () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
        onConfirm();
      },
      onCancel: () => {
        setConfirmState(prev => ({ ...prev, isOpen: false }));
      }
    });
  };

  useEffect(() => {
    fetchOrders();
  }, []);

  const fetchOrders = async () => {
    setLoading(true);
    try {
      const data = await api.getOrders();
      setOrders(data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handlePrintPickingList = (order: any) => {
    printPickingList(order);
  };

  const handleRequestCae = async (orderId: number) => {
    try {
      setLoading(true);
      const res = await api.requestCaeForOrder(orderId);
      showConfirm({
        title: 'CAE Asignado con Éxito',
        message: res.message || 'El comprobante fue autorizado por AFIP.',
        type: 'success',
        isAlert: true,
        onConfirm: () => fetchOrders(),
      });
    } catch (err: any) {
      showConfirm({
        title: 'Error al solicitar CAE',
        message: err.message || 'Error al conectar con AFIP.',
        type: 'danger',
        isAlert: true,
        onConfirm: () => {},
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePrintReceipt = (order: any) => {
    printOrderReceipt(order);
  };

  // Obtener listas únicas para los selectores de filtros
  const uniqueSellers = Array.from(new Set(orders.map(o => o.seller?.username).filter(Boolean)));
  const uniqueRoutes = Array.from(new Set(orders.map(o => o.client?.city || o.persona?.city || o.client?.route || o.persona?.route).filter(Boolean)));

  // Filter and group
  const filteredOrders = orders.filter(o => {
    const q = searchQuery.toLowerCase();
    const matchesSearch = !searchQuery || (o.client?.name?.toLowerCase().includes(q) || String(o.id).includes(q));
    
    const sellerName = o.seller?.username || '';
    const matchesSeller = selectedSeller === 'ALL' || sellerName === selectedSeller;

    const routeName = o.client?.city || o.persona?.city || o.client?.route || o.persona?.route || '';
    const matchesRoute = selectedRoute === 'ALL' || routeName === selectedRoute;

    // Filtro por zona de armado
    const matchesZone = selectedZone === 'ALL' || (o.items || []).some((item: any) => {
      const zone = item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS';
      return zone === selectedZone;
    });

    return matchesSearch && matchesSeller && matchesRoute && matchesZone;
  });

  const getFilterLabel = () => {
    const filterLabelParts: string[] = [];
    if (selectedRoute !== 'ALL') filterLabelParts.push(`Ruta: ${selectedRoute}`);
    if (selectedSeller !== 'ALL') filterLabelParts.push(`Vendedor: ${selectedSeller}`);
    if (selectedZone !== 'ALL') filterLabelParts.push(`Zona: ${selectedZone}`);
    return filterLabelParts.length > 0 ? filterLabelParts.join(' | ') : 'Todos los Pedidos';
  };

  // Selección múltiple para armado A4
  const [selectedOrderIds, setSelectedOrderIds] = useState<number[]>([]);

  const toggleSelectOrder = (id: number) => {
    setSelectedOrderIds(prev =>
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAllPending = () => {
    const pendingIds = pending.map(o => o.id);
    const allSelected = pendingIds.length > 0 && pendingIds.every(id => selectedOrderIds.includes(id));
    if (allSelected) {
      setSelectedOrderIds(prev => prev.filter(id => !pendingIds.includes(id)));
    } else {
      setSelectedOrderIds(prev => Array.from(new Set([...prev, ...pendingIds])));
    }
  };

  const handleRevertToPending = async (orderId: number) => {
    try {
      await api.updateOrderStatus(orderId, 'PENDING' as any);
      fetchOrders();
    } catch (err) {
      console.error('Error al devolver pedido a pendientes:', err);
    }
  };

  const handleRevertAllPreparingToPending = () => {
    if (preparing.length === 0) return;
    showConfirm({
      title: 'Devolver a Pendientes',
      message: `¿Deseas devolver los ${preparing.length} pedidos de "En Picking" a la columna "Pendientes"?`,
      confirmText: 'Devolver Todos',
      cancelText: 'Cancelar',
      type: 'warning',
      onConfirm: async () => {
        try {
          await Promise.all(
            preparing.map(o => api.updateOrderStatus(o.id, 'PENDING' as any))
          );
          fetchOrders();
        } catch (err) {
          console.error('Error al devolver todos a pendientes:', err);
        }
      }
    });
  };

  const handlePrintBatchA4 = () => {
    const ordersToPrint = selectedOrderIds.length > 0
      ? pending.filter(o => selectedOrderIds.includes(o.id))
      : pending;

    if (ordersToPrint.length === 0) {
      showConfirm({
        title: 'Sin Pedidos Pendientes',
        message: 'No hay pedidos seleccionados o pendientes que coincidan con los filtros.',
        isAlert: true,
        confirmText: 'Entendido',
        type: 'info',
        onConfirm: () => {}
      });
      return;
    }

    printBatchPickingA4({
      orders: ordersToPrint,
      zone: selectedZone,
      filterLabel: getFilterLabel()
    });

    setTimeout(() => {
      showConfirm({
        title: 'Pasar a En Picking',
        message: `¿Deseas mover los ${ordersToPrint.length} pedidos impresos a la columna "En Picking"?`,
        confirmText: 'Pasar a Picking',
        cancelText: 'Mantener en Pendientes',
        type: 'info',
        onConfirm: async () => {
          await Promise.all(
            ordersToPrint.map(o => api.updateOrderStatus(o.id, 'PREPARING' as any))
          );
          setSelectedOrderIds([]);
          fetchOrders();
        }
      });
    }, 600);
  };

  const handlePrintConsolidated = () => {
    const ordersToPrint = selectedOrderIds.length > 0
      ? pending.filter(o => selectedOrderIds.includes(o.id))
      : pending;

    if (ordersToPrint.length === 0) {
      showConfirm({
        title: 'Sin Pedidos Pendientes',
        message: 'No hay pedidos pendientes para consolidar.',
        isAlert: true,
        confirmText: 'Entendido',
        type: 'info',
        onConfirm: () => {}
      });
      return;
    }

    printConsolidatedPickingA4({
      orders: ordersToPrint,
      zone: selectedZone,
      filterLabel: getFilterLabel()
    });
  };

  const handlePrintLabels = (singleOrder?: any) => {
    const ordersToPrint = singleOrder
      ? [singleOrder]
      : selectedOrderIds.length > 0
        ? pending.filter(o => selectedOrderIds.includes(o.id))
        : pending;

    if (ordersToPrint.length === 0) {
      showConfirm({
        title: 'Sin Pedidos',
        message: 'No hay pedidos seleccionados para imprimir rótulos de despacho.',
        isAlert: true,
        confirmText: 'Entendido',
        type: 'info',
        onConfirm: () => {}
      });
      return;
    }

    printShippingLabelsBultos({ orders: ordersToPrint });
  };

  const pending = filteredOrders.filter(o => o.status === 'PENDING' || o.status === 'RECIBIDO');
  const preparing = filteredOrders.filter(o => o.status === 'PREPARING' || (o.status === 'PREPARED' && !o.invoiceNumber));
  
  // Show only recently billed today
  const today = new Date().toLocaleDateString();
  const billedToday = filteredOrders.filter(o => 
    o.invoiceNumber && new Date(o.updatedAt).toLocaleDateString() === today
  );

  const renderCard = (o: any, column: 'PENDING' | 'PREPARING' | 'BILLED') => {
    const statusInfo = getOrderStatusInfo(o);
    const clientName = o.client?.name || o.persona?.name || 'Cliente sin Nombre';
    const isSelected = selectedOrderIds.includes(o.id);
    
    return (
      <div 
        key={o.id} 
        style={{
          background: isSelected ? '#F8FAFC' : 'var(--background-card)',
          borderRadius: '8px',
          padding: '8px 10px',
          border: isSelected ? '2px solid #6366F1' : '1px solid var(--border-color)',
          boxShadow: isSelected ? '0 2px 8px rgba(99, 102, 241, 0.12)' : '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          transition: 'all 0.15s ease',
          cursor: 'default'
        }}
        className="fulfillment-card"
      >
        {/* Linea 1: Checkbox (si es PENDING) + #Pedido + Nombre Cliente + Badge Estado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
            {column === 'PENDING' && (
              <input 
                type="checkbox"
                checked={isSelected}
                onChange={() => toggleSelectOrder(o.id)}
                style={{ 
                  cursor: 'pointer', 
                  width: '15px', 
                  height: '15px', 
                  accentColor: '#6366F1',
                  flexShrink: 0
                }}
                title="Seleccionar para imprimir en lote A4"
              />
            )}
            <span style={{ 
              fontWeight: 800, 
              fontSize: '0.78rem', 
              background: '#F1F5F9', 
              padding: '1px 6px', 
              borderRadius: '4px', 
              color: '#334155',
              border: '1px solid #E2E8F0',
              flexShrink: 0 
            }}>
              #{o.id}
            </span>
            <span 
              style={{ 
                fontWeight: 700, 
                fontSize: '0.86rem', 
                whiteSpace: 'nowrap', 
                overflow: 'hidden', 
                textOverflow: 'ellipsis',
                color: 'var(--text-main)' 
              }} 
              title={clientName}
            >
              {clientName}
            </span>
          </div>
          <span 
            className="badge" 
            style={{ 
              backgroundColor: statusInfo.color + '18', 
              color: statusInfo.color, 
              fontWeight: 700, 
              fontSize: '0.7rem',
              padding: '2px 7px',
              borderRadius: '10px',
              flexShrink: 0
            }}
          >
            {statusInfo.label}
          </span>
        </div>

        {/* Linea 2: Items + Ciudad/Ruta + Monto Total */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span>📦 {o.items?.length || 0} items</span>
            {(o.client?.city || o.persona?.city) && (
              <span style={{ fontSize: '0.75rem', opacity: 0.85 }}>📍 {o.client?.city || o.persona?.city}</span>
            )}
          </div>
          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: '#0F172A' }}>
            ${Math.round(Number(o.totalAmount)).toLocaleString('es-AR')}
          </div>
        </div>

        {/* Linea 3: Botones de Acción Elegantes */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          {column === 'PENDING' && (
            <>
              <button 
                className="btn btn-secondary" 
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  gap: '4px',
                  height: '26px',
                  padding: '0 6px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: '#F8FAFC',
                  borderColor: '#E2E8F0',
                  color: '#475569'
                }} 
                onClick={() => handlePrintPickingList(o)} 
                title="Imprimir Hoja de Armado"
              >
                <Printer size={13} /> Hoja
              </button>
              <button 
                className="btn btn-secondary" 
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  gap: '4px',
                  height: '26px',
                  padding: '0 6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: '#FEF3C7',
                  borderColor: '#F59E0B',
                  color: '#B45309'
                }} 
                onClick={() => handlePrintLabels(o)} 
                title="Imprimir Rótulos Térmicos de Bultos"
              >
                🏷️ Rótulo
              </button>
              <button 
                className="btn btn-primary" 
                style={{ 
                  flex: 1.2, 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  gap: '4px', 
                  height: '26px',
                  padding: '0 6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: '#6366F1', 
                  borderColor: '#6366F1',
                  color: '#FFFFFF'
                }} 
                onClick={() => setFulfillmentModalOrder(o)} 
                title="Facturar Directamente"
              >
                ⚡ Facturar
              </button>
            </>
          )}
          {column === 'PREPARING' && (
            <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
              <button 
                className="btn btn-secondary" 
                style={{ 
                  height: '26px',
                  padding: '0 8px',
                  fontSize: '0.74rem',
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  backgroundColor: '#F8FAFC',
                  borderColor: '#E2E8F0',
                  color: '#475569'
                }} 
                onClick={() => handleRevertToPending(o.id)}
                title="Devolver este pedido a la columna Pendientes"
              >
                ↩️ Volver
              </button>
              <button 
                className="btn btn-primary" 
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  justifyContent: 'center', 
                  alignItems: 'center', 
                  gap: '5px', 
                  height: '26px',
                  padding: '0 8px',
                  fontSize: '0.78rem',
                  fontWeight: 700,
                  backgroundColor: '#4F46E5', 
                  color: 'white', 
                  borderColor: '#4F46E5'
                }} 
                onClick={() => setFulfillmentModalOrder(o)}
              >
                <CheckSquare size={13} /> Confirmar Armado
              </button>
            </div>
          )}
          {column === 'BILLED' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', width: '100%' }}>
              {o.billingType === 'OFFICIAL' && !o.cae && (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '6px', padding: '4px 8px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#B45309', display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Zap size={12} /> PENDIENTE CAE (PRE-FACTURA)
                  </span>
                  <button
                    className="btn btn-primary"
                    style={{
                      height: '22px',
                      padding: '0 8px',
                      fontSize: '0.7rem',
                      fontWeight: 700,
                      backgroundColor: '#D97706',
                      borderColor: '#D97706',
                      color: 'white',
                      borderRadius: '4px'
                    }}
                    onClick={() => handleRequestCae(o.id)}
                    title="Solicitar CAE a AFIP ahora"
                  >
                    ⚡ Solicitar CAE
                  </button>
                </div>
              )}

              <div style={{ display: 'flex', gap: '6px', width: '100%' }}>
                {o.billingType === 'OFFICIAL' ? (
                  <button 
                    className="btn btn-secondary" 
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      gap: '4px',
                      height: '26px',
                      padding: '0 6px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      backgroundColor: '#F8FAFC',
                      borderColor: '#CBD5E1',
                      color: '#0F172A'
                    }} 
                    onClick={() => printFacturaOficialA4(o)}
                    title="Imprimir Factura Oficial A4"
                  >
                    📄 Factura A4
                  </button>
                ) : (
                  <button 
                    className="btn btn-secondary" 
                    style={{ 
                      flex: 1, 
                      display: 'flex', 
                      justifyContent: 'center', 
                      alignItems: 'center', 
                      gap: '4px',
                      height: '26px',
                      padding: '0 6px',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      backgroundColor: '#F8FAFC',
                      borderColor: '#CBD5E1',
                      color: '#0F172A'
                    }} 
                    onClick={() => printRemitoX(o)}
                    title="Imprimir Boleta Remito X en hoja A4"
                  >
                    📄 Boleta A4
                  </button>
                )}

                <button 
                  className="btn btn-secondary" 
                  style={{ 
                    flex: 1, 
                    display: 'flex', 
                    justifyContent: 'center', 
                    alignItems: 'center', 
                    gap: '4px',
                    height: '26px',
                    padding: '0 6px',
                    fontSize: '0.76rem',
                    fontWeight: 600,
                    backgroundColor: '#F8FAFC',
                    borderColor: '#CBD5E1',
                    color: '#475569'
                  }} 
                  onClick={() => handlePrintReceipt(o)}
                  title="Imprimir Ticket Térmico de 80mm"
                >
                  <Printer size={13} /> Ticket
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '0 12px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Barra de Control y Filtros Unificada de Alta Densidad */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '10px',
        alignItems: 'center',
        justifyContent: 'space-between',
        backgroundColor: 'var(--background-card)',
        padding: '8px 14px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        marginBottom: '12px'
      }}>
        {/* Titulo + Boton Recargar */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, letterSpacing: '-0.3px' }}>Armado & Facturación</h2>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', height: '28px', borderRadius: '6px' }} 
            onClick={fetchOrders} 
            disabled={loading}
            title="Recargar pedidos"
          >
            <RefreshCw size={13} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Buscador + Filtros In-Line */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div className="search-input-wrapper" style={{ position: 'relative' }}>
            <Search size={14} style={{ position: 'absolute', left: '8px', top: '7px', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              className="input" 
              placeholder="Buscar..." 
              style={{ paddingLeft: '28px', paddingRight: '8px', height: '28px', fontSize: '0.82rem', width: '150px' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>📍</span>
            <select
              className="input"
              style={{ padding: '3px 6px', height: '28px', fontSize: '0.82rem' }}
              value={selectedRoute}
              onChange={e => setSelectedRoute(e.target.value)}
            >
              <option value="ALL">Todas las Rutas</option>
              {uniqueRoutes.map((r: any) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>👤</span>
            <select
              className="input"
              style={{ padding: '3px 6px', height: '28px', fontSize: '0.82rem' }}
              value={selectedSeller}
              onChange={e => setSelectedSeller(e.target.value)}
            >
              <option value="ALL">Vendedores</option>
              {uniqueSellers.map((s: any) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>📦</span>
            <select
              className="input"
              style={{ padding: '3px 6px', height: '28px', fontSize: '0.82rem', fontWeight: 600 }}
              value={selectedZone}
              onChange={e => setSelectedZone(e.target.value)}
            >
              <option value="ALL">Zonas</option>
              <option value="FRIO">❄️ Frío</option>
              <option value="CAJAS">📦 Cajas</option>
              <option value="TABLA">🍾 Tabla</option>
            </select>
          </div>
        </div>

        {/* Botones de Impresión de Picking (Tonos Neutros con Violeta Tenue) */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#6366F1',
              borderColor: '#6366F1',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '0.82rem',
              height: '28px',
              padding: '0 12px',
              borderRadius: '6px',
              boxShadow: '0 2px 6px rgba(99, 102, 241, 0.2)'
            }}
            onClick={handlePrintBatchA4}
            title="Imprimir lote de pedidos seleccionados (máximo 8 por hoja A4)"
          >
            <Printer size={13} /> Lote A4 {selectedOrderIds.length > 0 ? `(${selectedOrderIds.length})` : ''}
          </button>

          <button
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#F8FAFC',
              borderColor: '#E2E8F0',
              color: '#334155',
              fontWeight: 700,
              fontSize: '0.82rem',
              height: '28px',
              padding: '0 12px',
              borderRadius: '6px'
            }}
            onClick={handlePrintConsolidated}
            title="Imprimir planilla de consolidado total por depósito"
          >
            <Printer size={13} /> Consolidado {selectedOrderIds.length > 0 ? `(${selectedOrderIds.length})` : ''}
          </button>

          <button
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#FEF3C7',
              borderColor: '#F59E0B',
              color: '#B45309',
              fontWeight: 800,
              fontSize: '0.82rem',
              height: '28px',
              padding: '0 12px',
              borderRadius: '6px'
            }}
            onClick={() => handlePrintLabels()}
            title="Imprimir rótulos térmicos adhesivos para los bultos"
          >
            🏷️ Rótulos Bultos {selectedOrderIds.length > 0 ? `(${selectedOrderIds.length})` : ''}
          </button>
        </div>
      </div>

      {/* Columnas Kanban de Alta Densidad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', flexGrow: 1, minHeight: 0 }}>
        {/* Columna Pendientes */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background-alt)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#6366F1' }} />
              Pendientes ({pending.length})
              {selectedOrderIds.length > 0 && (
                <span style={{
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  backgroundColor: '#EEF2FF',
                  color: '#4338CA',
                  border: '1px solid #C7D2FE',
                  padding: '1px 7px',
                  borderRadius: '10px',
                  marginLeft: '4px'
                }}>
                  {selectedOrderIds.length} sel.
                </span>
              )}
            </h3>

            {pending.length > 0 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 600, color: 'var(--text-secondary)' }}>
                  <input 
                    type="checkbox"
                    checked={pending.length > 0 && pending.every(o => selectedOrderIds.includes(o.id))}
                    onChange={toggleSelectAllPending}
                    style={{ accentColor: 'var(--accent-color, #111827)', cursor: 'pointer' }}
                  />
                  Todos
                </label>
              </div>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flexGrow: 1, paddingRight: '2px' }}>
            {pending.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '30px', fontSize: '0.85rem' }}>No hay pedidos pendientes.</div>
            ) : (
              pending.map(o => renderCard(o, 'PENDING'))
            )}
          </div>
        </div>

        {/* Columna En Picking */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background-alt)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
              En Picking ({preparing.length})
            </h3>
            {preparing.length > 0 && (
              <button
                className="btn btn-secondary"
                style={{
                  padding: '2px 8px',
                  fontSize: '0.72rem',
                  height: '24px',
                  borderRadius: '5px',
                  fontWeight: 600
                }}
                onClick={handleRevertAllPreparingToPending}
                title="Devolver todos los pedidos en picking a la columna Pendientes"
              >
                ↩️ Devolver Todos
              </button>
            )}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flexGrow: 1, paddingRight: '2px' }}>
            {preparing.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '30px', fontSize: '0.85rem' }}>No hay pedidos en preparación.</div>
            ) : (
              preparing.map(o => renderCard(o, 'PREPARING'))
            )}
          </div>
        </div>

        {/* Columna Facturados Hoy */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background-alt)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
              Facturados Hoy ({billedToday.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', overflowY: 'auto', flexGrow: 1, paddingRight: '2px' }}>
            {billedToday.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '30px', fontSize: '0.85rem' }}>Aún no hay facturaciones hoy.</div>
            ) : (
              billedToday.map(o => renderCard(o, 'BILLED'))
            )}
          </div>
        </div>
      </div>

      {fulfillmentModalOrder && (
        <OrderFulfillmentModal
          order={fulfillmentModalOrder}
          onClose={() => setFulfillmentModalOrder(null)}
          onSuccess={() => {
            setFulfillmentModalOrder(null);
            fetchOrders();
          }}
        />
      )}

      <ConfirmModal {...confirmState} />
      
      <style>{`
        .fulfillment-card:hover {
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,0,0,0.05) !important;
        }
        .spin {
          animation: spin 1s linear infinite;
        }
        @keyframes spin { 100% { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
