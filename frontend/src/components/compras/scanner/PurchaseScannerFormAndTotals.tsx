import type { FC } from 'react';
import { Check, AlertCircle } from 'lucide-react';

interface SectionProps {
  extractedData: any;
  setExtractedData: (next: any) => void;
}

const sectionBoxStyle = {
  border: '1px solid var(--border-color)',
  borderRadius: '10px',
  padding: '16px',
  display: 'flex',
  flexDirection: 'column' as const,
  gap: '12px',
  backgroundColor: 'var(--bg-app)',
};

const fieldLabelStyle = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 600,
  color: 'var(--text-secondary)',
  marginBottom: '4px',
};

export const PurchaseScannerGeneralSection: FC<SectionProps> = ({ extractedData, setExtractedData }) => {
  const isOfficial = extractedData.billingType === 'OFFICIAL';

  return (
    <>
      <div
        role="status"
        style={{
          padding: '10px 14px',
          backgroundColor: isOfficial ? 'var(--color-success-bg)' : 'var(--color-warning-bg)',
          border: isOfficial ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(245, 158, 11, 0.25)',
          borderRadius: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '0.82rem',
          fontWeight: 600,
          color: isOfficial ? 'var(--color-success)' : 'var(--color-warning)',
        }}
      >
        {isOfficial ? <Check size={16} aria-hidden="true" /> : <AlertCircle size={16} aria-hidden="true" />}
        <span>{isOfficial ? 'Sucursal A (Oficial) — CUIT 20163165059' : 'Sucursal X (Interna)'}</span>
      </div>

      <div style={sectionBoxStyle}>
        <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Datos Generales</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          <div>
            <label htmlFor="scanner-supplier-name" style={fieldLabelStyle}>Proveedor</label>
            <input id="scanner-supplier-name" type="text" className="input" value={extractedData.supplierName || ''} onChange={(e) => setExtractedData({ ...extractedData, supplierName: e.target.value })} />
          </div>
          <div>
            <label htmlFor="scanner-provider-id" style={fieldLabelStyle}>ID Proveedor</label>
            <input id="scanner-provider-id" type="number" className="input tabular-nums" value={extractedData.providerId || ''} onChange={(e) => setExtractedData({ ...extractedData, providerId: e.target.value })} />
          </div>
          <div>
            <label htmlFor="scanner-doc-type" style={fieldLabelStyle}>Tipo Comprobante</label>
            <input id="scanner-doc-type" type="text" className="input" value={extractedData.documentType || ''} onChange={(e) => setExtractedData({ ...extractedData, documentType: e.target.value })} />
          </div>
          <div>
            <label htmlFor="scanner-doc-num" style={fieldLabelStyle}>Número Comprobante</label>
            <input id="scanner-doc-num" type="text" className="input tabular-nums" value={extractedData.documentNumber || ''} onChange={(e) => setExtractedData({ ...extractedData, documentNumber: e.target.value })} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
          </div>
          <div style={{ gridColumn: 'span 2' }}>
            <label htmlFor="scanner-billing-type" style={fieldLabelStyle}>Sucursal</label>
            <select id="scanner-billing-type" className="select" value={extractedData.billingType || 'OFFICIAL'} onChange={(e) => setExtractedData({ ...extractedData, billingType: e.target.value })}>
              <option value="OFFICIAL">Sucursal A</option>
              <option value="INTERNAL">Sucursal X</option>
            </select>
          </div>
        </div>
      </div>
    </>
  );
};

const TAX_FIELDS: Array<{ id: string; key: string; label: string }> = [
  { id: 'scanner-net', key: 'netAmount', label: 'Neto Gravado' },
  { id: 'scanner-iva', key: 'taxAmount', label: 'IVA (21%)' },
  { id: 'scanner-perc-pampa', key: 'percepcionPampa', label: 'IIBB La Pampa' },
  { id: 'scanner-perc-bsas', key: 'percepcionBsAs', label: 'IIBB Bs As' },
  { id: 'scanner-perc-iva', key: 'percepcionIva', label: 'Percepción IVA RG 3337' },
  { id: 'scanner-perc-iva5329', key: 'percepcionIva5329', label: 'Percepción IVA RG 5329' },
  { id: 'scanner-imp-internos', key: 'impuestosInternos', label: 'Impuestos Internos' },
];

export const PurchaseScannerTotalsSection: FC<SectionProps & { updateExtractedField: (field: string, rawVal: any) => void }> = ({
  extractedData, setExtractedData, updateExtractedField,
}) => (
  <div style={sectionBoxStyle}>
    <h3 style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Totales</h3>
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
      {TAX_FIELDS.map((f) => (
        <div key={f.key}>
          <label htmlFor={f.id} style={fieldLabelStyle}>{f.label}</label>
          <input
            id={f.id} type="number" step="0.01" className="input tabular-nums"
            value={extractedData[f.key] || ''} placeholder="0.00"
            onFocus={(e) => e.target.select()}
            onChange={(e) => updateExtractedField(f.key, e.target.value)}
          />
        </div>
      ))}
    </div>
    <div style={{ paddingTop: '10px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <label htmlFor="scanner-total" style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.9rem' }}>Total Factura</label>
      <input
        id="scanner-total" type="number" step="0.01" className="input tabular-nums"
        value={extractedData.totalAmount || ''} placeholder="0.00"
        onFocus={(e) => e.target.select()}
        onChange={(e) => setExtractedData({ ...extractedData, totalAmount: Number(e.target.value) })}
        style={{ width: '140px', fontSize: '0.95rem', fontWeight: 700, borderColor: 'var(--color-corp-red)', color: 'var(--color-corp-red)', textAlign: 'right' }}
      />
    </div>
  </div>
);
