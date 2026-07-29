import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Printer, CheckSquare, Search, RefreshCw, Eye, CheckCircle } from 'lucide-react';
import { printPickingList, printOrderReceipt, printBatchPickingA4, printConsolidatedPickingA4 } from '../../utils/printHelpers';
import OrderFulfillmentModal from '../modals/OrderFulfillmentModal';
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

  useEffect(() => {
    fetchOrders();

    // Listen for print success to move orders from PENDING to PREPARING (En Picking)
    const handleMessage = async (event: MessageEvent) => {
      if (event.data?.type === 'PRINT_SUCCESS' && event.data?.orderId) {
        await api.updateOrderStatus(event.data.orderId, 'PREPARING' as any);
        fetchOrders();
      } else if (event.data?.type === 'PRINT_BATCH_SUCCESS' && Array.isArray(event.data?.orderIds)) {
        await Promise.all(
          event.data.orderIds.map((id: number) => api.updateOrderStatus(id, 'PREPARING' as any))
        );
        fetchOrders();
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
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

  const handlePrintBatchA4 = () => {
    if (pending.length === 0) {
      alert('No hay pedidos pendientes que coincidan con los filtros seleccionados.');
      return;
    }

    printBatchPickingA4({
      orders: pending,
      zone: selectedZone,
      filterLabel: getFilterLabel()
    });
  };

  const handlePrintConsolidated = () => {
    if (pending.length === 0) {
      alert('No hay pedidos pendientes para consolidar.');
      return;
    }

    printConsolidatedPickingA4({
      orders: pending,
      zone: selectedZone,
      filterLabel: getFilterLabel()
    });
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
    
    return (
      <div 
        key={o.id} 
        style={{
          background: 'var(--background-card)',
          borderRadius: '8px',
          padding: '8px 10px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '5px',
          transition: 'all 0.15s ease',
          cursor: 'default'
        }}
        className="fulfillment-card"
      >
        {/* Linea 1: #Pedido + Nombre Cliente + Badge Estado */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '6px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', overflow: 'hidden', minWidth: 0 }}>
            <span style={{ 
              fontWeight: 800, 
              fontSize: '0.78rem', 
              background: 'var(--background-alt)', 
              padding: '1px 6px', 
              borderRadius: '4px', 
              color: 'var(--text-main)',
              border: '1px solid var(--border-color)',
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
          <div style={{ fontWeight: 800, fontSize: '0.88rem', color: 'var(--text-main)' }}>
            ${Math.round(Number(o.totalAmount)).toLocaleString('es-AR')}
          </div>
        </div>

        {/* Linea 3: Botones de Acción Compactos */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '2px' }}>
          {column === 'PENDING' && (
            <>
              <button 
                className="btn btn-secondary" 
                style={{ 
                  flex: 1, 
                  display: 'flex', 
                  justify: 'center', 
                  alignItems: 'center', 
                  gap: '4px',
                  height: '26px',
                  padding: '0 6px',
                  fontSize: '0.75rem',
                  fontWeight: 600
                }} 
                onClick={() => handlePrintPickingList(o)} 
                title="Imprimir Hoja de Armado"
              >
                <Printer size={13} /> Hoja
              </button>
              <button 
                className="btn btn-primary" 
                style={{ 
                  flex: 1.2, 
                  display: 'flex', 
                  justify: 'center', 
                  alignItems: 'center', 
                  gap: '4px', 
                  height: '26px',
                  padding: '0 6px',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  backgroundColor: '#4F46E5', 
                  borderColor: '#4F46E5' 
                }} 
                onClick={() => setFulfillmentModalOrder(o)} 
                title="Facturar Directamente"
              >
                ⚡ Facturar
              </button>
            </>
          )}
          {column === 'PREPARING' && (
            <button 
              className="btn btn-primary" 
              style={{ 
                flex: 1, 
                display: 'flex', 
                justify: 'center', 
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
          )}
          {column === 'BILLED' && (
            <button 
              className="btn btn-secondary" 
              style={{ 
                flex: 1, 
                display: 'flex', 
                justify: 'center', 
                alignItems: 'center', 
                gap: '5px',
                height: '26px',
                padding: '0 8px',
                fontSize: '0.78rem',
                fontWeight: 600 
              }} 
              onClick={() => handlePrintReceipt(o)}
            >
              <Printer size={13} /> Ticket
            </button>
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
        justify: 'space-between',
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

        {/* Botones de Impresión de Picking Premium */}
        <div style={{ display: 'flex', gap: '6px' }}>
          <button
            className="btn btn-primary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#007AFF',
              borderColor: '#007AFF',
              fontWeight: 700,
              fontSize: '0.82rem',
              height: '28px',
              padding: '0 10px'
            }}
            onClick={handlePrintBatchA4}
            title="Imprimir lote de pedidos (máximo 8 por hoja A4)"
          >
            <Printer size={13} /> 🖨️ Lote A4
          </button>

          <button
            className="btn btn-secondary"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              backgroundColor: '#059669',
              borderColor: '#059669',
              color: 'white',
              fontWeight: 700,
              fontSize: '0.82rem',
              height: '28px',
              padding: '0 10px'
            }}
            onClick={handlePrintConsolidated}
            title="Imprimir planilla de consolidado total por depósito"
          >
            <Printer size={13} /> 📌 Consolidado
          </button>
        </div>
      </div>

      {/* Columnas Kanban de Alta Densidad */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '14px', flexGrow: 1, minHeight: 0 }}>
        {/* Columna Pendientes */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background-alt)', borderRadius: '10px', padding: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span style={{ display: 'inline-block', width: '8px', height: '8px', borderRadius: '50%', backgroundColor: 'var(--accent-color)' }} />
              Pendientes ({pending.length})
            </h3>
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
