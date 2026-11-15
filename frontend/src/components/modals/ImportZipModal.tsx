import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../../utils/api';
import { NativeModalDialog } from './NativeModalDialog';

interface ImportZipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ImportZipModal({ isOpen, onClose }: ImportZipModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{
    totalProcessed: number;
    totalSkipped: number;
    skippedFiles: string[];
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      if (!selectedFile.name.toLowerCase().endsWith('.zip')) {
        setError('El archivo debe ser un comprimido .zip');
        setFile(null);
        return;
      }
      setFile(selectedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const droppedFile = e.dataTransfer.files?.[0];
    if (droppedFile) {
      if (!droppedFile.name.toLowerCase().endsWith('.zip')) {
        setError('El archivo debe ser un comprimido .zip');
        setFile(null);
        return;
      }
      setFile(droppedFile);
      setError(null);
      setResult(null);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) return;

    setLoading(true);
    setError(null);
    try {
      const res = await api.importProductsZip(file);
      setResult(res);
      setFile(null);
    } catch (err: any) {
      setError(err.message || 'Error al procesar el archivo ZIP.');
    } finally {
      setLoading(false);
    }
  };

  const resetModal = () => {
    setFile(null);
    setResult(null);
    setError(null);
  };

  const handleClose = () => {
    resetModal();
    onClose();
  };

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={handleClose}
      ariaLabelledBy="import-zip-title"
      style={{ maxWidth: '520px', width: '94vw', padding: '24px' }}
    >
      <div>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 id="import-zip-title" style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>
            Importar Imágenes (.zip)
          </h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={handleClose} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
          {!result ? (
            <div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: '14px' }}>
                Cada imagen debe coincidir con el SKU (<code>0024.jpg</code>, <code>0024.webp</code>).
              </p>

              <div
                onDragOver={handleDragOver}
                onDrop={handleDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '8px',
                  padding: '32px 16px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: 'var(--bg-muted)',
                  transition: 'border-color 0.2s, background-color 0.2s',
                }}
                className="hover-border-primary"
              >
                <input
                  id="import-zip-file"
                  type="file"
                  aria-label="Seleccionar archivo ZIP"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".zip"
                  style={{ display: 'none' }}
                />

                <Upload size={32} aria-hidden="true" style={{ color: 'var(--text-muted)', marginBottom: '12px', margin: '0 auto' }} />

                {file ? (
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{file.name}</div>
                    <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      Seleccionar o arrastrar .zip
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      Máximo 50 MB
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div role="alert" style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '6px', marginTop: '16px', fontSize: '0.85rem' }}>
                  <AlertTriangle size={16} aria-hidden="true" style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>{error}</div>
                </div>
              )}

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', marginTop: '24px', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={handleClose} disabled={loading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!file || loading} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {loading && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
                  <span>{loading ? 'Procesando...' : 'Importar'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircle size={44} aria-hidden="true" style={{ color: '#10b981', margin: '0 auto 12px' }} />
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Importación Finalizada
                </h4>
              </div>

              <div style={{ backgroundColor: 'var(--bg-muted)', borderRadius: '8px', padding: '16px', marginTop: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Asociadas</span>
                  <strong className="tabular-nums" style={{ color: '#10b981' }}>{result.totalProcessed}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Omitidas</span>
                  <strong className="tabular-nums" style={{ color: result.totalSkipped > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
                    {result.totalSkipped}
                  </strong>
                </div>
              </div>

              {result.skippedFiles.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Omitidos
                  </span>
                  <div style={{ maxHeight: '100px', overflowY: 'auto', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {result.skippedFiles.map((name, idx) => (
                      <div key={idx} style={{ padding: '2px 0', color: 'var(--text-secondary)' }}>{name}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', marginTop: '24px', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-primary" onClick={handleClose}>
                  Aceptar
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </NativeModalDialog>
  );
}
