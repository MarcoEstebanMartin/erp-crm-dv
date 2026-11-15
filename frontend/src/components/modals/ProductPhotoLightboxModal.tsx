import React from 'react';
import { Upload, X } from 'lucide-react';
import { NativeModalDialog } from './NativeModalDialog';

interface ProductPhotoLightboxModalProps {
  previewModal: {
    open: boolean;
    imageUrl: string;
    name: string;
    sku: string;
    productId: number;
    categoryName: string;
    categoryIcon?: string;
  } | null;
  onClose: () => void;
  onUploadImage?: (productId: number, file: File) => Promise<void>;
}

export const ProductPhotoLightboxModal: React.FC<ProductPhotoLightboxModalProps> = ({
  previewModal,
  onClose,
  onUploadImage,
}) => {
  if (!previewModal || !previewModal.open) return null;

  return (
    <NativeModalDialog
      isOpen={Boolean(previewModal.open)}
      onClose={onClose}
      ariaLabelledBy="photo-lightbox-title"
      style={{ maxWidth: '500px', width: '90vw', padding: '24px' }}
    >
      <div style={{ textAlign: 'center', position: 'relative' }}>
        <button
          type="button"
          onClick={onClose}
          aria-label="Cerrar"
          className="btn btn-ghost"
          style={{ position: 'absolute', top: '-8px', right: '-8px', padding: '6px' }}
        >
          <X size={18} aria-hidden="true" />
        </button>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-muted)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
          <span>{previewModal.categoryName}</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span style={{ fontFamily: 'monospace' }}>SKU: {previewModal.sku}</span>
        </div>

        <h3 id="photo-lightbox-title" style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
          {previewModal.name}
        </h3>

        <div style={{ backgroundColor: '#fff', borderRadius: '12px', padding: '16px', border: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '260px', maxHeight: '420px', overflow: 'hidden' }}>
          <img
            src={previewModal.imageUrl}
            alt={previewModal.name}
            style={{ maxWidth: '100%', maxHeight: '380px', objectFit: 'contain', borderRadius: '8px' }}
          />
        </div>

        {onUploadImage && (
          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'center', gap: '10px' }}>
            <button
              type="button"
              className="btn btn-secondary"
              style={{ borderRadius: '8px', fontSize: '0.85rem', padding: '8px 16px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              onClick={() => {
                const input = document.createElement('input');
                input.type = 'file';
                input.accept = 'image/*';
                input.onchange = (e: any) => {
                  if (e.target.files && e.target.files[0]) {
                    onUploadImage(previewModal.productId, e.target.files[0]);
                    onClose();
                  }
                };
                input.click();
              }}
            >
              <Upload size={14} aria-hidden="true" />
              <span>Cambiar Imagen</span>
            </button>
          </div>
        )}
      </div>
    </NativeModalDialog>
  );
};
export default ProductPhotoLightboxModal;
