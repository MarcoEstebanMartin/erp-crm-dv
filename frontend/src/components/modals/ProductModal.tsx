import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';

interface ProductModalProps {
  productModal: {
    open: boolean;
    mode: string;
    data: any;
  };
  setProductModal: (val: any) => void;
  rubrosList: any[];
  providersList: any[];
  fetchData: () => void;
  setSuccessMsg: (msg: string | null) => void;
  setErrorMsg: (msg: string | null) => void;
}

const ProductModal: React.FC<ProductModalProps> = ({
  productModal,
  setProductModal,
  rubrosList,
  providersList,
  fetchData,
  setSuccessMsg,
  setErrorMsg
}) => {
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');

  useEffect(() => {
    if (productModal.open) {
      if (productModal.mode === 'edit' && productModal.data.imageUrl) {
        setImagePreviewUrl(`http://${window.location.hostname}:3000${productModal.data.imageUrl}`);
      } else {
        setImagePreviewUrl('');
      }
    }
  }, [productModal.open, productModal.data.id, productModal.data.imageUrl, productModal.mode]);

  if (!productModal || !productModal.open) return null;

  const handleModalPriceChange = (field: string, valueStr: string) => {
    const value = valueStr === '' ? '' : Number(valueStr);
    const updatedData = { ...productModal.data, [field]: value };

    const cost = Number(updatedData.costPrice) || 0;
    const rentPercentage = updatedData.profitMargin !== '' && updatedData.profitMargin !== undefined ? Number(updatedData.profitMargin) : 25;
    const margin = 1 + (rentPercentage / 100);

    if (field === 'costPrice') {
      const listPrice = cost * margin;
      updatedData.listPrice = Math.max(0, Math.round(listPrice * 100) / 100);
      
      const ratioB = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceB) > 0
        ? Number(productModal.data.listPriceB) / Number(productModal.data.listPrice) : 0.95;
      const ratioC = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceC) > 0
        ? Number(productModal.data.listPriceC) / Number(productModal.data.listPrice) : 0.90;
      updatedData.listPriceB = Math.max(0, Math.round(updatedData.listPrice * ratioB * 100) / 100);
      updatedData.listPriceC = Math.max(0, Math.round(updatedData.listPrice * ratioC * 100) / 100);

    } else if (field === 'profitMargin') {
      const newMargin = valueStr === '' ? 1 : 1 + (Number(valueStr) / 100);
      const listPrice = cost * newMargin;
      updatedData.listPrice = Math.max(0, Math.round(listPrice * 100) / 100);

      const ratioB = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceB) > 0
        ? Number(productModal.data.listPriceB) / Number(productModal.data.listPrice) : 0.95;
      const ratioC = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceC) > 0
        ? Number(productModal.data.listPriceC) / Number(productModal.data.listPrice) : 0.90;
      updatedData.listPriceB = Math.max(0, Math.round(updatedData.listPrice * ratioB * 100) / 100);
      updatedData.listPriceC = Math.max(0, Math.round(updatedData.listPrice * ratioC * 100) / 100);

    } else if (field === 'priceSinIva') {
      const finalPrice = (Number(value) || 0) * 1.21;
      updatedData.listPrice = Math.max(0, Math.round(finalPrice * 100) / 100);
      updatedData.costPrice = Math.max(0, Math.round((updatedData.listPrice / margin) * 100) / 100);

      const ratioB = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceB) > 0
        ? Number(productModal.data.listPriceB) / Number(productModal.data.listPrice) : 0.95;
      const ratioC = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceC) > 0
        ? Number(productModal.data.listPriceC) / Number(productModal.data.listPrice) : 0.90;
      updatedData.listPriceB = Math.max(0, Math.round(updatedData.listPrice * ratioB * 100) / 100);
      updatedData.listPriceC = Math.max(0, Math.round(updatedData.listPrice * ratioC * 100) / 100);

    } else if (field === 'listPrice') {
      const listPriceVal = Number(value) || 0;
      updatedData.costPrice = Math.max(0, Math.round((listPriceVal / margin) * 100) / 100);

      const ratioB = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceB) > 0
        ? Number(productModal.data.listPriceB) / Number(productModal.data.listPrice) : 0.95;
      const ratioC = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceC) > 0
        ? Number(productModal.data.listPriceC) / Number(productModal.data.listPrice) : 0.90;
      updatedData.listPriceB = Math.max(0, Math.round(listPriceVal * ratioB * 100) / 100);
      updatedData.listPriceC = Math.max(0, Math.round(listPriceVal * ratioC * 100) / 100);
    }

    setProductModal({
      ...productModal,
      data: updatedData
    });
  };

  const handleModalRubroChange = (rubroIdVal: string) => {
    const rubroId = rubroIdVal === '' ? '' : Number(rubroIdVal);
    const updatedData = { ...productModal.data, rubroId };

    if (rubroId) {
      const selectedRubro = rubrosList.find(r => Number(r.id) === rubroId);
      if (selectedRubro) {
        const marginFactor = Number(selectedRubro.profitMargin) || 1.25;
        const rentPercent = Math.round((marginFactor - 1) * 100);
        updatedData.profitMargin = rentPercent;

        const cost = Number(updatedData.costPrice) || 0;
        const listPrice = cost * marginFactor;
        updatedData.listPrice = Math.max(0, Math.round(listPrice * 100) / 100);

        const ratioB = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceB) > 0
          ? Number(productModal.data.listPriceB) / Number(productModal.data.listPrice) : 0.95;
        const ratioC = Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceC) > 0
          ? Number(productModal.data.listPriceC) / Number(productModal.data.listPrice) : 0.90;
        updatedData.listPriceB = Math.max(0, Math.round(updatedData.listPrice * ratioB * 100) / 100);
        updatedData.listPriceC = Math.max(0, Math.round(updatedData.listPrice * ratioC * 100) / 100);
      }
    }

    setProductModal({
      ...productModal,
      data: updatedData
    });
  };

  const handleProductSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const { mode, data } = productModal;
    if (!data.sku || !data.name || data.costPrice === undefined || data.listPrice === undefined) {
      setErrorMsg('Completar SKU, Nombre, Costo y Lista.');
      return;
    }

    const payload = {
      sku: data.sku,
      name: data.name,
      description: data.description,
      barcode: data.barcode || null,
      costPrice: Number(data.costPrice),
      listPrice: Number(data.listPrice),
      listPriceB: Number(data.listPriceB || 0),
      listPriceC: Number(data.listPriceC || 0),
      profitMargin: data.profitMargin !== undefined && data.profitMargin !== '' ? (1 + Number(data.profitMargin) / 100) : null,
      rubroId: data.rubroId ? Number(data.rubroId) : null,
      providerId: data.providerId ? Number(data.providerId) : null,
      minStock: Number(data.minStock || 0),
      isPesable: Boolean(data.isPesable),
      unitsPerBox: Number(data.unitsPerBox || 1),
      approximateWeight: data.approximateWeight ? Number(data.approximateWeight) : 0,
      isActive: (data as any).isActive !== undefined ? Boolean((data as any).isActive) : undefined
    };

    try {
      let savedProduct;
      if (mode === 'create') {
        savedProduct = await api.createProduct(payload);
      } else {
        savedProduct = await api.updateProduct(data.id, payload);
      }

      if (selectedImageFile) {
        await api.uploadProductImage(savedProduct.id, selectedImageFile);
      }

      setProductModal({ ...productModal, open: false });
      setSuccessMsg('Producto guardado correctamente.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar producto.');
    }
  };

  return (
    <div className="modal-overlay">
      <div className="modal-content">
        <div className="modal-header">
          <h3>{productModal.mode === 'create' ? 'Cargar Nuevo Producto' : 'Editar Producto'}</h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setProductModal({ ...productModal, open: false })}>✕</button>
        </div>
        <form onSubmit={handleProductSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label>SKU (Código interno)</label>
              <input
                type="text"
                className="input"
                placeholder="ej: 0001"
                value={productModal.data.sku}
                onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, sku: e.target.value } })}
                disabled={productModal.mode === 'edit'}
                required
              />
            </div>

            <div className="form-group">
              <label>Código de Barras (EAN)</label>
              <input
                type="text"
                className="input"
                placeholder="ej: 7799876543210"
                value={productModal.data.barcode || ''}
                onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, barcode: e.target.value } })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label>Rubro (Categoría)</label>
              <select
                className="select"
                value={productModal.data.rubroId || ''}
                onChange={(e) => handleModalRubroChange(e.target.value)}
                style={{ width: '100%', borderRadius: '8px', padding: '10px 14px' }}
              >
                <option value="">-- Sin Rubro --</option>
                {rubrosList.map(r => (
                  <option key={r.id} value={r.id}>{r.name}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Proveedor</label>
              <select
                className="select"
                value={productModal.data.providerId || ''}
                onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, providerId: e.target.value === '' ? '' : Number(e.target.value) } })}
                style={{ width: '100%', borderRadius: '8px', padding: '10px 14px' }}
              >
                <option value="">-- Sin Proveedor --</option>
                {providersList.map(p => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Nombre del Producto</label>
            <input
              type="text"
              className="input"
              placeholder="ej: Gaseosa Coca Cola 1.5L"
              value={productModal.data.name}
              onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, name: e.target.value } })}
              required
            />
          </div>

          <div className="form-group">
            <label>Descripción corta</label>
            <input
              type="text"
              className="input"
              placeholder="ej: Pack x6 botellas sabor original"
              value={productModal.data.description}
              onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, description: e.target.value } })}
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '14px', alignItems: 'flex-start', marginBottom: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0 }}>
                <input
                  type="checkbox"
                  checked={productModal.data.isPesable || false}
                  onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, isPesable: e.target.checked } })}
                  style={{ width: '18px', height: '18px' }}
                />
                Es Producto Pesable
              </label>
            </div>
            {productModal.data.isPesable && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label>Peso Aproximado de Horma (Kg)</label>
                <input
                  type="number"
                  step="0.01"
                  className="input"
                  placeholder="ej: 4.5"
                  value={productModal.data.approximateWeight || ''}
                  onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, approximateWeight: Number(e.target.value) } })}
                />
              </div>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label>Precio Costo (C/IVA)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={productModal.data.costPrice !== undefined ? productModal.data.costPrice : ''}
                onChange={(e) => handleModalPriceChange('costPrice', e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Rentabilidad (%)</label>
              <input
                type="number"
                className="input"
                placeholder="ej: 25"
                value={productModal.data.profitMargin !== undefined ? productModal.data.profitMargin : ''}
                onChange={(e) => handleModalPriceChange('profitMargin', e.target.value)}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label>Precio Venta Sin IVA</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={productModal.data.listPrice ? Math.round((Number(productModal.data.listPrice) / 1.21) * 100) / 100 : ''}
                onChange={(e) => handleModalPriceChange('priceSinIva', e.target.value)}
              />
            </div>
            <div className="form-group">
              <label>Precio Venta Final (Lista A - C/IVA)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                value={productModal.data.listPrice !== undefined ? productModal.data.listPrice : ''}
                onChange={(e) => handleModalPriceChange('listPrice', e.target.value)}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label>Precio Lista B (Especial - Opcional)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="Fallback a Lista A"
                value={productModal.data.listPriceB || ''}
                onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, listPriceB: Number(e.target.value) } })}
              />
            </div>
            <div className="form-group">
              <label>Precio Lista C (Distribuidor - Opcional)</label>
              <input
                type="number"
                step="0.01"
                className="input"
                placeholder="Fallback a Lista A"
                value={productModal.data.listPriceC || ''}
                onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, listPriceC: Number(e.target.value) } })}
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label>Stock Mínimo (Alerta de reposición)</label>
              <input
                type="number"
                className="input"
                value={productModal.data.minStock || ''}
                onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, minStock: Number(e.target.value) } })}
              />
            </div>
            <div className="form-group">
              <label>Unidades por Caja (Fraccionado)</label>
              <input
                type="number"
                className="input"
                placeholder="ej: 12"
                min={1}
                value={productModal.data.unitsPerBox || 1}
                onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, unitsPerBox: Number(e.target.value) } })}
              />
            </div>
          </div>

          <div className="form-group" style={{ gridColumn: '1 / -1', marginTop: '10px' }}>
            <label>Imagen del Producto</label>
            <div style={{ display: 'flex', gap: '16px', alignItems: 'center', backgroundColor: 'var(--bg-muted)', padding: '12px', borderRadius: '8px', border: '1px dashed var(--border-color)' }}>
              {imagePreviewUrl ? (
                <div style={{ position: 'relative', width: '80px', height: '80px', minWidth: '80px', borderRadius: '6px', overflow: 'hidden', border: '1px solid var(--border-color)', backgroundColor: '#fff' }}>
                  <img src={imagePreviewUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  <button 
                    type="button" 
                    style={{ position: 'absolute', top: '2px', right: '2px', backgroundColor: 'rgba(227, 6, 19, 0.9)', color: '#fff', border: 'none', borderRadius: '50%', width: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: '9px', padding: 0 }}
                    onClick={() => {
                      setSelectedImageFile(null);
                      setImagePreviewUrl('');
                      setProductModal({
                        ...productModal,
                        data: { ...productModal.data, imageUrl: null }
                      });
                    }}
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <div style={{ width: '80px', height: '80px', minWidth: '80px', borderRadius: '6px', border: '2px dashed var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', fontSize: '0.8rem', backgroundColor: 'var(--bg-body)' }}>
                  Sin Foto
                </div>
              )}
              <div style={{ flex: 1 }}>
                <input 
                  type="file" 
                  accept="image/*"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      setSelectedImageFile(file);
                      const reader = new FileReader();
                      reader.onloadend = () => {
                        setImagePreviewUrl(reader.result as string);
                      };
                      reader.readAsDataURL(file);
                    }
                  }}
                  style={{ display: 'none' }}
                  id="product-image-upload"
                />
                <label htmlFor="product-image-upload" className="btn btn-secondary" style={{ display: 'inline-block', cursor: 'pointer', borderRadius: '6px', fontSize: '0.8rem', padding: '6px 12px', margin: 0 }}>
                  Seleccionar Imagen
                </label>
                <p style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                  PNG, JPG o WEBP. Estandarizado por SKU.
                </p>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={() => setProductModal({ ...productModal, open: false })}>Cancelar</button>
            <button type="submit" className="btn btn-primary">Guardar Cambios</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
