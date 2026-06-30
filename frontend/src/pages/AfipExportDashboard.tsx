import { useState } from 'react';
import { API_BASE_URL } from '../utils/api';
import { FileText, FileDown } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export default function AfipExportDashboard() {
  const date = new Date();
  const [month, setMonth] = useState<number>(date.getMonth() + 1);
  const [year, setYear] = useState<number>(date.getFullYear());
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

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

  const handleDownloadTxt = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`${API_BASE_URL}/iva/export?month=${month}&year=${year}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!res.ok) throw new Error('Error al generar los archivos AFIP');
      const { data } = await res.json();
      
      const { txt } = data;
      
      // We will use JSZip to bundle them if possible, or just download individually.
      // Since jszip is installed, let's use it dynamically.
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
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const formatCurrency = (val: number) => {
    return '$ ' + Number(val).toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
  };

  const generatePDFs = async () => {
    try {
      setLoading(true);
      setErrorMsg(null);
      const res = await fetch(`${API_BASE_URL}/iva/export?month=${month}&year=${year}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });
      if (!res.ok) throw new Error('Error al obtener datos para PDF');
      const { data } = await res.json();

      // Generar SubdiarioVentas
      const docVentas = new jsPDF('landscape');
      docVentas.setFontSize(16);
      docVentas.text('LIBRO I.V.A. - VENTAS', 140, 15, { align: 'center' });
      
      docVentas.setFontSize(10);
      docVentas.text(`Empresa: DISTRIBUIDORA DV`, 14, 25);
      docVentas.text(`Periodo: 01/${month.toString().padStart(2,'0')}/${year} - 31/${month.toString().padStart(2,'0')}/${year}`, 14, 30);
      
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

      autoTable(docVentas, {
        startY: 35,
        head: [['Fecha', 'Comprobante', 'Numero', 'Persona', 'CUIT/DNI', 'Neto Gravado', 'Exento', 'IVA', 'Percepciones', 'Retenciones', 'Total']],
        body: ventasRows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
      docVentas.save(`Subdiario_Ventas_${year}_${month.toString().padStart(2,'0')}.pdf`);

      // Generar SubdiarioCompras
      const docCompras = new jsPDF('landscape');
      docCompras.setFontSize(16);
      docCompras.text('LIBRO I.V.A. - COMPRAS', 140, 15, { align: 'center' });
      
      docCompras.setFontSize(10);
      docCompras.text(`Empresa: DISTRIBUIDORA DV`, 14, 25);
      docCompras.text(`Periodo: 01/${month.toString().padStart(2,'0')}/${year} - 31/${month.toString().padStart(2,'0')}/${year}`, 14, 30);
      
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

      autoTable(docCompras, {
        startY: 35,
        head: [['Fecha', 'Comprobante', 'Numero', 'Proveedor', 'CUIT', 'Neto Gravado', 'Exento', 'IVA Crédito', 'Percepciones', 'Retenciones', 'Total']],
        body: comprasRows,
        styles: { fontSize: 8 },
        headStyles: { fillColor: [220, 220, 220], textColor: [0, 0, 0], fontStyle: 'bold' }
      });
      docCompras.save(`Subdiario_Compras_${year}_${month.toString().padStart(2,'0')}.pdf`);

    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ maxWidth: '800px', margin: '0 auto' }}>
      {errorMsg && (
        <div style={{ backgroundColor: '#FDF6F6', color: '#C5221F', padding: '12px', borderRadius: '8px', marginBottom: '20px', border: '1px solid #FAD2D2' }}>
          {errorMsg}
        </div>
      )}

      <div className="card">
        <h2 className="card-title">Cierre Fiscal (Libro IVA Digital)</h2>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginBottom: '20px' }}>
          Generá los archivos obligatorios para la AFIP (.txt) y los subdiarios en PDF para enviar a tu contador. 
          Este módulo incluye únicamente los comprobantes oficiales generados bajo los Puntos de Venta registrados.
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
    </div>
  );
}
