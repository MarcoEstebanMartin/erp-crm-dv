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
  users: _users,
  clients: _clients,
  products,
  financialReport
}: UnifiedReportsDashboardProps) {
  const [activeTab, setActiveTab] = useState<'finanzas' | 'zonas' | 'crm'>('finanzas');
  
  // Estados para Zonas
  const [zoneData, setZoneData] = useState<any>({
    clients: [],
    totalClients: 0,
    totalDebt: 0,
    topClients: [],
    clientsWithMovements: [],
    topProducts: [],
    bottomProducts: [],
    weeklyInvoicing: []
  });
  const [zoneLoading, setZoneLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citiesDropdownOpen, setCitiesDropdownOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [hoveredWeekIdx, setHoveredWeekIdx] = useState<number | null>(null);
  
  // Date states for Zonas
  const [zoneDatePreset, setZoneDatePreset] = useState<string>('all');
  const [zoneStartDate, setZoneStartDate] = useState<string>('');
  const [zoneEndDate, setZoneEndDate] = useState<string>('');
  const [bottomProductsTab, setBottomProductsTab] = useState<'lento' | 'sin_ventas'>('lento');

  // Filtros y paginación para la tabla de Clientes con Movimientos
  const [clientSearch, setClientSearch] = useState<string>('');
  const [clientPage, setClientPage] = useState<number>(1);

  useEffect(() => {
    setClientPage(1);
    setClientSearch('');
  }, [selectedCities, selectedSeller, zoneDatePreset, zoneStartDate, zoneEndDate]);

  // --- CÁLCULOS GENERALES ---
  const deliveredOrders = orders.filter((o: any) => o.status === 'DELIVERED');
  
  // 1. FINANZAS
  const totalFacturado = financialReport ? (financialReport.sales.official + financialReport.sales.internal) : 0;
  const officialSales = financialReport ? financialReport.sales.official : 0;
  const internalSales = financialReport ? financialReport.sales.internal : 0;
  const totalCostoEstimado = (officialSales * 0.75) + (internalSales * 0.73);
  const totalMargenNeto = totalFacturado - totalCostoEstimado;
  const pctMargenConsolidado = totalFacturado > 0 ? Math.round((totalMargenNeto / totalFacturado) * 100) : 0;
  const totalSalesSum = deliveredOrders.reduce((sum: number, o: any) => sum + Number(o.totalAmount), 0);
  const ticketAverage = deliveredOrders.length > 0 ? totalSalesSum / deliveredOrders.length : 0;
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



  // Carga de datos de zonas
  const loadZoneData = async () => {
    setZoneLoading(true);
    try {
      let startStr: string | undefined = undefined;
      let endStr: string | undefined = undefined;

      const now = new Date();
      if (zoneDatePreset === 'this_week') {
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 3600 * 1000);
        startStr = sevenDaysAgo.toISOString().split('T')[0];
        endStr = now.toISOString().split('T')[0];
      } else if (zoneDatePreset === 'last_30_days') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 3600 * 1000);
        startStr = thirtyDaysAgo.toISOString().split('T')[0];
        endStr = now.toISOString().split('T')[0];
      } else if (zoneDatePreset === 'this_month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1);
        startStr = firstDay.toISOString().split('T')[0];
        endStr = now.toISOString().split('T')[0];
      } else if (zoneDatePreset === 'last_month') {
        const firstDay = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        const lastDay = new Date(now.getFullYear(), now.getMonth(), 0);
        startStr = firstDay.toISOString().split('T')[0];
        endStr = lastDay.toISOString().split('T')[0];
      } else if (zoneDatePreset === 'custom') {
        if (zoneStartDate) startStr = zoneStartDate;
        if (zoneEndDate) endStr = zoneEndDate;
      }

      const res = await api.getZoneReports({
        cities: selectedCities,
        sellerId: selectedSeller ? Number(selectedSeller) : undefined,
        startDate: startStr,
        endDate: endStr
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
  }, [activeTab, selectedCities, selectedSeller, zoneDatePreset, zoneStartDate, zoneEndDate]);

  // Helper calculations for Zone Analysis
  const zoneTopProducts = zoneData.topProducts || [];
  const zoneBottomProducts = zoneData.bottomProducts || [];
  const zoneDeadStockProducts = zoneData.deadStockProducts || [];
  const zoneWeeklyInvoicing = zoneData.weeklyInvoicing || [];

  const totalInvoicedInZone = zoneWeeklyInvoicing.reduce((sum: number, w: any) => sum + (w.total || 0), 0);
  const totalOrdersInZone = zoneWeeklyInvoicing.reduce((sum: number, w: any) => sum + (w.count || 0), 0);
  const avgTicketInZone = totalOrdersInZone > 0 ? Math.round(totalInvoicedInZone / totalOrdersInZone) : 0;

  // Find max weekly amount for chart height scaling
  const maxWeeklyAmount = Math.max(...zoneWeeklyInvoicing.map((w: any) => w.total || 0), 1);

  // Determine which week's details to show (hovered one, or default to the latest one)
  const activeWeek = hoveredWeekIdx !== null && zoneWeeklyInvoicing[hoveredWeekIdx] 
    ? zoneWeeklyInvoicing[hoveredWeekIdx] 
    : zoneWeeklyInvoicing[zoneWeeklyInvoicing.length - 1];

  const formatWeekLabel = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    const date = new Date(Number(year), Number(month) - 1, Number(day));
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    return `${date.getDate()} ${months[date.getMonth()]}`;
  };

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
          { id: 'zonas', label: 'Análisis de Zonas', icon: <MapPin size={16} /> },
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
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>${(officialSales * 0.75).toLocaleString()}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#137333' }}>${(officialSales * 0.25).toLocaleString()}</td>
                    <td style={{ padding: '12px' }}><span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8' }}>25%</span></td>
                  </tr>
                  <tr>
                    <td style={{ padding: '12px', fontWeight: 600 }}>Sucursal X (Interno)</td>
                    <td style={{ padding: '12px' }}>${internalSales.toLocaleString()}</td>
                    <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>${(internalSales * 0.73).toLocaleString()}</td>
                    <td style={{ padding: '12px', fontWeight: 600, color: '#137333' }}>${(internalSales * 0.27).toLocaleString()}</td>
                    <td style={{ padding: '12px' }}><span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8' }}>27%</span></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 2. VENDEDORES (Removido e integrado en Análisis de Zonas) */}

      {/* 3. ZONAS */}
      {activeTab === 'zonas' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Tarjeta de Filtros */}
          <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Filtrar por Localidad</label>
                <button
                  onClick={() => setCitiesDropdownOpen(!citiesDropdownOpen)}
                  className="input-field"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    backgroundColor: 'var(--bg-light)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    fontSize: '0.9rem',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    outline: 'none',
                    textAlign: 'left',
                    height: '40px'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                    {selectedCities.length === 0 
                      ? 'Todas las localidades' 
                      : selectedCities.length === 1 
                        ? selectedCities[0] 
                        : `${selectedCities.length} localidades`}
                  </span>
                  <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>▼</span>
                </button>

                {citiesDropdownOpen && (
                  <>
                    <div
                      onClick={() => setCitiesDropdownOpen(false)}
                      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }}
                    />
                    <div
                      style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        zIndex: 1000,
                        width: '100%',
                        minWidth: '220px',
                        backgroundColor: 'var(--card-bg, #fff)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        marginTop: '4px',
                        padding: '8px 0',
                        maxHeight: '260px',
                        overflowY: 'auto'
                      }}
                    >
                      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '6px', padding: '0 12px' }}>
                        <button
                          onClick={() => {
                            setSelectedCities([]);
                            setCitiesDropdownOpen(false);
                            setHoveredWeekIdx(null);
                          }}
                          style={{
                            fontSize: '0.75rem',
                            color: '#1a73e8',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            fontWeight: 600,
                            padding: 0
                          }}
                        >
                          Limpiar selección (Todas)
                        </button>
                      </div>

                      {cities.map(c => {
                        const isChecked = selectedCities.includes(c);
                        return (
                          <label
                            key={c}
                            style={{
                              display: 'flex',
                              alignItems: 'center',
                              gap: '8px',
                              padding: '6px 12px',
                              cursor: 'pointer',
                              fontSize: '0.85rem',
                              color: 'var(--text-primary)',
                              transition: 'background-color 0.15s'
                            }}
                            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-light)'}
                            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                          >
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => {
                                setSelectedCities(prev => 
                                  prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]
                                );
                                setHoveredWeekIdx(null);
                              }}
                              style={{ cursor: 'pointer' }}
                            />
                            <span>{c}</span>
                          </label>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Filtrar por Vendedor</label>
                <select className="input-field" value={selectedSeller} onChange={e => { setSelectedSeller(e.target.value); setHoveredWeekIdx(null); }}>
                  <option value="">Todos los vendedores</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.username}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Período de Fecha</label>
                <select className="input-field" value={zoneDatePreset} onChange={e => { setZoneDatePreset(e.target.value); setHoveredWeekIdx(null); }}>
                  <option value="all">Histórico Completo</option>
                  <option value="this_week">Esta semana (Últimos 7 días)</option>
                  <option value="last_30_days">Últimos 30 días</option>
                  <option value="this_month">Este mes</option>
                  <option value="last_month">Mes anterior</option>
                  <option value="custom">Rango personalizado</option>
                </select>
              </div>
              {zoneDatePreset === 'custom' && (
                <>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Desde</label>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={zoneStartDate} 
                      onChange={e => { setZoneStartDate(e.target.value); setHoveredWeekIdx(null); }} 
                      style={{ padding: '7.5px 12px' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Hasta</label>
                    <input 
                      type="date" 
                      className="input-field" 
                      value={zoneEndDate} 
                      onChange={e => { setZoneEndDate(e.target.value); setHoveredWeekIdx(null); }}
                      style={{ padding: '7.5px 12px' }}
                    />
                  </div>
                </>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
                <button className="btn btn-secondary" onClick={loadZoneData} disabled={zoneLoading} style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <RefreshCw size={18} className={zoneLoading ? 'spin' : ''} />
                </button>
              </div>
            </div>
          </div>

          {/* KPIs Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>CLIENTES EN LA ZONA</span>
                <Users size={18} color="var(--text-secondary)" />
              </div>
              <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>{zoneData.totalClients}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Clientes activos registrados</span>
            </div>

            <div className="card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>COBERTURA DE VENTAS</span>
                <TrendingUp size={18} color="#1a73e8" />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <span style={{ fontSize: '1.8rem', fontWeight: 700 }}>
                  {zoneData.clientsWithMovements ? zoneData.clientsWithMovements.length : 0} de {zoneData.totalClients || 0}
                </span>
                <span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontSize: '0.8rem', padding: '4px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  {zoneData.totalClients > 0 ? Math.round(((zoneData.clientsWithMovements ? zoneData.clientsWithMovements.length : 0) / zoneData.totalClients) * 100) : 0}%
                </span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Clientes con compras en el período</span>
            </div>
            
            <div className="card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>FACTURACIÓN TOTAL</span>
                <DollarSign size={18} color="#137333" />
              </div>
              <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#137333' }}>${totalInvoicedInZone.toLocaleString()}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Ventas entregadas acumuladas</span>
            </div>

            <div className="card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TICKET PROMEDIO</span>
                <TrendingUp size={18} color="#1a73e8" />
              </div>
              <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#1a73e8' }}>${avgTicketInZone.toLocaleString()}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Monto promedio por pedido</span>
            </div>

            <div className="card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid #E30613' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>DEUDA EN LA ZONA</span>
                <MapPin size={18} color="#E30613" />
              </div>
              <span style={{ fontSize: '1.8rem', fontWeight: 700, color: '#E30613' }}>${(zoneData.totalDebt || 0).toLocaleString()}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Saldo total pendiente</span>
            </div>
          </div>

          {/* Gráfico de Facturación Semanal */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 4px 0' }}>Evolución de Facturación Semanal</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>
              Ventas entregadas consolidadas por semana. Pasa el cursor sobre las barras para ver el detalle de cada semana.
            </p>
            {zoneWeeklyInvoicing.length === 0 ? (
              <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)' }}>
                No hay registros de facturación en esta zona.
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '32px', alignItems: 'center' }}>
                
                {/* Visual Chart */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '180px', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', gap: '8px' }}>
                    {zoneWeeklyInvoicing.map((week: any, idx: number) => {
                      const isActive = activeWeek && activeWeek.weekStart === week.weekStart;
                      const heightPct = week.total > 0 ? Math.max((week.total / maxWeeklyAmount) * 100, 3) : 0;
                      return (
                        <div 
                          key={week.weekStart}
                          onMouseEnter={() => setHoveredWeekIdx(idx)}
                          style={{
                            flex: 1,
                            display: 'flex',
                            flexDirection: 'column',
                            alignItems: 'center',
                            cursor: 'pointer',
                            height: '100%',
                            justifyContent: 'flex-end'
                          }}
                        >
                          <div 
                            style={{
                              width: '100%',
                              maxWidth: '36px',
                              height: `${heightPct}%`,
                              backgroundColor: isActive ? '#1a73e8' : '#e0e0e0',
                              borderRadius: '4px 4px 0 0',
                              transition: 'all 0.2s ease',
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                  {/* Labels */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', padding: '0 4px' }}>
                    {zoneWeeklyInvoicing.map((week: any) => (
                      <div key={week.weekStart} style={{ flex: 1, textAlign: 'center', maxWidth: '36px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {formatWeekLabel(week.weekStart)}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Details Panel */}
                <div style={{ backgroundColor: 'var(--bg-light)', padding: '20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '10px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', textTransform: 'uppercase' }}>SEMANA SELECCIONADA</span>
                    <span style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Semana del {activeWeek ? formatWeekLabel(activeWeek.weekStart) : 'N/A'}
                    </span>
                  </div>
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Facturación total</span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#137333' }}>
                      ${activeWeek ? activeWeek.total.toLocaleString() : '0'}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Pedidos</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                        {activeWeek ? activeWeek.count : '0'}
                      </span>
                    </div>
                    <div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>Ticket Prom.</span>
                      <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>
                        ${activeWeek && activeWeek.count > 0 ? Math.round(activeWeek.total / activeWeek.count).toLocaleString() : '0'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* Secciones de Tabla y Columnas */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
            
            {/* Clientes con Movimientos (Ventas) */}
            <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Users size={20} color="var(--text-secondary)" /> Clientes con Movimientos (Ventas)
                </h4>
                
                {/* Buscador de Clientes */}
                <div style={{ position: 'relative', width: '280px' }}>
                  <input
                    type="text"
                    placeholder="Buscar cliente, localidad o preventista..."
                    value={clientSearch}
                    onChange={(e) => {
                      setClientSearch(e.target.value);
                      setClientPage(1);
                    }}
                    style={{
                      padding: '6px 12px',
                      paddingLeft: '32px',
                      fontSize: '0.85rem',
                      borderRadius: '6px',
                      border: '1px solid var(--border-color)',
                      backgroundColor: 'var(--bg-light)',
                      color: 'var(--text-primary)',
                      width: '100%',
                      outline: 'none'
                    }}
                  />
                  <svg
                    style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }}
                    xmlns="http://www.w3.org/2000/svg"
                    width="14"
                    height="14"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <circle cx="11" cy="11" r="8"></circle>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
                  </svg>
                </div>
              </div>

              {(() => {
                const zoneClientsWithMovements = zoneData.clientsWithMovements || [];
                const filteredClients = zoneClientsWithMovements.filter((c: any) =>
                  c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  c.city.toLowerCase().includes(clientSearch.toLowerCase()) ||
                  (c.sellerName && c.sellerName.toLowerCase().includes(clientSearch.toLowerCase()))
                );

                if (filteredClients.length === 0) {
                  return <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No hay clientes con movimientos registrados para la búsqueda actual.</p>;
                }

                const ITEMS_PER_PAGE = 10;
                const totalPages = Math.max(Math.ceil(filteredClients.length / ITEMS_PER_PAGE), 1);
                const startIndex = (clientPage - 1) * ITEMS_PER_PAGE;
                const paginatedClients = filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE);

                return (
                  <>
                    <div className="table-container">
                      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                        <thead>
                          <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.85rem' }}>
                            <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Rank</th>
                            <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Cliente</th>
                            <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Localidad</th>
                            <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Preventista</th>
                            <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'center' }}>Pedidos</th>
                            <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>Total Comprado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {paginatedClients.map((c: any, idx: number) => {
                            const globalRank = startIndex + idx + 1;
                            return (
                              <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem', transition: 'background-color 0.2s' }} className="table-row-hover">
                                <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>#{globalRank}</td>
                                <td style={{ padding: '12px 8px', fontWeight: 600 }}>{c.name}</td>
                                <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{c.city}</td>
                                <td style={{ padding: '12px 8px', color: 'var(--text-primary)' }}>{c.sellerName || 'Sin preventista'}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'center' }}>{c.ordersCount}</td>
                                <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: '#137333' }}>${c.totalSpent.toLocaleString()}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>

                    {/* Controles de Paginación */}
                    {totalPages > 1 && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                          Mostrando {startIndex + 1} a {Math.min(startIndex + ITEMS_PER_PAGE, filteredClients.length)} de {filteredClients.length} clientes con ventas
                        </span>
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <button
                            onClick={() => setClientPage(prev => Math.max(prev - 1, 1))}
                            disabled={clientPage === 1}
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              backgroundColor: clientPage === 1 ? 'transparent' : 'var(--bg-light)',
                              color: clientPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              cursor: clientPage === 1 ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            Anterior
                          </button>
                          <button
                            onClick={() => setClientPage(prev => Math.min(prev + 1, totalPages))}
                            disabled={clientPage === totalPages}
                            style={{
                              padding: '6px 12px',
                              fontSize: '0.8rem',
                              fontWeight: 600,
                              backgroundColor: clientPage === totalPages ? 'transparent' : 'var(--bg-light)',
                              color: clientPage === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)',
                              border: '1px solid var(--border-color)',
                              borderRadius: '6px',
                              cursor: clientPage === totalPages ? 'not-allowed' : 'pointer',
                              transition: 'all 0.2s'
                            }}
                          >
                            Siguiente
                          </button>
                        </div>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>

            {/* Split View: Productos más y menos vendidos */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
              
              {/* Productos más vendidos */}
              <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
                <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 16px 0', color: '#137333', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={20} /> Productos Más Vendidos (Top Salida)
                </h4>
                {zoneTopProducts.length === 0 ? (
                  <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No hay ventas registradas.</p>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {zoneTopProducts.map((p: any, idx: number) => (
                      <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                            <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>#{idx + 1}</span>
                            {p.name}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>SKU: {p.sku}</div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.qty} unidades</div>
                          <div style={{ fontSize: '0.75rem', color: '#137333', fontWeight: 600 }}>${p.revenue.toLocaleString()}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Productos de baja rotación y stock inmovilizado */}
              <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Package size={20} color="var(--text-secondary)" /> Alertas y Baja Rotación
                  </h4>
                  <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--bg-light)', padding: '2px', borderRadius: '6px' }}>
                    <button
                      onClick={() => setBottomProductsTab('lento')}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: bottomProductsTab === 'lento' ? '#fff' : 'transparent',
                        color: bottomProductsTab === 'lento' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        boxShadow: bottomProductsTab === 'lento' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.1s'
                      }}
                    >
                      Lento Movimiento
                    </button>
                    <button
                      onClick={() => setBottomProductsTab('sin_ventas')}
                      style={{
                        padding: '4px 8px',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                        backgroundColor: bottomProductsTab === 'sin_ventas' ? '#fff' : 'transparent',
                        color: bottomProductsTab === 'sin_ventas' ? 'var(--text-primary)' : 'var(--text-secondary)',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        boxShadow: bottomProductsTab === 'sin_ventas' ? '0 1px 2px rgba(0,0,0,0.05)' : 'none',
                        transition: 'all 0.1s'
                      }}
                    >
                      Stock Muerto
                    </button>
                  </div>
                </div>

                {bottomProductsTab === 'lento' ? (
                  zoneBottomProducts.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No hay ventas registradas.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {zoneBottomProducts.map((p: any, idx: number) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                              <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>#{idx + 1}</span>
                              {p.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>SKU: {p.sku}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.qty} unidades</div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>${p.revenue.toLocaleString()}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                ) : (
                  zoneDeadStockProducts.length === 0 ? (
                    <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Excelente. No hay stock inmovilizado en esta zona.</p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {zoneDeadStockProducts.map((p: any, idx: number) => (
                        <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                          <div>
                            <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                              <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>#{idx + 1}</span>
                              {p.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>SKU: {p.sku}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span className="badge" style={{ backgroundColor: '#FCE8E6', color: '#E30613', fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '4px' }}>
                              {p.stock} u en depósito
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )
                )}
              </div>

            </div>

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
