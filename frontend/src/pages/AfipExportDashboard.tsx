import { useState, useEffect } from 'react';
import { API_BASE_URL } from '../utils/api';
import { FileText, FileDown, AlertCircle, TrendingUp, TrendingDown, CheckCircle2 } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AfipExportDashboard() {
  const date = new Date();
  const [month, setMonth] = useState<number>(date.getMonth() + 1);
  const [year, setYear] = useState<number>(date.getFullYear());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [progressMsg, setProgressMsg] = useState<string | null>(null);

  // Estados para el Monitor de Correlación
  const [fetchingMetrics, setFetchingMetrics] = useState(false);
  const [metrics, setMetrics] = useState({ ventasNeto: 0, ventasIva: 0, ventasTotal: 0, comprasNeto: 0, comprasIva: 0, comprasTotal: 0 });

  const months = [
    { value: 1, label: 'Enero' },
    { value: 2, label: 'Febrero' },
    { value: 3, label: 'Marzo' },
    { value: 4, label: 'Abril' },
    { value: 5, label: 'Mayo' },
    { value: 6, label: 'Junio' },
    { value: 7, label: 'Julio' },
    { value: 8, label: 'Agosto' },
    { value: 9, label: 'Septiembre' },
    { value: 10, label: 'Octubre' },
    { value: 11, label: 'Noviembre' },
    { value: 12, label: 'Diciembre' }
  ];

  useEffect(() => {
    fetchMetrics();
    // eslint-disable-next-line
  }, [month, year]);

  const fetchMetrics = async () => {
    try {
      setFetchingMetrics(true);
      const res = await fetch(`${API_BASE_URL}/iva/export?month=${month}&year=${year}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al obtener datos fiscales');
      const { data } = await res.json();
      
      let vNeto = 0, vIva = 0, vTotal = 0;
      data.ventasData.forEach((v: any) => {
        vNeto += (v.neto * v.sign);
        vIva += (v.iva * v.sign);
        vTotal += (v.total * v.sign);
      });

      let cNeto = 0, cIva = 0, cTotal = 0;
      data.comprasData.forEach((c: any) => {
        cNeto += (c.neto * c.sign);
        cIva += (c.iva * c.sign);
        cTotal += (c.total * c.sign);
      });

      setMetrics({
        ventasNeto: vNeto,
        ventasIva: vIva,
        ventasTotal: vTotal,
        comprasNeto: cNeto,
        comprasIva: cIva,
        comprasTotal: cTotal
      });
    } catch (err: any) {
      console.error('Error fetching metrics:', err);
    } finally {
      setFetchingMetrics(false);
    }
  };

  const handleDownloadTxt = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setProgressMsg('Conectando con el servidor para exportar registros...');
      await new Promise(r => setTimeout(r, 100));

      const res = await fetch(`${API_BASE_URL}/iva/export?month=${month}&year=${year}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al generar los archivos AFIP');
      const { data } = await res.json();
      
      setProgressMsg('Comprimiendo y empaquetando archivos oficiales TXT...');
      await new Promise(r => setTimeout(r, 100));

      const { txt } = data;
      const JSZip = (await import('jszip')).default;
      const zip = new JSZip();
      
      Object.keys(txt).forEach(filename => {
        if (txt[filename]) {
          zip.file(filename, txt[filename]);
        }
      });
      
      const content = await zip.generateAsync({ type: 'blob' });
      const url = window.URL.createObjectURL(content);
      const a = document.createElement('a');
      a.href = url;
      a.download = `AFIP_Export_${year}_${month.toString().padStart(2, '0')}.zip`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      
      setProgressMsg('Descarga completada.');
      await new Promise(r => setTimeout(r, 600));
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
      setProgressMsg(null);
    }
  };

  const formatCurrency = (val: number) => {
    return '$ ' + Number(val).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const generatePDFs = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      setProgressMsg('Conectando con el servidor y obteniendo datos fiscales...');
      await new Promise(r => setTimeout(r, 150));

      const res = await fetch(`${API_BASE_URL}/iva/export?month=${month}&year=${year}`, {
        credentials: 'include',
      });
      if (!res.ok) throw new Error('Error al obtener datos para PDF');
      const { data } = await res.json();

      setProgressMsg('Procesando y tabulando Libro IVA Ventas...');
      await new Promise(r => setTimeout(r, 150));

      const ventasRows = data.ventasData.map((v: any) => {
        const d = new Date(v.fecha);
        const fStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth() + 1).toString().padStart(2,'0')}/${d.getFullYear()}`;
        return [
          fStr,
          v.tipo,
          v.numero,
          v.persona.name || '',
          v.persona.cuit || '',
          formatCurrency(v.neto * v.sign),
          '$ 0,00',
          formatCurrency(v.iva * v.sign),
          formatCurrency(v.percepciones * v.sign),
          '$ 0,00',
          formatCurrency(v.total * v.sign)
        ];
      });

      setProgressMsg('Generando archivo PDF de IVA Ventas...');
      await new Promise(r => setTimeout(r, 150));

      const docVentas = new jsPDF('landscape');
      docVentas.setFontSize(16);
      docVentas.text('LIBRO I.V.A. - VENTAS', 140, 15, { align: 'center' });
      
      docVentas.setFontSize(10);
      docVentas.text(`Empresa: DISTRIBUIDORA DV`, 14, 25);
      docVentas.text(`Periodo: 01/${month.toString().padStart(2,'0')}/${year} - 31/${month.toString().padStart(2,'0')}/${year}`, 14, 30);
      
      autoTable(docVentas, {
        startY: 35,
        head: [['Fecha', 'Comprobante', 'Numero', 'Persona', 'CUIT/DNI', 'Neto Gravado', 'Exento', 'IVA', 'Percepciones', 'Retenciones', 'Total']],
        body: ventasRows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
      docVentas.save(`Subdiario_Ventas_${year}_${month.toString().padStart(2,'0')}.pdf`);

      setProgressMsg('Procesando y tabulando Libro IVA Compras...');
      await new Promise(r => setTimeout(r, 150));

      const comprasRows = data.comprasData.map((c: any) => {
        const d = new Date(c.fecha);
        const fStr = `${d.getDate().toString().padStart(2,'0')}/${(d.getMonth() + 1).toString().padStart(2,'0')}/${d.getFullYear()}`;
        return [
          fStr,
          c.tipo,
          c.numero,
          c.persona.name || '',
          c.persona.cuit || '',
          formatCurrency(c.neto * c.sign),
          '$ 0,00',
          formatCurrency(c.iva * c.sign),
          formatCurrency(c.percepciones * c.sign),
          '$ 0,00',
          formatCurrency(c.total * c.sign)
        ];
      });

      setProgressMsg('Generando archivo PDF de IVA Compras...');
      await new Promise(r => setTimeout(r, 150));

      const docCompras = new jsPDF('landscape');
      docCompras.setFontSize(16);
      docCompras.text('LIBRO I.V.A. - COMPRAS', 140, 15, { align: 'center' });
      
      docCompras.setFontSize(10);
      docCompras.text(`Empresa: DISTRIBUIDORA DV`, 14, 25);
      docCompras.text(`Periodo: 01/${month.toString().padStart(2,'0')}/${year} - 31/${month.toString().padStart(2,'0')}/${year}`, 14, 30);
      
      autoTable(docCompras, {
        startY: 35,
        head: [['Fecha', 'Comprobante', 'Numero', 'Proveedor', 'CUIT', 'Neto Gravado', 'Exento', 'IVA Crédito', 'Percepciones', 'Retenciones', 'Total']],
        body: comprasRows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
      docCompras.save(`Subdiario_Compras_${year}_${month.toString().padStart(2,'0')}.pdf`);

      setProgressMsg('Descargas finalizadas con éxito.');
      await new Promise(r => setTimeout(r, 600));

    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
      setProgressMsg(null);
    }
  };

  // Cálculos para el monitor
  const sumTotal = metrics.ventasTotal + metrics.comprasTotal || 1;
  const ventasPerc = Math.max((metrics.ventasTotal / sumTotal) * 100, 0);
  const comprasPerc = Math.max((metrics.comprasTotal / sumTotal) * 100, 0);

  // Lógica del semáforo
  // Un margen saludable suele ser Ventas > Compras, pero si Ventas son DEMASIADO altas respecto a compras, pagan mucho IVA/Ganancias.
  // Si Compras son DEMASIADO altas respecto a Ventas, genera saldo a favor y levanta sospechas de evasión.
  const isVentasTooHigh = metrics.ventasTotal > metrics.comprasTotal * 1.5; // Ventas 50% mayores que compras
  const isComprasTooHigh = metrics.comprasTotal > metrics.ventasTotal * 1.2; // Compras 20% mayores que ventas

  let statusColor = '#000000';
  let statusIcon = <CheckCircle2 size={18} />;
  let statusText = 'Correlación balanceada.';
  let statusDesc = 'La proporción entre compras y ventas en blanco es razonable.';
  let alertStyle = { bg: '#F8F9FA', border: '#E9ECEF', text: '#495057' };

  if (metrics.ventasTotal === 0 && metrics.comprasTotal === 0) {
    statusColor = '#6c757d';
    statusText = 'Sin movimientos.';
    statusDesc = 'No hay compras ni ventas registradas en el período.';
  } else if (isVentasTooHigh) {
    statusColor = '#D97706'; // Naranja / Ambar
    statusIcon = <TrendingUp size={18} />;
    statusText = 'Atención: Ventas elevadas.';
    statusDesc = 'Estás facturando (Ventas en blanco) significativamente más de lo que ingresás como compras oficiales. Considerá cargar más comprobantes de proveedores.';
    alertStyle = { bg: '#FFFBEB', border: '#FEF3C7', text: '#92400E' };
  } else if (isComprasTooHigh) {
    statusColor = '#DC2626'; // Rojo
    statusIcon = <TrendingDown size={18} />;
    statusText = 'Alerta: Compras superan Ventas.';
    statusDesc = 'Estás ingresando comprobantes de compras por encima de tus ventas oficiales. Esto puede generar alertas fiscales. Considerá oficializar más ventas.';
    alertStyle = { bg: '#FEF2F2', border: '#FEE2E2', text: '#991B1B' };
  } else {
    statusColor = '#059669'; // Verde
    alertStyle = { bg: '#ECFDF5', border: '#D1FAE5', text: '#065F46' };
  }

  return (
    <div style={{ maxWidth: '850px', margin: '0 auto' }}>
      {errorMsg && (
        <div style={{ backgroundColor: '#FDF6F6', color: '#C5221F', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #FAD2D2' }}>
          {errorMsg}
        </div>
      )}

      <div className="card">
        <h2 className="card-title">Monitor de Correlación Fiscal</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
          Evaluá en tiempo real el balance entre tus compras legales a proveedores y tu facturación de ventas (Sucursal A).
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginBottom: '30px', backgroundColor: '#F8F8FA', padding: '20px', borderRadius: '8px' }}>
          <div className="form-group">
            <label style={{ fontWeight: 600 }}>Mes a liquidar</label>
            <select className="select" value={month} onChange={e => setMonth(Number(e.target.value))}>
              {months.map(m => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label style={{ fontWeight: 600 }}>Año</label>
            <input 
              type="number" 
              className="input" 
              value={year} 
              onChange={e => setYear(Number(e.target.value))} 
              min={2020} 
              max={2100} 
            />
          </div>
        </div>

        {/* Dashboard de Correlación */}
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '10px', padding: '24px', marginBottom: '30px', backgroundColor: '#fff', position: 'relative', overflow: 'hidden' }}>
          {fetchingMetrics && (
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: '3px', backgroundColor: 'var(--bg-light)', overflow: 'hidden' }}>
              <div style={{ width: '30%', height: '100%', backgroundColor: 'var(--color-primary)', animation: 'slide 1.5s infinite linear' }} />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
            {/* KPI Compras */}
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#FAFAFA', border: '1px solid #EEEEEE' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Compras Oficiales</span>
              <span style={{ display: 'block', fontSize: '1.4rem', fontWeight: 700, marginTop: '4px', color: '#111827' }}>
                {formatCurrency(metrics.comprasTotal)}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Neto Gravado: {formatCurrency(metrics.comprasNeto)}</span>
            </div>

            {/* KPI Ventas */}
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#FAFAFA', border: '1px solid #EEEEEE' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ventas Oficiales</span>
              <span style={{ display: 'block', fontSize: '1.4rem', fontWeight: 700, marginTop: '4px', color: '#111827' }}>
                {formatCurrency(metrics.ventasTotal)}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>Neto Gravado: {formatCurrency(metrics.ventasNeto)}</span>
            </div>

            {/* KPI Saldo Técnico */}
            <div style={{ padding: '16px', borderRadius: '8px', backgroundColor: '#FAFAFA', border: '1px solid #EEEEEE' }}>
              <span style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>IVA (Débito vs Crédito)</span>
              <span style={{ display: 'block', fontSize: '1.4rem', fontWeight: 700, marginTop: '4px', color: metrics.ventasIva > metrics.comprasIva ? '#D97706' : '#059669' }}>
                {formatCurrency(metrics.ventasIva - metrics.comprasIva)}
              </span>
              <span style={{ fontSize: '0.75rem', color: '#6B7280' }}>
                {metrics.ventasIva > metrics.comprasIva ? 'A Pagar (Saldo favor AFIP)' : 'Saldo a Favor (Crédito)'}
              </span>
            </div>
          </div>

          {/* Barra de Proporción Visual */}
          <div style={{ marginBottom: '16px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              <span>Compras ({comprasPerc.toFixed(1)}%)</span>
              <span>Ventas ({ventasPerc.toFixed(1)}%)</span>
            </div>
            <div style={{ width: '100%', height: '12px', backgroundColor: '#F3F4F6', borderRadius: '6px', display: 'flex', overflow: 'hidden' }}>
              <div style={{ width: `${comprasPerc}%`, backgroundColor: '#3B82F6', transition: 'width 0.5s ease' }} />
              <div style={{ width: `${ventasPerc}%`, backgroundColor: '#10B981', transition: 'width 0.5s ease' }} />
            </div>
          </div>

          {/* Recomendación Dinámica */}
          <div style={{ 
            backgroundColor: alertStyle.bg, 
            border: `1px solid ${alertStyle.border}`, 
            color: alertStyle.text, 
            padding: '16px', 
            borderRadius: '8px',
            display: 'flex',
            gap: '12px',
            alignItems: 'flex-start'
          }}>
            <div style={{ color: statusColor, marginTop: '2px' }}>{statusIcon}</div>
            <div>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '0.9rem', marginBottom: '4px', color: statusColor }}>
                {statusText}
              </span>
              <span style={{ fontSize: '0.85rem', lineHeight: '1.4' }}>
                {statusDesc}
              </span>
            </div>
          </div>
        </div>

        <hr style={{ border: '0', borderTop: '1px solid var(--border-color)', margin: '30px 0' }} />

        <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '20px' }}>Exportación Legal AFIP</h3>
        
        {loading && progressMsg && (
          <div style={{
            backgroundColor: '#F3F4F6',
            border: '1px solid #E5E7EB',
            borderRadius: '8px',
            padding: '14px 18px',
            marginBottom: '25px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            animation: 'fadeIn 0.2s ease-in-out'
          }}>
            <div style={{
              width: '18px',
              height: '18px',
              border: '2px solid #D1D5DB',
              borderTopColor: '#111827',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite'
            }}></div>
            <span style={{ fontSize: '0.875rem', color: '#374151', fontWeight: 500 }}>{progressMsg}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <button 
            className="btn btn-primary" 
            style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', height: 'auto' }}
            onClick={handleDownloadTxt}
            disabled={loading}
          >
            <FileText size={32} />
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '1rem' }}>Descargar Archivos AFIP (.zip)</span>
              <span style={{ fontSize: '0.75rem', opacity: 0.9, fontWeight: 400 }}>Incluye Ventas, Compras y Percepciones</span>
            </div>
          </button>

          <button 
            className="btn btn-secondary" 
            style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', height: 'auto', backgroundColor: '#fff', border: '1px solid #d1d1d6' }}
            onClick={generatePDFs}
            disabled={loading}
          >
            <FileDown size={32} style={{ color: 'var(--text-primary)' }} />
            <div style={{ textAlign: 'center' }}>
              <span style={{ display: 'block', fontWeight: 600, fontSize: '1rem', color: 'var(--text-primary)' }}>Descargar Subdiarios (PDF)</span>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>Libro IVA Ventas y Compras</span>
            </div>
          </button>
        </div>
      </div>
      
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes slide {
          0% { transform: translateX(-100%); }
          100% { transform: translateX(400%); }
        }
      `}} />
    </div>
  );
}
