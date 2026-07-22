import { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { 
  BarChart2, 
  DollarSign, 
  Users, 
  MapPin, 
  Package, 
  RefreshCw, 
  TrendingUp, 
  TrendingDown,
  Sparkles, 
  FileText,
  Calendar,
  Plus,
  Trash2,
  Save
} from 'lucide-react';
import CrmDashboard from './CrmDashboard';
import AfipExportDashboard from '../pages/AfipExportDashboard';
import ProfitabilityTab from './ProfitabilityTab';
import { useConfirm } from '../context/ConfirmContext';

const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};

const getMonthName = (m: number): string => {
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
  ];
  return months[m - 1];
};



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
  const confirm = useConfirm();
  const [activeTab, setActiveTab] = useState<'finanzas' | 'zonas' | 'caja_semanal' | 'crm' | 'arca'>('finanzas');

  // Estados para reporte financiero con filtros mensuales
  const [reportYear, setReportYear] = useState<number>(new Date().getFullYear());
  const [reportMonth, setReportMonth] = useState<number>(new Date().getMonth() + 1); // Mes actual por defecto
  const [localReport, setLocalReport] = useState<any>(null);
  const [reportLoading, setReportLoading] = useState(false);

  useEffect(() => {
    fetchLocalFinancialReport();
  }, [reportYear, reportMonth]);

  const fetchLocalFinancialReport = async () => {
    setReportLoading(true);
    try {
      const data = await api.getFinancialReports(reportYear, reportMonth);
      setLocalReport(data);
    } catch (e) {
      console.error("Error al cargar reporte financiero consolidado:", e);
    } finally {
      setReportLoading(false);
    }
  };

  // Estados para Caja Semanal Consolidada
  const [weeklyReports, setWeeklyReports] = useState<any[]>([]);
  const [selectedWeekStart, setSelectedWeekStart] = useState<string>('');
  const [purchases, setPurchases] = useState<any[]>([]);
  const [sales, setSales] = useState<any[]>([]);
  const [credit, setCredit] = useState<number>(0);
  const [buffer, setBuffer] = useState<number>(20000000);
  const [isDirty, setIsDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [suggestedCredit, setSuggestedCredit] = useState<number>(0);
  const [weeksDropdownOpen, setWeeksDropdownOpen] = useState(false);

  const defaultSuppliers = [
    "REMOTTI- RTO",
    "NIZA SA",
    "DIST.JUNIN",
    "A.G.D.",
    "CASA NINI",
    "R.P.B.",
    "FIDEOS EL RECORD",
    "SODECAR SA",
    "CREMIGAL",
    "FRATELLI BRANCA",
    "COMISION M.PAGO",
    "PERC-ING.BRUTOS"
  ];

  const defaultLocalities = [
    "GENERAL VILLEGAS",
    "EMILIO V. BUNGE",
    "BANDERALÓ",
    "BERNARDO LARROUDÉ",
    "PIEDRITAS",
    "CORONEL CHARLONE",
    "BUCHARDO",
    "TRES ALGARROBOS",
    "CARLOS TEJEDOR",
    "FLORENTINO AMEGHINO",
    "BLAQUIER",
    "RIVADAVIA",
    "FORTÍN OLAVARRÍA",
    "INTENDENTE ALVEAR",
    "RUFINO",
    "CEBALLOS",
    "REALICÓ",
    "VILLA SAUZE",
    "SANSINENA",
    "SANTA ELEODORA",
    "SANTA REGINA",
    "VILLA SABOYA",
    "CAÑADA SECA"
  ];

  const getMonday = (dStr: string) => {
    const d = new Date(dStr + 'T00:00:00');
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const monday = new Date(d.setDate(diff));
    return monday.toISOString().split('T')[0];
  };

  const setupNewWeek = async (weekStart: string, _existingReports: any[]) => {
    setSelectedWeekStart(weekStart);
    setPurchases(defaultSuppliers.map(s => ({ company: s, date: '', amount: 0 })));
    setSales(defaultLocalities.map(l => ({ locality: l, date: '', amountA: 0, amountX: 0 })));
    setBuffer(20000000);
    setIsDirty(true);
    
    try {
      const suggested = await api.getSuggestedCredit(weekStart);
      setCredit(suggested || 0);
      setSuggestedCredit(suggested || 0);
    } catch (e) {
      console.error('Error fetching suggested credit:', e);
      setCredit(0);
      setSuggestedCredit(0);
    }
  };

  const loadWeeklyReports = async (selectWeek?: string) => {
    try {
      const data = await api.getWeeklyReports();
      setWeeklyReports(data || []);
      
      if (data && data.length > 0) {
        const targetWeek = selectWeek || data[data.length - 1].weekStart;
        setSelectedWeekStart(targetWeek);
        const report = data.find((r: any) => r.weekStart === targetWeek);
        if (report) {
          setPurchases(report.purchases || []);
          setSales(report.sales || []);
          setCredit(Number(report.credit) || 0);
          setBuffer(Number(report.buffer) || 20000000);
          setIsDirty(false);
          try {
            const suggested = await api.getSuggestedCredit(targetWeek);
            setSuggestedCredit(suggested || 0);
          } catch (e) {
            setSuggestedCredit(0);
          }
        } else {
          setupNewWeek(targetWeek, data);
        }
      } else {
        const currentMonday = getMonday(new Date().toISOString().split('T')[0]);
        setupNewWeek(currentMonday, []);
      }
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    if (activeTab === 'caja_semanal') {
      loadWeeklyReports();
    }
  }, [activeTab]);

  const handleSelectWeek = async (weekStart: string) => {
    if (isDirty) {
      if (!await confirm('Tenés cambios sin guardar en esta planilla. ¿Querés descartarlos y cambiar de semana?', { type: 'warning' })) {
        return;
      }
    }
    const report = weeklyReports.find(r => r.weekStart === weekStart);
    setSelectedWeekStart(weekStart);
    if (report) {
      setPurchases(report.purchases || []);
      setSales(report.sales || []);
      setCredit(Number(report.credit) || 0);
      setBuffer(Number(report.buffer) || 20000000);
      setIsDirty(false);
      try {
        const suggested = await api.getSuggestedCredit(weekStart);
        setSuggestedCredit(suggested || 0);
      } catch (e) {
        setSuggestedCredit(0);
      }
    } else {
      setupNewWeek(weekStart, weeklyReports);
    }
    setWeeksDropdownOpen(false);
  };

  const handleSaveWeekly = async () => {
    setSaving(true);
    try {
      await api.saveWeeklyReport({
        weekStart: selectedWeekStart,
        purchases,
        sales,
        credit,
        buffer
      });
      alert('Planilla semanal guardada con éxito.');
      setIsDirty(false);
      await loadWeeklyReports(selectedWeekStart);
    } catch (err: any) {
      alert('Error al guardar la planilla: ' + (err.message || err));
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteWeekly = async () => {
    if (!await confirm(`¿Estás seguro de que querés eliminar la planilla de la semana ${selectedWeekStart}? Esta acción no se puede deshacer.`, { type: 'danger' })) {
      return;
    }
    try {
      await api.deleteWeeklyReport(selectedWeekStart);
      alert('Planilla eliminada con éxito.');
      setIsDirty(false);
      await loadWeeklyReports();
    } catch (err: any) {
      alert('Error al eliminar la planilla: ' + (err.message || err));
    }
  };

  const handleCreateNewWeek = () => {
    const defaultVal = new Date().toISOString().split('T')[0];
    const userVal = window.prompt('Ingresá una fecha de la semana que querés crear (se ajustará automáticamente al lunes de esa semana):', defaultVal);
    if (userVal) {
      const mon = getMonday(userVal);
      handleSelectWeek(mon);
    }
  };

  const addPurchaseRow = () => {
    setPurchases(prev => [...prev, { company: '', date: '', amount: 0 }]);
    setIsDirty(true);
  };

  const removePurchaseRow = (idx: number) => {
    setPurchases(prev => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const handlePurchaseChange = (idx: number, field: string, val: any) => {
    setPurchases(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
    setIsDirty(true);
  };

  const addSalesRow = () => {
    setSales(prev => [...prev, { locality: '', date: '', amountA: 0, amountX: 0 }]);
    setIsDirty(true);
  };

  const removeSalesRow = (idx: number) => {
    setSales(prev => prev.filter((_, i) => i !== idx));
    setIsDirty(true);
  };

  const handleSalesChange = (idx: number, field: string, val: any) => {
    setSales(prev => prev.map((item, i) => i === idx ? { ...item, [field]: val } : item));
    setIsDirty(true);
  };

  const handleAutofillSales = async () => {
    try {
      const autoSales = await api.getAutofillSales(selectedWeekStart);
      if (!autoSales || autoSales.length === 0) {
        alert('No se encontraron ventas entregadas en el sistema para esta semana.');
        return;
      }

      setSales(prevSales => {
        const newSales = [...prevSales];
        const matchedLocalities = new Set<string>();

        autoSales.forEach((as: any) => {
          const matchIdx = newSales.findIndex(s => normalizeString(s.locality) === normalizeString(as.locality));
          if (matchIdx >= 0) {
            newSales[matchIdx] = {
              ...newSales[matchIdx],
              amountA: as.amountA,
              amountX: as.amountX,
              date: as.date || newSales[matchIdx].date
            };
            matchedLocalities.add(normalizeString(as.locality));
          }
        });

        autoSales.forEach((as: any) => {
          if (!matchedLocalities.has(normalizeString(as.locality))) {
            newSales.push({
              locality: as.locality,
              date: as.date || '',
              amountA: as.amountA,
              amountX: as.amountX
            });
          }
        });

        return newSales;
      });

      setIsDirty(true);
      alert('Ventas completadas con éxito en base a los pedidos entregados.');
    } catch (err: any) {
      alert('Error al autocompletar ventas: ' + (err.message || err));
    }
  };




  
  // Estados para Zonas
  const [zoneData, setZoneData] = useState<any>({
    clients: [],
    totalClients: 0,
    totalDebt: 0,
    topClients: [],
    clientsWithMovements: [],
    topProducts: [],
    bottomProducts: [],
    weeklyInvoicing: [],
    rubroMetrics: [],
    salesRecommendations: []
  });
  const [zoneLoading, setZoneLoading] = useState(false);
  const [cities, setCities] = useState<string[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [citiesDropdownOpen, setCitiesDropdownOpen] = useState(false);
  const [selectedSeller, setSelectedSeller] = useState<string>('');
  const [hoveredWeekIdx, setHoveredWeekIdx] = useState<number | null>(null);
  const [selectedRubroChart, setSelectedRubroChart] = useState<string>('all');
  
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
  const currentReport = localReport || financialReport;
  const totalFacturado = currentReport?.sales ? ((currentReport.sales.official || 0) + (currentReport.sales.internal || 0)) : 0;
  const officialSales = currentReport?.sales?.official || 0;
  const internalSales = currentReport?.sales?.internal || 0;
  
  // Costos reales obtenidos desde el backend (CMV)
  const officialCostReal = currentReport?.sales?.officialCost || 0;
  const internalCostReal = currentReport?.sales?.internalCost || 0;
  const totalCostoReal = Math.round(officialCostReal + internalCostReal);
  
  // Margen Comercial Bruto
  const totalMargenBruto = Math.round(totalFacturado - totalCostoReal);
  const pctMargenBruto = totalFacturado > 0 ? Math.round((totalMargenBruto / totalFacturado) * 100) : 0;
  
  // Gastos Operativos Reales
  const totalGastosReal = currentReport?.expenses?.total || 0;
  
  // Utilidad Neta y Margen Neto Final
  const totalMargenNeto = Math.round(totalMargenBruto - totalGastosReal);
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

  // Find all available rubro names from the rubro metrics
  const availableRubros = zoneData.rubroMetrics?.map((r: any) => r.name) || [];

  // Determine the active total based on selected rubro
  const getWeeklyVal = (w: any) => {
    if (!w) return 0;
    if (selectedRubroChart === 'all') {
      return w.total || 0;
    }
    return w.rubros?.[selectedRubroChart] || 0;
  };

  // Find max weekly amount for chart height scaling
  const maxWeeklyAmount = Math.max(...zoneWeeklyInvoicing.map((w: any) => getWeeklyVal(w)), 1);

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
          { id: 'rentabilidad', label: 'Rentabilidad', icon: <TrendingUp size={16} /> },
          { id: 'zonas', label: 'Análisis de Zonas', icon: <MapPin size={16} /> },
          { id: 'caja_semanal', label: 'Caja Semanal Consolidada', icon: <Calendar size={16} /> },
          { id: 'crm', label: 'Alertas + IA', icon: <Sparkles size={16} /> },
          { id: 'arca', label: 'Cierre Fiscal (ARCA)', icon: <FileText size={16} /> }
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
          
          {/* Barra de Filtros de Reporte */}
          <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', gap: '16px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Seleccionar período:</span>
            <div style={{ display: 'flex', gap: '12px' }}>
              <select 
                value={reportYear} 
                onChange={e => setReportYear(Number(e.target.value))}
                className="select"
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', fontSize: '0.85rem' }}
                disabled={reportLoading}
              >
                <option value={2026}>2026</option>
                <option value={2025}>2025</option>
                <option value={2024}>2024</option>
              </select>
              <select 
                value={reportMonth} 
                onChange={e => setReportMonth(Number(e.target.value))}
                className="select"
                style={{ padding: '6px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)', fontSize: '0.85rem' }}
                disabled={reportLoading}
              >
                {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                  <option key={m} value={m}>{getMonthName(m)}</option>
                ))}
              </select>
            </div>
            {reportLoading && (
              <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Cargando analíticas...</span>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
            <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>VENTAS FACTURADAS</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 700 }}>${totalFacturado.toLocaleString('es-AR')}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Ventas del mes seleccionado</span>
            </div>
            
            <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>COSTO MERCADERÍA (CMV)</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#5f6368' }}>${totalCostoReal.toLocaleString('es-AR')}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Costo real de productos entregados</span>
            </div>

            <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>UTILIDAD BRUTA</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 700, color: '#137333' }}>${totalMargenBruto.toLocaleString('es-AR')}</span>
                <span className="badge" style={{ backgroundColor: '#e6f4ea', color: '#137333', fontSize: '0.75rem', padding: '2px 6px' }}>{pctMargenBruto}%</span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Margen sobre ventas</span>
            </div>

            <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>GASTOS OPERATIVOS</span>
              <span style={{ fontSize: '1.6rem', fontWeight: 700, color: 'var(--color-corp-red)' }}>${totalGastosReal.toLocaleString('es-AR')}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Egresos y sueldos del período</span>
            </div>

            <div className="card" style={{ padding: '20px', borderRadius: '12px', borderLeft: '4px solid #137333' }}>
              <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '8px' }}>RENTABILIDAD NETA</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '1.6rem', fontWeight: 700, color: totalMargenNeto >= 0 ? '#137333' : 'var(--color-corp-red)' }}>
                  ${totalMargenNeto.toLocaleString('es-AR')}
                </span>
                <span className="badge" style={{ 
                  backgroundColor: totalMargenNeto >= 0 ? '#e6f4ea' : 'var(--color-danger-bg)', 
                  color: totalMargenNeto >= 0 ? '#137333' : 'var(--color-danger)', 
                  fontSize: '0.75rem', 
                  padding: '2px 6px' 
                }}>{pctMargenConsolidado}%</span>
              </div>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block', marginTop: '4px' }}>Ganancia neta final exacta</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '20px', alignItems: 'stretch' }}>
            
            {/* Tabla de Desglose de Canales */}
            <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 0, marginBottom: '16px' }}>Margen Comercial por Sucursal</h4>
              <div className="table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left' }}>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Sucursal</th>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Vendido</th>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Costo Real (CMV)</th>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600 }}>Margen Bruto</th>
                      <th style={{ padding: '12px', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'center' }}>% Margen</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px', fontWeight: 600 }}>Sucursal A (Oficial)</td>
                      <td style={{ padding: '12px' }}>${officialSales.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>${officialCostReal.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#137333' }}>${Math.round(officialSales - officialCostReal).toLocaleString('es-AR')}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontWeight: 600 }}>
                          {officialSales > 0 ? Math.round(((officialSales - officialCostReal) / officialSales) * 100) : 0}%
                        </span>
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '12px', fontWeight: 600 }}>Sucursal X (Interno)</td>
                      <td style={{ padding: '12px' }}>${internalSales.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '12px', color: 'var(--text-secondary)' }}>${internalCostReal.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '12px', fontWeight: 600, color: '#137333' }}>${Math.round(internalSales - internalCostReal).toLocaleString('es-AR')}</td>
                      <td style={{ padding: '12px', textAlign: 'center' }}>
                        <span className="badge" style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontWeight: 600 }}>
                          {internalSales > 0 ? Math.round(((internalSales - internalCostReal) / internalSales) * 100) : 0}%
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>

            {/* Resumen de Egresos por Categoría */}
            <div className="card" style={{ padding: '24px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column' }}>
              <h4 style={{ fontSize: '1rem', fontWeight: 600, marginTop: 0, marginBottom: '16px' }}>Desglose de Egresos del Período</h4>
              {currentReport?.expenses?.byCategory && currentReport.expenses.byCategory.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', overflowY: 'auto', maxHeight: '180px', flex: 1 }}>
                  {currentReport.expenses.byCategory.map((cat: any, idx: number) => {
                    const pct = totalGastosReal > 0 ? (cat.value / totalGastosReal) * 100 : 0;
                    return (
                      <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                          <span style={{ fontWeight: 500 }}>{cat.name}</span>
                          <span style={{ fontWeight: 600 }}>${cat.value.toLocaleString('es-AR')} ({pct.toFixed(0)}%)</span>
                        </div>
                        <div style={{ width: '100%', height: '5px', backgroundColor: '#f3f4f6', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ 
                            width: `${pct}%`, 
                            height: '100%', 
                            backgroundColor: idx === 0 ? 'var(--color-corp-red)' : 'var(--color-primary)',
                            borderRadius: '2px' 
                          }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '120px', color: 'var(--text-secondary)', gap: '8px' }}>
                  <TrendingDown size={28} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.8rem' }}>Sin gastos registrados en este período.</span>
                </div>
              )}
            </div>

          </div>

        </div>
      )}

      {/* 2. RENTABILIDAD */}
      {activeTab === 'rentabilidad' && (
        <ProfitabilityTab />
      )}

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
                  className="select"
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    width: '100%',
                    cursor: 'pointer',
                    outline: 'none',
                    textAlign: 'left',
                    backgroundColor: 'var(--bg-card)',
                    padding: '10px 16px'
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
                <select className="select" value={selectedSeller} onChange={e => { setSelectedSeller(e.target.value); setHoveredWeekIdx(null); }}>
                  <option value="">Todos los vendedores</option>
                  {sellers.map(s => <option key={s.id} value={s.id}>{s.username.replace('_', ' ').toUpperCase()}</option>)}
                </select>
              </div>
              <div style={{ flex: 1, minWidth: '180px' }}>
                <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Período de Fecha</label>
                <select className="select" value={zoneDatePreset} onChange={e => { setZoneDatePreset(e.target.value); setHoveredWeekIdx(null); }}>
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
                      className="input" 
                      value={zoneStartDate} 
                      onChange={e => { setZoneStartDate(e.target.value); setHoveredWeekIdx(null); }} 
                      style={{ padding: '10px 12px' }}
                    />
                  </div>
                  <div style={{ flex: 1, minWidth: '130px' }}>
                    <label style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Hasta</label>
                    <input 
                      type="date" 
                      className="input" 
                      value={zoneEndDate} 
                      onChange={e => { setZoneEndDate(e.target.value); setHoveredWeekIdx(null); }}
                      style={{ padding: '10px 12px' }}
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

            <div className="card" style={{ padding: '20px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '8px', borderLeft: '4px solid var(--color-corp-red)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>DEUDA EN LA ZONA</span>
                <MapPin size={18} color="var(--color-corp-red)" />
              </div>
              <span style={{ fontSize: '1.8rem', fontWeight: 700, color: 'var(--color-corp-red)' }}>${(zoneData.totalDebt || 0).toLocaleString()}</span>
              <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Saldo total pendiente</span>
            </div>
          </div>

          {/* Gráfico de Facturación Semanal */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', flexWrap: 'wrap', gap: '12px' }}>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0 }}>Evolución de Facturación Semanal</h4>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Visualizar por:</span>
                <select 
                  className="select" 
                  value={selectedRubroChart} 
                  onChange={e => { setSelectedRubroChart(e.target.value); setHoveredWeekIdx(null); }}
                  style={{ padding: '6px 12px', fontSize: '0.8rem', width: 'auto', minWidth: '160px', height: '32px' }}
                >
                  <option value="all">Todas las categorías</option>
                  {availableRubros.map((r: string) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>
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
                      const weeklyVal = getWeeklyVal(week);
                      const heightPct = weeklyVal > 0 ? Math.max((weeklyVal / maxWeeklyAmount) * 100, 3) : 0;
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
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'block' }}>
                      {selectedRubroChart === 'all' ? 'Facturación total' : `Facturación ${selectedRubroChart}`}
                    </span>
                    <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#137333' }}>
                      ${activeWeek ? getWeeklyVal(activeWeek).toLocaleString() : '0'}
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
                        ${activeWeek && activeWeek.count > 0 ? Math.round(getWeeklyVal(activeWeek) / activeWeek.count).toLocaleString() : '0'}
                      </span>
                    </div>
                  </div>
                </div>

              </div>
            )}
          </div>

          {/* NUEVO: Copiloto de Ventas y Resumen de Rubros */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
            
            {/* COPILOTO DE VENTAS */}
            <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Sparkles size={20} color="#1a73e8" />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Copiloto de Ventas (Recomendaciones)</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Acciones comerciales detectadas para esta zona</p>
                </div>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
                {!zoneData.salesRecommendations || zoneData.salesRecommendations.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.85rem' }}>
                    No se detectaron alertas o desvíos en esta zona para el período actual. ¡Buen trabajo!
                  </div>
                ) : (
                  zoneData.salesRecommendations.map((rec: any, idx: number) => {
                    const isHigh = rec.severity === 'high';
                    const isMed = rec.severity === 'medium';
                    let borderLeftColor = '#f2994a'; // low (orange)
                    let iconBg = '#fef3e6';
                    let iconColor = '#f2994a';
                    if (isHigh) {
                      borderLeftColor = 'var(--color-corp-red)'; // high (red)
                      iconBg = '#fdebee';
                      iconColor = 'var(--color-corp-red)';
                    } else if (isMed) {
                      borderLeftColor = '#1a73e8'; // medium (blue)
                      iconBg = '#e8f0fe';
                      iconColor = '#1a73e8';
                    }

                    return (
                      <div 
                        key={idx} 
                        style={{ 
                          padding: '16px', 
                          borderRadius: '8px', 
                          backgroundColor: 'var(--bg-card)', 
                          border: '1px solid var(--border-color)', 
                          borderLeft: `4px solid ${borderLeftColor}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '10px'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{rec.title}</span>
                          <span 
                            style={{ 
                              fontSize: '0.7rem', 
                              fontWeight: 600, 
                              padding: '2px 8px', 
                              borderRadius: '12px', 
                              backgroundColor: iconBg, 
                              color: iconColor,
                              textTransform: 'uppercase'
                            }}
                          >
                            {rec.type === 'CRITICAL_DROP' ? 'Alerta' : rec.type === 'CROSS_SELLING' ? 'Oportunidad' : 'Stock'}
                          </span>
                        </div>
                        <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>
                          {rec.description}
                        </p>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                          <strong style={{ color: 'var(--text-secondary)' }}>Sugerencia:</strong> {rec.action}
                        </div>
                        {rec.script && (
                          <div 
                            style={{ 
                              padding: '12px', 
                              borderRadius: '6px', 
                              backgroundColor: 'var(--bg-light)', 
                              border: '1px solid var(--border-color)',
                              fontSize: '0.8rem',
                              fontStyle: 'italic',
                              color: 'var(--text-secondary)',
                              position: 'relative'
                            }}
                          >
                            <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontStyle: 'normal' }}>
                              💬 Bajada para Vendedores:
                            </span>
                            "{rec.script}"
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* RENDIMIENTO POR RUBROS */}
            <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
                <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Package size={20} color="#137333" />
                </div>
                <div>
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Rendimiento por Categoría (Rubros)</h4>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Ventas, participación y crecimiento en el período</p>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
                {!zoneData.rubroMetrics || zoneData.rubroMetrics.length === 0 ? (
                  <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.85rem' }}>
                    No se registran ventas categorizadas en esta zona.
                  </div>
                ) : (
                  <div className="table-container" style={{ margin: 0, boxShadow: 'none', border: 'none' }}>
                    <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                      <thead>
                        <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                          <th style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>Rubro</th>
                          <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'right' }}>Total Ventas</th>
                          <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'center' }}>Share</th>
                          <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'right' }}>Tendencia</th>
                        </tr>
                      </thead>
                      <tbody>
                        {zoneData.rubroMetrics.map((r: any, idx: number) => {
                          const isPositive = r.trend > 0;
                          return (
                            <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                              <td style={{ padding: '10px 4px', fontWeight: 600 }}>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span>{r.name}</span>
                                  {r.topProducts && r.topProducts.length > 0 && (
                                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                      Top: {r.topProducts[0]?.name.substring(0, 24)}...
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 600, color: '#137333' }}>
                                ${r.totalSales.toLocaleString()}
                              </td>
                              <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                                <span className="badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.75rem' }}>
                                  {r.percentageOfTotal}%
                                </span>
                              </td>
                              <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                                {r.trend === 0 ? (
                                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>stable</span>
                                ) : (
                                  <span 
                                    style={{ 
                                      fontSize: '0.75rem', 
                                      fontWeight: 700, 
                                      color: isPositive ? '#137333' : 'var(--color-corp-red)',
                                      backgroundColor: isPositive ? '#e6f4ea' : '#fdebee',
                                      padding: '2px 6px',
                                      borderRadius: '4px',
                                      display: 'inline-block'
                                    }}
                                  >
                                    {isPositive ? `▲ +${r.trend}%` : `▼ ${r.trend}%`}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

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
                            <span className="badge" style={{ backgroundColor: '#FCE8E6', color: 'var(--color-corp-red)', fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '4px' }}>
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



      {/* 4. CAJA SEMANAL CONSOLIDADA */}
      {activeTab === 'caja_semanal' && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Barra de Herramientas de la Planilla */}
          <div className="card" style={{ padding: '16px 20px', borderRadius: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', position: 'relative' }}>
              <div style={{ display: 'flex', flexDirection: 'column' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>SEMANA ACTIVA</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <button 
                    onClick={() => setWeeksDropdownOpen(!weeksDropdownOpen)}
                    className="btn btn-secondary"
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 16px', fontSize: '0.9rem', fontWeight: 600 }}
                  >
                    <Calendar size={16} />
                    Semana del {selectedWeekStart || 'Seleccionar'}
                    <span style={{ fontSize: '0.6rem' }}>▼</span>
                  </button>
                  
                  {weeksDropdownOpen && (
                    <>
                      <div onClick={() => setWeeksDropdownOpen(false)} style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 999 }} />
                      <div style={{
                        position: 'absolute',
                        top: '100%',
                        left: 0,
                        zIndex: 1000,
                        backgroundColor: 'var(--bg-card, #fff)',
                        border: '1px solid var(--border-color)',
                        borderRadius: '8px',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                        marginTop: '4px',
                        minWidth: '220px',
                        maxHeight: '250px',
                        overflowY: 'auto',
                        padding: '6px 0'
                      }}>
                        <div style={{ padding: '4px 12px 8px 12px', borderBottom: '1px solid var(--border-color)', marginBottom: '6px' }}>
                          <button 
                            className="btn btn-ghost"
                            onClick={handleCreateNewWeek}
                            style={{ width: '100%', justifyContent: 'center', fontSize: '0.8rem', padding: '6px' }}
                          >
                            <Plus size={14} /> Nueva Semana
                          </button>
                        </div>
                        {weeklyReports.length === 0 ? (
                          <div style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>No hay semanas guardadas</div>
                        ) : (
                          weeklyReports.map((r: any) => (
                            <button
                              key={r.weekStart}
                              onClick={() => handleSelectWeek(r.weekStart)}
                              style={{
                                display: 'block',
                                width: '100%',
                                padding: '8px 16px',
                                textAlign: 'left',
                                border: 'none',
                                background: r.weekStart === selectedWeekStart ? 'var(--bg-light)' : 'transparent',
                                color: 'var(--text-primary)',
                                fontSize: '0.85rem',
                                cursor: 'pointer',
                                fontWeight: r.weekStart === selectedWeekStart ? 600 : 400
                              }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--bg-light)'}
                              onMouseLeave={e => {
                                if (r.weekStart !== selectedWeekStart) {
                                  e.currentTarget.style.backgroundColor = 'transparent';
                                }
                              }}
                            >
                              Semana {r.weekStart}
                            </button>
                          ))
                        )}
                      </div>
                    </>
                  )}
                </div>
              </div>

              {isDirty && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', alignSelf: 'flex-end', marginBottom: '6px' }}>
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: '#f2994a', animation: 'pulse 1.5s infinite' }} />
                  <span style={{ fontSize: '0.78rem', color: '#f2994a', fontWeight: 600 }}>Planilla con cambios sin guardar</span>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '4px' }}>COLCHÓN OPERATIVO (RESULTADO)</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>$</span>
                  <input
                    type="number"
                    value={buffer}
                    onChange={e => { setBuffer(Number(e.target.value) || 0); setIsDirty(true); }}
                    className="input"
                    style={{ width: '130px', padding: '6px 10px', textAlign: 'right', fontWeight: 600, fontSize: '0.9rem' }}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Planillas de Carga Lateral (Compras vs Ventas) */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(480px, 1fr))', gap: '24px' }}>
            
            {/* Columna Compras (Egresos) */}
            <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <DollarSign size={18} color="var(--color-primary)" /> COMPRA SEMANAL
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>EGRESOS Y CRÉDITO</span>
              </div>

              <div className="table-container" style={{ overflow: 'visible' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                      <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600 }}>EMPRESAS</th>
                      <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600, width: '110px' }}>Fecha</th>
                      <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600, width: '130px', textAlign: 'right' }}>$ Monto</th>
                      <th style={{ padding: '8px 4px', width: '40px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {purchases.map((p, idx) => (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '6px 4px' }}>
                          <input
                            type="text"
                            value={p.company}
                            onChange={e => handlePurchaseChange(idx, 'company', e.target.value)}
                            placeholder="Nombre del proveedor"
                            className="input-inline-cell"
                          />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <input
                            type="text"
                            value={p.date || ''}
                            onChange={e => handlePurchaseChange(idx, 'date', e.target.value)}
                            placeholder="DD/MM/AAAA"
                            className="input-inline-cell"
                          />
                        </td>
                        <td style={{ padding: '6px 4px' }}>
                          <input
                            type="number"
                            value={p.amount || ''}
                            onChange={e => handlePurchaseChange(idx, 'amount', Number(e.target.value) || 0)}
                            placeholder="0"
                            className="input-inline-cell"
                            style={{ textAlign: 'right', fontWeight: 600 }}
                          />
                        </td>
                        <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                          <button
                            onClick={() => removePurchaseRow(idx)}
                            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                            onMouseEnter={e => e.currentTarget.style.color = 'var(--color-corp-red)'}
                            onMouseLeave={e => e.currentTarget.style.color = '#666'}
                            title="Eliminar fila"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                    
                    {/* Fila Crédito Rollover */}
                    <tr style={{ backgroundColor: 'var(--bg-light)', fontWeight: 600 }}>
                      <td style={{ padding: '10px 8px', color: 'var(--text-primary)' }}>
                        CRÉDITO (Rollover)
                      </td>
                      <td style={{ padding: '10px 4px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                        Automático
                      </td>
                      <td style={{ padding: '6px 4px' }}>
                        <input
                          type="number"
                          value={credit}
                          onChange={e => { setCredit(Number(e.target.value) || 0); setIsDirty(true); }}
                          className="input-inline-cell"
                          style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-corp-red)', backgroundColor: 'transparent' }}
                        />
                      </td>
                      <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                        {suggestedCredit !== credit && (
                          <button
                            onClick={() => { setCredit(suggestedCredit); setIsDirty(true); }}
                            style={{
                              background: 'none',
                              border: 'none',
                              color: '#1a73e8',
                              cursor: 'pointer',
                              fontSize: '0.72rem',
                              fontWeight: 700,
                              padding: 0
                            }}
                            title={`Restaurar sugerencia: $${suggestedCredit.toLocaleString()}`}
                          >
                            Sugerir
                          </button>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button 
                  className="btn btn-ghost"
                  onClick={addPurchaseRow}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}
                >
                  <Plus size={14} /> Agregar Fila
                </button>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>TOTAL COMPRA (CON CRÉDITO)</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    ${(purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0) + Number(credit)).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

            {/* Columna Ventas (Ingresos) */}
            <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} color="#137333" /> VENTA SEMANAL
                </h3>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    onClick={handleAutofillSales}
                    className="btn btn-ghost"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.78rem',
                      padding: '4px 10px',
                      fontWeight: 600,
                      color: '#137333',
                      borderColor: '#137333',
                      borderWidth: '1px',
                      borderStyle: 'solid',
                      borderRadius: '6px',
                      backgroundColor: 'transparent'
                    }}
                  >
                    <RefreshCw size={12} />
                    Autocompletar desde ERP
                  </button>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', fontWeight: 600 }}>INGRESOS POR LOCALIDAD</span>
                </div>
              </div>


              <div className="table-container">
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                      <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600 }}>LOCALIDADES</th>
                      <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600, width: '90px' }}>Fecha</th>
                      <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600, width: '95px', textAlign: 'right' }}>Imp. A (Ofi)</th>
                      <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600, width: '95px', textAlign: 'right' }}>Imp. X (Int)</th>
                      <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', fontWeight: 600, width: '100px', textAlign: 'right' }}>Total</th>
                      <th style={{ padding: '8px 4px', width: '30px' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sales.map((s, idx) => {
                      const rowTotal = (Number(s.amountA) || 0) + (Number(s.amountX) || 0);
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)' }}>
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="text"
                              value={s.locality}
                              onChange={e => handleSalesChange(idx, 'locality', e.target.value)}
                              placeholder="Nombre de localidad"
                              className="input-inline-cell"
                            />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="text"
                              value={s.date || ''}
                              onChange={e => handleSalesChange(idx, 'date', e.target.value)}
                              placeholder="DD/MM"
                              className="input-inline-cell"
                            />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="number"
                              value={s.amountA || ''}
                              onChange={e => handleSalesChange(idx, 'amountA', Number(e.target.value) || 0)}
                              placeholder="0"
                              className="input-inline-cell"
                              style={{ textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px' }}>
                            <input
                              type="number"
                              value={s.amountX || ''}
                              onChange={e => handleSalesChange(idx, 'amountX', Number(e.target.value) || 0)}
                              placeholder="0"
                              className="input-inline-cell"
                              style={{ textAlign: 'right' }}
                            />
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'right', fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.85rem' }}>
                            ${rowTotal.toLocaleString()}
                          </td>
                          <td style={{ padding: '6px 4px', textAlign: 'center' }}>
                            <button
                              onClick={() => removeSalesRow(idx)}
                              style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', display: 'flex', alignItems: 'center' }}
                              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-corp-red)'}
                              onMouseLeave={e => e.currentTarget.style.color = '#666'}
                              title="Eliminar fila"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '8px' }}>
                <button 
                  className="btn btn-ghost"
                  onClick={addSalesRow}
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}
                >
                  <Plus size={14} /> Agregar Fila
                </button>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', display: 'block' }}>TOTAL VENTAS</span>
                  <span style={{ fontSize: '1.25rem', fontWeight: 700, color: '#137333' }}>
                    ${sales.reduce((sum, s) => sum + (Number(s.amountA) || 0) + (Number(s.amountX) || 0), 0).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>

          </div>

          {/* Tarjeta de Cierre y Acciones */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '24px', backgroundColor: 'var(--bg-light)', border: '1px solid var(--border-color)' }}>
            <div>
              <h4 style={{ margin: '0 0 6px 0', fontSize: '1.05rem', fontWeight: 700 }}>Resumen Financiero de la Semana</h4>
              <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginTop: '12px' }}>
                <div>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>VENTAS TOTALES (A + X)</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 700, color: '#137333' }}>
                    +${sales.reduce((sum, s) => sum + (Number(s.amountA) || 0) + (Number(s.amountX) || 0), 0).toLocaleString()}
                  </span>
                </div>
                <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>COMPRAS (PROVEEDORES)</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                    -${purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0).toLocaleString()}
                  </span>
                </div>
                <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>CRÉDITO INICIAL</span>
                  <span style={{ fontSize: '1.15rem', fontWeight: 700, color: credit < 0 ? 'var(--color-corp-red)' : 'var(--text-primary)' }}>
                    ${credit.toLocaleString()}
                  </span>
                </div>
                
                {(() => {
                  const sTot = sales.reduce((sum, s) => sum + (Number(s.amountA) || 0) + (Number(s.amountX) || 0), 0);
                  const pTot = purchases.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
                  const netWeekly = sTot - pTot;
                  const finalCredit = (pTot + credit + buffer) - sTot;

                  return (
                    <>
                      <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px' }}>
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', display: 'block' }}>FLUJO NETO OPERATIVO</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 700, color: netWeekly >= 0 ? '#137333' : 'var(--color-corp-red)' }}>
                          {netWeekly >= 0 ? '+' : ''}${netWeekly.toLocaleString()}
                        </span>
                      </div>
                      <div style={{ borderLeft: '1px solid var(--border-color)', paddingLeft: '24px', backgroundColor: '#e6f4ea', padding: '6px 14px', borderRadius: '8px' }}>
                        <span style={{ fontSize: '0.75rem', color: '#137333', display: 'block', fontWeight: 600 }}>PROYECTAR CRÉDITO SEMANA SIGUIENTE</span>
                        <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#137333' }}>
                          ${Math.round(finalCredit).toLocaleString()}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>
            
            <div style={{ display: 'flex', gap: '12px' }}>
              {weeklyReports.some(r => r.weekStart === selectedWeekStart) && (
                <button
                  className="btn btn-secondary"
                  onClick={handleDeleteWeekly}
                  disabled={saving}
                  style={{ borderColor: 'var(--color-corp-red)', color: 'var(--color-corp-red)', padding: '10px 16px' }}
                >
                  <Trash2 size={16} />
                  Eliminar Cierre
                </button>
              )}
              <button
                className="btn btn-primary"
                onClick={handleSaveWeekly}
                disabled={saving}
                style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 20px', fontWeight: 600 }}
              >
                <Save size={16} />
                {saving ? 'Guardando...' : 'Guardar Cierre Semanal'}
              </button>
            </div>
          </div>

          {/* Historial y Gráfico de Evolución */}
          <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
            <h4 style={{ margin: '0 0 4px 0', fontSize: '1.1rem', fontWeight: 700 }}>Evolución Financiera Histórica Semanal</h4>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 24px 0' }}>
              Evolución de la deuda (Crédito) de las últimas semanas cargadas en el sistema.
            </p>

            {weeklyReports.length < 2 ? (
              <div style={{ height: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
                Se necesitan al menos 2 semanas cerradas para visualizar los gráficos de evolución histórica.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                
                {/* Visual Line Chart (CSS/SVG Minimal) */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>TENDENCIA DE DEUDA (CRÉDITO SEMANAL)</span>
                  
                  <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', height: '160px', borderBottom: '1px solid var(--border-color)', paddingBottom: '10px', gap: '12px' }}>
                    {(() => {
                      const maxAbs = Math.max(...weeklyReports.map(x => Math.abs(Number(x.credit) || 0)), 1);

                      return weeklyReports.map((r) => {
                        const crVal = Number(r.credit) || 0;
                        const absCr = Math.abs(crVal);
                        const heightPct = Math.max((absCr / maxAbs) * 100, 4);
                        const isCurrent = r.weekStart === selectedWeekStart;

                        return (
                          <div
                            key={r.weekStart}
                            onClick={() => handleSelectWeek(r.weekStart)}
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
                            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: isCurrent ? 'var(--color-primary)' : 'var(--text-secondary)', marginBottom: '4px' }}>
                              -${Math.round(absCr / 1000000)}M
                            </span>
                            <div
                              style={{
                                width: '100%',
                                maxWidth: '40px',
                                height: `${heightPct}%`,
                                backgroundColor: isCurrent ? 'var(--color-corp-red)' : 'var(--text-secondary)',
                                borderRadius: '4px 4px 0 0',
                                transition: 'all 0.2s',
                                opacity: isCurrent ? 1 : 0.6
                              }}
                            />
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '8px', fontWeight: isCurrent ? 700 : 400 }}>
                              {r.weekStart.substring(5)}
                            </span>
                          </div>
                        );
                      });
                    })()}
                  </div>
                </div>

              </div>
            )}
          </div>
          
          <style>{`
            .input-inline-cell {
              width: 100%;
              border: 1px solid transparent;
              background-color: transparent;
              padding: 6px 8px;
              font-size: 0.85rem;
              color: var(--text-primary);
              border-radius: 4px;
              transition: all 0.15s;
              outline: none;
            }
            .input-inline-cell:focus {
              border-color: var(--border-color);
              background-color: var(--bg-card);
              box-shadow: 0 1px 2px rgba(0,0,0,0.05);
            }
            .input-inline-cell:hover {
              background-color: var(--bg-light);
            }
          `}</style>
        </div>
      )}

      {/* 5. Alertas + IA */}
      {activeTab === 'crm' && (
        <div className="fade-in">
          <CrmDashboard />
        </div>
      )}

      {/* 6. ARCA */}
      {activeTab === 'arca' && (
        <div className="fade-in">
          <AfipExportDashboard />
        </div>
      )}
    </div>
  );
}
