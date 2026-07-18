import { useState, useRef } from 'react';
import { Upload, X, CheckCircle, AlertTriangle, Loader2 } from 'lucide-react';
import { api } from '../../utils/api';

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

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ maxWidth: '520px', animation: 'scaleUp 0.2s ease-out' }}>
        <div className="modal-header" style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
          <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, color: 'var(--text-primary)' }}>Importar Imágenes en Lote</h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => { resetModal(); onClose(); }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ marginTop: '16px' }}>
          {!result ? (
            <div>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px', lineHeight: 1.4 }}>
                Sube un archivo <strong>.zip</strong> que contenga las imágenes de los productos. 
                El nombre de cada imagen dentro del ZIP debe coincidir exactamente con el <strong>SKU</strong> del producto en el ERP 
                (ejemplo: <code>0024.png</code>, <code>0024.jpg</code>, <code>0024.webp</code>).
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
                  type="file"
                  ref={fileInputRef}
                  onChange={handleFileChange}
                  accept=".zip"
                  style={{ display: 'none' }}
                />
                
                <Upload size={32} style={{ color: 'var(--text-muted)', marginBottom: '12px', margin: '0 auto' }} />
                
                {file ? (
                  <div>
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.9rem' }}>{file.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                      {(file.size / (1024 * 1024)).toFixed(2)} MB
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ fontWeight: 500, color: 'var(--text-primary)', fontSize: '0.9rem' }}>
                      Arrastra tu archivo ZIP aquí o haz clic para buscar
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                      Máximo 50MB
                    </div>
                  </div>
                )}
              </div>

              {error && (
                <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-start', backgroundColor: '#fee2e2', color: '#b91c1c', padding: '12px', borderRadius: '6px', marginTop: '16px', fontSize: '0.85rem' }}>
                  <AlertTriangle size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
                  <div>{error}</div>
                </div>
              )}

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', marginTop: '24px', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button type="button" className="btn btn-secondary" onClick={() => { resetModal(); onClose(); }} disabled={loading}>
                  Cancelar
                </button>
                <button type="submit" className="btn btn-primary" disabled={!file || loading} style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  {loading && <Loader2 size={16} className="animate-spin" />}
                  <span>{loading ? 'Procesando ZIP...' : 'Subir e Importar'}</span>
                </button>
              </div>
            </div>
          ) : (
            <div>
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <CheckCircle size={48} style={{ color: '#10b981', margin: '0 auto 12px' }} />
                <h4 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  Procesamiento Finalizado
                </h4>
              </div>

              <div style={{ backgroundColor: 'var(--bg-muted)', borderRadius: '8px', padding: '16px', marginTop: '12px', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '8px', borderBottom: '1px solid var(--border-color)', marginBottom: '8px', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Imágenes asociadas por SKU:</span>
                  <strong style={{ color: '#10b981' }}>{result.totalProcessed}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem' }}>
                  <span style={{ color: 'var(--text-secondary)' }}>Archivos omitidos (no corresponden a SKUs):</span>
                  <strong style={{ color: result.totalSkipped > 0 ? '#f59e0b' : 'var(--text-primary)' }}>
                    {result.totalSkipped}
                  </strong>
                </div>
              </div>

              {result.skippedFiles.length > 0 && (
                <div style={{ marginTop: '16px' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>
                    Archivos Omitidos:
                  </span>
                  <div style={{ maxHeight: '100px', overflowY: 'auto', backgroundColor: 'var(--bg-body)', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px', fontSize: '0.75rem', fontFamily: 'monospace' }}>
                    {result.skippedFiles.map((name, idx) => (
                      <div key={idx} style={{ padding: '2px 0', color: 'var(--text-secondary)' }}>• {name}</div>
                    ))}
                  </div>
                </div>
              )}

              <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', marginTop: '24px', paddingTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-primary" onClick={() => { resetModal(); onClose(); }}>
                  Aceptar
                </button>
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}
