import type { FC } from 'react';
import { Check, AlertCircle } from 'lucide-react';
import { formatCuitDisplay } from '../providersHelpers';
import type { ScannerReceptionMode } from './usePurchaseScanner';

interface GeneralSectionProps {
  extractedData: any;
  providers: any[];
  receptionMode: ScannerReceptionMode;
  setReceptionMode: (mode: ScannerReceptionMode) => void;
  onDocMetaChange: (patch: Record<string, any>) => void;
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

const RECEPTION_MODES: Array<{ value: ScannerReceptionMode; label: string }> = [
  { value: 'IN_TRANSIT', label: 'En tránsito (pendiente de ingreso)' },
  { value: 'IMMEDIATE', label: 'Ingresar stock ahora' },
  { value: 'NONE', label: 'Sin mercadería (gasto / servicio)' },
];

export const PurchaseScannerGeneralSection: FC<GeneralSectionProps> = ({
  extractedData,
  providers,
  receptionMode,
  setReceptionMode,
  onDocMetaChange,
}) => {
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
          <div style={{ gridColumn: 'span 2' }}>
            <label htmlFor="scanner-provider-id" style={fieldLabelStyle}>Proveedor</label>
            <select
              id="scanner-provider-id"
              className="select"
              value={extractedData.providerId || ''}
              onChange={(e) => onDocMetaChange({ providerId: e.target.value })}
            >
              <option value="">Seleccionar proveedor...</option>
              {providers.map((pr) => {
                const formattedCuit = formatCuitDisplay(pr.cuit);
                return (
                  <option key={pr.id} value={pr.id}>
                    {formattedCuit ? `${pr.name} (${formattedCuit})` : pr.name}
                  </option>
                );
              })}
            </select>
            {!extractedData.providerId && extractedData.supplierName && (
              <div style={{ fontSize: '0.72rem', color: 'var(--color-warning)', marginTop: '4px' }}>
                Detectado en PDF: {extractedData.supplierName}
              </div>
            )}
          </div>

          <div>
            <label htmlFor="scanner-doc-type" style={fieldLabelStyle}>Tipo Comprobante</label>
            <select
              id="scanner-doc-type"
              className="select"
              value={extractedData.documentType || 'FACTURA_A'}
              onChange={(e) => onDocMetaChange({ documentType: e.target.value })}
            >
              <option value="FACTURA_A">Factura A</option>
              <option value="FACTURA_B">Factura B</option>
              <option value="FACTURA_C">Factura C</option>
              <option value="NOTA_CREDITO_A">Nota de Crédito A</option>
              <option value="NOTA_CREDITO_B">Nota de Crédito B</option>
              <option value="NOTA_CREDITO_C">Nota de Crédito C</option>
              <option value="REMITO">Remito</option>
            </select>
          </div>
          <div>
            <label htmlFor="scanner-doc-num" style={fieldLabelStyle}>Número Comprobante</label>
            <input
              id="scanner-doc-num"
              type="text"
              className="input tabular-nums"
              value={extractedData.documentNumber || ''}
              onChange={(e) => onDocMetaChange({ documentNumber: e.target.value })}
              autoCorrect="off" autoCapitalize="none" spellCheck={false}
            />
          </div>

          <div>
            <label htmlFor="scanner-issue-date" style={fieldLabelStyle}>Fecha de Emisión</label>
            <input
              id="scanner-issue-date"
              type="date"
              className="input tabular-nums"
              value={extractedData.issueDate || ''}
              onChange={(e) => onDocMetaChange({ issueDate: e.target.value })}
            />
          </div>
          <div>
            <label htmlFor="scanner-billing-type" style={fieldLabelStyle}>Sucursal</label>
            <select
              id="scanner-billing-type"
              className="select"
              value={extractedData.billingType || 'OFFICIAL'}
              onChange={(e) => onDocMetaChange({ billingType: e.target.value })}
            >
              <option value="OFFICIAL">Sucursal A</option>
              <option value="INTERNAL">Sucursal X</option>
            </select>
          </div>
        </div>

        <fieldset style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '10px 12px', margin: '4px 0 0' }}>
          <legend style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', padding: '0 4px' }}>
            Ingreso de mercadería
          </legend>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            {RECEPTION_MODES.map((opt) => (
              <label key={opt.value} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-primary)' }}>
                <input
                  type="radio"
                  name="scanner-reception-mode"
                  value={opt.value}
                  checked={receptionMode === opt.value}
                  onChange={() => setReceptionMode(opt.value)}
                />
                <span>{opt.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
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

export const PurchaseScannerTotalsSection: FC<{
  extractedData: any;
  setExtractedData: (next: any) => void;
  updateExtractedField: (field: string, rawVal: any) => void;
}> = ({ extractedData, setExtractedData, updateExtractedField }) => (
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
