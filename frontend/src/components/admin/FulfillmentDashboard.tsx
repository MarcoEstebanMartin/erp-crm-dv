import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { Printer, CheckSquare, Search, RefreshCw, Eye, CheckCircle } from 'lucide-react';
import { printPickingList, printOrderReceipt, printBatchPickingA4 } from '../../utils/printHelpers';
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

    // Listen for print success to move to PREPARING
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'PRINT_SUCCESS' && event.data?.orderId) {
        api.updateOrderStatus(event.data.orderId, 'PREPARING' as any).then(() => fetchOrders());
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

  const handlePrintBatchA4 = () => {
    if (pending.length === 0) {
      alert('No hay pedidos pendientes que coincidan con los filtros seleccionados.');
      return;
    }

    const filterLabelParts: string[] = [];
    if (selectedRoute !== 'ALL') filterLabelParts.push(`Ruta: ${selectedRoute}`);
    if (selectedSeller !== 'ALL') filterLabelParts.push(`Vendedor: ${selectedSeller}`);
    if (selectedZone !== 'ALL') filterLabelParts.push(`Zona: ${selectedZone}`);
    
    const filterLabel = filterLabelParts.length > 0 ? filterLabelParts.join(' | ') : 'Todos los Pedidos';

    printBatchPickingA4({
      orders: pending,
      zone: selectedZone,
      filterLabel
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
    
    return (
      <div 
        key={o.id} 
        style={{
          background: 'var(--background-card)',
          borderRadius: '8px',
          padding: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: '0 2px 4px rgba(0,0,0,0.02)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          transition: 'all 0.2s',
          cursor: 'default'
        }}
        className="fulfillment-card"
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{o.client?.name}</div>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Pedido #{o.id}</div>
          </div>
          <span className="badge" style={{ backgroundColor: statusInfo.color + '15', color: statusInfo.color, fontWeight: 600 }}>
            {statusInfo.label}
          </span>
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
          <div>Items: {o.items?.length || 0}</div>
          <div>${Math.round(Number(o.totalAmount)).toLocaleString('es-AR')}</div>
        </div>

        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '12px', display: 'flex', gap: '8px' }}>
          {column === 'PENDING' && (
            <>
              <button className="btn btn-secondary" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '6px' }} onClick={() => handlePrintPickingList(o)} title="Imprimir Hoja de Armado">
                <Printer size={16} /> Hoja
              </button>
              <button className="btn btn-primary" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '6px', backgroundColor: '#4F46E5', borderColor: '#4F46E5' }} onClick={() => setFulfillmentModalOrder(o)} title="Facturar Directamente">
                Facturar Rápid.
              </button>
            </>
          )}
          {column === 'PREPARING' && (
            <button className="btn btn-secondary" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '6px', backgroundColor: '#4F46E5', color: 'white', borderColor: '#4F46E5' }} onClick={() => setFulfillmentModalOrder(o)}>
              <CheckSquare size={16} /> Confirmar Armado
            </button>
          )}
          {column === 'BILLED' && (
            <button className="btn btn-secondary" style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: '6px' }} onClick={() => handlePrintReceipt(o)}>
              <Printer size={16} /> Comprobante
            </button>
          )}
        </div>
      </div>
    );
  };

  return (
    <div style={{ padding: '0 16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 600 }}>Centro de Armado y Facturación</h2>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Gestión unificada de pedidos para el depósito.</p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <div className="search-input-wrapper">
            <Search size={16} style={{ position: 'absolute', left: '10px', top: '10px', color: 'var(--text-secondary)' }} />
            <input 
              type="text" 
              className="input" 
              placeholder="Buscar pedido..." 
              style={{ paddingLeft: '34px', width: '250px' }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <button className="btn btn-secondary" onClick={fetchOrders} disabled={loading}>
            <RefreshCw size={16} className={loading ? 'spin' : ''} />
          </button>
      {/* Barra de Filtros Operativos de Administración */}
      <div style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '12px',
        alignItems: 'center',
        justify: 'space-between',
        backgroundColor: 'var(--background-card)',
        padding: '12px 16px',
        borderRadius: '10px',
        border: '1px solid var(--border-color)',
        marginBottom: '16px'
      }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
          {/* Filtro Ruta / Localidad */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>📍 Ruta:</span>
            <select
              className="input"
              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              value={selectedRoute}
              onChange={e => setSelectedRoute(e.target.value)}
            >
              <option value="ALL">Todas las Rutas</option>
              {uniqueRoutes.map((r: any) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Filtro Vendedor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>👤 Vendedor:</span>
            <select
              className="input"
              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
              value={selectedSeller}
              onChange={e => setSelectedSeller(e.target.value)}
            >
              <option value="ALL">Todos los Vendedores</option>
              {uniqueSellers.map((s: any) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          {/* Filtro Zona de Armado */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>📦 Zona:</span>
            <select
              className="input"
              style={{ padding: '6px 10px', fontSize: '0.85rem', fontWeight: 600 }}
              value={selectedZone}
              onChange={e => setSelectedZone(e.target.value)}
            >
              <option value="ALL">🌟 Todas las Zonas</option>
              <option value="FRIO">❄️ Sector Frío</option>
              <option value="CAJAS">📦 Sector Cajas / Secos</option>
              <option value="TABLA">🍾 Sector Tabla / Bebidas</option>
            </select>
          </div>
        </div>

        {/* Botón Imprimir Hoja A4 2 Columnas */}
        <button
          className="btn btn-primary"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            backgroundColor: '#007AFF',
            borderColor: '#007AFF',
            fontWeight: 700,
            fontSize: '0.88rem',
            padding: '8px 16px'
          }}
          onClick={handlePrintBatchA4}
          title="Imprime los pedidos filtrados agrupados en 2 columnas en hoja A4"
        >
          <Printer size={16} /> 🖨️ Imprimir Lote A4 (2 Col)
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', flexGrow: 1, minHeight: 0 }}>
        {/* Columna Pendientes */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background-alt)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--accent-color)' }} />
              Pendientes ({pending.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1, paddingRight: '4px' }}>
            {pending.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>No hay pedidos pendientes.</div>
            ) : (
              pending.map(o => renderCard(o, 'PENDING'))
            )}
          </div>
        </div>

        {/* Columna En Picking */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background-alt)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: '#F59E0B' }} />
              En Picking ({preparing.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1, paddingRight: '4px' }}>
            {preparing.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>No hay pedidos en preparación.</div>
            ) : (
              preparing.map(o => renderCard(o, 'PREPARING'))
            )}
          </div>
        </div>

        {/* Columna Facturados Hoy */}
        <div style={{ display: 'flex', flexDirection: 'column', background: 'var(--background-alt)', borderRadius: '12px', padding: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ display: 'inline-block', width: '10px', height: '10px', borderRadius: '50%', backgroundColor: 'var(--color-success)' }} />
              Facturados Hoy ({billedToday.length})
            </h3>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', flexGrow: 1, paddingRight: '4px' }}>
            {billedToday.length === 0 ? (
              <div style={{ textAlign: 'center', color: 'var(--text-secondary)', marginTop: '40px' }}>Aún no hay facturaciones hoy.</div>
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
