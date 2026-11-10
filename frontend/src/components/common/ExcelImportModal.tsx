import React, { useState } from 'react';
import { FileSpreadsheet, Upload, CheckCircle2, AlertTriangle, XCircle, ArrowRight, Loader2, X, RefreshCw } from 'lucide-react';
import { apiClient } from '../../api/apiClient';

interface ExcelImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ExcelImportModal: React.FC<ExcelImportModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [domain, setDomain] = useState<'PRODUCTS' | 'PRICES' | 'CLIENTS'>('PRODUCTS');

  const [file, setFile] = useState<File | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [loadingCommit, setLoadingCommit] = useState(false);
  const [report, setReport] = useState<any | null>(null);
  const [activeFilter, setActiveFilter] = useState<'ALL' | 'ERRORS' | 'WARNINGS' | 'CHANGES'>('ALL');
  const [commitMessage, setCommitMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

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
      if (data.success) {
        setReport(data.report);
      }
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
      const data = await apiClient.post<any>('/admin/excel/commit', {
        domain,
        rows: report.rows
      });

      if (data.success) {
        setCommitMessage(data.message);
        if (onSuccess) onSuccess();
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'Error al importar los datos en la base de datos.');
    } finally {
      setLoadingCommit(false);
    }
  };

  const filteredRows = report ? report.rows.filter((r: any) => {
    if (activeFilter === 'ERRORS') return r.status === 'ERROR';
    if (activeFilter === 'WARNINGS') return r.status === 'WARNING';
    if (activeFilter === 'CHANGES') return r.action === 'CREATE' || r.action === 'UPDATE';
    return true;
  }) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-zinc-900 border border-zinc-800 rounded-xl w-full max-w-5xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-950/50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg border border-emerald-500/20">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-zinc-100">Ingesta Segura de Planillas Excel</h2>
              <p className="text-xs text-zinc-400">Validador y Pre-Inspección Transaccional a Prueba de Errores</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-zinc-400 hover:text-zinc-200 rounded-lg hover:bg-zinc-800 transition">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Selector de Dominio & File Drop */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-medium text-zinc-300">Dominio de Importación</label>
              <select
                value={domain}
                onChange={(e) => { setDomain(e.target.value as any); setReport(null); }}
                className="w-full bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-2 text-sm text-zinc-200 focus:outline-none focus:border-zinc-700"
              >
                <option value="PRODUCTS">Catálogo de Productos (SKUs, Rubros, Precios)</option>
                <option value="PRICES">Lista de Precios (Actualización Masiva)</option>
                <option value="CLIENTS">Maestro de Clientes (CUIT, Razón Social, Dirección, Ruta)</option>

              </select>
            </div>

            <div className="md:col-span-2 space-y-2">
              <label className="text-xs font-medium text-zinc-300">Planilla Excel (.xlsx / .csv)</label>
              <div className="flex gap-2">
                <input
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1.5 text-sm text-zinc-400 file:mr-3 file:py-1 file:px-3 file:rounded-md file:border-0 file:text-xs file:font-semibold file:bg-zinc-800 file:text-zinc-200 hover:file:bg-zinc-700"
                />
                <button
                  onClick={handlePreview}
                  disabled={!file || loadingPreview}
                  className="flex items-center gap-2 bg-zinc-100 text-zinc-900 px-4 py-2 rounded-lg text-sm font-medium hover:bg-white disabled:opacity-50 transition"
                >
                  {loadingPreview ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  Analizar
                </button>
              </div>
            </div>
          </div>

          {/* Banner de Mensajes */}
          {errorMessage && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 text-red-400 rounded-lg text-sm flex items-center gap-2">
              <XCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {commitMessage && (
            <div className="p-3 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 rounded-lg text-sm flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{commitMessage}</span>
            </div>
          )}

          {/* Reporte de Pre-Inspección */}
          {report && (
            <div className="space-y-4">
              {/* Tarjetas de Resumen */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg">
                  <div className="text-xs text-zinc-400 font-medium">Filas Totales</div>
                  <div className="text-lg font-semibold text-zinc-100">{report.summary.totalRows}</div>
                </div>
                <div className="bg-zinc-950 border border-emerald-500/30 p-3 rounded-lg">
                  <div className="text-xs text-emerald-400 font-medium flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Válidas
                  </div>
                  <div className="text-lg font-semibold text-emerald-400">{report.summary.validCount}</div>
                </div>
                <div className="bg-zinc-950 border border-amber-500/30 p-3 rounded-lg">
                  <div className="text-xs text-amber-400 font-medium flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Advertencias
                  </div>
                  <div className="text-lg font-semibold text-amber-400">{report.summary.warningCount}</div>
                </div>
                <div className="bg-zinc-950 border border-red-500/30 p-3 rounded-lg">
                  <div className="text-xs text-red-400 font-medium flex items-center gap-1">
                    <XCircle className="w-3.5 h-3.5" /> Errores
                  </div>
                  <div className="text-lg font-semibold text-red-400">{report.summary.errorCount}</div>
                </div>
                <div className="bg-zinc-950 border border-zinc-800 p-3 rounded-lg">
                  <div className="text-xs text-blue-400 font-medium">Nuevos / Modif.</div>
                  <div className="text-lg font-semibold text-blue-400">
                    +{report.summary.actionNewCount} / ~{report.summary.actionUpdateCount}
                  </div>
                </div>
              </div>

              {/* Filtros de Tabla */}
              <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveFilter('ALL')}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition ${activeFilter === 'ALL' ? 'bg-zinc-800 text-zinc-100' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Todos ({report.rows.length})
                  </button>
                  <button
                    onClick={() => setActiveFilter('ERRORS')}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition ${activeFilter === 'ERRORS' ? 'bg-red-500/20 text-red-300 border border-red-500/30' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Errores ({report.summary.errorCount})
                  </button>
                  <button
                    onClick={() => setActiveFilter('WARNINGS')}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition ${activeFilter === 'WARNINGS' ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Advertencias ({report.summary.warningCount})
                  </button>
                  <button
                    onClick={() => setActiveFilter('CHANGES')}
                    className={`px-3 py-1 text-xs rounded-md font-medium transition ${activeFilter === 'CHANGES' ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' : 'text-zinc-400 hover:text-zinc-200'}`}
                  >
                    Cambios (+{report.summary.actionNewCount} / ~{report.summary.actionUpdateCount})
                  </button>
                </div>
              </div>

              {/* Tabla de Vista Previa */}
              <div className="border border-zinc-800 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-zinc-950 text-zinc-400 border-b border-zinc-800 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 font-medium">Fila</th>
                      <th className="px-3 py-2 font-medium">Estado</th>
                      <th className="px-3 py-2 font-medium">Acción</th>
                      <th className="px-3 py-2 font-medium">SKU</th>
                      <th className="px-3 py-2 font-medium">Descripción</th>
                      <th className="px-3 py-2 font-medium">Costo</th>
                      <th className="px-3 py-2 font-medium">Lista A</th>
                      <th className="px-3 py-2 font-medium">Mensajes</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50 text-zinc-300">
                    {filteredRows.map((r: any, idx: number) => (
                      <tr key={idx} className="hover:bg-zinc-800/30 transition">
                        <td className="px-3 py-2 text-zinc-500">#{r.rowIndex}</td>
                        <td className="px-3 py-2">
                          {r.status === 'VALID' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">🟢 Válido</span>}
                          {r.status === 'WARNING' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-amber-500/10 text-amber-400 border border-amber-500/20">🟡 Adv.</span>}
                          {r.status === 'ERROR' && <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] bg-red-500/10 text-red-400 border border-red-500/20">🔴 Error</span>}
                        </td>
                        <td className="px-3 py-2 font-mono">
                          {r.action === 'CREATE' && <span className="text-emerald-400 font-semibold">+ Crear</span>}
                          {r.action === 'UPDATE' && <span className="text-blue-400 font-semibold">~ Actualizar</span>}
                          {r.action === 'NONE' && <span className="text-zinc-500">- Ninguna</span>}
                        </td>
                        <td className="px-3 py-2 font-mono font-semibold text-zinc-100">{r.data.sku || '---'}</td>
                        <td className="px-3 py-2 truncate max-w-xs">{r.data.name || '---'}</td>
                        <td className="px-3 py-2 font-mono">${Number(r.data.costPrice || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 font-mono">${Number(r.data.listPrice || 0).toLocaleString('es-AR', { minimumFractionDigits: 2 })}</td>
                        <td className="px-3 py-2 text-zinc-400">
                          {r.messages && r.messages.length > 0 ? (
                            <span className={r.status === 'ERROR' ? 'text-red-400' : 'text-amber-400'}>
                              {r.messages.join(' | ')}
                            </span>
                          ) : (
                            <span className="text-zinc-600">Sin observaciones</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-6 py-4 border-t border-zinc-800 bg-zinc-950/50 flex items-center justify-between">
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800 transition"
          >
            Cancelar
          </button>

          {report && (
            <button
              onClick={handleCommit}
              disabled={loadingCommit || report.summary.errorCount > 0 || commitMessage !== null}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-500 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50 transition shadow-lg shadow-emerald-950/50"
            >
              {loadingCommit ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              {commitMessage ? 'Importación Completada' : 'Confirmar e Importar a Base de Datos'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
