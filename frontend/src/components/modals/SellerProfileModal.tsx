import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { 
  X, 
  Users, 
  ShoppingBag, 
  TrendingUp, 
  DollarSign, 
  MapPin, 
  Phone, 
  ExternalLink, 
  Search, 
  BarChart2, 
  Award
} from 'lucide-react';

interface SellerProfileModalProps {
  sellerId: number | null;
  onClose: () => void;
  onOpenReport?: (sellerId: number) => void;
}

export default function SellerProfileModal({ sellerId, onClose, onOpenReport }: SellerProfileModalProps) {
  const [loading, setLoading] = useState<boolean>(true);
  const [data, setData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<'stats' | 'routes' | 'clients'>('stats');
  const [clientSearch, setClientSearch] = useState<string>('');

  useEffect(() => {
    if (!sellerId) return;

    const fetchStats = async () => {
      setLoading(true);
      try {
        const response = await api.getSellerProfileStats(sellerId);
        setData(response.data || response);
      } catch (err) {
        console.error('Error al cargar la ficha del vendedor:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [sellerId]);

  if (!sellerId) return null;

  const getWhatsAppUrl = (phone?: string) => {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, '');
    if (!clean) return null;
    const formatted = clean.startsWith('54') ? clean : `549${clean}`;
    return `https://wa.me/${formatted}`;
  };

  const formatMoney = (amount: number) => {
    return `$${(amount || 0).toLocaleString('es-AR')}`;
  };

  const seller = data?.seller || {};
  const metrics = data?.metrics || {};
  const salesEvolution: any[] = data?.salesEvolution || [];
  const topClients: any[] = data?.topClients || [];
  const routes: any[] = data?.routes || [];
  const clients: any[] = data?.clients || [];

  const filteredClients = clients.filter((c: any) => {
    if (!clientSearch) return true;
    const term = clientSearch.toLowerCase();
    return (
      c.name?.toLowerCase().includes(term) ||
      c.tradeName?.toLowerCase().includes(term) ||
      c.city?.toLowerCase().includes(term) ||
      c.cuit?.includes(term)
    );
  });

  const maxSalesInEvolution = Math.max(...salesEvolution.map(s => s.sales || 0), 1);

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(15, 23, 42, 0.65)',
      backdropFilter: 'blur(4px)',
      zIndex: 1100,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '16px',
        width: '100%',
        maxWidth: '1050px',
        maxHeight: '90vh',
        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #e2e8f0'
      }}>
        {/* Header de la Ficha */}
        <div style={{
          padding: '24px 32px',
          borderBottom: '1px solid #f1f5f9',
          background: 'linear-gradient(180deg, #fafafa 0%, #ffffff 100%)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start'
        }}>
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              backgroundColor: '#1e293b',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '1.5rem',
              fontWeight: 700,
              boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1)'
            }}>
              {(seller.name || 'V').substring(0, 2).toUpperCase()}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 700, color: '#0f172a' }}>
                  {seller.name || 'Cargando vendedor...'}
                </h2>
                <span style={{
                  padding: '3px 10px',
                  borderRadius: '12px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  backgroundColor: seller.isActive !== false ? '#ecfdf5' : '#fef2f2',
                  color: seller.isActive !== false ? '#047857' : '#b91c1c'
                }}>
                  {seller.isActive !== false ? 'Activo' : 'Inactivo'}
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '16px', marginTop: '6px', fontSize: '0.85rem', color: '#64748b', flexWrap: 'wrap' }}>
                <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={14} /> {seller.city || 'General Villegas'}
                </span>
                {seller.userAccount && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    👤 Usuario: <strong>{seller.userAccount}</strong>
                  </span>
                )}
                {seller.phone && (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <Phone size={14} /> {seller.phone}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {getWhatsAppUrl(seller.phone) && (
              <a
                href={getWhatsAppUrl(seller.phone)!}
                target="_blank"
                rel="noreferrer"
                className="btn btn-secondary"
                style={{
                  padding: '8px 14px',
                  fontSize: '0.85rem',
                  borderRadius: '8px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  color: '#16a34a',
                  borderColor: '#bbf7d0'
                }}
              >
                <span>💬 WhatsApp</span>
              </a>
            )}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '6px',
                borderRadius: '50%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <X size={22} />
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ padding: '60px', textAlign: 'center', color: '#64748b' }}>
            Cargando estadísticas de vendedor...
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 32px' }}>
            {/* Grid de 4 Métricas KPI */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
              gap: '16px',
              marginBottom: '28px'
            }}>
              {/* KPI 1: Clientes Asignados */}
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Clientes Cartera</span>
                  <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#eff6ff', color: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Users size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                  {metrics.assignedClientsCount || 0}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  {metrics.activeClientsCount || 0} activos este mes ({metrics.coveragePercentage || 0}% cobertura)
                </div>
              </div>

              {/* KPI 2: Ticket Promedio */}
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Ticket Promedio</span>
                  <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#f0fdf4', color: '#16a34a', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                  {formatMoney(metrics.averageTicket || 0)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Promedio por pedido realizado
                </div>
              </div>

              {/* KPI 3: Facturación del Mes */}
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Ventas del Mes</span>
                  <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#fef2f2', color: '#E30613', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <DollarSign size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#E30613' }}>
                  {formatMoney(metrics.totalSalesMonth || 0)}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Mes en curso
                </div>
              </div>

              {/* KPI 4: Total Pedidos */}
              <div style={{
                padding: '20px',
                borderRadius: '12px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: '#64748b' }}>Pedidos Tomados</span>
                  <div style={{ padding: '6px', borderRadius: '8px', backgroundColor: '#faf5ff', color: '#9333ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <ShoppingBag size={18} />
                  </div>
                </div>
                <div style={{ fontSize: '1.6rem', fontWeight: 800, color: '#0f172a' }}>
                  {metrics.totalOrdersMonth || 0}
                </div>
                <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: '4px' }}>
                  Pedidos confirmados en el mes
                </div>
              </div>
            </div>

            {/* Navegación por Solapas */}
            <div style={{
              display: 'flex',
              gap: '8px',
              borderBottom: '1px solid #e2e8f0',
              marginBottom: '24px'
            }}>
              <button
                onClick={() => setActiveTab('stats')}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'stats' ? '2px solid #E30613' : '2px solid transparent',
                  color: activeTab === 'stats' ? '#E30613' : '#64748b'
                }}
              >
                📊 Evolución & Estadísticas
              </button>
              <button
                onClick={() => setActiveTab('routes')}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'routes' ? '2px solid #E30613' : '2px solid transparent',
                  color: activeTab === 'routes' ? '#E30613' : '#64748b'
                }}
              >
                📍 Rutas de Preventa ({routes.length})
              </button>
              <button
                onClick={() => setActiveTab('clients')}
                style={{
                  padding: '10px 16px',
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  borderBottom: activeTab === 'clients' ? '2px solid #E30613' : '2px solid transparent',
                  color: activeTab === 'clients' ? '#E30613' : '#64748b'
                }}
              >
                👥 Clientes a Cargo ({clients.length})
              </button>
            </div>

            {/* Pestaña 1: Estadísticas y Evolución */}
            {activeTab === 'stats' && (
              <div style={{ display: 'grid', gridTemplateColumns: '3fr 2fr', gap: '24px' }}>
                {/* Evolución Mensual de Ventas */}
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a' }}>
                    Evolución Mensual de Ventas ($)
                  </h4>
                  <div style={{ display: 'flex', alignItems: 'flex-end', gap: '12px', height: '180px', paddingTop: '20px' }}>
                    {salesEvolution.map((item, index) => {
                      const heightPct = Math.max(10, Math.round((item.sales / maxSalesInEvolution) * 100));
                      return (
                        <div key={index} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, color: '#64748b' }}>
                            {item.sales > 0 ? `$${Math.round(item.sales / 1000)}k` : '$0'}
                          </span>
                          <div style={{
                            width: '100%',
                            height: `${heightPct}%`,
                            backgroundColor: index === salesEvolution.length - 1 ? '#E30613' : '#cbd5e1',
                            borderRadius: '4px 4px 0 0',
                            transition: 'height 0.3s ease'
                          }} />
                          <span style={{ fontSize: '0.75rem', color: '#475569', fontWeight: 500 }}>
                            {item.period.split(' ')[0]}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Top Clientes del Vendedor */}
                <div style={{
                  backgroundColor: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '12px',
                  padding: '20px'
                }}>
                  <h4 style={{ margin: '0 0 16px 0', fontSize: '0.95rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Award size={16} color="#eab308" /> Top Clientes del Vendedor
                  </h4>
                  {topClients.length === 0 ? (
                    <p style={{ fontSize: '0.85rem', color: '#94a3b8', textAlign: 'center', margin: '40px 0' }}>
                      Sin histórico de ventas registrado.
                    </p>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      {topClients.map((c, i) => (
                        <div key={c.id} style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          padding: '8px 12px',
                          backgroundColor: '#f8fafc',
                          borderRadius: '8px',
                          border: '1px solid #f1f5f9'
                        }}>
                          <div>
                            <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#1e293b' }}>
                              {i + 1}. {c.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                              📍 {c.city} • {c.ordersCount} pedido(s)
                            </div>
                          </div>
                          <div style={{ fontSize: '0.88rem', fontWeight: 700, color: '#0f172a' }}>
                            {formatMoney(c.totalSpent)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pestaña 2: Rutas de Preventa */}
            {activeTab === 'routes' && (
              <div>
                {routes.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#64748b', backgroundColor: '#f8fafc', borderRadius: '12px' }}>
                    Este vendedor no tiene rutas de preventa asignadas formalmente.
                  </div>
                ) : (
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
                    {routes.map((r: any) => (
                      <div key={r.id} style={{
                        padding: '20px',
                        backgroundColor: '#ffffff',
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                          <h4 style={{ margin: 0, fontSize: '1rem', fontWeight: 700, color: '#0f172a' }}>
                            📍 {r.name}
                          </h4>
                          <span style={{
                            fontSize: '0.72rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            backgroundColor: '#eff6ff',
                            color: '#1d4ed8',
                            borderRadius: '4px',
                            textTransform: 'uppercase'
                          }}>
                            {r.dayOfWeek || 'Sin día asignado'}
                          </span>
                        </div>
                        <div style={{ fontSize: '0.85rem', color: '#64748b', marginTop: '6px' }}>
                          👥 {r.clientsCount} cliente(s) en este recorrido
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Pestaña 3: Cartera de Clientes */}
            {activeTab === 'clients' && (
              <div>
                <div style={{ marginBottom: '16px', display: 'flex', gap: '12px' }}>
                  <div style={{ position: 'relative', flex: 1 }}>
                    <Search size={16} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94a3b8' }} />
                    <input
                      type="text"
                      className="input"
                      placeholder="Buscar cliente por nombre, razón social, localidad o CUIT..."
                      value={clientSearch}
                      onChange={(e) => setClientSearch(e.target.value)}
                      style={{ paddingLeft: '36px', width: '100%' }}
                    />
                  </div>
                </div>

                <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', textAlign: 'left' }}>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>CLIENTE / RAZÓN SOCIAL</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>LOCALIDAD</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>DIRECCIÓN</th>
                        <th style={{ padding: '10px 14px', fontWeight: 600, color: '#475569' }}>TELÉFONO</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredClients.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '24px', textAlign: 'center', color: '#94a3b8' }}>
                            No se encontraron clientes asignados.
                          </td>
                        </tr>
                      ) : (
                        filteredClients.map((c: any) => (
                          <tr key={c.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                            <td style={{ padding: '10px 14px', fontWeight: 600, color: '#0f172a' }}>
                              {c.name}
                              {c.tradeName && <span style={{ fontSize: '0.75rem', color: '#64748b', display: 'block' }}>{c.tradeName}</span>}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569' }}>
                              {c.city || 'S/D'}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569' }}>
                              {c.address || '-'}
                            </td>
                            <td style={{ padding: '10px 14px', color: '#475569' }}>
                              {c.phone || '-'}
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

        {/* Footer del Modal */}
        <div style={{
          padding: '16px 32px',
          borderTop: '1px solid #f1f5f9',
          backgroundColor: '#fafafa',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center'
        }}>
          <div>
            {onOpenReport && (
              <button
                className="btn btn-secondary"
                style={{ padding: '8px 16px', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '6px' }}
                onClick={() => {
                  onClose();
                  onOpenReport(sellerId);
                }}
              >
                <BarChart2 size={16} /> Ver Reportes de Ventas
              </button>
            )}
          </div>
          <button
            className="btn btn-primary"
            style={{ padding: '8px 20px', fontSize: '0.85rem', borderRadius: '8px', backgroundColor: '#0f172a', borderColor: '#0f172a' }}
            onClick={onClose}
          >
            Cerrar Ficha
          </button>
        </div>
      </div>
    </div>
  );
}
