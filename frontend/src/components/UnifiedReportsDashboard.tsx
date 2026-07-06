import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { BarChart2, DollarSign, Users, MapPin, Package, RefreshCw, TrendingUp, Sparkles } from 'lucide-react';
import CrmDashboard from './CrmDashboard';

interface UnifiedReportsDashboardProps {
  orders: any[];
  users: any[];
  clients: any[];
  products: any[];
  financialReport: any;
}

export default function UnifiedReportsDashboard({
  orders,
  users,
  clients,
  products,
  financialReport
}: UnifiedReportsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'finanzas' | 'vendedores' | 'zonas' | 'productos' | 'crm'>('finanzas');
  
  // Estados para Zonas
  const [zoneData, setZoneData] = useState<any>({ clients: [], totalClients: 0, totalDebt: 0 });
  const [zoneLoading, setZoneLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedSeller, setSelectedSeller] = useState<string>('');

  // Filtros para Vendedores
  const [sellerDateFilter, setSellerDateFilter] = useState<string>('all');
  const [sellerCityFilter, setSellerCityFilter] = useState<string>('all');
  const sellerCities = Array.from(new Set(clients.filter(c => c.city).map(c => c.city))).sort();

  // --- CÁLCULOS GENERALES ---
  const deliveredOrders = orders.filter((o: any) => o.status === 'DELIVERED');
  
  // 1. FINANZAS
  const totalFacturado = financialReport ? (financialReport.sales.official + financialReport.sales.internal) : 0;
  const officialSales = financialReport ? financialReport.sales.official : 0;
  const internalSales = financialReport ? financialReport.sales.internal : 0;
  const totalCostoEstimado = (officialSales * 0.65) + (internalSales * 0.60);
  const totalMargenNeto = totalFacturado - totalCostoEstimado;
  const pctMargenConsolidado = totalFacturado > 0 ? Math.round((totalMargenNeto / totalFacturado) * 100) : 0;
  const totalSalesSum = deliveredOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
  const ticketAverage = deliveredOrders.length > 0 ? totalSalesSum / deliveredOrders.length : 0;

  // 2. VENDEDORES
  const sellerUsers = users.filter((u: any) => u.role === 'VENDEDOR');
  const sellerPerformance = sellerUsers.map((seller: any) => {
    let sellerOrders = orders.filter((o: any) => o.sellerId === seller.id);
    
    if (sellerDateFilter === 'this_week') {
      const oneWeekAgo = new Date();
      oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
      sellerOrders = sellerOrders.filter((o: any) => new Date(o.createdAt) >= oneWeekAgo);
    } else if (sellerDateFilter === 'this_month') {
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
      sellerOrders = sellerOrders.filter((o: any) => new Date(o.createdAt) >= oneMonthAgo);
    }

    const completedOrders = sellerOrders.filter((o: any) => o.status === 'DELIVERED');
    const totalSales = completedOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
    const avgTicket = completedOrders.length > 0 ? totalSales / completedOrders.length : 0;
    
    let assignedClients = clients.filter((c: any) => c.sellerId === seller.id && c.isClient);
    
    if (sellerCityFilter !== 'all') {
      assignedClients = assignedClients.filter((c: any) => c.city === sellerCityFilter);
    }

    const visitedClients = assignedClients.filter((c: any) => 
      sellerOrders.some((o: any) => (o.personaId === c.id || o.clientId === c.id))
    );
    
    const visitEffectiveness = assignedClients.length > 0 
      ? Math.round((visitedClients.length / assignedClients.length) * 100) 
      : 0;

    let lastActivity = 'Sin actividad';
    if (completedOrders.length > 0) {
      const sorted = [...completedOrders].sort((a: any, b: any) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      const lastOrder = sorted[0];
      const clientName = lastOrder.client?.name || clients.find((c: any) => c.id === lastOrder.clientId)?.name || 'Cliente';
      lastActivity = `Visita: ${clientName}`;
    }

    // Generar recomendaciones
    let recommendation = '';
    if (assignedClients.length > 0 && visitEffectiveness < 50) {
      recommendation = `Visitar a más clientes (solo ${visitedClients.length} de ${assignedClients.length} visitados).`;
    } else if (completedOrders.length > 0 && avgTicket < ticketAverage * 0.7) {
      recommendation = `El ticket promedio (${Math.round(avgTicket)}) está por debajo de la media general. Fomentar upselling.`;
    } else if (totalSales === 0) {
      recommendation = `Sin ventas registradas en el período seleccionado.`;
    } else {
      recommendation = 'Buen rendimiento general.';
    }

    return {
      id: seller.id,
      username: seller.username,
      totalSales,
      ordersCount: sellerOrders.length,
      completedCount: completedOrders.length,
      avgTicket,
      assignedCount: assignedClients.length,
      visitedCount: visitedClients.length,
      effectiveness: visitEffectiveness,
      lastActivity,
      commission: totalSales * 0.05, // 5% neto
      recommendation
    };
  }).sort((a: any, b: any) => b.totalSales - a.totalSales);

  // 3. PRODUCTOS
  const productStatsMap: { [key: number]: { qty: number; revenue: number; name: string; sku: string; stock: number } } = {};
  products.forEach((p: any) => {
    productStatsMap[p.id] = { qty: 0, revenue: 0, name: p.name, sku: p.sku, stock: p.stock };
  });

  deliveredOrders.forEach((o: any) => {
    if (o.items && Array.isArray(o.items)) {
      o.items.forEach((item: any) => {
        const pId = item.productId;
        if (productStatsMap[pId]) {
          productStatsMap[pId].qty += Number(item.quantity);
          productStatsMap[pId].revenue += Number(item.subtotal || (item.quantity * (item.unitPrice || 0)));
        }
      });
    }
  });

  const productStatsList = Object.keys(productStatsMap).map((key: any) => ({
    id: Number(key),
    ...productStatsMap[key]
  }));

  const topProducts = [...productStatsList]
    .filter(p => p.qty > 0)
    .sort((a, b) => b.qty - a.qty)
    .slice(0, 10);

  const deadStockProducts = [...productStatsList]
    .filter(p => p.qty === 0 && p.stock > 0)
    .sort((a, b) => b.stock - a.stock);

  // Carga de datos de zonas
  const loadZoneData = async () => {
    setZoneLoading(true);
    try {
      const res = await api.getZoneReports({
        city: selectedCity,
        sellerId: selectedSeller ? Number(selectedSeller) : undefined
      });
      setZoneData(res);
      if (res.availableCities) setCities(res.availableCities);
      if (res.availableSellers) setSellers(res.availableSellers);
    } catch (err) {
      console.error(err);
    } finally {
      setZoneLoading(false);
    }
  };

  useEffect(() => {
    if (activeTab === 'zonas') {
      loadZoneData();
    }
  }, [activeTab, selectedCity, selectedSeller]);

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px' }}>
        <BarChart2 size={28} color="var(--color-primary)" />
        <h2 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>Reportes y Analíticas</h2>
      </div>

      {/* TABS INTERNOS */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
        {[
          { id: 'finanzas', label: 'Resumen Financiero', icon: <DollarSign size={16} /> },
          { id: 'vendedores', label: 'Rendimiento Vendedores', icon: <Users size={16} /> },
          { id: 'zonas', label: 'Análisis de Zonas', icon: <MapPin size={16} /> },
          { id: 'productos', label: 'Catálogo y Productos', icon: <Package size={16} /> },
          { id: 'crm', label: 'CRM + IA', icon: <Sparkles size={16} /> }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '8px 16px',
              backgroundColor: activeTab === tab.id ? 'var(--bg-light)' : 'transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              border: 'none',
              borderRadius: '8px',
              fontWeight: activeTab === tab.id ? 600 : 500,
              cursor: 'pointer',
              transition: 'background-color 0.2s'
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* CONTENIDO DE TABS */}
      
      {/* 1. FINANZAS */}
      {activeTab === 'finanzas' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>VENTAS FACTURADAS</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>${totalFacturado.toLocaleString()}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>{deliveredOrders.length} pedidos entregados</span>
            </div>
            <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>COSTO ESTIMADO</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#5f6368' }}>${totalCostoEstimado.toLocaleString()}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Costo ponderado de mercadería</span>
            </div>
            <div className="card" style={{ padding: '20px', borderRadius: '12px', borderLeft: '4px solid #137333' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>MARGEN NETO</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#137333' }}>${totalMargenNeto.toLocaleString()}</span>
                <span className="badge" style={{ backgroundColor: '#e6f4ea', color: '#137333', fontSize: '0.8rem', padding: '4px 8px' }}>{pctMargenConsolidado}%</span>
              </div>
            </div>
            <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>TICKET PROMEDIO</span>
              <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a73e8' }}>${Math.round(ticketAverage).toLocaleString()}</span>
            </div>
          </div>

          <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600, marginTop: 0, marginBottom: '16px' }}>Desglose por Sucursal/Canal</h4>
            <div className="table-container">
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Sucursal</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Vendido (Facturado)</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Costo Estimado</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Margen Neto</th>
                    <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>% Margen</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>Sucursal A (Oficial)</td>
                    <td style={{ padding: '12px' }}>${officialSales.toLocaleString()}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>${(officialSales * 0.65).toLocaleString()}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#137333' }}>${(officialSales * 0.35).toLocaleString()}</td>
                    <td style={{ padding: '12px' }}><span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8' }}>35%</span></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px', fontWeight: 600 }}>Sucursal X (Interno)</td>
                    <td style={{ padding: '12px' }}>${internalSales.toLocaleString()}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>${(internalSales * 0.60).toLocaleString()}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#137333' }}>${(internalSales * 0.40).toLocaleString()}</td>
                    <td style={{ padding: '12px' }}><span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8' }}>40%</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. VENDEDORES */}
      {activeTab === 'vendedores' && (
        <div className="fade-in card" style={{ padding: '24px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Rendimiento y Recomendaciones de Preventistas</h4>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              <select 
                value={sellerDateFilter} 
                onChange={(e) => setSellerDateFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-light)', color: 'var(--text-primary)', outline: 'none' }}
              >
                <option value="all">Histórico Completo</option>
                <option value="this_week">Últimos 7 días</option>
                <option value="this_month">Últimos 30 días</option>
              </select>

              <select 
                value={sellerCityFilter} 
                onChange={(e) => setSellerCityFilter(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '8px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-light)', color: 'var(--text-primary)', outline: 'none' }}
              >
                <option value="all">Todas las Localidades</option>
                {sellerCities.map((city: string) => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.85rem' }}>
                  <th style={{ padding: '12px' }}>Vendedor</th>
                  <th style={{ padding: '12px' }}>Ventas Totales</th>
                  <th style={{ padding: '12px' }}>Efectividad de Visitas</th>
                  <th style={{ padding: '12px' }}>Ticket Prom.</th>
                  <th style={{ padding: '12px' }}>Comisión Est.</th>
                  <th style={{ padding: '12px', width: '30%' }}>Recomendación Inteligente</th>
                </tr>
              </thead>
              <tbody>
                {sellerPerformance.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: 'center', padding: '20px' }}>No hay preventistas.</td></tr>
                ) : sellerPerformance.map((perf: any) => (
                  <tr key={perf.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '12px', fontWeight: 600 }}>
                      {perf.username}
                      <span style={{ display: 'block', fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400, marginTop: '4px' }}>
                        {perf.lastActivity}
                      </span>
                    </td>
                    <td style={{ padding: '12px', fontWeight: 700 }}>${perf.totalSales.toLocaleString()}</td>
                    <td style={{ padding: '12px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ flex: 1, backgroundColor: '#f0f0f0', height: '6px', borderRadius: '3px', width: '60px', overflow: 'hidden' }}>
                          <div style={{
                            backgroundColor: perf.effectiveness >= 80 ? 'var(--color-success)' : perf.effectiveness >= 50 ? '#f2994a' : 'var(--color-danger)',
                            height: '100%',
                            width: `${perf.effectiveness}%`
                          }} />
                        </div>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>{perf.effectiveness}%</span>
                      </div>
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '4px' }}>{perf.visitedCount} de {perf.assignedCount} clientes</div>
                    </td>
                    <td style={{ padding: '12px' }}>${Math.round(perf.avgTicket).toLocaleString()}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#137333' }}>${Math.round(perf.commission).toLocaleString()}</td>
                    <td style={{ padding: '12px', fontSize: '0.85rem' }}>
                      <div style={{ 
                        backgroundColor: perf.recommendation.includes('Buen') ? '#e6f4ea' : (perf.recommendation.includes('Sin ventas') ? '#fce8e6' : '#fef7e0'), 
                        color: perf.recommendation.includes('Buen') ? '#137333' : (perf.recommendation.includes('Sin ventas') ? '#c5221f' : '#b06000'),
                        padding: '8px 12px', 
                        borderRadius: '6px',
                        lineHeight: 1.4
                      }}>
                        {perf.recommendation}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 3. ZONAS */}
      {activeTab === 'zonas' && (
        <div className="fade-in">
          <div className="card" style={{ padding: '20px', borderRadius: '12px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Filtrar por Localidad</label>
                <select className="input-field" value={selectedCity} onChange={e => setSelectedCity(e.target.value)}>
                  <option value="">Todas las localidades</option>
                  {cities.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '200px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Filtrar por Vendedor</label>
                <select className="input-field" value={selectedSeller} onChange={e => setSelectedSeller(e.target.value)}>
                  <option value="">Todos los vendedores</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.username}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', alignItems: 'flex-end' }}>
                <button className="btn btn-secondary" onClick={loadZoneData} disabled={zoneLoading}>
                  <RefreshCw size={18} className={zoneLoading ? 'spin' : ''} />
                </button>
              </div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '20px' }}>
            <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
              <h4 style={{ fontSize: '1rem', margin: '0 0 16px 0' }}>Clientes en la Zona</h4>
              <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-primary)' }}>{zoneData.totalClients}</span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Clientes activos en esta área.</p>
            </div>
            <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
              <h4 style={{ fontSize: '1rem', margin: '0 0 16px 0' }}>Deuda Total en la Zona</h4>
              <span style={{ fontSize: '2.5rem', fontWeight: 700, color: 'var(--color-danger)' }}>${(zoneData.totalDebt || 0).toLocaleString()}</span>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem' }}>Saldo pendiente de cobro en esta área.</p>
            </div>
          </div>
        </div>
      )}

      {/* 4. PRODUCTOS */}
      {activeTab === 'productos' && (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
          
          <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 20px 0', color: '#137333', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <TrendingUp size={20} /> Productos Estrella (Top 10)
            </h4>
            {topProducts.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>No hay ventas registradas.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {topProducts.map((p, idx) => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.95rem' }}>
                        <span style={{ color: 'var(--text-secondary)', marginRight: '8px' }}>#{idx + 1}</span>
                        {p.name}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>SKU: {p.sku} | Stock: {p.stock}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>{p.qty} vendidos</div>
                      <div style={{ fontSize: '0.8rem', color: '#137333', fontWeight: 600 }}>${p.revenue.toLocaleString()}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 8px 0', color: 'var(--color-danger)' }}>
              ⚠️ Alerta de Stock Muerto (Cero Ventas)
            </h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '20px' }}>
              Estos productos tienen stock inmovilizado en depósito pero no registran ventas recientes. Se recomienda hacer promociones o descuentos.
            </p>
            {deadStockProducts.length === 0 ? (
              <p style={{ color: 'var(--text-secondary)' }}>Excelente. No hay stock inmovilizado.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', maxHeight: '500px', overflowY: 'auto', paddingRight: '8px' }}>
                {deadStockProducts.map(p => (
                  <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', backgroundColor: '#fcfcfc', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{p.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px' }}>SKU: {p.sku}</div>
                    </div>
                    <span className="badge" style={{ backgroundColor: '#FCE8E6', color: 'var(--color-danger)', fontSize: '0.85rem', fontWeight: 600 }}>
                      {p.stock} u en depósito
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      )}

      {/* 5. CRM + IA */}
      {activeTab === 'crm' && (
        <div className="fade-in">
          <CrmDashboard />
        </div>
      )}
    </div>
  );
}
