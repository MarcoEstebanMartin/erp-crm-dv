import React from 'react';
import { Box, DollarSign, Image as ImageIcon } from 'lucide-react';

interface ProductPricingLogisticsSectionProps {
  data: any;
  canViewCosts?: boolean;
  selectedImageFile: File | null;
  imagePreviewUrl: string;
  onDataChange: (patch: Record<string, any>) => void;
  onPriceChange: (field: string, valueStr: string) => void;
  onImageSelected: (file: File) => void;
}

export const ProductPricingLogisticsSection: React.FC<ProductPricingLogisticsSectionProps> = ({
  data,
  canViewCosts = true,
  selectedImageFile,
  imagePreviewUrl,
  onDataChange,
  onPriceChange,
  onImageSelected,
}) => {
  const fieldLabelStyle: React.CSSProperties = {
    fontSize: '0.75rem',
    fontWeight: 600,
    color: 'var(--text-secondary)',
    marginBottom: '3px',
  };

  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
          <DollarSign size={15} color="var(--text-secondary)" aria-hidden="true" />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            {canViewCosts ? 'Costos y Precios de Venta' : 'Precios de Venta'}
          </span>
        </div>

        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'var(--bg-secondary, #F9FAFB)',
            borderRadius: '10px',
            border: '1px solid var(--border-color)',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: canViewCosts ? '1fr 0.85fr 1fr 1.15fr 1fr 1fr' : '1fr 1.15fr 1fr 1fr', gap: '12px' }}>
            {canViewCosts && (
              <>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="product-cost-price" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
                    Costo ($)
                  </label>
                  <input
                    id="product-cost-price"
                    name="costPrice"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    min="0"
                    className="input tabular-nums"
                    value={data.costPrice !== undefined ? data.costPrice : ''}
                    onChange={(e) => onPriceChange('costPrice', e.target.value)}
                    required
                    style={{ padding: '5px 8px', fontWeight: 700 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label htmlFor="product-profit-margin" style={fieldLabelStyle}>
                    Margen (%)
                  </label>
                  <input
                    id="product-profit-margin"
                    name="profitMargin"
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    className="input tabular-nums"
                    value={data.profitMargin !== undefined ? data.profitMargin : ''}
                    onChange={(e) => onPriceChange('profitMargin', e.target.value)}
                    style={{
                      padding: '5px 8px',
                      color: Number(data.profitMargin) < 0 ? '#E30613' : undefined,
                      fontWeight: Number(data.profitMargin) < 0 ? 700 : undefined,
                    }}
                  />
                </div>
              </>
            )}

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="product-price-sin-iva" style={fieldLabelStyle}>
                Venta Sin IVA ($)
              </label>
              <input
                id="product-price-sin-iva"
                name="priceSinIva"
                type="number"
                step="0.01"
                className="input tabular-nums"
                value={data.listPrice ? Math.round((Number(data.listPrice) / 1.21) * 100) / 100 : ''}
                onChange={(e) => onPriceChange('priceSinIva', e.target.value)}
                style={{ padding: '5px 8px' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="product-list-price" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '3px' }}>
                Lista 4 (Final C/IVA)
              </label>
              <input
                id="product-list-price"
                name="listPrice"
                type="number"
                step="0.01"
                className="input tabular-nums"
                value={data.listPrice !== undefined ? data.listPrice : ''}
                onChange={(e) => onPriceChange('listPrice', e.target.value)}
                required
                style={{ fontWeight: 800, color: 'var(--text-primary)', border: '2px solid var(--accent-color, #111827)', padding: '5px 8px' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="product-list-price-b" style={fieldLabelStyle}>
                Lista Especial (Opcional)
              </label>
              <input
                id="product-list-price-b"
                type="number"
                step="0.01"
                className="input tabular-nums"
                placeholder="Opcional"
                value={data.listPriceB !== undefined ? data.listPriceB : ''}
                onChange={(e) => onDataChange({ listPriceB: e.target.value === '' ? '' : Number(e.target.value) })}
                style={{ padding: '5px 8px' }}
              />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="product-list-price-c" style={fieldLabelStyle}>
                Lista Especial 2 (Opcional)
              </label>
              <input
                id="product-list-price-c"
                type="number"
                step="0.01"
                className="input tabular-nums"
                placeholder="Opcional"
                value={data.listPriceC !== undefined ? data.listPriceC : ''}
                onChange={(e) => onDataChange({ listPriceC: e.target.value === '' ? '' : Number(e.target.value) })}
                style={{ padding: '5px 8px' }}
              />
            </div>
          </div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
          <Box size={15} color="var(--text-secondary)" aria-hidden="true" />
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
            Logística y Almacén
          </span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.3fr 1.2fr', gap: '12px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="product-min-stock" style={fieldLabelStyle}>Stock Mínimo</label>
            <input id="product-min-stock" type="number" className="input tabular-nums" value={data.minStock !== undefined ? data.minStock : 0} onChange={(e) => onDataChange({ minStock: Number(e.target.value) })} style={{ padding: '5px 8px' }} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="product-units-per-box" style={fieldLabelStyle}>Unidades / Caja</label>
            <input id="product-units-per-box" type="number" className="input tabular-nums" value={data.unitsPerBox !== undefined ? data.unitsPerBox : 1} onChange={(e) => onDataChange({ unitsPerBox: Number(e.target.value) })} style={{ padding: '5px 8px' }} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="product-min-order-qty" style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-color, #e30613)', marginBottom: '3px' }}>Mínimo Venta</label>
            <input id="product-min-order-qty" type="number" min="1" className="input tabular-nums" value={data.minOrderQuantity !== undefined ? data.minOrderQuantity : 1} onChange={(e) => onDataChange({ minOrderQuantity: Math.max(1, Number(e.target.value)) })} style={{ padding: '5px 8px', fontWeight: 700 }} />
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="product-photo-upload" style={fieldLabelStyle}>
              Fotografía
            </label>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div
                style={{
                  width: '36px',
                  height: '36px',
                  borderRadius: '6px',
                  border: '1px dashed var(--border-color)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: 'var(--bg-secondary)',
                  overflow: 'hidden',
                }}
              >
                {selectedImageFile ? (
                  <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981' }}>OK</span>
                ) : imagePreviewUrl ? (
                  <img src={imagePreviewUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                ) : (
                  <ImageIcon size={16} color="var(--text-muted)" aria-hidden="true" />
                )}
              </div>
              <label
                htmlFor="product-photo-upload"
                style={{
                  flex: 1,
                  padding: '5px 8px',
                  backgroundColor: '#ffffff',
                  border: '1px solid var(--border-color)',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'var(--text-secondary)',
                  textAlign: 'center',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {selectedImageFile ? selectedImageFile.name : 'Subir Imagen'}
                <input
                  id="product-photo-upload"
                  type="file"
                  accept="image/*"
                  style={{ display: 'none' }}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      onImageSelected(e.target.files[0]);
                    }
                  }}
                />
              </label>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="product-active-checkbox" style={fieldLabelStyle}>
              Estado
            </label>
            <label
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                cursor: 'pointer',
                padding: '5px 10px',
                backgroundColor: data.isActive !== false ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)',
                border: data.isActive !== false ? '1px solid #10b981' : '1px solid var(--border-color)',
                borderRadius: '6px',
                fontSize: '0.78rem',
                fontWeight: 600,
                height: '36px',
              }}
            >
              <input
                id="product-active-checkbox"
                type="checkbox"
                checked={data.isActive !== false}
                onChange={(e) => onDataChange({ isActive: e.target.checked })}
                style={{ width: '15px', height: '15px', cursor: 'pointer' }}
              />
              <span style={{ color: data.isActive !== false ? '#059669' : 'var(--text-muted)' }}>
                {data.isActive !== false ? 'Activo' : 'Inactivo'}
              </span>
            </label>
          </div>
        </div>
      </div>
    </>
  );
};
