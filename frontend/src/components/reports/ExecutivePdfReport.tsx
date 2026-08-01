import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import { Printer, Download, Calendar, RefreshCw, AlertCircle, TrendingUp, TrendingDown, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface ExecutivePdfReportProps {
  onClose?: () => void;
}

export default function ExecutivePdfReport({ onClose }: ExecutivePdfReportProps) {
  const [periodType, setPeriodType] = useState<'week' | 'month' | 'prev_week' | 'prev_month' | 'custom'>('month');
  
  // Rango de fechas
  const [startDate, setStartDate] = useState<string>(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return new Date().toISOString().split('T')[0];
  });

  const [loading, setLoading] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    handlePeriodTypeChange(periodType);
  }, [periodType]);

  const handlePeriodTypeChange = (type: string) => {
    const now = new Date();
    if (type === 'month') {
      const start = new Date(now.getFullYear(), now.getMonth(), 1);
      const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } else if (type === 'prev_month') {
      const start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const end = new Date(now.getFullYear(), now.getMonth(), 0);
      setStartDate(start.toISOString().split('T')[0]);
      setEndDate(end.toISOString().split('T')[0]);
    } else if (type === 'week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1); // Lunes
      const monday = new Date(now.setDate(diff));
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 6);
      setStartDate(monday.toISOString().split('T')[0]);
      setEndDate(sunday.toISOString().split('T')[0]);
    } else if (type === 'prev_week') {
      const day = now.getDay();
      const diff = now.getDate() - day + (day === 0 ? -6 : 1) - 7;
      const prevMonday = new Date(now.setDate(diff));
      const prevSunday = new Date(prevMonday);
      prevSunday.setDate(prevMonday.getDate() + 6);
      setStartDate(prevMonday.toISOString().split('T')[0]);
      setEndDate(prevSunday.toISOString().split('T')[0]);
    }
  };

  const fetchReportData = async () => {
    setLoading(true);
    setError(null);
    try {
      const reportData = await api.getExecutivePdfReport(startDate, endDate);
      if (reportData) {
        setData(reportData);
      } else {
        setError('No se pudieron obtener los datos del reporte.');
      }
    } catch (e: any) {
      console.error("Error al cargar reporte ejecutivo:", e);
      setError(e.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current) return;
    setGeneratingPdf(true);
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdfWidth = 210; // A4
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Reporte_Ejecutivo_${startDate}_a_${endDate}.pdf`);
    } catch (err) {
      console.error('Error al descargar PDF:', err);
      alert('Ocurrió un error al descargar el PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }).format(val || 0);
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return '';
    const d = new Date(dateStr);
    return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  return (
    <div style={{ padding: '20px', backgroundColor: '#f8fafc', minHeight: '100vh' }}>
      
      {/* CSS para Impresión A4 impecable */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .no-print {
            display: none !important;
          }
          #executive-report-container, #executive-report-container * {
            visibility: visible;
          }
          #executive-report-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
          }
          .page-break {
            page-break-before: always;
          }
        }
      `}</style>

      {/* BARRA SUPERIOR DE FILTROS Y ACCIONES (NO SE IMPRIME) */}
      <div className="no-print" style={{ 
        backgroundColor: '#fff', 
        borderRadius: '10px', 
        padding: '16px 24px', 
        marginBottom: '24px', 
        border: '1px solid #e2e8f0',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        gap: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.05)'
      }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={22} color="var(--color-corp-red)" />
            Reporte Ejecutivo para la Dirección
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            Auditoría consolidada de ventas, margen bruto, cobranzas y rendimiento operativo.
          </p>
        </div>

        {/* Filtros de Fecha */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          <div style={{ display: 'flex', gap: '4px', backgroundColor: '#f1f5f9', padding: '3px', borderRadius: '6px' }}>
            <button
              onClick={() => setPeriodType('week')}
              style={{
                fontSize: '0.78rem',
                padding: '5px 10px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: periodType === 'week' ? '#fff' : 'transparent',
                fontWeight: periodType === 'week' ? 600 : 400,
                color: periodType === 'week' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                boxShadow: periodType === 'week' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Esta Semana
            </button>
            <button
              onClick={() => setPeriodType('month')}
              style={{
                fontSize: '0.78rem',
                padding: '5px 10px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: periodType === 'month' ? '#fff' : 'transparent',
                fontWeight: periodType === 'month' ? 600 : 400,
                color: periodType === 'month' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                boxShadow: periodType === 'month' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Este Mes
            </button>
            <button
              onClick={() => setPeriodType('prev_month')}
              style={{
                fontSize: '0.78rem',
                padding: '5px 10px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: periodType === 'prev_month' ? '#fff' : 'transparent',
                fontWeight: periodType === 'prev_month' ? 600 : 400,
                color: periodType === 'prev_month' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                boxShadow: periodType === 'prev_month' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Mes Anterior
            </button>
            <button
              onClick={() => setPeriodType('custom')}
              style={{
                fontSize: '0.78rem',
                padding: '5px 10px',
                borderRadius: '4px',
                border: 'none',
                backgroundColor: periodType === 'custom' ? '#fff' : 'transparent',
                fontWeight: periodType === 'custom' ? 600 : 400,
                color: periodType === 'custom' ? '#0f172a' : '#64748b',
                cursor: 'pointer',
                boxShadow: periodType === 'custom' ? '0 1px 2px rgba(0,0,0,0.1)' : 'none'
              }}
            >
              Personalizado
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <Calendar size={15} color="#64748b" />
            <input 
              type="date" 
              className="input" 
              value={startDate} 
              onChange={e => { setStartDate(e.target.value); setPeriodType('custom'); }} 
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
            />
            <span style={{ fontSize: '0.8rem', color: '#64748b' }}>al</span>
            <input 
              type="date" 
              className="input" 
              value={endDate} 
              onChange={e => { setEndDate(e.target.value); setPeriodType('custom'); }} 
              style={{ fontSize: '0.8rem', padding: '4px 8px' }}
            />
          </div>

          <button
            onClick={fetchReportData}
            disabled={loading}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem' }}
            title="Recargar datos"
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Botones de Exportación */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {onClose && (
            <button onClick={onClose} className="btn btn-secondary" style={{ fontSize: '0.82rem' }}>
              Volver
            </button>
          )}
          <button
            onClick={handleDownloadPdf}
            disabled={loading || generatingPdf || !data}
            className="btn btn-secondary"
            style={{ fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
          >
            <Download size={15} />
            <span>{generatingPdf ? 'Generando...' : 'Descargar PDF'}</span>
          </button>
          <button
            onClick={handlePrint}
            disabled={loading || !data}
            className="btn"
            style={{ 
              fontSize: '0.82rem', 
              backgroundColor: '#0f172a', 
              color: '#fff',
              display: 'inline-flex', 
              alignItems: 'center', 
              gap: '6px' 
            }}
          >
            <Printer size={15} />
            <span>Imprimir A4</span>
          </button>
        </div>

      </div>

      {error && (
        <div style={{ padding: '16px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fca5a5', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <AlertCircle size={18} />
          <span>{error}</span>
        </div>
      )}

      {/* DOCUMENTO IMPRIMIBLE A4 */}
      <div 
        id="executive-report-container"
        ref={reportRef}
        style={{
          width: '210mm',
          minHeight: '297mm',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          padding: '24mm 20mm',
          boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
          borderRadius: '4px',
          fontFamily: 'Inter, system-ui, -apple-system, sans-serif',
          color: '#0f172a',
          boxSizing: 'border-box'
        }}
      >
        {!data ? (
          <div style={{ padding: '60px 0', textAlign: 'center', color: '#64748b' }}>
            <RefreshCw size={24} className="spin" style={{ marginBottom: '12px' }} />
            <div>Cargando datos del informe ejecutivo...</div>
          </div>
        ) : (
          <div>
            
            {/* ENCABEZADO EJECUTIVO CON LOGO ALINEADO Y SUBTÍTULO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '22px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                <img 
                  src="/logo.png" 
                  alt="Logo DV" 
                  style={{ height: '56px', width: 'auto', objectFit: 'contain' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px', borderLeft: '2px solid #e2e8f0', paddingLeft: '12px' }}>
                  Alimentos y Bebidas | Control de Gestión
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                  Informe Ejecutivo de Resultados
                </h1>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '4px' }}>
                  Período: <strong>{formatDate(data.period.startDate)}</strong> al <strong>{formatDate(data.period.endDate)}</strong>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  Generado el {new Date().toLocaleDateString('es-AR')} a las {new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>
            </div>

            {/* CUADROS DE RESUMEN EJECUTIVO (4 CARDS KPIS) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '22px' }}>
              
              <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Ventas Totales ($)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'monospace', color: '#0f172a', marginTop: '4px' }}>
                  {formatCurrency(data.summary.totalSales)}
                </div>
                <div style={{ fontSize: '0.72rem', marginTop: '4px', display: 'flex', alignItems: 'center', gap: '4px', color: data.summary.salesGrowthPct >= 0 ? '#166534' : '#991b1b', fontWeight: 600 }}>
                  {data.summary.salesGrowthPct >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                  <span>{data.summary.salesGrowthPct >= 0 ? `+${data.summary.salesGrowthPct}%` : `${data.summary.salesGrowthPct}%`} vs ant.</span>
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Ganancia Bruta ($)</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'monospace', color: '#166534', marginTop: '4px' }}>
                  {formatCurrency(data.summary.grossProfit)}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#475569', marginTop: '4px', fontWeight: 600 }}>
                  Margen Bruto: <strong style={{ color: '#166534' }}>{data.summary.grossMarginPct}%</strong>
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Cobranza Recaudada</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'monospace', color: '#0369a1', marginTop: '4px' }}>
                  {formatCurrency(data.collections.totalCollected)}
                </div>
                <div style={{ fontSize: '0.72rem', color: '#991b1b', marginTop: '4px' }}>
                  Deuda Pendiente: <strong>{formatCurrency(data.collections.totalPendingDebt)}</strong>
                </div>
              </div>

              <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Volumen Comercial</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, fontFamily: 'monospace', color: '#0f172a', marginTop: '4px' }}>
                  {data.summary.totalBultos.toLocaleString('es-AR')} <span style={{ fontSize: '0.75rem', fontWeight: 500 }}>bultos</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '4px' }}>
                  En <strong>{data.summary.totalOrders}</strong> pedidos entregados
                </div>
              </div>

            </div>

            {/* SECCIÓN 1: FACTURACIÓN CANAL OFICIAL (A) VS INTERNA (X) Y COBRANZAS */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '22px' }}>
              
              {/* Facturación Sucursal A vs Sucursal X */}
              <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  1. Canal de Facturación (Oficial A vs Interna X)
                </h3>
                <table style={{ width: '100%', fontSize: '0.75rem', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid #cbd5e1', textAlign: 'left', color: '#64748b' }}>
                      <th style={{ padding: '4px 0' }}>Sucursal</th>
                      <th style={{ padding: '4px 0', textAlign: 'right' }}>Venta ($)</th>
                      <th style={{ padding: '4px 0', textAlign: 'right' }}>Ganancia ($)</th>
                      <th style={{ padding: '4px 0', textAlign: 'right' }}>Margen %</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '6px 0', fontWeight: 600, color: '#1e40af' }}>Sucursal A (Oficial)</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(data.billingBreakdown.official.sales)}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace', color: '#166534' }}>{formatCurrency(data.billingBreakdown.official.grossProfit)}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                        {data.billingBreakdown.official.sales > 0 ? Math.round((data.billingBreakdown.official.grossProfit / data.billingBreakdown.official.sales) * 100) : 0}%
                      </td>
                    </tr>
                    <tr>
                      <td style={{ padding: '6px 0', fontWeight: 600, color: '#b45309' }}>Sucursal X (Interna)</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace' }}>{formatCurrency(data.billingBreakdown.internal.sales)}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontFamily: 'monospace', color: '#166534' }}>{formatCurrency(data.billingBreakdown.internal.grossProfit)}</td>
                      <td style={{ padding: '6px 0', textAlign: 'right', fontWeight: 600 }}>
                        {data.billingBreakdown.internal.sales > 0 ? Math.round((data.billingBreakdown.internal.grossProfit / data.billingBreakdown.internal.sales) * 100) : 0}%
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Cobranzas por Método de Pago */}
              <div style={{ padding: '14px', borderRadius: '6px', border: '1px solid #e2e8f0', backgroundColor: '#fff' }}>
                <h3 style={{ margin: '0 0 10px 0', fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  2. Recaudación de Cobranzas por Medio
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', fontSize: '0.75rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>💵 Efectivo Rendido (Caja)</span>
                    <strong style={{ fontFamily: 'monospace' }}>{formatCurrency(data.collections.byMethod.cash)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>🏦 Transferencias Bancarias</span>
                    <strong style={{ fontFamily: 'monospace' }}>{formatCurrency(data.collections.byMethod.transfer)}</strong>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px', borderBottom: '1px solid #f1f5f9' }}>
                    <span style={{ color: '#475569' }}>📄 Cheques de Terceros</span>
                    <strong style={{ fontFamily: 'monospace' }}>{formatCurrency(data.collections.byMethod.check)}</strong>
                  </div>
                </div>
              </div>

            </div>

            {/* SECCIÓN 3: TOP 10 CLIENTES MÁS RENTABLES DEL PERÍODO */}
            <div style={{ marginBottom: '22px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                3. Top 10 Clientes Más Rentables del Período
              </h3>
              
              <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '5px 8px' }}>#</th>
                    <th style={{ padding: '5px 8px' }}>Cliente</th>
                    <th style={{ padding: '5px 8px' }}>Localidad</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Suc. A (Oficial)</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Suc. X (Interna)</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Total Venta ($)</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Ganancia ($)</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Margen %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topClients && data.topClients.map((client: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '4px 8px', fontWeight: 600, color: '#0f172a' }}>{client.name}</td>
                      <td style={{ padding: '4px 8px', color: '#64748b' }}>📍 {client.city}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                        {formatCurrency(client.officialSales)}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                        {formatCurrency(client.internalSales)}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                        {formatCurrency(client.totalSales)}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#166534' }}>
                        {formatCurrency(client.profit)}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: client.marginPct >= 20 ? '#166534' : '#b45309' }}>
                        {client.marginPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SECCIÓN 4: TOP 10 PRODUCTOS MÁS VENDIDOS */}
            <div style={{ marginBottom: '22px' }}>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                4. Productos Más Vendidos del Período
              </h3>
              
              <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '5px 8px' }}>#</th>
                    <th style={{ padding: '5px 8px' }}>Producto</th>
                    <th style={{ padding: '5px 8px' }}>Categoría</th>
                    <th style={{ padding: '5px 8px', textAlign: 'center' }}>Bultos / Cantidad</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Total Venta ($)</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Margen %</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((prod: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '4px 8px', fontWeight: 600, color: '#0f172a' }}>{prod.name}</td>
                      <td style={{ padding: '4px 8px', color: '#64748b' }}>{prod.category}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', fontWeight: 600 }}>{prod.quantity.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                        {formatCurrency(prod.amount)}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 600, color: prod.marginPct >= 20 ? '#166534' : '#b45309' }}>
                        {prod.marginPct}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SECCIÓN 5: VENTAS POR LOCALIDAD / ZONA (MINIMALISTA) */}
            <div>
              <h3 style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '10px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                5. Ventas por Zona y Localidad (Sucursal A vs Sucursal X)
              </h3>
              
              <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f8fafc', color: '#475569', textAlign: 'left', borderBottom: '1px solid #e2e8f0' }}>
                    <th style={{ padding: '5px 8px' }}>Localidad / Ruta</th>
                    <th style={{ padding: '5px 8px', textAlign: 'center' }}>Pedidos</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Sucursal A (Oficial)</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Sucursal X (Interna)</th>
                    <th style={{ padding: '5px 8px', textAlign: 'right' }}>Total Facturado ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.citiesSummary.map((c: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px 8px', fontWeight: 600, color: '#0f172a' }}>📍 {c.cityName}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'center', color: '#64748b' }}>{c.ordersCount}</td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                        {formatCurrency(c.officialSales || 0)}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontFamily: 'monospace', color: '#475569' }}>
                        {formatCurrency(c.internalSales || 0)}
                      </td>
                      <td style={{ padding: '4px 8px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#0f172a' }}>
                        {formatCurrency(c.totalSales || c.sales || 0)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* FIRMA Y PIE DE PÁGINA */}
            <div style={{ marginTop: '36px', paddingTop: '16px', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.7rem', color: '#94a3b8' }}>
              <div>ERP-CRM DV | Distribuidora de Alimentos y Bebidas</div>
              <div>Documento Confidencial para Uso Exclusivo de la Dirección</div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
