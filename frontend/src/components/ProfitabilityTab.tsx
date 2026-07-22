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
    <div className="space-y-6 fade-in text-gray-900">
      {/* BARRA DE FILTROS Y CONTROLES */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-3 pb-3 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-500" />
            <h3 className="text-sm font-semibold text-gray-900">Filtros de Análisis</h3>
          </div>

          {/* Preset de Fechas */}
          <div className="flex items-center gap-1.5 bg-gray-50 p-1 rounded-lg border border-gray-200 text-xs">
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
                    ? 'bg-gray-900 text-white font-medium shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
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
            <label className="text-gray-500 block mb-1 font-medium">Desde</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setDatePreset('CUSTOM');
                setStartDate(e.target.value);
              }}
              className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
            />
          </div>
          <div>
            <label className="text-gray-500 block mb-1 font-medium">Hasta</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setDatePreset('CUSTOM');
                setEndDate(e.target.value);
              }}
              className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
            />
          </div>

          {/* Vendedor */}
          <div>
            <label className="text-gray-500 block mb-1 font-medium">Vendedor</label>
            <select
              value={selectedSeller}
              onChange={(e) => setSelectedSeller(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
            >
              <option value="">Todos los vendedores</option>
              {sellerOptions.map((s) => (
                <option key={s.id} value={s.id}>{s.username}</option>
              ))}
            </select>
          </div>

          {/* Rubro */}
          <div>
            <label className="text-gray-500 block mb-1 font-medium">Rubro de Producto</label>
            <select
              value={selectedRubro}
              onChange={(e) => setSelectedRubro(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
            >
              <option value="">Todos los rubros</option>
              {rubroOptions.map((r) => (
                <option key={r.id} value={r.id}>{r.name}</option>
              ))}
            </select>
          </div>

          {/* Tipo Facturación */}
          <div>
            <label className="text-gray-500 block mb-1 font-medium">Tipo Facturación</label>
            <select
              value={selectedBillingType}
              onChange={(e) => setSelectedBillingType(e.target.value)}
              className="w-full bg-white border border-gray-300 rounded-lg px-2.5 py-1.5 text-gray-900 focus:outline-none focus:border-gray-500 focus:ring-1 focus:ring-gray-500"
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
            <div key={i} className="bg-white border border-gray-200 rounded-xl p-4 h-24 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* KPI 1: Ganancia Bruta Real */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 relative overflow-hidden group hover:border-gray-300 shadow-sm transition-all">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-gray-500">Margen Bruto Total</span>
              <span className="p-1.5 bg-emerald-50 text-emerald-600 rounded-lg">
                <TrendingUp className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(kpis?.totalGrossProfit || 0)}
            </div>
            <div className="flex items-center gap-1.5 mt-2 text-xs">
              <span className="font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                {kpis?.overallMarginPercent || 0}%
              </span>
              <span className="text-gray-500">margen promedio real</span>
            </div>
          </div>

          {/* KPI 2: Facturación vs Costos */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 relative overflow-hidden group hover:border-gray-300 shadow-sm transition-all">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-gray-500">Facturación vs. Costos</span>
              <span className="p-1.5 bg-blue-50 text-blue-600 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </span>
            </div>
            <div className="text-2xl font-bold text-gray-900">
              {formatCurrency(kpis?.totalRevenue || 0)}
            </div>
            <div className="text-xs text-gray-500 mt-2">
              Costo mercadería: <span className="font-medium text-gray-700">{formatCurrency(kpis?.totalCost || 0)}</span>
            </div>
          </div>

          {/* KPI 3: Cliente Top */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 relative overflow-hidden group hover:border-gray-300 shadow-sm transition-all">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-gray-500">Cliente N° 1 en Ganancia</span>
              <span className="p-1.5 bg-amber-50 text-amber-600 rounded-lg">
                <Award className="w-4 h-4" />
              </span>
            </div>
            <div className="text-base font-bold text-gray-900 truncate">
              {kpis?.topClient?.businessName || 'Sin datos'}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span>{kpis?.topClient ? formatCurrency(kpis.topClient.grossProfit) : '$ 0'} ganancia</span>
              <span className="text-emerald-600 font-semibold">{kpis?.topClient?.marginPercent || 0}%</span>
            </div>
          </div>

          {/* KPI 4: Producto Estrella */}
          <div className="bg-white border border-gray-200 rounded-xl p-4 relative overflow-hidden group hover:border-gray-300 shadow-sm transition-all">
            <div className="flex justify-between items-start mb-2">
              <span className="text-xs font-medium text-gray-500">Producto N° 1 Estrella</span>
              <span className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                <Sparkles className="w-4 h-4" />
              </span>
            </div>
            <div className="text-base font-bold text-gray-900 truncate">
              {kpis?.topProduct?.name || 'Sin datos'}
            </div>
            <div className="flex items-center justify-between text-xs text-gray-500 mt-2">
              <span>{kpis?.topProduct ? formatCurrency(kpis.topProduct.grossProfit) : '$ 0'} ganancia</span>
              <span className="text-purple-600 font-semibold">{kpis?.topProduct?.marginPercent || 0}%</span>
            </div>
          </div>
        </div>
      )}

      {/* NAVEGACIÓN DE SUB-VISTAS Y BÚSQUEDA */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 bg-gray-50 p-2 rounded-xl border border-gray-200">
        <div className="flex items-center gap-1 bg-white p-1 rounded-lg border border-gray-200 text-xs shadow-sm">
          <button
            onClick={() => setSubView('clients')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-all ${
              subView === 'clients'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            Clientes más Rentables ({reportData?.clients?.length || 0})
          </button>
          <button
            onClick={() => setSubView('products')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-all ${
              subView === 'products'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Package className="w-3.5 h-3.5" />
            Productos más Rentables ({reportData?.products?.length || 0})
          </button>
          <button
            onClick={() => setSubView('matrix')}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-md font-medium transition-all ${
              subView === 'matrix'
                ? 'bg-gray-900 text-white shadow-sm'
                : 'text-gray-600 hover:text-gray-900'
            }`}
          >
            <Layers className="w-3.5 h-3.5 text-amber-500" />
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
              className="bg-white border border-gray-300 rounded-lg px-3 py-1.5 text-xs text-gray-900 placeholder-gray-400 focus:outline-none focus:border-gray-500 w-full sm:w-64"
            />
          </div>
        )}
      </div>

      {/* TABLA 1: CLIENTES MÁS RENTABLES */}
      {subView === 'clients' && (
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">Cliente</th>
                  <th className="py-3 px-4">Localidad</th>
                  <th className="py-3 px-4">Vendedor</th>
                  <th className="py-3 px-4 text-right">Facturación ($)</th>
                  <th className="py-3 px-4 text-right">Costo ($)</th>
                  <th className="py-3 px-4 text-right font-bold text-gray-900">Margen Bruto ($)</th>
                  <th className="py-3 px-4 text-center font-bold">Margen (%)</th>
                  <th className="py-3 px-4 text-right">Ticket Prom.</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredClients.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      No se encontraron clientes para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredClients.map((client: any, idx: number) => (
                    <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-gray-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4 font-semibold text-gray-900">
                        {client.businessName}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {client.city}
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {client.sellerName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-900">
                        {formatCurrency(client.totalRevenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-500">
                        {formatCurrency(client.totalCost)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-emerald-600">
                        {formatCurrency(client.grossProfit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold font-mono">
                          {client.marginPercent}%
                        </div>
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">
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
        <div className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-gray-700">
              <thead className="bg-gray-50 border-b border-gray-200 text-gray-500 uppercase font-semibold">
                <tr>
                  <th className="py-3 px-4 w-12 text-center">#</th>
                  <th className="py-3 px-4">SKU / Producto</th>
                  <th className="py-3 px-4">Rubro</th>
                  <th className="py-3 px-4 text-right">Vendidos</th>
                  <th className="py-3 px-4 text-right">Facturación ($)</th>
                  <th className="py-3 px-4 text-right font-bold text-gray-900">Margen Real ($)</th>
                  <th className="py-3 px-4 text-center font-bold">Margen Real (%)</th>
                  <th className="py-3 px-4 text-center">Margen Obj. (%)</th>
                  <th className="py-3 px-4 text-center">Estado</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-gray-500">
                      No se encontraron productos para los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod: any, idx: number) => (
                    <tr key={prod.id} className="hover:bg-gray-50 transition-colors">
                      <td className="py-3 px-4 text-center font-mono text-gray-400 font-medium">
                        {idx + 1}
                      </td>
                      <td className="py-3 px-4">
                        <div className="font-semibold text-gray-900">{prod.name}</div>
                        <div className="text-[10px] text-gray-400 font-mono">{prod.sku}</div>
                      </td>
                      <td className="py-3 px-4 text-gray-500">
                        {prod.rubroName}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-700">
                        {prod.quantitySold}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-gray-900">
                        {formatCurrency(prod.totalRevenue)}
                      </td>
                      <td className="py-3 px-4 text-right font-mono font-bold text-purple-600">
                        {formatCurrency(prod.grossProfit)}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <span className="font-semibold font-mono text-purple-700 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded">
                          {prod.marginPercent}%
                        </span>
                      </td>
                      <td className="py-3 px-4 text-center font-mono text-gray-500">
                        {prod.targetMargin}%
                      </td>
                      <td className="py-3 px-4 text-center">
                        {prod.classification === 'STAR' && (
                          <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            ⭐ Estrella
                          </span>
                        )}
                        {prod.classification === 'VOLUME' && (
                          <span className="bg-blue-50 text-blue-700 border border-blue-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            📦 Volumen
                          </span>
                        )}
                        {prod.classification === 'OPPORTUNITY' && (
                          <span className="bg-amber-50 text-amber-700 border border-amber-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
                            💎 Oportunidad
                          </span>
                        )}
                        {prod.classification === 'LOW_MARGIN' && (
                          <span className="bg-red-50 text-[#E30613] border border-red-200 text-[10px] font-bold px-2 py-0.5 rounded-full uppercase">
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
          <div className="bg-emerald-50/40 border border-emerald-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200/60">
              <span className="text-base">⭐</span>
              <h4 className="text-sm font-semibold text-emerald-800">Estrellas (Alto Margen + Alto Volumen)</h4>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(reportData?.products || []).filter((p: any) => p.classification === 'STAR').map((p: any) => (
                <div key={p.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-emerald-100 text-xs shadow-sm">
                  <div>
                    <span className="font-semibold text-gray-900 block">{p.name}</span>
                    <span className="text-[10px] text-gray-500">Margen: <strong className="text-emerald-600">{p.marginPercent}%</strong></span>
                  </div>
                  <span className="font-mono font-bold text-gray-900">{formatCurrency(p.grossProfit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cuadrante 2: Oportunidad */}
          <div className="bg-amber-50/40 border border-amber-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-amber-200/60">
              <span className="text-base">💎</span>
              <h4 className="text-sm font-semibold text-amber-800">Oportunidades (Alto Margen + Bajo Volumen)</h4>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(reportData?.products || []).filter((p: any) => p.classification === 'OPPORTUNITY').map((p: any) => (
                <div key={p.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-amber-100 text-xs shadow-sm">
                  <div>
                    <span className="font-semibold text-gray-900 block">{p.name}</span>
                    <span className="text-[10px] text-gray-500">Margen: <strong className="text-amber-600">{p.marginPercent}%</strong></span>
                  </div>
                  <span className="font-mono font-bold text-gray-900">{formatCurrency(p.grossProfit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cuadrante 3: Volumen */}
          <div className="bg-blue-50/40 border border-blue-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-blue-200/60">
              <span className="text-base">📦</span>
              <h4 className="text-sm font-semibold text-blue-800">Volumen (Bajo Margen + Alto Volumen)</h4>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(reportData?.products || []).filter((p: any) => p.classification === 'VOLUME').map((p: any) => (
                <div key={p.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-blue-100 text-xs shadow-sm">
                  <div>
                    <span className="font-semibold text-gray-900 block">{p.name}</span>
                    <span className="text-[10px] text-gray-500">Margen: <strong className="text-blue-600">{p.marginPercent}%</strong></span>
                  </div>
                  <span className="font-mono font-bold text-gray-900">{formatCurrency(p.grossProfit)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Cuadrante 4: Revisar */}
          <div className="bg-red-50/40 border border-red-200 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3 pb-2 border-b border-red-200/60">
              <span className="text-base">⚠️</span>
              <h4 className="text-sm font-semibold text-[#E30613]">Revisar (Margen Bajo &lt; 15%)</h4>
            </div>
            <div className="space-y-2 max-h-60 overflow-y-auto pr-1">
              {(reportData?.products || []).filter((p: any) => p.classification === 'LOW_MARGIN').map((p: any) => (
                <div key={p.id} className="flex justify-between items-center bg-white p-2.5 rounded-lg border border-red-100 text-xs shadow-sm">
                  <div>
                    <span className="font-semibold text-gray-900 block">{p.name}</span>
                    <span className="text-[10px] text-gray-500">Margen: <strong className="text-[#E30613]">{p.marginPercent}%</strong></span>
                  </div>
                  <span className="font-mono font-bold text-gray-900">{formatCurrency(p.grossProfit)}</span>
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
