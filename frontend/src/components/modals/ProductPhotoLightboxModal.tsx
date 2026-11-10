import React from 'react';
import { Upload } from 'lucide-react';

interface ProductPhotoLightboxModalProps {
  previewModal: {
    open: boolean;
    imageUrl: string;
    name: string;
    sku: string;
    productId: number;
    categoryName: string;
    categoryIcon: string;
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
    <div
      className="modal-overlay"
      style={{ backdropFilter: 'blur(8px)', backgroundColor: 'rgba(0,0,0,0.65)', zIndex: 1200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
      onClick={onClose}
    >
      <div
        className="modal-content fade-in"
        style={{ backgroundColor: 'var(--bg-card)', padding: '24px', borderRadius: '16px', maxWidth: '500px', width: '90%', textAlign: 'center', position: 'relative', boxShadow: '0 20px 40px rgba(0,0,0,0.3)', border: '1px solid var(--border-color)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          style={{ position: 'absolute', top: '16px', right: '16px', background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '1.2rem', fontWeight: 'bold' }}
        >
          ✕
        </button>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', backgroundColor: 'var(--bg-muted)', padding: '4px 12px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '12px' }}>
          <span>{previewModal.categoryIcon}</span>
          <span>{previewModal.categoryName}</span>
          <span style={{ opacity: 0.5 }}>|</span>
          <span style={{ fontFamily: 'monospace' }}>SKU: {previewModal.sku}</span>
        </div>

        <h3 style={{ fontSize: '1.1rem', fontWeight: 700, margin: '0 0 16px 0', color: 'var(--text-primary)' }}>
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
              <Upload size={14} />
              <span>Cambiar Imagen</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
export default ProductPhotoLightboxModal;
