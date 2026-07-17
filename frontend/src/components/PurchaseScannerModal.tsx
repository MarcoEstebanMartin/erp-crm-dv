import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { X, Check, AlertCircle, Loader } from 'lucide-react';

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

  useEffect(() => {
    let url: string | null = null;
    if (isOpen && file) {
      url = URL.createObjectURL(file);
      setPreviewUrl(url);
      processDocument(file);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [isOpen, file]);

  const processDocument = async (fileToProcess: File) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const response = await api.uploadPurchaseDocument(fileToProcess);
      setExtractedData({
        ...response.extracted,
        providerId: response.matchedProvider ? response.matchedProvider.id : '',
        billingType: 'OFFICIAL'
      });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el documento con Inteligencia Artificial.');
    } finally {
      setLoading(false);
    }
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

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-[#1C1C1E] border border-white/10 rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-semibold text-white">Escáner de Facturas (IA)</h2>
            <p className="text-sm text-gray-400 mt-1">Revisión y validación de datos extraídos</p>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-xl transition-colors">
            <X className="w-5 h-5 text-gray-400" />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left: Image Preview */}
          <div className="w-1/2 p-6 border-r border-white/10 overflow-y-auto bg-black/20">
            {previewUrl ? (
              <img src={previewUrl} alt="Preview" className="w-full h-auto rounded-lg shadow-lg border border-white/5" />
            ) : (
              <div className="w-full h-64 flex items-center justify-center text-gray-500">
                Sin vista previa
              </div>
            )}
          </div>

          {/* Right: Data Validation */}
          <div className="w-1/2 p-6 overflow-y-auto custom-scrollbar">
            {loading && !extractedData ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <Loader className="w-10 h-10 text-[var(--color-corp-red)] animate-spin" />
                <div>
                  <p className="text-white font-medium text-lg">Procesando Documento...</p>
                  <p className="text-sm text-gray-400">Nuestra IA está leyendo los datos fiscales y artículos.</p>
                </div>
              </div>
            ) : errorMsg && !extractedData ? (
              <div className="flex flex-col items-center justify-center h-full text-center space-y-4">
                <AlertCircle className="w-12 h-12 text-[var(--color-corp-red)]" />
                <p className="text-red-400 font-medium">{errorMsg}</p>
                <button onClick={() => file && processDocument(file)} className="px-4 py-2 bg-white/5 rounded-lg text-sm text-white hover:bg-white/10">Reintentar</button>
              </div>
            ) : extractedData ? (
              <div className="space-y-6">
                
                {errorMsg && (
                  <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-start space-x-3">
                    <AlertCircle className="w-5 h-5 text-[var(--color-corp-red)] flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-red-200">{errorMsg}</p>
                  </div>
                )}

                {/* Info General */}
                <div className="bg-white/5 rounded-xl p-5 border border-white/10 space-y-4">
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider">Datos del Comprobante</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Proveedor Extraído</label>
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
                        placeholder="Ej: 1"
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--color-corp-red)] focus:ring-1 focus:ring-[var(--color-corp-red)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Tipo</label>
                      <input 
                        type="text" 
                        value={extractedData.documentType || ''} 
                        onChange={(e) => setExtractedData({...extractedData, documentType: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--color-corp-red)] focus:ring-1 focus:ring-[var(--color-corp-red)] transition-all"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Número</label>
                      <input 
                        type="text" 
                        value={extractedData.documentNumber || ''} 
                        onChange={(e) => setExtractedData({...extractedData, documentNumber: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--color-corp-red)] focus:ring-1 focus:ring-[var(--color-corp-red)] transition-all"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-xs text-gray-500 mb-1">Destino (Sucursal)</label>
                      <select 
                        value={extractedData.billingType || 'OFFICIAL'} 
                        onChange={(e) => setExtractedData({...extractedData, billingType: e.target.value})}
                        className="w-full bg-black/20 border border-white/10 rounded-lg px-3 py-2 text-sm text-white focus:border-[var(--color-corp-red)] focus:ring-1 focus:ring-[var(--color-corp-red)] transition-all"
                      >
                        <option value="OFFICIAL" className="bg-[#1C1C1E] text-white">Sucursal A (Oficial - Afecta Libro de Compras AFIP)</option>
                        <option value="INTERNAL" className="bg-[#1C1C1E] text-white">Sucursal X (Interna - Solo Afecta Stock / Control Interno)</option>
                      </select>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div>
                  <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wider mb-4">Artículos Detectados</h3>
                  <div className="space-y-3">
                    {extractedData.items?.map((item: any, idx: number) => (
                      <div key={idx} className="p-4 bg-white/5 border border-white/10 rounded-xl space-y-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm text-white font-medium">{item.description}</p>
                            <p className="text-xs text-gray-400 mt-1">Cant: {item.quantity} | PU: ${item.unitPrice}</p>
                          </div>
                          <p className="text-sm text-white font-medium">${item.subtotal}</p>
                        </div>
                        {/* Matching */}
                        <div className="pt-3 border-t border-white/5 flex items-center space-x-3">
                          <div className="flex-1">
                            <label className="block text-[10px] text-gray-500 uppercase tracking-wider mb-1">Vincular a ID de Producto</label>
                            <div className="flex items-center space-x-2">
                              <input 
                                type="number"
                                placeholder="ID"
                                value={item.matchedProductId || ''}
                                onChange={(e) => {
                                  const newItems = [...extractedData.items];
                                  newItems[idx].matchedProductId = e.target.value;
                                  setExtractedData({...extractedData, items: newItems});
                                }}
                                className={`w-20 bg-black/20 border rounded-lg px-2 py-1.5 text-xs text-white focus:border-[var(--color-corp-red)] focus:ring-1 focus:ring-[var(--color-corp-red)] transition-all ${item.matchedProductId ? 'border-green-500/50' : 'border-red-500/50'}`}
                              />
                              <span className="text-xs text-gray-400 truncate">
                                {item.matchedProductName || 'Sin vincular - no se sumará stock'}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Totales */}
                <div className="bg-[var(--color-corp-red)]/10 rounded-xl p-5 border border-[var(--color-corp-red)]/20 space-y-3">
                  <h3 className="text-sm font-semibold text-[var(--color-corp-red)] uppercase tracking-wider mb-4">Totales</h3>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Neto Gravado</span>
                    <span className="text-white font-medium">${extractedData.netAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">IVA</span>
                    <span className="text-white font-medium">${extractedData.taxAmount}</span>
                  </div>
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-400">Percepciones</span>
                    <span className="text-white font-medium">${extractedData.percepcionAmount}</span>
                  </div>
                  <div className="pt-3 border-t border-white/10 flex justify-between items-center text-lg">
                    <span className="text-white font-semibold">Total</span>
                    <span className="text-[var(--color-corp-red)] font-bold">${extractedData.totalAmount}</span>
                  </div>
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
            className="px-6 py-2.5 rounded-xl text-sm font-medium text-white hover:bg-white/5 transition-colors disabled:opacity-50"
          >
            Cancelar
          </button>
          <button 
            onClick={handleConfirm}
            disabled={loading || !extractedData}
            className="px-6 py-2.5 bg-[var(--color-corp-red)] hover:bg-red-600 rounded-xl text-sm font-medium text-white shadow-lg shadow-red-500/20 transition-all flex items-center space-x-2 disabled:opacity-50"
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
