import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  TrendingUp, 
  DollarSign, 
  Users, 
  Package, 
  AlertTriangle, 
  Sparkles, 
  Filter, 
  ArrowUpRight, 
  ArrowDownRight, 
  BarChart3,
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
      if (sellerOptions.length === 0 && api.getUsers) {
        const u = await api.getUsers();
        if (Array.isArray(u)) setSellerOptions(u);
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
    <div className="space-y-6 fade-in text-neutral-100">
      {/* BARRA DE FILTROS Y CONTROLES */}
      <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3 pb-3 border-b border-neutral-800">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-neutral-400" />
            <h3 className="text-sm font-semibold text-neutral-200">Filtros de Análisis</h3>
          </div>

          {/* Preset de Fechas */}
          <div className="flex items-center gap-1.5 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
            {[
              { id: 'THIS_MONTH', label: 'Este Mes' },
              { id: 'LAST_MONTH', label: 'Mes Anterior' },
              { id: 'QUARTER', label: 'Trimestre' },
              { id: 'YEAR', label: 'Año' },
              { id: 'CUSTOM', label: 'Personalizado' },
            ].map((p) => (
              <button
                key={p.id}
                onClick={() => setDatePreset(p.id)}
                className={`px-2.5 py-1 rounded-md transition-all ${
                  datePreset === p.id
                    ? 'bg-neutral-800 text-neutral-100 font-medium shadow-sm'
                    : 'text-neutral-400 hover:text-neutral-200'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 text-xs">
          {/* Fechas personalizadas */}
          <div>
            <label className="text-neutral-400 block mb-1">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setDatePreset('CUSTOM');
                setStartDate(e.target.value);
              }}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-neutral-700"
            />
          </div>
          <div>
            <label className="text-neutral-400 block mb-1">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setDatePreset('CUSTOM');
                setEndDate(e.target.value);
              }}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-neutral-700"
            />
          </div>

          {/* Vendedor */}
          <div>
            <label className="text-neutral-400 block mb-1">Vendedor</label>
            <select
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-neutral-700"
            >
              <option value="">Todos los vendedores</option>
              {sellerOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.username}</option>
              ))}
            </select>
          </div>

          {/* Rubro */}
          <div>
            <label className="text-neutral-400 block mb-1">Rubro de Producto</label>
            <select
              value={selectedRubro}
              onChange={(e) => setSelectedRubro(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-neutral-700"
            >
              <option value="">Todos los rubros</option>
              {rubroOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Tipo Facturación */}
          <div>
            <label className="text-neutral-400 block mb-1">Tipo Facturación</label>
            <select
              value={selectedBillingType}
              onChange={(e) => setSelectedBillingType(e.target.value)}
              className="w-full bg-neutral-950 border border-neutral-800 rounded-lg px-2.5 py-1.5 text-neutral-200 focus:outline-none focus:border-neutral-700"
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
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Ganancia Bruta Real */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 relative overflow-hidden group hover:border-neutral-700 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-neutral-400">Margen Bruto Total</span>
              <span className="p-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-bold text-neutral-100">
              {formatCurrency(kpis?.totalGrossProfit || 0)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              <span className="font-semibold text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded">
                {kpis?.overallMarginPercent || 0}%
              </span>
              <span className="text-neutral-400">margen promedio real</span>
            </div>
          </div>

          {/* KPI 2: Facturación vs Costos */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 relative overflow-hidden group hover:border-neutral-700 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-neutral-400">Facturación vs. Costos</span>
              <span className="p-1.5 bg-blue-500/10 text-blue-400 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-bold text-neutral-100">
              {formatCurrency(kpis?.totalRevenue || 0)}
            </div>
            <div className="text-xs text-neutral-400 mt-2">
              Costo mercadería: <span className="font-medium text-neutral-300">{formatCurrency(kpis?.totalCost || 0)}</span>
            </div>
          </div>

          {/* KPI 3: Cliente Top */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 relative overflow-hidden group hover:border-neutral-700 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-neutral-400">Cliente N° 1 en Ganancia</span>
              <span className="p-1.5 bg-amber-500/10 text-amber-400 rounded-lg">
                <Award className="w-4 h-4" />
              </span>
            </div>
            <div className="text-base font-bold text-neutral-100 truncate">
              {kpis?.topClient?.businessName || 'Sin datos'}
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-400 mt-2">
              <span>{kpis?.topClient ? formatCurrency(kpis.topClient.grossProfit) : '$ 0'} ganancia</span>
              <span className="text-emerald-400 font-semibold">{kpis?.topClient?.marginPercent || 0}%</span>
            </div>
          </div>

          {/* KPI 4: Producto Estrella */}
          <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl p-4 relative overflow-hidden group hover:border-neutral-700 transition-colors">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-neutral-400">Producto N° 1 Estrella</span>
              <span className="p-1.5 bg-purple-500/10 text-purple-400 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </span>
            </div>
            <div className="text-base font-bold text-neutral-100 truncate">
              {kpis?.topProduct?.name || 'Sin datos'}
            </div>
            <div className="flex items-center justify-between text-xs text-neutral-400 mt-2">
              <span>{kpis?.topProduct ? formatCurrency(kpis.topProduct.grossProfit) : '$ 0'} ganancia</span>
              <span className="text-purple-400 font-semibold">{kpis?.topProduct?.marginPercent || 0}%</span>
            </div>
          </div>
        </div>
      )}

      {/* NAVEGACIÓN DE SUB-VISTAS Y BÚSQUEDA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-neutral-900/60 p-2 rounded-xl border border-neutral-800">
        <div className="flex items-center gap-1 bg-neutral-950 p-1 rounded-lg border border-neutral-800 text-xs">
          <button
            onClick={() => setSubView('clients')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-all ${
              subView === 'clients'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Clientes más Rentables ({reportData?.clients?.length || 0})
          </button>
          <button
            onClick={() => setSubView('products')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-all ${
              subView === 'products'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Productos más Rentables ({reportData?.products?.length || 0})
          </button>
          <button
            onClick={() => setSubView('matrix')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-all ${
              subView === 'matrix'
                ? 'bg-neutral-800 text-neutral-100 shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-400" />
            Matriz de Rentabilidad
          </button>
        </div>

        {subView !== 'matrix' && (
          <div className="relative">
            <input
              type="text"
              placeholder={subView === 'clients' ? "Buscar cliente o localidad..." : "Buscar producto por SKU o nombre..."}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bg-neutral-950 border border-neutral-800 rounded-lg px-3 py-1.5 text-xs text-neutral-200 placeholder-neutral-400 focus:outline-none focus:border-neutral-700 w-full sm:w-64"
            />
          </div>
        )}
      </div>

      {/* TABLA 1: CLIENTES MÁS RENTABLES */}
      {subView === 'clients' && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Localidad</th>
                  <th className="py-3 px-4">Vendedor</th>
                  <th className="py-3 px-4 text-right">Facturación ($)</th>
                  <th className="py-3 px-4 text-right">Costo ($)</th>
                  <th className="py-3 px-4 text-right font-bold text-neutral-200">Margen Bruto ($)</th>
                  <th className="py-3 px-4 text-center font-bold">Margen (%)</th>
                  <th className="py-3 px-4 text-right">Ticket Prom.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-neutral-400">
                      No se encontraron clientes para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client: any, idx: number) => (
                    <tr key={client.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-neutral-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-neutral-100">
                        {client.businessName}
                      </td>
                      <td className="py-3 px-4 text-neutral-400">
                        {client.city}
                      </td>
                      <td className="py-3 px-4 text-neutral-400">
                        {client.sellerName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatCurrency(client.totalRevenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-400">
                        {formatCurrency(client.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400">
                        {formatCurrency(client.grossProfit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-semibold font-mono">
                          {client.marginPercent}%
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-300">
                        {formatCurrency(client.averageTicket)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TABLA 2: PRODUCTOS MÁS RENTABLES */}
      {subView === 'products' && (
        <div className="bg-neutral-900/90 border border-neutral-800 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-neutral-300">
              <thead className="bg-neutral-950 border-b border-neutral-800 text-neutral-400 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">SKU / Producto</th>
                  <th className="py-3 px-4">Rubro</th>
                  <th className="py-3 px-4 text-right">Vendidos</th>
                  <th className="py-3 px-4 text-right">Facturación ($)</th>
                  <th className="py-3 px-4 text-right font-bold text-neutral-200">Margen Real ($)</th>
                  <th className="py-3 px-4 text-center font-bold">Margen Real (%)</th>
                  <th className="py-3 px-4 text-center">Margen Obj. (%)</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-neutral-400">
                      No se encontraron productos para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod: any, idx: number) => (
                    <tr key={prod.id} className="hover:bg-neutral-800/40 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-neutral-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-neutral-100">{prod.name}</div>
                        <div className="text-[10px] text-neutral-400 font-mono">{prod.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-neutral-400">
                        {prod.rubroName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-neutral-300">
                        {prod.quantitySold}
                      </td>
                      <td className="py-3 px-4 text-right font-mono">
                        {formatCurrency(prod.totalRevenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-purple-400">
                        {formatCurrency(prod.grossProfit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold font-mono text-purple-400 bg-purple-500/10 px-2 py-0.5 rounded">
                          {prod.marginPercent}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-neutral-400">
                        {prod.targetMargin}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        {prod.classification === 'STAR' && (
                          <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            ⭐ Estrella
                          </span>
                        )}
                        {prod.classification === 'VOLUME' && (
                          <span className="bg-blue-500/10 text-blue-400 border border-blue-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            📦 Volumen
                          </span>
                        )}
                        {prod.classification === 'OPPORTUNITY' && (
                          <span className="bg-amber-500/10 text-amber-400 border border-amber-500/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            💎 Oportunidad
                          </span>
                        )}
                        {prod.classification === 'LOW_MARGIN' && (
                          <span className="bg-[#E30613]/10 text-[#E30613] border border-[#E30613]/30 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
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
        </div>
      )}

      {/* SUB-VISTA 3: MATRIZ DE CUADRANTES DE PRODUCTOS */}
      {subView === 'matrix' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Cuadrante 1: Estrellas */}
          <div className="bg-neutral-900/90 border border-emerald-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-800">
              <span className="text-base">⭐</span>
              <h4 className="text-sm font-semibold text-emerald-400">Estrellas (Alto Margen + Alto Volumen)</h4>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(reportData?.products || []).filter((p: any) => p.classification === 'STAR').map((p: any) => (
                <div key={p.id} className="flex justify-between items-center bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/80 text-xs">
                  <div>
                    <span className="font-semibold text-neutral-100 block">{p.name}</span>
                    <span className="text-[10px] text-neutral-400">Margen: <strong className="text-emerald-400">{p.marginPercent}%</strong></span>
                  </div>
                  <span className="font-mono font-bold text-neutral-200">{formatCurrency(p.grossProfit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cuadrante 2: Oportunidad */}
          <div className="bg-neutral-900/90 border border-amber-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-800">
              <span className="text-base">💎</span>
              <h4 className="text-sm font-semibold text-amber-400">Oportunidades (Alto Margen + Bajo Volumen)</h4>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(reportData?.products || []).filter((p: any) => p.classification === 'OPPORTUNITY').map((p: any) => (
                <div key={p.id} className="flex justify-between items-center bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/80 text-xs">
                  <div>
                    <span className="font-semibold text-neutral-100 block">{p.name}</span>
                    <span className="text-[10px] text-neutral-400">Margen: <strong className="text-amber-400">{p.marginPercent}%</strong></span>
                  </div>
                  <span className="font-mono font-bold text-neutral-200">{formatCurrency(p.grossProfit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cuadrante 3: Volumen */}
          <div className="bg-neutral-900/90 border border-blue-500/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-800">
              <span className="text-base">📦</span>
              <h4 className="text-sm font-semibold text-blue-400">Volumen (Bajo Margen + Alto Volumen)</h4>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(reportData?.products || []).filter((p: any) => p.classification === 'VOLUME').map((p: any) => (
                <div key={p.id} className="flex justify-between items-center bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/80 text-xs">
                  <div>
                    <span className="font-semibold text-neutral-100 block">{p.name}</span>
                    <span className="text-[10px] text-neutral-400">Margen: <strong className="text-blue-400">{p.marginPercent}%</strong></span>
                  </div>
                  <span className="font-mono font-bold text-neutral-200">{formatCurrency(p.grossProfit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cuadrante 4: Revisar */}
          <div className="bg-neutral-900/90 border border-[#E30613]/30 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-neutral-800">
              <span className="text-base">⚠️</span>
              <h4 className="text-sm font-semibold text-[#E30613]">Revisar (Margen Bajo &lt; 15%)</h4>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(reportData?.products || []).filter((p: any) => p.classification === 'LOW_MARGIN').map((p: any) => (
                <div key={p.id} className="flex justify-between items-center bg-neutral-950 p-2.5 rounded-lg border border-neutral-800/80 text-xs">
                  <div>
                    <span className="font-semibold text-neutral-100 block">{p.name}</span>
                    <span className="text-[10px] text-neutral-400">Margen: <strong className="text-[#E30613]">{p.marginPercent}%</strong></span>
                  </div>
                  <span className="font-mono font-bold text-neutral-200">{formatCurrency(p.grossProfit)}</span>
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
