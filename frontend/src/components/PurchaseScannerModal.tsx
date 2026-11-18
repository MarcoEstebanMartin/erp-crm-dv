import type { FC } from 'react';
import { X, Check, AlertCircle, Loader, FileText, HelpCircle } from 'lucide-react';
import { NativeModalDialog } from './modals/NativeModalDialog';
import { usePurchaseScanner } from './compras/scanner/usePurchaseScanner';
import { PurchaseScannerGeneralSection, PurchaseScannerTotalsSection } from './compras/scanner/PurchaseScannerFormAndTotals';
import { PurchaseScannerItemsSection } from './compras/scanner/PurchaseScannerItemsSection';

interface PurchaseScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  providers?: any[];
  onSuccess: () => void;
}

const CONFIRM_LABELS: Record<string, string> = {
  IN_TRANSIT: 'Guardar en tránsito',
  IMMEDIATE: 'Confirmar e ingresar stock',
  NONE: 'Confirmar factura',
};

export const PurchaseScannerModal: FC<PurchaseScannerModalProps> = ({ isOpen, onClose, file, providers = [], onSuccess }) => {
  const s = usePurchaseScanner({ isOpen, file, onSuccess, onClose });
  const items = s.extractedData?.items || [];
  const allItemsValid =
    s.receptionMode === 'NONE'
      ? true
      : items.length > 0 &&
        items.some((i: any) => !i.isNonStock && !!i.matchedProductId) &&
        items.every((i: any) => i.isNonStock || !!i.matchedProductId);
  const isDisabled = s.loading || !s.extractedData || !allItemsValid;

  return (
    <NativeModalDialog isOpen={isOpen} onClose={onClose} ariaLabelledBy="purchase-scanner-title" style={{ width: '96vw', maxWidth: '1560px', padding: 0, overflow: 'hidden' }}>
      <div style={{ display: 'flex', flexDirection: 'column', height: '90vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 24px', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--accent-bg-light)' }}>
          <h2 id="purchase-scanner-title" style={{ fontSize: '1.15rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <FileText size={20} aria-hidden="true" style={{ color: 'var(--color-corp-red)' }} />
            Escáner de Facturas
          </h2>
          <button type="button" className="btn btn-ghost" onClick={onClose} style={{ padding: '6px' }} aria-label="Cerrar">
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          <div style={{ width: '58%', padding: '20px', borderRight: '1px solid var(--border-color)', backgroundColor: 'var(--bg-app)', overflowY: 'auto', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            {s.previewUrl ? (
              s.isPdf ? (
                <iframe src={`${s.previewUrl}#toolbar=0&navpanes=0`} title="Vista previa PDF" style={{ width: '100%', height: '78vh', border: '1px solid var(--border-color)', borderRadius: '10px', backgroundColor: '#FFFFFF' }} />
              ) : (
                <img src={s.previewUrl} alt="Vista previa del comprobante" style={{ maxWidth: '100%', maxHeight: '78vh', objectFit: 'contain', borderRadius: '10px', border: '1px solid var(--border-color)' }} />
              )
            ) : (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', color: 'var(--text-secondary)' }}>
                <HelpCircle size={40} aria-hidden="true" style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.88rem' }}>Sin documento seleccionado</span>
              </div>
            )}
          </div>

          <div className="custom-scrollbar" style={{ width: '42%', padding: '20px', backgroundColor: '#FFFFFF', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '18px' }}>
            {s.loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '12px' }}>
                <Loader size={36} aria-hidden="true" style={{ color: 'var(--color-corp-red)' }} />
                <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Procesando comprobante...</span>
              </div>
            ) : s.errorMsg && !s.extractedData ? (
              <div role="alert" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: '12px' }}>
                <AlertCircle size={40} aria-hidden="true" style={{ color: 'var(--color-corp-red)' }} />
                <div style={{ color: 'var(--color-danger)', fontWeight: 600 }}>{s.errorMsg}</div>
                <button type="button" className="btn btn-secondary" onClick={() => file && s.processUploadedDocument(file)}>Reintentar</button>
              </div>
            ) : s.extractedData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
                {s.errorMsg && (
                  <div role="alert" className="alert alert-danger" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: 0 }}>
                    <AlertCircle size={18} aria-hidden="true" />
                    <span>{s.errorMsg}</span>
                  </div>
                )}
                <PurchaseScannerGeneralSection
                  extractedData={s.extractedData}
                  providers={providers}
                  receptionMode={s.receptionMode}
                  setReceptionMode={s.setReceptionMode}
                  onDocMetaChange={s.updateDocMeta}
                />
                <PurchaseScannerItemsSection
                  items={items}
                  activeSearchIndex={s.activeSearchIndex}
                  setActiveSearchIndex={s.setActiveSearchIndex}
                  productSearchQueries={s.productSearchQueries}
                  productSearchResults={s.productSearchResults}
                  onProductSearch={s.handleProductSearch}
                  onSelectProduct={s.handleSelectProduct}
                  onToggleNonStock={s.handleToggleNonStock}
                  onMarkAllNonStock={s.handleMarkAllNonStock}
                />
                <PurchaseScannerTotalsSection extractedData={s.extractedData} setExtractedData={s.setExtractedData} updateExtractedField={s.updateExtractedField} />
              </div>
            ) : null}
          </div>
        </div>

        <div style={{ padding: '14px 24px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', gap: '10px', backgroundColor: 'var(--bg-app)' }}>
          <button type="button" className="btn btn-secondary" onClick={onClose} disabled={s.loading}>Cancelar</button>
          <button type="button" className="btn btn-primary" onClick={s.handleConfirm} disabled={isDisabled} style={{ backgroundColor: 'var(--color-corp-red)', borderColor: 'var(--color-corp-red)', display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            {s.loading ? <Loader size={16} aria-hidden="true" /> : <Check size={16} aria-hidden="true" />}
            <span>{CONFIRM_LABELS[s.receptionMode] || 'Confirmar factura'}</span>
          </button>
        </div>
      </div>
    </NativeModalDialog>
  );
};
