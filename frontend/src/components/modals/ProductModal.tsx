import React, { useState, useEffect } from 'react';
import { Package, X, Check } from 'lucide-react';
import { api } from '../../utils/api';
import { NativeModalDialog } from './NativeModalDialog';
import { ProductIdentificationSection } from './product/ProductIdentificationSection';
import { ProductPricingLogisticsSection } from './product/ProductPricingLogisticsSection';

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
  setErrorMsg,
}) => {
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string>('');

  useEffect(() => {
    if (productModal.open) {
      setSelectedImageFile(null);
      if (productModal.mode === 'edit' && productModal.data.imageUrl) {
        const img = productModal.data.imageUrl;
        setImagePreviewUrl(img.startsWith('http') ? img : img.startsWith('/') ? img : `/uploads/products/${img}`);
      } else {
        setImagePreviewUrl('');
      }
    }
  }, [productModal.open, productModal.data?.id, productModal.data?.imageUrl, productModal.mode]);

  if (!productModal || !productModal.open) return null;

  const handleClose = () => {
    setSelectedImageFile(null);
    setProductModal({ ...productModal, open: false });
  };

  const applyBandRatios = (updatedData: any, targetListPrice: number) => {
    const ratioB =
      Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceB) > 0
        ? Number(productModal.data.listPriceB) / Number(productModal.data.listPrice)
        : 0.95;
    const ratioC =
      Number(productModal.data.listPrice) > 0 && Number(productModal.data.listPriceC) > 0
        ? Number(productModal.data.listPriceC) / Number(productModal.data.listPrice)
        : 0.9;
    updatedData.listPriceB = Math.max(0, Math.round(targetListPrice * ratioB * 100) / 100);
    updatedData.listPriceC = Math.max(0, Math.round(targetListPrice * ratioC * 100) / 100);
  };

  const handleModalPriceChange = (field: string, valueStr: string) => {
    const value = valueStr === '' ? '' : Number(valueStr);
    const updatedData = { ...productModal.data, [field]: value };

    const cost = Number(updatedData.costPrice) || 0;
    const currentListPrice = Number(updatedData.listPrice) || 0;

    if (field === 'costPrice') {
      if (cost > 0 && currentListPrice > 0) {
        updatedData.profitMargin = Math.round(((currentListPrice / cost - 1) * 100) * 100) / 100;
      }
    } else if (field === 'profitMargin') {
      const newMargin = valueStr === '' ? 1 : 1 + Number(valueStr) / 100;
      updatedData.listPrice = Math.max(0, Math.round(cost * newMargin * 100) / 100);
      applyBandRatios(updatedData, updatedData.listPrice);
    } else if (field === 'priceSinIva') {
      updatedData.listPrice = Math.max(0, Math.round((Number(value) || 0) * 1.21 * 100) / 100);
      if (cost > 0) {
        updatedData.profitMargin = Math.round(((updatedData.listPrice / cost - 1) * 100) * 100) / 100;
      }
      applyBandRatios(updatedData, updatedData.listPrice);
    } else if (field === 'listPrice') {
      const listPriceVal = Number(value) || 0;
      if (cost > 0) {
        updatedData.profitMargin = Math.round(((listPriceVal / cost - 1) * 100) * 100) / 100;
      }
      applyBandRatios(updatedData, listPriceVal);
    }

    setProductModal({ ...productModal, data: updatedData });
  };

  const handleModalRubroChange = (rubroIdVal: string) => {
    const rubroId = rubroIdVal === '' ? '' : Number(rubroIdVal);
    const updatedData = { ...productModal.data, rubroId };

    if (rubroId) {
      const selectedRubro = rubrosList.find((r) => Number(r.id) === rubroId);
      if (selectedRubro) {
        const marginFactor = Number(selectedRubro.profitMargin) || 1.25;
        updatedData.profitMargin = Math.round((marginFactor - 1) * 100);
        const cost = Number(updatedData.costPrice) || 0;
        updatedData.listPrice = Math.max(0, Math.round(cost * marginFactor * 100) / 100);
        applyBandRatios(updatedData, updatedData.listPrice);
      }
    }

    setProductModal({ ...productModal, data: updatedData });
  };

  const handleDataChange = (patch: Record<string, any>) => {
    setProductModal({ ...productModal, data: { ...productModal.data, ...patch } });
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
      profitMargin:
        data.profitMargin !== undefined && data.profitMargin !== '' ? 1 + Number(data.profitMargin) / 100 : null,
      rubroId: data.rubroId ? Number(data.rubroId) : null,
      providerId: data.providerId ? Number(data.providerId) : null,
      commercialCategory: data.commercialCategory || null,
      minStock: Number(data.minStock || 0),
      isPesable: Boolean(data.isPesable),
      unitsPerBox: Number(data.unitsPerBox || 1),
      minOrderQuantity: Number(data.minOrderQuantity || 1),
      approximateWeight: data.approximateWeight ? Number(data.approximateWeight) : 0,
      isActive: (data as any).isActive !== undefined ? Boolean((data as any).isActive) : undefined,
    };

    try {
      const savedProduct =
        mode === 'create' ? await api.createProduct(payload) : await api.updateProduct(data.id, payload);
      if (selectedImageFile) {
        await api.uploadProductImage(savedProduct.id, selectedImageFile);
      }
      handleClose();
      setSuccessMsg('Producto guardado correctamente.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar producto.');
    }
  };

  return (
    <NativeModalDialog
      isOpen={Boolean(productModal.open)}
      onClose={handleClose}
      ariaLabelledBy="product-modal-title"
      style={{ maxWidth: '1180px', width: '95vw', maxHeight: '94vh', padding: 0 }}
    >
      <div
        style={{
          padding: '14px 24px',
          borderBottom: '1px solid var(--border-color, #E5E7EB)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          backgroundColor: 'var(--bg-secondary, #F9FAFB)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '10px',
              backgroundColor: 'var(--accent-color, #111827)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <Package size={18} aria-hidden="true" />
          </div>
          <div>
            <h3 id="product-modal-title" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              {productModal.mode === 'create' ? 'Nuevo Producto' : 'Editar Producto'}
            </h3>
            {productModal.mode === 'edit' && (
              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                SKU: {productModal.data.sku} · ID: {productModal.data.id}
              </span>
            )}
          </div>
        </div>
        <button
          type="button"
          onClick={handleClose}
          aria-label="Cerrar"
          className="btn btn-ghost"
          style={{ padding: '6px', borderRadius: '8px', display: 'flex', alignItems: 'center' }}
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <form onSubmit={handleProductSubmit} style={{ padding: '16px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <ProductIdentificationSection
            mode={productModal.mode}
            data={productModal.data}
            rubrosList={rubrosList}
            providersList={providersList}
            onDataChange={handleDataChange}
            onRubroChange={handleModalRubroChange}
          />

          <ProductPricingLogisticsSection
            data={productModal.data}
            selectedImageFile={selectedImageFile}
            imagePreviewUrl={imagePreviewUrl}
            onDataChange={handleDataChange}
            onPriceChange={handleModalPriceChange}
            onImageSelected={(file) => {
              setSelectedImageFile(file);
              setImagePreviewUrl(URL.createObjectURL(file));
            }}
          />

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '12px',
              paddingTop: '10px',
              borderTop: '1px solid var(--border-color)',
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={handleClose}
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
                backgroundColor: 'var(--accent-color, #111827)',
              }}
            >
              <Check size={16} aria-hidden="true" /> Guardar
            </button>
          </div>
        </div>
      </form>
    </NativeModalDialog>
  );
};

export default ProductModal;
