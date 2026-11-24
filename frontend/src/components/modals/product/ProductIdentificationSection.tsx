import React from 'react';
import { Scale, Tag } from 'lucide-react';

export const COMMERCIAL_CATEGORIES = [
  { value: 'Refrigerados', label: 'Refrigerados' },
  { value: 'Fiambres', label: 'Fiambres' },
  { value: 'Bebidas', label: 'Bebidas' },
  { value: 'Bebidas Alcoholicas', label: 'Bebidas Alcohólicas' },
  { value: 'Vinos', label: 'Vinos' },
  { value: 'Aderezos y Aceites', label: 'Aderezos y Aceites' },
  { value: 'Pastas Secas', label: 'Pastas Secas' },
  { value: 'Almacén', label: 'Almacén' },
  { value: 'Yerbas', label: 'Yerbas' },
  { value: 'Conservas', label: 'Conservas' },
  { value: 'Pescadería', label: 'Pescadería' },
  { value: 'Papeles', label: 'Papeles' },
  { value: 'No comestibles', label: 'No comestibles' },
  { value: 'Estucheria y Regalerìa', label: 'Estuchería y Regalería' },
  { value: 'Varios', label: 'Varios' },
];

export const STORE_HIGHLIGHT_OPTIONS: { id: string; value: 'OFERTON' | 'DESTACADO' | null; label: string }[] = [
  { id: 'normal', value: null, label: 'Normal' },
  { id: 'oferton', value: 'OFERTON', label: 'Ofertón' },
  { id: 'destacado', value: 'DESTACADO', label: 'Destacado' },
];

interface ProductIdentificationSectionProps {
  mode: string;
  data: any;
  rubrosList: any[];
  providersList: any[];
  onDataChange: (patch: Record<string, any>) => void;
  onRubroChange: (rubroIdVal: string) => void;
}

export const ProductIdentificationSection: React.FC<ProductIdentificationSectionProps> = ({
  mode,
  data,
  rubrosList,
  providersList,
  onDataChange,
  onRubroChange,
}) => {
  const selectedRubroObj = rubrosList.find((r) => Number(r.id) === Number(data?.rubroId));
  const automaticRubroLabel = selectedRubroObj?.name
    ? `Automático (${selectedRubroObj.name})`
    : 'Automático por Rubro';
  const currentCategory = data?.commercialCategory;
  const isCustomCategory =
    currentCategory &&
    !COMMERCIAL_CATEGORIES.some((c) => c.value.toLowerCase() === String(currentCategory).toLowerCase());

  const labelStyle: React.CSSProperties = {
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '3px',
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
        <Tag size={15} color="var(--text-secondary)" aria-hidden="true" />
        <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
          Identificación y Clasificación
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.3fr 1.5fr 1.3fr', gap: '12px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="product-sku-input" style={labelStyle}>
            SKU <span style={{ color: 'var(--color-corp-red, #E30613)' }}>*</span>
          </label>
          <input
            id="product-sku-input"
            type="text"
            className="input"
            placeholder="0001"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={data.sku || ''}
            onChange={(e) => onDataChange({ sku: e.target.value })}
            disabled={mode === 'edit'}
            required
            style={{ fontWeight: 600, fontFamily: 'monospace', padding: '6px 10px' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="product-barcode-input" style={labelStyle}>
            Código EAN
          </label>
          <input
            id="product-barcode-input"
            type="text"
            className="input"
            placeholder="7799876543210"
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            value={data.barcode || ''}
            onChange={(e) => onDataChange({ barcode: e.target.value })}
            style={{ fontFamily: 'monospace', padding: '6px 10px' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="product-rubro-select" style={labelStyle}>
            Rubro
          </label>
          <select
            id="product-rubro-select"
            className="select"
            value={data.rubroId || ''}
            onChange={(e) => onRubroChange(e.target.value)}
            style={{ width: '100%', borderRadius: '6px', padding: '6px 10px' }}
          >
            <option value="">Sin Rubro</option>
            {rubrosList.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="product-category-select" style={labelStyle}>
            Categoría Comercial
          </label>
          <select
            id="product-category-select"
            className="select"
            value={data.commercialCategory || ''}
            onChange={(e) => onDataChange({ commercialCategory: e.target.value })}
            style={{ width: '100%', borderRadius: '6px', padding: '6px 10px', fontWeight: 600, color: '#0f172a' }}
          >
            <option value="">{automaticRubroLabel}</option>
            {COMMERCIAL_CATEGORIES.map((cat) => (
              <option key={cat.value} value={cat.value}>
                {cat.label}
              </option>
            ))}
            {isCustomCategory && <option value={currentCategory}>{currentCategory}</option>}
          </select>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="product-provider-select" style={labelStyle}>
            Proveedor
          </label>
          <select
            id="product-provider-select"
            className="select"
            value={data.providerId || ''}
            onChange={(e) => onDataChange({ providerId: e.target.value === '' ? '' : Number(e.target.value) })}
            style={{ width: '100%', borderRadius: '6px', padding: '6px 10px' }}
          >
            <option value="">Sin Proveedor</option>
            {providersList.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="product-name-input" style={labelStyle}>
            Nombre <span style={{ color: 'var(--color-corp-red, #E30613)' }}>*</span>
          </label>
          <input
            id="product-name-input"
            type="text"
            className="input"
            placeholder="MELINCUE BARRA TYBO x KG"
            value={data.name || ''}
            onChange={(e) => onDataChange({ name: e.target.value })}
            required
            style={{ fontSize: '0.9rem', fontWeight: 600, padding: '6px 10px' }}
          />
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="product-description-input" style={labelStyle}>
            Descripción
          </label>
          <input
            id="product-description-input"
            type="text"
            className="input"
            placeholder="Detalle corto"
            value={data.description || ''}
            onChange={(e) => onDataChange({ description: e.target.value })}
            style={{ padding: '6px 10px' }}
          />
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px', padding: '8px 14px', backgroundColor: 'var(--bg-secondary, #F9FAFB)', borderRadius: '8px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '0.84rem' }}>
            <input type="checkbox" checked={Boolean(data.isPesable)} onChange={(e) => onDataChange({ isPesable: e.target.checked })} style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color, #111827)', cursor: 'pointer' }} />
            <Scale size={15} color="var(--text-secondary)" aria-hidden="true" />
            Producto Pesable (Kg)
          </label>
          {data.isPesable && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <label htmlFor="product-approx-weight" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>Peso Horma (Kg)</label>
              <input id="product-approx-weight" type="number" step="0.01" className="input tabular-nums" placeholder="4.5" value={data.approximateWeight || ''} onChange={(e) => onDataChange({ approximateWeight: Number(e.target.value) })} style={{ width: '90px', padding: '3px 8px', textAlign: 'center', fontWeight: 600 }} />
            </div>
          )}
        </div>

        <fieldset style={{ border: 'none', padding: 0, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <legend className="visually-hidden">Tienda</legend>
          <span aria-hidden="true" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Tienda</span>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {STORE_HIGHLIGHT_OPTIONS.map((opt) => {
              const current = data.storeHighlight === 'OFERTON' || data.storeHighlight === 'DESTACADO' ? data.storeHighlight : null;
              const isSelected = current === opt.value;
              const tone = opt.value === 'OFERTON' ? '#E30613' : opt.value === 'DESTACADO' ? '#0f172a' : null;
              return (
                <label
                  key={opt.id}
                  htmlFor={`product-store-highlight-${opt.id}`}
                  style={{
                    display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 10px', borderRadius: '999px',
                    fontSize: '0.76rem', fontWeight: isSelected ? 700 : 500, cursor: 'pointer', margin: 0,
                    backgroundColor: isSelected ? (tone ?? '#ffffff') : 'transparent',
                    border: `1px solid ${isSelected ? (tone ?? 'var(--text-secondary)') : 'var(--border-color)'}`,
                    color: isSelected ? (tone ? '#ffffff' : 'var(--text-primary)') : 'var(--text-secondary)',
                  }}
                >
                  <input
                    id={`product-store-highlight-${opt.id}`}
                    type="radio"
                    name="storeHighlight"
                    value={opt.value ?? ''}
                    checked={isSelected}
                    onChange={() => onDataChange({ storeHighlight: opt.value })}
                    style={{ width: '13px', height: '13px', margin: 0, cursor: 'pointer', accentColor: tone ?? '#0f172a' }}
                  />
                  <span>{opt.label}</span>
                </label>
              );
            })}
          </div>
        </fieldset>
      </div>
    </div>
  );
};
