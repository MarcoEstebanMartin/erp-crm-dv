import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Package, 
  Sparkles, 
  Filter, 
  Award,
  Layers
} from 'lucide-react';

interface ProfitabilityTabProps {
  sellers?: Array<{ id: number; username: string }>;
  rubros?: Array<{ id: number; name: string }>;
}

export const ProfitabilityTab: React.FC<ProfitabilityTabProps> = ({ sellers = [], rubros = [] }) => {
  const [loading, setLoading] = useState<boolean>(true);
  const [subView, setSubView] = useState<'clients' | 'products' | 'matrix'>('clients');

  // Filtros
  const [datePreset, setDatePreset] = useState<string>('THIS_MONTH');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [selectedCity, setSelectedCity] = useState<string>('');
  const [selectedRubro, setSelectedRubro] = useState<string>('');
  const [selectedBillingType, setSelectedBillingType] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');

  // Datos
  const [reportData, setReportData] = useState<any>(null);
  const [sellerOptions, setSellerOptions] = useState<Array<{ id: number; username: string }>>(sellers);
  const [rubroOptions, setRubroOptions] = useState<Array<{ id: number; name: string }>>(rubros);

  useEffect(() => {
    applyDatePreset(datePreset);
    loadMetadata();
  }, [datePreset]);

  const loadMetadata = async () => {
    try {
      if (sellerOptions.length === 0) {
        let sellersList: any[] = [];
        if (api.getSellersList) {
          sellersList = await api.getSellersList();
        }
        if ((!sellersList || sellersList.length === 0) && api.getUsers) {
          const u = await api.getUsers();
          if (Array.isArray(u)) {
            sellersList = u.filter((user: any) => user.role === 'VENDEDOR');
          }
        }
        if (Array.isArray(sellersList)) setSellerOptions(sellersList);
      }
      if (rubroOptions.length === 0 && api.getRubros) {
        const r = await api.getRubros();
        if (Array.isArray(r)) setRubroOptions(r);
      }
    } catch (e) {
      console.error('Error al cargar metadatos de vendedores o rubros:', e);
    }
  };

  useEffect(() => {
    loadReport();
  }, [startDate, endDate, selectedSeller, selectedCity, selectedRubro, selectedBillingType]);

  const applyDatePreset = (preset: string) => {
    const now = new Date();
    let start = new Date();
    let end = new Date();

    if (preset === 'THIS_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === 'LAST_MONTH') {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (preset === 'QUARTER') {
      start = new Date(now.getFullYear(), now.getMonth() - 3, 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    } else if (preset === 'YEAR') {
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear(), 11, 31);
    }

    if (preset !== 'CUSTOM') {
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    }
  };

  const loadReport = async () => {
    setLoading(true);
    try {
      const data = await api.getProfitabilityReport({
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        sellerId: selectedSeller ? Number(selectedSeller) : undefined,
        city: selectedCity || undefined,
        rubroId: selectedRubro ? Number(selectedRubro) : undefined,
        billingType: selectedBillingType !== 'ALL' ? selectedBillingType : undefined,
      });
      setReportData(data);
    } catch (error) {
      console.error('Error al cargar reporte de rentabilidad:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number): string => {
    return new Intl.NumberFormat('es-AR', {
      style: 'currency',
      currency: 'ARS',
      maximumFractionDigits: 0,
    }).format(val || 0);
  };

  const kpis = reportData?.kpis;
  const filteredClients = (reportData?.clients || []).filter((c: any) =>
    c.businessName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.city.toLowerCase().includes(searchTerm.toLowerCase())
  );
  const filteredProducts = (reportData?.products || []).filter((p: any) =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {/* BARRA DE FILTROS Y CONTROLES */}
      <div className="card" style={{ padding: '16px 20px', backgroundColor: '#ffffff', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid #f1f5f9' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 600, fontSize: '0.92rem', color: 'var(--text-primary)' }}>
            <Filter size={16} color="var(--text-secondary)" />
            <span>Filtros de Análisis</span>
          </div>

          {/* Preset de Fechas */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', backgroundColor: '#f8fafc', padding: '3px', borderRadius: '6px', border: '1px solid #e2e8f0' }}>
            {[
              { id: 'THIS_MONTH', label: 'Este Mes' },
              { id: 'LAST_MONTH', label: 'Mes Anterior' },
              { id: 'QUARTER', label: 'Trimestre' },
              { id: 'YEAR', label: 'Año' },
              { id: 'CUSTOM', label: 'Personalizado' },
            ].map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => setDatePreset(p.id)}
                style={{
                  padding: '4px 10px',
                  fontSize: '0.78rem',
                  borderRadius: '4px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: datePreset === p.id ? 600 : 500,
                  backgroundColor: datePreset === p.id ? '#1e293b' : 'transparent',
                  color: datePreset === p.id ? '#ffffff' : 'var(--text-secondary)',
                  transition: 'all 0.15s ease'
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: '12px' }}>
          {/* Fechas personalizadas */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Desde</label>
            <input
              type="date"
              className="input"
              value={startDate}
              onChange={(e) => {
                setDatePreset('CUSTOM');
                setStartDate(e.target.value);
              }}
              style={{ padding: '6px 10px', fontSize: '0.84rem' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Hasta</label>
            <input
              type="date"
              className="input"
              value={endDate}
              onChange={(e) => {
                setDatePreset('CUSTOM');
                setEndDate(e.target.value);
              }}
              style={{ padding: '6px 10px', fontSize: '0.84rem' }}
            />
          </div>

          {/* Vendedor */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Vendedor</label>
            <select
              className="select"
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.84rem' }}
            >
              <option value="">Todos los vendedores</option>
              {sellerOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.username}</option>
              ))}
            </select>
          </div>

          {/* Rubro */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Rubro de Producto</label>
            <select
              className="select"
              value={selectedRubro}
              onChange={(e) => setSelectedRubro(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.84rem' }}
            >
              <option value="">Todos los rubros</option>
              {rubroOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Tipo Facturación */}
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>Tipo Facturación</label>
            <select
              className="select"
              value={selectedBillingType}
              onChange={(e) => setSelectedBillingType(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.84rem' }}
            >
              <option value="ALL">Todas (Oficial + Interno)</option>
              <option value="OFFICIAL">Solo Oficial (Factura A/B)</option>
              <option value="INTERNAL">Solo X (Interno)</option>
            </select>
          </div>
        </div>
      </div>

      {/* TARJETAS DE KPIS PRINCIPALES */}
      {loading ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="card" style={{ height: '90px', backgroundColor: '#ffffff', borderRadius: '8px', opacity: 0.6 }} />
          ))}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
          {/* KPI 1: Ganancia Bruta Real */}
          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Margen Bruto Total</span>
              <span style={{ padding: '6px', backgroundColor: '#ecfdf5', borderRadius: '6px', color: '#047857', display: 'flex', alignItems: 'center' }}>
                <TrendingUp size={16} />
              </span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {formatCurrency(kpis?.totalGrossProfit || 0)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '8px', fontSize: '0.78rem' }}>
              <span style={{ backgroundColor: '#ecfdf5', color: '#047857', fontWeight: 700, padding: '2px 6px', borderRadius: '4px', border: '1px solid #a7f3d0' }}>
                {kpis?.overallMarginPercent || 0}%
              </span>
              <span style={{ color: 'var(--text-muted)' }}>margen promedio real</span>
            </div>
          </div>

          {/* KPI 2: Facturación vs Costos */}
          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Facturación vs. Costos</span>
              <span style={{ padding: '6px', backgroundColor: '#eff6ff', borderRadius: '6px', color: '#1d4ed8', display: 'flex', alignItems: 'center' }}>
                <DollarSign size={16} />
              </span>
            </div>
            <div style={{ fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-primary)', fontFamily: 'monospace' }}>
              {formatCurrency(kpis?.totalRevenue || 0)}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              Costo mercadería: <strong style={{ color: 'var(--text-primary)', fontFamily: 'monospace' }}>{formatCurrency(kpis?.totalCost || 0)}</strong>
            </div>
          </div>

          {/* KPI 3: Cliente Top */}
          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Cliente N° 1 en Ganancia</span>
              <span style={{ padding: '6px', backgroundColor: '#fffbe6', borderRadius: '6px', color: '#d97706', display: 'flex', alignItems: 'center' }}>
                <Award size={16} />
              </span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {kpis?.topClient?.businessName || 'Sin datos'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              <span>{kpis?.topClient ? formatCurrency(kpis.topClient.grossProfit) : '$ 0'} ganancia</span>
              <span style={{ color: '#047857', fontWeight: 700 }}>{kpis?.topClient?.marginPercent || 0}%</span>
            </div>
          </div>

          {/* KPI 4: Producto Estrella */}
          <div className="card" style={{ padding: '16px', backgroundColor: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 500 }}>Producto N° 1 Estrella</span>
              <span style={{ padding: '6px', backgroundColor: '#faf5ff', borderRadius: '6px', color: '#7e22ce', display: 'flex', alignItems: 'center' }}>
                <Sparkles size={16} />
              </span>
            </div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {kpis?.topProduct?.name || 'Sin datos'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '8px' }}>
              <span>{kpis?.topProduct ? formatCurrency(kpis.topProduct.grossProfit) : '$ 0'} ganancia</span>
              <span style={{ color: '#7e22ce', fontWeight: 700 }}>{kpis?.topProduct?.marginPercent || 0}%</span>
            </div>
          </div>
        </div>
      )}

      {/* NAVEGACIÓN DE SUB-VISTAS Y BÚSQUEDA */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', backgroundColor: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setSubView('clients')}
            style={{
              padding: '6px 12px',
              fontSize: '0.82rem',
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              backgroundColor: subView === 'clients' ? '#1e293b' : '#ffffff',
              color: subView === 'clients' ? '#ffffff' : 'var(--text-secondary)',
              borderColor: subView === 'clients' ? '#1e293b' : '#cbd5e1',
              fontWeight: subView === 'clients' ? 600 : 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Users size={14} />
            <span>Clientes más Rentables ({reportData?.clients?.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('products')}
            style={{
              padding: '6px 12px',
              fontSize: '0.82rem',
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              backgroundColor: subView === 'products' ? '#1e293b' : '#ffffff',
              color: subView === 'products' ? '#ffffff' : 'var(--text-secondary)',
              borderColor: subView === 'products' ? '#1e293b' : '#cbd5e1',
              fontWeight: subView === 'products' ? 600 : 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Package size={14} />
            <span>Productos más Rentables ({reportData?.products?.length || 0})</span>
          </button>
          <button
            type="button"
            onClick={() => setSubView('matrix')}
            style={{
              padding: '6px 12px',
              fontSize: '0.82rem',
              borderRadius: '6px',
              cursor: 'pointer',
              border: '1px solid',
              backgroundColor: subView === 'matrix' ? '#1e293b' : '#ffffff',
              color: subView === 'matrix' ? '#ffffff' : 'var(--text-secondary)',
              borderColor: subView === 'matrix' ? '#1e293b' : '#cbd5e1',
              fontWeight: subView === 'matrix' ? 600 : 500,
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              transition: 'all 0.15s ease'
            }}
          >
            <Layers size={14} color={subView === 'matrix' ? '#f59e0b' : '#d97706'} />
            <span>Matriz de Rentabilidad</span>
          </button>
        </div>

        {subView !== 'matrix' && (
          <div style={{ minWidth: '220px' }}>
            <input
              type="text"
              className="input"
              placeholder={subView === 'clients' ? "Buscar cliente o localidad..." : "Buscar producto por SKU o nombre..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.82rem', width: '100%' }}
            />
          </div>
        )}
      </div>

      {/* TABLA 1: CLIENTES MÁS RENTABLES */}
      {subView === 'clients' && (
        <div className="table-container" style={{ margin: 0, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>#</th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Cliente</th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Localidad</th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Vendedor</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Facturación ($)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Costo ($)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-primary)', fontWeight: 700 }}>Margen Bruto ($)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-primary)', fontWeight: 700 }}>Margen (%)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Ticket Prom.</th>
              </tr>
            </thead>
            <tbody>
              {filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No se encontraron clientes para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredClients.map((client: any, idx: number) => (
                  <tr key={client.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '10px 12px', fontWeight: 600, color: 'var(--text-primary)' }}>
                      {client.businessName}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {client.city}
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {client.sellerName}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(client.totalRevenue)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {formatCurrency(client.totalCost)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#047857' }}>
                      {formatCurrency(client.grossProfit)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {client.marginPercent}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(client.averageTicket)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* TABLA 2: PRODUCTOS MÁS RENTABLES */}
      {subView === 'products' && (
        <div className="table-container" style={{ margin: 0, border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
            <thead style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <tr>
                <th style={{ padding: '10px 12px', width: '40px', textAlign: 'center', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>#</th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>SKU / Producto</th>
                <th style={{ padding: '10px 12px', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Rubro</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Vendidos</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Facturación ($)</th>
                <th style={{ padding: '10px 12px', textAlign: 'right', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-primary)', fontWeight: 700 }}>Margen Real ($)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-primary)', fontWeight: 700 }}>Margen Real (%)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Margen Obj. (%)</th>
                <th style={{ padding: '10px 12px', textAlign: 'center', fontSize: '0.75rem', textTransform: 'uppercase', color: 'var(--text-secondary)', fontWeight: 600 }}>Estado</th>
              </tr>
            </thead>
            <tbody>
              {filteredProducts.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ padding: '32px 12px', textAlign: 'center', color: 'var(--text-muted)' }}>
                    No se encontraron productos para los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                filteredProducts.map((prod: any, idx: number) => (
                  <tr key={prod.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {idx + 1}
                    </td>
                    <td style={{ padding: '10px 12px' }}>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{prod.name}</div>
                      <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{prod.sku}</div>
                    </td>
                    <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>
                      {prod.rubroName}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {prod.quantitySold}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace' }}>
                      {formatCurrency(prod.totalRevenue)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'right', fontFamily: 'monospace', fontWeight: 700, color: '#7e22ce' }}>
                      {formatCurrency(prod.grossProfit)}
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      <span style={{ display: 'inline-block', padding: '2px 8px', borderRadius: '4px', backgroundColor: '#faf5ff', color: '#7e22ce', border: '1px solid #e9d5ff', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.78rem' }}>
                        {prod.marginPercent}%
                      </span>
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center', fontFamily: 'monospace', color: 'var(--text-muted)' }}>
                      {prod.targetMargin}%
                    </td>
                    <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                      {prod.classification === 'STAR' && (
                        <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: '#ecfdf5', color: '#047857', border: '1px solid #a7f3d0', fontSize: '0.72rem', fontWeight: 700 }}>
                          ⭐ Estrella
                        </span>
                      )}
                      {prod.classification === 'VOLUME' && (
                        <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', fontSize: '0.72rem', fontWeight: 700 }}>
                          📦 Volumen
                        </span>
                      )}
                      {prod.classification === 'OPPORTUNITY' && (
                        <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: '#fffbe6', color: '#d97706', border: '1px solid #fef08a', fontSize: '0.72rem', fontWeight: 700 }}>
                          💎 Oportunidad
                        </span>
                      )}
                      {prod.classification === 'LOW_MARGIN' && (
                        <span style={{ padding: '2px 8px', borderRadius: '12px', backgroundColor: '#fef2f2', color: '#e30613', border: '1px solid #fecaca', fontSize: '0.72rem', fontWeight: 700 }}>
                          ⚠️ Margen Bajo
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* SUB-VISTA 3: MATRIZ DE CUADRANTES DE PRODUCTOS */}
      {subView === 'matrix' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
          {/* Cuadrante 1: Estrellas */}
          <div style={{ backgroundColor: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #dcfce7', fontWeight: 600, color: '#166534', fontSize: '0.88rem' }}>
              <span>⭐</span>
              <span>Estrellas (Alto Margen + Alto Volumen)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {(reportData?.products || []).filter((p: any) => p.classification === 'STAR').map((p: any) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #dcfce7', fontSize: '0.82rem' }}>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{p.name}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Margen: <strong style={{ color: '#047857' }}>{p.marginPercent}%</strong></span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(p.grossProfit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cuadrante 2: Oportunidad */}
          <div style={{ backgroundColor: '#fffbe6', border: '1px solid #fef08a', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #fef9c3', fontWeight: 600, color: '#854d0e', fontSize: '0.88rem' }}>
              <span>💎</span>
              <span>Oportunidades (Alto Margen + Bajo Volumen)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {(reportData?.products || []).filter((p: any) => p.classification === 'OPPORTUNITY').map((p: any) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fef9c3', fontSize: '0.82rem' }}>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{p.name}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Margen: <strong style={{ color: '#d97706' }}>{p.marginPercent}%</strong></span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(p.grossProfit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cuadrante 3: Volumen */}
          <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #dbeafe', fontWeight: 600, color: '#1e40af', fontSize: '0.88rem' }}>
              <span>📦</span>
              <span>Volumen (Bajo Margen + Alto Volumen)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {(reportData?.products || []).filter((p: any) => p.classification === 'VOLUME').map((p: any) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #dbeafe', fontSize: '0.82rem' }}>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{p.name}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Margen: <strong style={{ color: '#1d4ed8' }}>{p.marginPercent}%</strong></span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(p.grossProfit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cuadrante 4: Revisar */}
          <div style={{ backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '8px', padding: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', paddingBottom: '8px', borderBottom: '1px solid #fee2e2', fontWeight: 600, color: '#991b1b', fontSize: '0.88rem' }}>
              <span>⚠️</span>
              <span>Revisar (Margen Bajo &lt; 15%)</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxHeight: '240px', overflowY: 'auto' }}>
              {(reportData?.products || []).filter((p: any) => p.classification === 'LOW_MARGIN').map((p: any) => (
                <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#ffffff', padding: '8px 12px', borderRadius: '6px', border: '1px solid #fee2e2', fontSize: '0.82rem' }}>
                  <div>
                    <strong style={{ display: 'block', color: 'var(--text-primary)' }}>{p.name}</strong>
                    <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>Margen: <strong style={{ color: '#e30613' }}>{p.marginPercent}%</strong></span>
                  </div>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(p.grossProfit)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ProfitabilityTab;
