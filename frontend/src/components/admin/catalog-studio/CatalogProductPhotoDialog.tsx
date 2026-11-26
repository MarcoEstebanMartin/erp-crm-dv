import { useEffect, useRef, useState } from 'react';
import { ImageOff, Upload, X } from 'lucide-react';
import type { CatalogStudioProduct } from '../../../utils/api/catalog-studio.api';
import { productsApi } from '../../../utils/api/products.api';
import { resolveCatalogImageSrc } from './CatalogProductCard';

interface CatalogProductPhotoDialogProps {
  product: CatalogStudioProduct | null;
  onClose: () => void;
  onImageUpdated: (productId: number, imageUrl: string | null) => void;
}

const ACCEPTED_IMAGE_TYPES = 'image/jpeg,image/png,image/webp';
const MAX_IMAGE_SIZE_BYTES = 10 * 1024 * 1024;

export function CatalogProductPhotoDialog({
  product,
  onClose,
  onImageUpdated,
}: CatalogProductPhotoDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backdropPressedRef = useRef(false);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);

  useEffect(() => {
    const dlg = dialogRef.current;
    if (!dlg) return;
    if (product) {
      setUploadError(null);
      if (!dlg.open) dlg.showModal();
    } else if (dlg.open) {
      dlg.close();
    }
  }, [product]);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !product) return;

    if (!file.type.startsWith('image/')) {
      setUploadError('Seleccioná un archivo de imagen válido (JPG, PNG o WebP).');
      return;
    }
    if (file.size > MAX_IMAGE_SIZE_BYTES) {
      setUploadError('La imagen supera el límite máximo de 10 MB.');
      return;
    }

    setUploading(true);
    setUploadError(null);
    try {
      const updated = await productsApi.uploadProductImage(product.id, file);
      onImageUpdated(product.id, updated?.imageUrl ?? null);
    } catch (err: any) {
      setUploadError(err?.message || 'No se pudo subir la imagen.');
    } finally {
      setUploading(false);
    }
  };

  const isOutsideDialog = (e: React.PointerEvent<HTMLDialogElement>) => {
    const dlg = dialogRef.current;
    if (!dlg) return false;
    const rect = dlg.getBoundingClientRect();
    return (
      e.clientX < rect.left ||
      e.clientX > rect.right ||
      e.clientY < rect.top ||
      e.clientY > rect.bottom
    );
  };

  const imgSrc = product ? resolveCatalogImageSrc(product.imageUrl) : '';

  return (
    <dialog
      ref={dialogRef}
      className="cs-dialog cs-photo-dialog"
      aria-labelledby="cs-photo-dialog-title"
      onCancel={(e) => {
        e.preventDefault();
        if (!uploading) onClose();
      }}
      onPointerDown={(e) => {
        backdropPressedRef.current = !uploading && isOutsideDialog(e);
      }}
      onPointerUp={(e) => {
        if (backdropPressedRef.current && !uploading && isOutsideDialog(e)) {
          onClose();
        }
        backdropPressedRef.current = false;
      }}
    >
      {product && (
        <>
          <div className="cs-dialog-header">
            <div className="cs-photo-dialog-heading">
              <span className="cs-pill">{product.sku}</span>
              <span className="cs-pill">{product.category}</span>
            </div>
            <button
              type="button"
              className="cs-icon-btn"
              onClick={onClose}
              disabled={uploading}
              aria-label="Cerrar"
            >
              <X size={16} aria-hidden="true" />
            </button>
          </div>

          <div className="cs-dialog-body">
            <h1 id="cs-photo-dialog-title" className="cs-photo-dialog-title">
              {product.name}
            </h1>

            <div className="cs-photo-stage">
              {imgSrc ? (
                <img src={imgSrc} alt={product.name} />
              ) : (
                <div className="cs-photo-empty">
                  <ImageOff size={28} aria-hidden="true" />
                  <span>Sin foto</span>
                </div>
              )}
            </div>

            {uploadError && (
              <div role="alert" className="cs-photo-error">
                {uploadError}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept={ACCEPTED_IMAGE_TYPES}
              onChange={handleFileSelected}
              hidden
            />
          </div>

          <div className="cs-dialog-footer">
            <button
              type="button"
              className="cs-btn"
              onClick={onClose}
              disabled={uploading}
            >
              Cerrar
            </button>
            <button
              type="button"
              className="cs-btn cs-btn-dark"
              autoFocus
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={14} aria-hidden="true" />
              <span>
                {uploading
                  ? 'Subiendo...'
                  : imgSrc
                    ? 'Cambiar imagen'
                    : 'Subir imagen'}
              </span>
            </button>
          </div>
        </>
      )}
    </dialog>
  );
}
