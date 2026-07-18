import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { X, Check, AlertCircle, Loader, FileText, Search, CornerDownRight, HelpCircle } from 'lucide-react';

interface PurchaseScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: File | null;
  onSuccess: () => void;
}

export const PurchaseScannerModal: React.FC<PurchaseScannerModalProps> = ({
  isOpen,
  onClose,
  file,
  onSuccess
}) => {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [localFiles, setLocalFiles] = useState<any[]>([]);
  const [selectedLocalFile, setSelectedLocalFile] = useState<string | null>(null);
  
  // Estados para buscador de productos de cada ítem
  const [productSearchResults, setProductSearchResults] = useState<{ [key: number]: any[] }>({});
  const [productSearchQueries, setProductSearchQueries] = useState<{ [key: number]: string }>({});
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);

  // Cargar lista de archivos locales de la carpeta ARCHIVOS
  const loadLocalFiles = async () => {
    try {
      const files = await api.getPurchaseLocalFiles();
      setLocalFiles(files || []);
    } catch (err) {
      console.error('Error al obtener archivos locales:', err);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadLocalFiles();
    }
  }, [isOpen]);

  useEffect(() => {
    let url: string | null = null;
    if (isOpen && file) {
      url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setSelectedLocalFile(null);
      processUploadedDocument(file);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [isOpen, file]);

  const processUploadedDocument = async (fileToProcess: File) => {
    setLoading(true);
    setErrorMsg(null);
    setExtractedData(null);
    try {
      const response = await api.uploadPurchaseDocument(fileToProcess);
      setExtractedData({
        ...response.extracted,
        providerId: response.matchedProvider ? response.matchedProvider.id : '',
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el documento con Inteligencia Artificial.');
    } finally {
      setLoading(false);
    }
  };

  const processLocalDocument = async (filename: string) => {
    setLoading(true);
    setErrorMsg(null);
    setExtractedData(null);
    setSelectedLocalFile(filename);
    setPreviewUrl(null); // No hay preview de imagen para archivos del servidor
    try {
      const response = await api.processPurchaseLocalFile(filename);
      setExtractedData({
        ...response.extracted,
        providerId: response.matchedProvider ? response.matchedProvider.id : '',
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el archivo del servidor.');
    } finally {
      setLoading(false);
    }
  };

  // Buscar productos locales para vincular
  const handleProductSearch = async (index: number, query: string) => {
    setProductSearchQueries(prev => ({ ...prev, [index]: query }));
    if (query.trim().length < 2) {
      setProductSearchResults(prev => ({ ...prev, [index]: [] }));
      return;
    }
    try {
      const products = await api.getProducts(query);
      setProductSearchResults(prev => ({ ...prev, [index]: products || [] }));
    } catch (err) {
      console.error('Error buscando productos:', err);
    }
  };

  const handleSelectProduct = (index: number, product: any) => {
    const newItems = [...extractedData.items];
    newItems[index].matchedProductId = product.id;
    newItems[index].matchedProductName = product.name;
    newItems[index].matchMethod = 'MANUAL';
    
    setExtractedData({ ...extractedData, items: newItems });
    setActiveSearchIndex(null);
    // Limpiar búsqueda
    setProductSearchResults(prev => ({ ...prev, [index]: [] }));
  };

  const handleConfirm = async () => {
    if (!extractedData.providerId) {
      setErrorMsg('Debes seleccionar o confirmar un proveedor válido antes de continuar.');
      return;
    }
    
    setLoading(true);
    setErrorMsg(null);
    try {
      await api.confirmPurchaseDocument({
        providerId: Number(extractedData.providerId),
        documentType: extractedData.documentType,
        documentNumber: extractedData.documentNumber,
        issueDate: extractedData.issueDate,
        billingType: extractedData.billingType || 'OFFICIAL',
        items: extractedData.items.map((item: any) => ({
          productId: item.matchedProductId ? Number(item.matchedProductId) : null,
          code: item.code,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal)
        })),
        netAmount: Number(extractedData.netAmount),
        taxAmount: Number(extractedData.taxAmount),
        percepcionAmount: Number(extractedData.percepcionAmount),
        totalAmount: Number(extractedData.totalAmount)
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al confirmar el documento.');
    } finally {
      setLoading(false);
    }
  };

  const formatBytes = (bytes: number, decimals = 2) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/75 backdrop-blur-md flex items-center justify-center z-[100] p-4 animate-fadeIn">
      <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] flex flex-col overflow-hidden">
        
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10 bg-black/10">
          <div>
            <h2 className="text-xl font-semibold text-white flex items-center gap-2">
              <FileText className="w-5 h-5 text-[var(--color-corp-red)]" /> 
              Escáner de Facturas (IA)
            </h2>
            <p className="text-xs text-gray-400 mt-0.5">Cargue y valide facturas de proveedores con extracción inteligente y actualización automática de stock.</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Local Files Bar */}
        {localFiles.length > 0 && (
          <div className="bg-white/5 border-b border-white/10 px-6 py-3 flex items-center gap-3 overflow-x-auto">
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider whitespace-nowrap">
              📁 Carpeta ARCHIVOS:
            </span>
            <div className="flex gap-2">
              {localFiles.map((f, i) => (
                <button
                  key={i}
                  onClick={() => processLocalDocument(f.name)}
                  disabled={loading}
                  className={`text-xs px-3 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${
                    selectedLocalFile === f.name
                      ? 'bg-[var(--color-corp-red)]/20 border-[var(--color-corp-red)] text-white'
                      : 'bg-black/20 border-white/10 text-gray-300 hover:bg-white/5'
                  } disabled:opacity-50`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  {f.name} ({formatBytes(f.size)})
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left Panel: Preview or Instructions */}
          <div className="w-1/2 p-6 border-r border-white/10 overflow-y-auto bg-black/20 flex flex-col justify-center items-center">
            {previewUrl ? (
              <img src={previewUrl} alt="Vista previa del documento" className="w-full h-auto max-h-[70vh] object-contain rounded-lg shadow-lg border border-white/5" />
            ) : selectedLocalFile ? (
              <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-[var(--color-corp-red)]/10 border border-[var(--color-corp-red)]/20 rounded-2xl flex items-center justify-center mx-auto">
                  <FileText className="w-10 h-10 text-[var(--color-corp-red)]" />
                </div>
                <div>
                  <h4 className="text-white font-medium text-lg">{selectedLocalFile}</h4>
                  <p className="text-xs text-gray-400 mt-1">Archivo del servidor cargado para análisis IA</p>
                </div>
              </div>
            ) : (
              <div className="text-center space-y-4 max-w-sm text-gray-400">
                <HelpCircle className="w-12 h-12 text-gray-500 mx-auto" />
                <p className="text-sm">Seleccione un archivo de la carpeta de servidor arriba, o suba uno nuevo utilizando el botón "Escanear Factura" en el panel principal.</p>
              </div>
            )}
          </div>

          {/* Right Panel: Data Validation */}
          <div className="w-1/2 p-6 overflow-y-auto custom-scrollbar bg-[#18181A]">
            {loading ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-20">
                <Loader className="w-10 h-10 text-[var(--color-corp-red)] animate-spin" />
                <div>
                  <p className="text-white font-medium text-lg">Procesando con Gemini 3.5 Flash...</p>
                  <p className="text-xs text-gray-400 mt-1">Analizando CUITs, artículos y correspondencia fiscal.</p>
                </div>
              </div>
            ) : errorMsg && !extractedData ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4 py-20">
                <AlertCircle className="w-12 h-12 text-[var(--color-corp-red)]" />
                <div>
                  <p className="text-red-400 font-medium text-lg">Ocurrió un error</p>
                  <p className="text-xs text-red-200 mt-1">{errorMsg}</p>
                </div>
                <button 
                  onClick={() => file ? processUploadedDocument(file) : selectedLocalFile && processLocalDocument(selectedLocalFile)} 
                  className="px-4 py-2 bg-white/5 rounded-lg text-sm text-white hover:bg-white/10 transition-all"
                >
                  Reintentar Procesamiento
                </button>
              </div>
            ) : extractedData ? (
              <div className="space-y-6 animate-fadeIn">
                
                {errorMsg && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-[var(--color-corp-red)] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200">{errorMsg}</p>
                  </div>
                )}

                {/* Sucursal Auto-detected Alert */}
                {extractedData.billingType === 'OFFICIAL' ? (
                  <div className="p-4 bg-green-500/10 border border-green-500/20 rounded-xl flex items-start gap-3">
                    <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-green-400">Sucursal A (Oficial) Pre-seleccionada</p>
                      <p className="text-xs text-green-200/70 mt-0.5">El CUIT del comprador en la Factura coincide con el de la distribuidora (<strong>20163165059</strong>).</p>
                    </div>
                  </div>
                ) : (
                  <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-start gap-3">
                    <AlertCircle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-semibold text-amber-400">Sucursal X (Interna) Pre-seleccionada</p>
                      <p className="text-xs text-amber-200/70 mt-0.5">Documento de control interno (Remito o factura no dirigida al CUIT oficial).</p>
                    </div>
                  </div>
                )}

                {/* Info General */}
                <div className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Datos Generales Extraídos</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Proveedor Detectado</label>
                      <input 
                        type="text" 
                        value={extractedData.supplierName || ''} 
                        onChange={(e) => setExtractedData({...extractedData, supplierName: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--color-corp-red)] focus:ring-1 focus:ring-[var(--color-corp-red)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">ID Proveedor (Sistema)</label>
                      <input 
                        type="number" 
                        value={extractedData.providerId || ''} 
                        onChange={(e) => setExtractedData({...extractedData, providerId: e.target.value})}
                        placeholder="Ej: 936"
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--color-corp-red)] focus:ring-1 focus:ring-[var(--color-corp-red)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tipo Comprobante</label>
                      <input 
                        type="text" 
                        value={extractedData.documentType || ''} 
                        onChange={(e) => setExtractedData({...extractedData, documentType: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--color-corp-red)] focus:ring-1 focus:ring-[var(--color-corp-red)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Número Comprobante</label>
                      <input 
                        type="text" 
                        value={extractedData.documentNumber || ''} 
                        onChange={(e) => setExtractedData({...extractedData, documentNumber: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--color-corp-red)] focus:ring-1 focus:ring-[var(--color-corp-red)] transition-all"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Imputación Contable (Sucursal)</label>
                      <select 
                        value={extractedData.billingType || 'OFFICIAL'} 
                        onChange={(e) => setExtractedData({...extractedData, billingType: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--color-corp-red)] focus:ring-1 focus:ring-[var(--color-corp-red)] transition-all"
                      >
                        <option value="OFFICIAL" className="bg-[#1C1C1E] text-white">Sucursal A (Oficial - Afecta IVA Ventas/Compras legal)</option>
                        <option value="INTERNAL" className="bg-[#1C1C1E] text-white">Sucursal X (Interna - Solo Control Físico / Cuenta Corriente)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div className="space-y-4">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Artículos y Vinculación con Stock</h3>
                  
                  <div className="space-y-3">
                    {extractedData.items?.map((item: any, idx: number) => {
                      const showSearch = activeSearchIndex === idx;
                      const results = productSearchResults[idx] || [];
                      const searchQuery = productSearchQueries[idx] || '';

                      return (
                        <div key={idx} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3 hover:border-white/20 transition-all">
                          
                          {/* Item Info Extracted */}
                          <div className="flex justify-between items-start gap-4">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="text-xs font-mono bg-white/10 text-gray-300 px-1.5 py-0.5 rounded">
                                  Cod: {item.code || 'S/C'}
                                </span>
                                <span className="text-sm font-medium text-white">{item.description}</span>
                              </div>
                              <p className="text-xs text-gray-400 mt-1">
                                Cantidad: <span className="text-white font-semibold">{item.quantity}</span> | 
                                P.U: <span className="text-white">${item.unitPrice}</span>
                              </p>
                            </div>
                            <div className="text-right">
                              <span className="text-sm font-semibold text-white">${item.subtotal}</span>
                              <div className="mt-1">
                                {item.matchMethod === 'PREVIOUS_MAPPING' && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-green-500/10 text-green-400 font-semibold border border-green-500/20">Mapeo Recordado</span>
                                )}
                                {item.matchMethod === 'CODE_MATCH' && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-blue-500/10 text-blue-400 font-semibold border border-blue-500/20">Código SKU/Barras</span>
                                )}
                                {item.matchMethod === 'DESCRIPTION_EXACT' && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-indigo-500/10 text-indigo-400 font-semibold border border-indigo-500/20">Nombre Exacto</span>
                                )}
                                {item.matchMethod === 'DESCRIPTION_PARTIAL' && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-amber-500/10 text-amber-400 font-semibold border border-amber-500/20">Nombre Parcial</span>
                                )}
                                {item.matchMethod === 'MANUAL' && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 font-semibold border border-purple-500/20">Vínculo Manual</span>
                                )}
                                {(!item.matchMethod || item.matchMethod === 'NONE') && (
                                  <span className="text-[10px] px-2 py-0.5 rounded bg-red-500/10 text-red-400 font-semibold border border-red-500/20">Sin Vincular</span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Matching Input */}
                          <div className="pt-3 border-t border-white/5 space-y-2">
                            <div className="flex items-center gap-2">
                              <CornerDownRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                              <div className="flex-1 relative">
                                {showSearch ? (
                                  <div className="space-y-1">
                                    <div className="relative">
                                      <input
                                        type="text"
                                        autoFocus
                                        placeholder="Escriba para buscar producto..."
                                        value={searchQuery}
                                        onChange={(e) => handleProductSearch(idx, e.target.value)}
                                        className="w-full bg-black/40 border border-[var(--color-corp-red)] rounded-lg pl-8 pr-3 py-1.5 text-xs text-white focus:outline-none transition-all"
                                      />
                                      <Search className="w-3.5 h-3.5 text-gray-500 absolute left-2.5 top-2.5" />
                                    </div>
                                    
                                    {/* Dropdown Results */}
                                    {results.length > 0 && (
                                      <div className="absolute left-0 right-0 mt-1 bg-[#2C2C2E] border border-white/10 rounded-lg shadow-xl z-50 max-h-48 overflow-y-auto custom-scrollbar">
                                        {results.map((p) => (
                                          <button
                                            key={p.id}
                                            type="button"
                                            onClick={() => handleSelectProduct(idx, p)}
                                            className="w-full text-left px-3 py-2 text-xs text-white hover:bg-white/5 transition-colors border-b border-white/5 flex justify-between items-center"
                                          >
                                            <div>
                                              <p className="font-medium">{p.name}</p>
                                              <p className="text-[10px] text-gray-400 mt-0.5">SKU: {p.sku} | Barras: {p.barcode || 'S/B'}</p>
                                            </div>
                                            <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-300">ID: {p.id}</span>
                                          </button>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <div 
                                    onClick={() => {
                                      setActiveSearchIndex(idx);
                                      handleProductSearch(idx, item.description);
                                    }}
                                    className={`w-full bg-black/20 border rounded-lg px-3 py-1.5 text-xs flex justify-between items-center cursor-pointer transition-all ${
                                      item.matchedProductId 
                                        ? 'border-green-500/20 text-green-300 hover:border-green-500/40' 
                                        : 'border-red-500/20 text-red-300 hover:border-red-500/40'
                                    }`}
                                  >
                                    <span className="truncate">
                                      {item.matchedProductId 
                                        ? `VINCULADO: ${item.matchedProductName} (ID: ${item.matchedProductId})` 
                                        : '⚠️ Haga clic aquí para buscar y vincular a un producto local.'
                                      }
                                    </span>
                                    <Search className="w-3.5 h-3.5 text-gray-500" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Totales */}
                <div className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-3">
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Totales del Comprobante</h3>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Neto Gravado</span>
                    <span className="text-white font-medium">${extractedData.netAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">IVA (21%)</span>
                    <span className="text-white font-medium">${extractedData.taxAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Percepciones Sufridas</span>
                    <span className="text-white font-medium">${extractedData.percepcionAmount}</span>
                  </div>
                  
                  <div className="pt-3 border-t border-white/10 flex justify-between items-center text-base">
                    <span className="text-white font-medium">Monto Factura</span>
                    <span className="text-[var(--color-corp-red)] font-bold text-lg">${extractedData.totalAmount}</span>
                  </div>

                  {extractedData.providerId && (
                    <div className="pt-3 border-t border-white/5 text-[10px] text-gray-400 flex items-center gap-1.5">
                      <AlertCircle className="w-3.5 h-3.5 text-amber-500 flex-shrink-0" />
                      Se registrará la deuda de <strong>${extractedData.totalAmount}</strong> en la CC del proveedor ID: {extractedData.providerId}.
                    </div>
                  )}
                </div>

              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-white/10 flex justify-end space-x-4 bg-black/20">
          <button 
            onClick={onClose}
            disabled={loading}
            className="px-5 py-2.5 rounded-xl text-sm font-medium text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm}
            disabled={loading || !extractedData || extractedData.items?.some((i: any) => !i.matchedProductId)}
            className="px-5 py-2.5 bg-[var(--color-corp-red)] hover:bg-red-600 rounded-xl text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
          >
            {loading ? (
              <Loader className="w-4 h-4 animate-spin" />
            ) : (
              <Check className="w-4 h-4" />
            )}
            <span>Confirmar e Inyectar Stock</span>
          </button>
        </div>
      </div>
    </div>
  );
};
