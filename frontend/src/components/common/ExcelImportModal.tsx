import React, { useEffect, useState } from 'react';
import { FileSpreadsheet, CheckCircle2, XCircle, ArrowRight, Loader2, X, RefreshCw, Download } from 'lucide-react';
import { apiClient } from '../../api/apiClient';
import { api } from '../../utils/api';
import { NativeModalDialog } from '../modals/NativeModalDialog';
import { formatCleanExpirationDate, isSentinelExpiration } from '../stock/lotLabel';

export type ExcelImportDomain = 'PRODUCTS' | 'PRICES' | 'CLIENTS' | 'STOCK_INICIAL';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialDomain?: ExcelImportDomain;
}

const STATUS_META: Record<string, { label: string; color: string; bg: string; dot: string }> = {
  VALID: { label: 'Válido', color: '#065f46', bg: '#ecfdf5', dot: '#10b981' },
  WARNING: { label: 'Adv.', color: '#92400e', bg: '#fffbeb', dot: '#f59e0b' },
  ERROR: { label: 'Error', color: '#991b1b', bg: '#fef2f2', dot: '#ef4444' },
};

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialDomain = 'PRODUCTS',
}) => {
  const [domain, setDomain] = useState<ExcelImportDomain>(initialDomain);
  const [file, setFile] = useState<File | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);
  const [downloadingTpl, setDownloadingTpl] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ERRORS' | 'WARNINGS' | 'CHANGES'>('ALL');
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setDomain(initialDomain);
      setReport(null);
      setCommitMessage(null);
      setErrorMessage(null);
    }
  }, [isOpen, initialDomain]);

  if (!isOpen) return null;

  const handleDownloadTemplate = async () => {
    setDownloadingTpl(true);
    setErrorMessage(null);
    try {
      const blob = await api.downloadStockInicialTemplate();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'Plantilla_Stock_Inicial_DV.xlsx';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      setErrorMessage(err.message || 'No se pudo descargar la plantilla.');
    } finally {
      setDownloadingTpl(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setFile(e.target.files[0]);
      setReport(null);
      setErrorMessage(null);
      setCommitMessage(null);
    }
  };

  const handlePreview = async () => {
    if (!file) return;
    setLoadingPreview(true);
    setErrorMessage(null);
    setCommitMessage(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('domain', domain);

    try {
      const data = await apiClient.postFormData<any>('/admin/excel/preview', formData);
      if (data.success) setReport(data.report);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al analizar la planilla Excel');
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleCommit = async () => {
    if (!report || report.rows.length === 0) return;
    setLoadingCommit(true);
    setErrorMessage(null);

    try {
      const data = await apiClient.post<any>('/admin/excel/commit', { domain, rows: report.rows });
      if (data.success) {
        setCommitMessage(data.message);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al importar los datos.');
    } finally {
      setLoadingCommit(false);
    }
  };

  const filteredRows = report
    ? report.rows.filter((r: any) => {
        if (activeFilter === 'ERRORS') return r.status === 'ERROR';
        if (activeFilter === 'WARNINGS') return r.status === 'WARNING';
        if (activeFilter === 'CHANGES') return r.action === 'CREATE' || r.action === 'UPDATE';
        return true;
      })
    : [];

  return (
    <NativeModalDialog
      isOpen={isOpen}
      onClose={onClose}
      ariaLabelledBy="excel-import-title"
      style={{ maxWidth: '1020px', width: '94vw', maxHeight: '90vh', padding: 0 }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '90vh' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px 24px',
            borderBottom: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary, #F9FAFB)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileSpreadsheet size={20} color="#059669" aria-hidden="true" />
            <h2 id="excel-import-title" style={{ margin: 0, fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)' }}>
              Importar Excel
            </h2>
          </div>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="btn btn-ghost" style={{ padding: '6px' }}>
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: '14px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="excel-import-domain" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Tipo
              </label>
              <select
                id="excel-import-domain"
                className="select"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value as ExcelImportDomain);
                  setReport(null);
                  setCommitMessage(null);
                }}
              >
                <option value="PRODUCTS">Productos</option>
                <option value="PRICES">Lista de Precios</option>
                <option value="CLIENTS">Clientes</option>
                <option value="STOCK_INICIAL">Stock Inicial (Lotes + Mapa WMS)</option>
              </select>
              {domain === 'STOCK_INICIAL' && (
                <button
                  type="button"
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTpl}
                  className="btn btn-secondary"
                  style={{ marginTop: '8px', width: '100%', fontSize: '0.78rem', padding: '5px 10px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                >
                  <Download size={14} aria-hidden="true" />
                  {downloadingTpl ? 'Generando...' : 'Descargar plantilla (.xlsx)'}
                </button>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label htmlFor="excel-import-file" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Archivo (.xlsx / .csv)
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  id="excel-import-file"
                  type="file"
                  accept=".xlsx, .csv"
                  onChange={handleFileChange}
                  className="input"
                  style={{ flex: 1, padding: '6px 10px' }}
                />
                <button
                  type="button"
                  onClick={handlePreview}
                  disabled={!file || loadingPreview}
                  className="btn btn-primary"
                  style={{ display: 'flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}
                >
                  {loadingPreview ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={15} aria-hidden="true" />}
                  Analizar
                </button>
              </div>
            </div>
          </div>

          {errorMessage && (
            <div role="alert" style={{ padding: '10px 14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', borderRadius: '8px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <XCircle size={16} aria-hidden="true" />
              <span>{errorMessage}</span>
            </div>
          )}

          {commitMessage && (
            <div role="status" style={{ padding: '10px 14px', backgroundColor: '#ecfdf5', border: '1px solid #a7f3d0', color: '#065f46', borderRadius: '8px', fontSize: '0.84rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <CheckCircle2 size={16} aria-hidden="true" />
              <span>{commitMessage}</span>
            </div>
          )}

          {report && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                <div style={{ padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Filas</div>
                  <div className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 700 }}>{report.summary.totalRows}</div>
                </div>
                <div style={{ padding: '10px 12px', border: '1px solid #a7f3d0', borderRadius: '8px', backgroundColor: '#ecfdf5' }}>
                  <div style={{ fontSize: '0.75rem', color: '#065f46' }}>Válidas</div>
                  <div className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#065f46' }}>{report.summary.validCount}</div>
                </div>
                <div style={{ padding: '10px 12px', border: '1px solid #fde68a', borderRadius: '8px', backgroundColor: '#fffbeb' }}>
                  <div style={{ fontSize: '0.75rem', color: '#92400e' }}>Advertencias</div>
                  <div className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#92400e' }}>{report.summary.warningCount}</div>
                </div>
                <div style={{ padding: '10px 12px', border: '1px solid #fecaca', borderRadius: '8px', backgroundColor: '#fef2f2' }}>
                  <div style={{ fontSize: '0.75rem', color: '#991b1b' }}>Errores</div>
                  <div className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 700, color: '#991b1b' }}>{report.summary.errorCount}</div>
                </div>
                <div style={{ padding: '10px 12px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Nuevos / Modif.</div>
                  <div className="tabular-nums" style={{ fontSize: '1.1rem', fontWeight: 700 }}>
                    +{report.summary.actionNewCount} / ~{report.summary.actionUpdateCount}
                  </div>
                </div>
              </div>

              <div role="tablist" aria-label="Filtros de pre-inspección" className="linear-tablist">
                {[
                  { id: 'ALL', label: `Todos (${report.rows.length})` },
                  { id: 'ERRORS', label: `Errores (${report.summary.errorCount})` },
                  { id: 'WARNINGS', label: `Advertencias (${report.summary.warningCount})` },
                  { id: 'CHANGES', label: `Cambios (+${report.summary.actionNewCount} / ~${report.summary.actionUpdateCount})` },
                ].map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeFilter === tab.id}
                    className="linear-tab"
                    onClick={() => setActiveFilter(tab.id as any)}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>

              <div className="table-container table-container--sticky" role="region" aria-label="Vista previa de planilla" tabIndex={0} style={{ maxHeight: '280px', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
                <table style={{ width: '100%', fontSize: '0.8rem' }}>
                  <thead>
                    {domain === 'STOCK_INICIAL' ? (
                      <tr>
                        <th scope="col">Fila</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Acción</th>
                        <th scope="col">Ubicación</th>
                        <th scope="col">SKU</th>
                        <th scope="col">Producto</th>
                        <th scope="col">Lote / Venc.</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Cantidad</th>
                        <th scope="col">Mensajes</th>
                      </tr>
                    ) : (
                      <tr>
                        <th scope="col">Fila</th>
                        <th scope="col">Estado</th>
                        <th scope="col">Acción</th>
                        <th scope="col">SKU</th>
                        <th scope="col">Descripción</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Costo</th>
                        <th scope="col" style={{ textAlign: 'right' }}>Lista A</th>
                        <th scope="col">Mensajes</th>
                      </tr>
                    )}
                  </thead>
                  <tbody>
                    {filteredRows.map((r: any, idx: number) => {
                      const st = STATUS_META[r.status] || { label: r.status, color: '#374151', bg: '#F3F4F6', dot: '#9CA3AF' };
                      const expTxt = isSentinelExpiration(r.data?.expirationDate)
                        ? 'Sin vto.'
                        : formatCleanExpirationDate(r.data?.expirationDate);
                      return (
                        <tr key={idx}>
                          <td className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>#{r.rowIndex}</td>
                          <td>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '2px 8px', borderRadius: '99px', fontSize: '0.72rem', fontWeight: 600, backgroundColor: st.bg, color: st.color }}>
                              <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: st.dot }} />
                              {st.label}
                            </span>
                          </td>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            {r.action === 'CREATE' && <span style={{ color: '#059669' }}>+ Crear</span>}
                            {r.action === 'UPDATE' && <span style={{ color: '#2563eb' }}>~ Actualizar</span>}
                            {r.action === 'NONE' && <span style={{ color: 'var(--text-secondary)' }}>-</span>}
                          </td>
                          {domain === 'STOCK_INICIAL' ? (
                            <>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.data.location || 'S/U'}</td>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.data.sku || '---'}</td>
                              <td>{r.data.name || '---'}</td>
                              <td style={{ fontSize: '0.75rem' }}>{r.data.lotNumber || 'S/L'} · {expTxt}</td>
                              <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700 }}>{r.data.quantity || 0} u.</td>
                            </>
                          ) : (
                            <>
                              <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{r.data.sku || '---'}</td>
                              <td>{r.data.name || '---'}</td>
                              <td className="tabular-nums" style={{ textAlign: 'right' }}>
                                ${Number(r.data.costPrice || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                              <td className="tabular-nums" style={{ textAlign: 'right' }}>
                                ${Number(r.data.listPrice || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                              </td>
                            </>
                          )}
                          <td>
                            {r.messages && r.messages.length > 0 ? (
                              <span style={{ color: r.status === 'ERROR' ? '#b91c1c' : '#b45309' }}>
                                {r.messages.join(' | ')}
                              </span>
                            ) : (
                              <span style={{ color: 'var(--text-muted)' }}>-</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        <div
          style={{
            padding: '14px 24px',
            borderTop: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-secondary, #F9FAFB)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <button type="button" onClick={onClose} className="btn btn-secondary">
            Cancelar
          </button>
          {report && (
            <button
              type="button"
              onClick={handleCommit}
              disabled={loadingCommit || report.summary.errorCount > 0 || commitMessage !== null}
              className="btn btn-primary"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              {loadingCommit ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <ArrowRight size={15} aria-hidden="true" />}
              {commitMessage ? 'Importado' : 'Confirmar e Importar'}
            </button>
          )}
        </div>
      </div>
    </NativeModalDialog>
  );
};
