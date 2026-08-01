import { useState, useEffect, useRef } from 'react';
import { api } from '../../utils/api';
import { Printer, Download, Calendar, RefreshCw, AlertCircle, Users, AlertTriangle, Lightbulb, CheckCircle2, TrendingUp } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface SellerMeetingPdfReportProps {
  sellers: any[];
  initialSellerId?: number;
  onClose?: () => void;
}

export default function SellerMeetingPdfReport({ sellers, initialSellerId, onClose }: SellerMeetingPdfReportProps) {
  const [selectedSellerId, setSelectedSellerId] = useState<number>(() => {
    if (initialSellerId) return initialSellerId;
    return sellers && sellers.length > 0 ? sellers[0].id : 0;
  });

  const [periodType, setPeriodType] = useState<'week' | 'month' | 'prev_week' | 'prev_month' | 'custom'>('month');
  
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
      const diff = now.getDate() - day + (day === 0 ? -6 : 1);
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
    if (!selectedSellerId) return;
    setLoading(true);
    setError(null);
    try {
      const reportData = await api.getSellerMeetingPdfReport(selectedSellerId, startDate, endDate);
      if (reportData) {
        setData(reportData);
      } else {
        setError('No se pudieron obtener los datos de la reunión para este vendedor.');
      }
    } catch (e: any) {
      console.error("Error al cargar reporte de reunión de vendedor:", e);
      setError(e.message || 'Error al conectar con el servidor.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReportData();
  }, [selectedSellerId, startDate, endDate]);

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadPdf = async () => {
    if (!reportRef.current || !data) return;
    setGeneratingPdf(true);
    try {
      const element = reportRef.current;
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff'
      });
      const imgData = canvas.toDataURL('image/jpeg', 0.95);
      const pdfWidth = 210;
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: [pdfWidth, pdfHeight]
      });

      pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`Reunion_Vendedor_${data.seller.name}_${startDate}.pdf`);
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
          #seller-meeting-report-container, #seller-meeting-report-container * {
            visibility: visible;
          }
          #seller-meeting-report-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            box-shadow: none !important;
            background: #fff !important;
          }
        }
      `}</style>

      {/* BARRA SUPERIOR DE FILTROS Y SELECCIÓN DE VENDEDOR (NO SE IMPRIME) */}
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
            <Users size={22} color="var(--color-corp-red)" />
            Ficha de Desempeño para Reunión 1 a 1 de Ventas
          </h2>
          <p style={{ margin: '2px 0 0 0', fontSize: '0.82rem', color: '#64748b' }}>
            Informe individual con métricas de ventas, cobertura, cobranza y temas clave de discusión.
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          
          {/* Selector de Vendedor */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#0f172a' }}>Vendedor:</span>
            <select
              className="input"
              value={selectedSellerId}
              onChange={e => setSelectedSellerId(Number(e.target.value))}
              style={{ fontSize: '0.85rem', fontWeight: 600, padding: '5px 10px', minWidth: '180px' }}
            >
              {sellers.map(s => (
                <option key={s.id} value={s.id}>
                  {s.username ? s.username.toUpperCase() : s.name}
                </option>
              ))}
            </select>
          </div>

          {/* Filtros de Período */}
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
                cursor: 'pointer'
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
                cursor: 'pointer'
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
                cursor: 'pointer'
              }}
            >
              Mes Anterior
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
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
          </button>
        </div>

        {/* Acciones de exportación */}
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
            <span>Imprimir Ficha A4</span>
          </button>
        </div>

      </div>

      {error && (
        <div style={{ padding: '16px', backgroundColor: '#fef2f2', color: '#991b1b', borderRadius: '8px', border: '1px solid #fca5a5', marginBottom: '20px' }}>
          <AlertCircle size={18} inline style={{ marginRight: '8px' }} />
          {error}
        </div>
      )}

      {/* DOCUMENTO IMPRIMIBLE A4 */}
      <div 
        id="seller-meeting-report-container"
        ref={reportRef}
        style={{
          width: '210mm',
          minHeight: '297mm',
          margin: '0 auto',
          backgroundColor: '#ffffff',
          padding: '22mm 18mm',
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
            <div>Cargando ficha del vendedor...</div>
          </div>
        ) : (
          <div>
            
            {/* ENCABEZADO FICHA DE VENDEDOR CON LOGO */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '2px solid #0f172a', paddingBottom: '14px', marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <img 
                  src="/logo.png" 
                  alt="Logo DV" 
                  style={{ height: '48px', width: 'auto', objectFit: 'contain' }}
                  onError={(e) => { e.currentTarget.style.display = 'none'; }}
                />
                <div>
                  <div style={{ fontSize: '1.3rem', fontWeight: 900, color: 'var(--color-corp-red)', letterSpacing: '0.5px' }}>
                    DISTRIBUIDORA DV
                  </div>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px', marginTop: '2px' }}>
                    Reunión Individual de Ventas y Desempeño
                  </div>
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <h1 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: '#0f172a', textTransform: 'uppercase' }}>
                  Vendedor: {data.seller.name}
                </h1>
                <div style={{ fontSize: '0.78rem', color: '#475569', marginTop: '3px' }}>
                  Período Evaluado: <strong>{formatDate(data.period.startDate)}</strong> al <strong>{formatDate(data.period.endDate)}</strong>
                </div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8', marginTop: '2px' }}>
                  Clientes Asignados en Cartera: <strong>{data.seller.totalAssignedClients}</strong>
                </div>
              </div>
            </div>

            {/* TARJETAS DE RENDIMIENTO INDIVIDUAL (4 KPIS) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px', marginBottom: '20px' }}>
              
              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Total Vendido ($)</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'monospace', color: '#0f172a', marginTop: '3px' }}>
                  {formatCurrency(data.performance.totalSales)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                  Ped: <strong>{data.performance.totalOrders}</strong> | Bultos: <strong>{data.performance.totalBultos}</strong>
                </div>
              </div>

              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Cobertura de Cartera</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'monospace', color: data.performance.portfolioCoveragePct >= 60 ? '#166534' : '#991b1b', marginTop: '3px' }}>
                  {data.performance.portfolioCoveragePct}%
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                  <strong>{data.performance.activeBuyingClientsCount}</strong> de <strong>{data.seller.totalAssignedClients}</strong> clientes
                </div>
              </div>

              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Ticket Promedio</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'monospace', color: '#0369a1', marginTop: '3px' }}>
                  {formatCurrency(data.performance.averageTicketPerClient)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                  por cliente activo
                </div>
              </div>

              <div style={{ padding: '10px', borderRadius: '6px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0' }}>
                <div style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 600, textTransform: 'uppercase' }}>Deuda Cartera</div>
                <div style={{ fontSize: '1.15rem', fontWeight: 800, fontFamily: 'monospace', color: data.collections.totalCarteraDebt > 1000000 ? '#991b1b' : '#0f172a', marginTop: '3px' }}>
                  {formatCurrency(data.collections.totalCarteraDebt)}
                </div>
                <div style={{ fontSize: '0.7rem', color: '#64748b', marginTop: '2px' }}>
                  Cobrado: <strong>{formatCurrency(data.collections.totalCollected)}</strong>
                </div>
              </div>

            </div>

            {/* SECCIÓN ESPECIAL: TEMAS DE DISCUSIÓN & PUNTOS DE MEJORA RECOMENDADOS EN LA REUNIÓN */}
            <div style={{ marginBottom: '20px' }}>
              <h3 style={{ fontSize: '0.82rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '6px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                <Lightbulb size={16} color="#b45309" />
                Temas Clave y Puntos de Discusión para la Reunión
              </h3>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {data.actionInsights.map((insight: any, idx: number) => (
                  <div key={idx} style={{ 
                    padding: '8px 12px', 
                    borderRadius: '6px', 
                    backgroundColor: insight.type === 'warning' ? '#fff7ed' : insight.type === 'opportunity' ? '#eff6ff' : '#f0fdf4',
                    border: insight.type === 'warning' ? '1px solid #ffedd5' : insight.type === 'opportunity' ? '1px solid #dbeafe' : '1px solid #bbf7d0',
                    color: insight.type === 'warning' ? '#9a3412' : insight.type === 'opportunity' ? '#1e40af' : '#166534',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '10px'
                  }}>
                    {insight.type === 'warning' ? (
                      <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : insight.type === 'opportunity' ? (
                      <Lightbulb size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    ) : (
                      <CheckCircle2 size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                    )}
                    <div>
                      <strong style={{ fontSize: '0.78rem', display: 'block' }}>{insight.title}</strong>
                      <span style={{ fontSize: '0.74rem', opacity: 0.9 }}>{insight.description}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* TABLAS DE DETALLE (DOS COLUMNAS: CLIENTES INACTIVOS Y DEUDA DE CARTERA) */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '20px' }}>
              
              {/* Clientes Inactivos */}
              <div>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#991b1b', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                  Clientes Sin Compras en el Período ({data.inactiveClients.length})
                </h3>

                {data.inactiveClients.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: '#166534', fontStyle: 'italic', padding: '10px 0' }}>
                    ¡Excelente! Todos los clientes de la cartera compraron en el período.
                  </div>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                        <th style={{ padding: '5px 6px' }}>Cliente</th>
                        <th style={{ padding: '5px 6px' }}>Pueblo / Ruta</th>
                        <th style={{ padding: '5px 6px', textAlign: 'right' }}>Deuda ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.inactiveClients.map((client: any) => (
                        <tr key={client.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '4px 6px', fontWeight: 600, color: '#0f172a' }}>{client.name}</td>
                          <td style={{ padding: '4px 6px', color: '#64748b' }}>📍 {client.city}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontFamily: 'monospace', color: client.balance > 0 ? '#991b1b' : '#64748b' }}>
                            {formatCurrency(client.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Mayor Deuda Acumulada */}
              <div>
                <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                  Principales Clientes con Saldo Pendiente ({data.debtorClients.length})
                </h3>

                {data.debtorClients.length === 0 ? (
                  <div style={{ fontSize: '0.75rem', color: '#64748b', fontStyle: 'italic', padding: '10px 0' }}>
                    No hay clientes con saldo pendiente en esta cartera.
                  </div>
                ) : (
                  <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                        <th style={{ padding: '5px 6px' }}>Cliente</th>
                        <th style={{ padding: '5px 6px' }}>Pueblo</th>
                        <th style={{ padding: '5px 6px', textAlign: 'right' }}>Saldo C/C ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.debtorClients.map((client: any) => (
                        <tr key={client.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                          <td style={{ padding: '4px 6px', fontWeight: 600, color: '#0f172a' }}>{client.name}</td>
                          <td style={{ padding: '4px 6px', color: '#64748b' }}>📍 {client.city}</td>
                          <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#991b1b' }}>
                            {formatCurrency(client.balance)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

            </div>

            {/* SECCIÓN TOP PRODUCTOS VENDIDOS POR EL VENDEDOR */}
            <div>
              <h3 style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px', borderBottom: '1px solid #cbd5e1', paddingBottom: '4px' }}>
                Productos Más Comercializados por {data.seller.name}
              </h3>
              
              <table style={{ width: '100%', fontSize: '0.73rem', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ backgroundColor: '#f1f5f9', color: '#475569', textAlign: 'left' }}>
                    <th style={{ padding: '5px 6px' }}>#</th>
                    <th style={{ padding: '5px 6px' }}>Producto</th>
                    <th style={{ padding: '5px 6px' }}>Categoría</th>
                    <th style={{ padding: '5px 6px', textAlign: 'center' }}>Bultos Vendidos</th>
                    <th style={{ padding: '5px 6px', textAlign: 'right' }}>Total Venta ($)</th>
                  </tr>
                </thead>
                <tbody>
                  {data.topProducts.map((prod: any, idx: number) => (
                    <tr key={idx} style={{ borderBottom: '1px solid #f1f5f9' }}>
                      <td style={{ padding: '4px 6px', fontWeight: 700, color: '#64748b' }}>{idx + 1}</td>
                      <td style={{ padding: '4px 6px', fontWeight: 600, color: '#0f172a' }}>{prod.name}</td>
                      <td style={{ padding: '4px 6px', color: '#64748b' }}>{prod.category}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'center', fontWeight: 600 }}>{prod.quantity.toLocaleString('es-AR')}</td>
                      <td style={{ padding: '4px 6px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>
                        {formatCurrency(prod.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* SECCIÓN DE COMPROMISOS Y FIRMA */}
            <div style={{ marginTop: '28px', paddingTop: '12px', borderTop: '1px dashed #cbd5e1', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <div style={{ width: '60%' }}>
                <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>Compromisos Acordados en la Reunión:</div>
                <div style={{ borderBottom: '1px solid #cbd5e1', minHeight: '18px', marginBottom: '6px' }}></div>
                <div style={{ borderBottom: '1px solid #cbd5e1', minHeight: '18px' }}></div>
              </div>
              <div style={{ textAlign: 'center', width: '30%' }}>
                <div style={{ borderBottom: '1px solid #0f172a', width: '100%', marginBottom: '4px' }}></div>
                <div style={{ fontSize: '0.7rem', fontWeight: 600, color: '#475569' }}>Firma del Vendedor</div>
              </div>
            </div>

          </div>
        )}
      </div>

    </div>
  );
}
