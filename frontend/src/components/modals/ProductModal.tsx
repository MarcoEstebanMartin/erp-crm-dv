import React, { useState, useEffect } from 'react';
import { Package, Tag, DollarSign, Box, Image as ImageIcon, X, Check, Scale } from 'lucide-react';
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
  }, [productModal.open, productModal.data?.id, productModal.data?.imageUrl, productModal.mode]);

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
      commercialCategory: data.commercialCategory || null,
      minStock: Number(data.minStock || 0),
      isPesable: Boolean(data.isPesable),
      unitsPerBox: Number(data.unitsPerBox || 1),
      minOrderQuantity: Number(data.minOrderQuantity || 1),
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

  const selectedRubroObj = rubrosList.find(r => Number(r.id) === Number(productModal.data?.rubroId));
  const automaticRubroLabel = selectedRubroObj?.name ? `-- Automático (${selectedRubroObj.name}) --` : '-- Automático / Por Rubro --';

  const commercialCategoriesList = [
    { value: 'Refrigerados', label: '❄️ Refrigerados' },
    { value: 'Fiambres', label: '🧀 Fiambres' },
    { value: 'Bebidas', label: '🥤 Bebidas' },
    { value: 'Bebidas Alcoholicas', label: '🍺 Bebidas Alcohólicas' },
    { value: 'Vinos', label: '🍷 Vinos' },
    { value: 'Aderezos y Aceites', label: '🌻 Aderezos y Aceites' },
    { value: 'Pastas Secas', label: '🍝 Pastas Secas' },
    { value: 'Almacén', label: '🛒 Almacén' },
    { value: 'Yerbas', label: '🌿 Yerbas' },
    { value: 'Conservas', label: '🥫 Conservas' },
    { value: 'Pescadería', label: '🐟 Pescadería' },
    { value: 'Papeles', label: '🧻 Papeles' },
    { value: 'No comestibles', label: '📦 No comestibles' },
    { value: 'Estucheria y Regalerìa', label: '🎁 Estuchería y Regalería' },
    { value: 'Varios', label: '🏷️ Varios' },
  ];

  const currentCategory = productModal.data?.commercialCategory;
  const isCustomCategory = currentCategory && !commercialCategoriesList.some(c => c.value.toLowerCase() === String(currentCategory).toLowerCase());

  return (
    <div className="modal-overlay" style={{ backdropFilter: 'blur(6px)', zIndex: 1100 }}>
      <div 
        className="modal-content fade-in" 
        style={{ 
          maxWidth: '1180px', 
          width: '95%', 
          maxHeight: '94vh', 
          overflowY: 'auto', 
          borderRadius: '16px', 
          padding: '0px', 
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
          border: '1px solid var(--border-color, #E5E7EB)',
          backgroundColor: 'var(--bg-card, #ffffff)'
        }}
      >
        {/* Cabecera del Modal */}
        <div style={{ 
          padding: '14px 24px', 
          borderBottom: '1px solid var(--border-color, #E5E7EB)', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary, #F9FAFB)',
          borderTopLeftRadius: '16px',
          borderTopRightRadius: '16px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{ 
              width: '38px', 
              height: '38px', 
              borderRadius: '10px', 
              backgroundColor: 'var(--accent-color, #111827)', 
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)'
            }}>
              <Package size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {productModal.mode === 'create' ? 'Cargar Nuevo Producto' : `Editar Producto`}
              </h3>
              <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                {productModal.mode === 'create' ? 'Ingresa los datos para dar de alta el artículo en el catálogo' : `SKU: ${productModal.data.sku} | ID: ${productModal.data.id}`}
              </p>
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => setProductModal({ ...productModal, open: false })}
            style={{
              background: 'transparent',
              border: 'none',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'all 0.15s ease'
            }}
            className="hover-bg-secondary"
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario Estructurado */}
        <form onSubmit={handleProductSubmit} style={{ padding: '16px 24px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>

            {/* SECCIÓN 1: IDENTIFICACIÓN Y CATEGORÍA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                <Tag size={15} color="var(--text-secondary)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  1. Identificación y Clasificación
                </span>
              </div>

              {/* 5 COLUMNAS EN UNA SOLA FILA HORIZONTAL PERFECTA */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1.3fr 1.5fr 1.3fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    SKU (Código interno) <span style={{ color: 'var(--color-corp-red, #E30613)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ej: 0001"
                    value={productModal.data.sku}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, sku: e.target.value } })}
                    disabled={productModal.mode === 'edit'}
                    required
                    style={{ fontWeight: 600, fontFamily: 'monospace', padding: '6px 10px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    Código EAN (Barras)
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ej: 7799876543210"
                    value={productModal.data.barcode || ''}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, barcode: e.target.value } })}
                    style={{ fontFamily: 'monospace', padding: '6px 10px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    Rubro (ERP Interno)
                  </label>
                  <select
                    className="select"
                    value={productModal.data.rubroId || ''}
                    onChange={(e) => handleModalRubroChange(e.target.value)}
                    style={{ width: '100%', borderRadius: '6px', padding: '6px 10px' }}
                  >
                    <option value="">-- Sin Rubro --</option>
                    {rubrosList.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    Categoría Comercial
                  </label>
                  <select
                    className="select"
                    value={productModal.data.commercialCategory || ''}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, commercialCategory: e.target.value } })}
                    style={{ width: '100%', borderRadius: '6px', padding: '6px 10px', fontWeight: 600, color: '#0f172a' }}
                  >
                    <option value="">{automaticRubroLabel}</option>
                    {commercialCategoriesList.map(cat => (
                      <option key={cat.value} value={cat.value}>{cat.label}</option>
                    ))}
                    {isCustomCategory && (
                      <option value={currentCategory}>🏷️ {currentCategory}</option>
                    )}
                  </select>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    Proveedor
                  </label>
                  <select
                    className="select"
                    value={productModal.data.providerId || ''}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, providerId: e.target.value === '' ? '' : Number(e.target.value) } })}
                    style={{ width: '100%', borderRadius: '6px', padding: '6px 10px' }}
                  >
                    <option value="">-- Sin Proveedor --</option>
                    {providersList.map(p => (
                      <option key={p.id} value={p.id}>{p.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    Nombre del Producto <span style={{ color: 'var(--color-corp-red, #E30613)' }}>*</span>
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ej: MELINCUE BARRA TYBO x KG"
                    value={productModal.data.name}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, name: e.target.value } })}
                    required
                    style={{ fontSize: '0.9rem', fontWeight: 600, padding: '6px 10px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    Descripción Corta / Detalle
                  </label>
                  <input
                    type="text"
                    className="input"
                    placeholder="ej: Queso Tybo en barra marca Melincué"
                    value={productModal.data.description || ''}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, description: e.target.value } })}
                    style={{ padding: '6px 10px' }}
                  />
                </div>
              </div>

              {/* Checkbox Pesable integrado estilizado */}
              <div style={{ 
                display: 'flex', 
                alignItems: 'center', 
                justifyContent: 'space-between',
                padding: '8px 14px', 
                backgroundColor: 'var(--bg-secondary, #F9FAFB)', 
                borderRadius: '8px',
                border: '1px solid var(--border-color)'
              }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', margin: 0, fontWeight: 600, fontSize: '0.84rem' }}>
                  <input
                    type="checkbox"
                    checked={productModal.data.isPesable || false}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, isPesable: e.target.checked } })}
                    style={{ width: '16px', height: '16px', accentColor: 'var(--accent-color, #111827)', cursor: 'pointer' }}
                  />
                  <Scale size={15} color="var(--text-secondary)" />
                  Es Producto Pesable (Venta por Kilo)
                </label>

                {productModal.data.isPesable && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)', margin: 0 }}>
                      Peso Aprox. Horma (Kg):
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      placeholder="ej: 4.5"
                      value={productModal.data.approximateWeight || ''}
                      onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, approximateWeight: Number(e.target.value) } })}
                      style={{ width: '90px', padding: '3px 8px', textAlign: 'center', fontWeight: 600 }}
                    />
                  </div>
                )}
              </div>
            </div>

            {/* SECCIÓN 2: PRECIOS Y MARGENES DE GANANCIA */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                <DollarSign size={15} color="var(--text-secondary)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  2. Precios de Venta
                </span>
              </div>

              <div style={{ 
                padding: '12px 16px', 
                backgroundColor: 'var(--bg-secondary, #F9FAFB)', 
                borderRadius: '10px', 
                border: '1px solid var(--border-color)',
                display: 'flex',
                flexDirection: 'column',
                gap: '10px'
              }}>
                {/* Precios de venta */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr 1fr 1fr', gap: '12px' }}>
                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Precio Venta Sin IVA ($)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={productModal.data.listPrice ? Math.round((Number(productModal.data.listPrice) / 1.21) * 100) / 100 : ''}
                      onChange={(e) => handleModalPriceChange('priceSinIva', e.target.value)}
                      style={{ padding: '5px 8px' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      Precio Lista 4 (Final C/IVA)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      value={productModal.data.listPrice !== undefined ? productModal.data.listPrice : ''}
                      onChange={(e) => handleModalPriceChange('listPrice', e.target.value)}
                      required
                      style={{ fontWeight: 800, color: 'var(--text-primary)', border: '2px solid var(--accent-color, #111827)', padding: '5px 8px' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Precio Lista Especial (Opcional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      placeholder="Opcional"
                      value={productModal.data.listPriceB !== undefined ? productModal.data.listPriceB : ''}
                      onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, listPriceB: e.target.value === '' ? '' : Number(e.target.value) } })}
                      style={{ padding: '5px 8px' }}
                    />
                  </div>

                  <div className="form-group" style={{ marginBottom: 0 }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      Precio Lista Especial 2 (Opcional)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      className="input"
                      placeholder="Opcional"
                      value={productModal.data.listPriceC !== undefined ? productModal.data.listPriceC : ''}
                      onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, listPriceC: e.target.value === '' ? '' : Number(e.target.value) } })}
                      style={{ padding: '5px 8px' }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECCIÓN 3: LOGÍSTICA Y ALMACÉN */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '4px' }}>
                <Box size={15} color="var(--text-secondary)" />
                <span style={{ fontSize: '0.78rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)' }}>
                  3. Logística y Almacén
                </span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1.3fr 1.2fr', gap: '12px' }}>
                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    Stock Mínimo
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={productModal.data.minStock !== undefined ? productModal.data.minStock : 0}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, minStock: Number(e.target.value) } })}
                    style={{ padding: '5px 8px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    Unidades / Caja
                  </label>
                  <input
                    type="number"
                    className="input"
                    value={productModal.data.unitsPerBox !== undefined ? productModal.data.unitsPerBox : 1}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, unitsPerBox: Number(e.target.value) } })}
                    style={{ padding: '5px 8px' }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--accent-color, #e30613)', marginBottom: '3px' }}>
                    Mínimo Venta
                  </label>
                  <input
                    type="number"
                    min="1"
                    className="input"
                    value={productModal.data.minOrderQuantity !== undefined ? productModal.data.minOrderQuantity : 1}
                    onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, minOrderQuantity: Math.max(1, Number(e.target.value)) } })}
                    style={{ padding: '5px 8px', fontWeight: 700 }}
                  />
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    Fotografía
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ 
                      width: '36px', 
                      height: '36px', 
                      borderRadius: '6px', 
                      border: '1px dashed var(--border-color)', 
                      display: 'flex', 
                      alignItems: 'center', 
                      justifyContent: 'center',
                      backgroundColor: 'var(--bg-secondary)',
                      overflow: 'hidden'
                    }}>
                      {selectedImageFile ? (
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, color: '#10b981' }}>OK</span>
                      ) : imagePreviewUrl ? (
                        <img src={imagePreviewUrl} alt="Vista previa" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <ImageIcon size={16} color="var(--text-muted)" />
                      )}
                    </div>
                    <label style={{ 
                      flex: 1, 
                      padding: '5px 8px', 
                      backgroundColor: '#ffffff', 
                      border: '1px solid var(--border-color)', 
                      borderRadius: '6px', 
                      cursor: 'pointer', 
                      fontSize: '0.75rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      textAlign: 'center'
                    }}>
                      {selectedImageFile ? selectedImageFile.name : 'Subir Imagen'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        style={{ display: 'none' }} 
                        onChange={(e) => {
                          if (e.target.files && e.target.files[0]) {
                            const file = e.target.files[0];
                            setSelectedImageFile(file);
                            setImagePreviewUrl(URL.createObjectURL(file));
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="form-group" style={{ marginBottom: 0 }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '3px' }}>
                    Estado
                  </label>
                  <label style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    gap: '6px', 
                    cursor: 'pointer', 
                    padding: '5px 10px', 
                    backgroundColor: productModal.data.isActive !== false ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-secondary)', 
                    border: productModal.data.isActive !== false ? '1px solid #10b981' : '1px solid var(--border-color)', 
                    borderRadius: '6px',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                    height: '36px'
                  }}>
                    <input
                      type="checkbox"
                      checked={productModal.data.isActive !== false}
                      onChange={(e) => setProductModal({ ...productModal, data: { ...productModal.data, isActive: e.target.checked } })}
                      style={{ width: '15px', height: '15px', cursor: 'pointer' }}
                    />
                    <span style={{ color: productModal.data.isActive !== false ? '#059669' : 'var(--text-muted)' }}>
                      {productModal.data.isActive !== false ? 'Activo' : 'Inactivo'}
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* BOTONES DE ACCIÓN */}
            <div style={{ 
              display: 'flex', 
              justifyContent: 'flex-end', 
              gap: '12px', 
              paddingTop: '10px', 
              borderTop: '1px solid var(--border-color)' 
            }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setProductModal({ ...productModal, open: false })}
                style={{ borderRadius: '8px', padding: '8px 18px', fontSize: '0.84rem' }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                className="btn btn-primary"
                style={{ 
                  borderRadius: '8px', 
                  padding: '8px 22px', 
                  fontSize: '0.84rem', 
                  fontWeight: 700, 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '6px',
                  backgroundColor: 'var(--accent-color, #111827)'
                }}
              >
                <Check size={16} /> Guardar Producto
              </button>
            </div>

          </div>
        </form>
      </div>
    </div>
  );
};

export default ProductModal;
