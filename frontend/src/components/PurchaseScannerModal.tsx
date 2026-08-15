import React, { useState, useEffect } from 'react';
import { api, API_BASE_URL } from '../utils/api';
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
  const [isPdf, setIsPdf] = useState(false);
  
  // Estados para buscador de productos de cada ítem
  const [productSearchResults, setProductSearchResults] = useState<{ [key: number]: any[] }>({});
  const [productSearchQueries, setProductSearchQueries] = useState<{ [key: number]: string }>({});
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);

  useEffect(() => {
    let url: string | null = null;
    if (isOpen && file) {
      url = URL.createObjectURL(file);
      setPreviewUrl(url);
      setIsPdf(file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf'));
      processUploadedDocument(file);
    }
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [isOpen, file]);

  const initExtractedData = (response: any) => {
    const rawPercAmount = Number(response.extracted.percepcionAmount || 0);
    const rawIIBB = Number(response.extracted.percepcionIIBBAmount || 0);
    const rawIva = Number(response.extracted.percepcionIvaAmount || 0);
    const jurisdiction = response.extracted.percepcionJurisdiction || '';

    const isPampa = jurisdiction.toLowerCase().includes('pampa') || jurisdiction.toUpperCase() === 'AR-L';
    const isBsAs = jurisdiction.toLowerCase().includes('buenos') || jurisdiction.toLowerCase().includes('bs') || jurisdiction.toUpperCase() === 'AR-B';

    return {
      ...response.extracted,
      providerId: response.matchedProvider ? response.matchedProvider.id : '',
      percepcionPampa: isPampa ? (rawIIBB || rawPercAmount) : 0,
      percepcionBsAs: isBsAs ? (rawIIBB || rawPercAmount) : 0,
      percepcionIva: rawIva || 0,
      impuestosInternos: 0
    };
  };

  const processUploadedDocument = async (fileToProcess: File) => {
    setLoading(true);
    setErrorMsg(null);
    setExtractedData(null);
    try {
      const response = await api.uploadPurchaseDocument(fileToProcess);
      setExtractedData(initExtractedData(response));
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el documento con Inteligencia Artificial.');
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
    newItems[index].isNonStock = false;
    
    setExtractedData({ ...extractedData, items: newItems });
    setActiveSearchIndex(null);
    // Limpiar búsqueda
    setProductSearchResults(prev => ({ ...prev, [index]: [] }));
  };

  const handleToggleNonStock = (index: number) => {
    const newItems = [...extractedData.items];
    const isCurrentlyNonStock = !!newItems[index].isNonStock;
    newItems[index].isNonStock = !isCurrentlyNonStock;
    if (!isCurrentlyNonStock) {
      newItems[index].matchedProductId = null;
      newItems[index].matchedProductName = null;
      newItems[index].matchMethod = 'NON_STOCK';
    } else {
      newItems[index].matchMethod = 'NONE';
    }
    setExtractedData({ ...extractedData, items: newItems });
  };

  const handleMarkAllNonStock = (nonStock: boolean) => {
    if (!extractedData?.items) return;
    const newItems = extractedData.items.map((item: any) => ({
      ...item,
      isNonStock: nonStock,
      matchedProductId: nonStock ? null : item.matchedProductId,
      matchedProductName: nonStock ? null : item.matchedProductName,
      matchMethod: nonStock ? 'NON_STOCK' : (item.matchedProductId ? item.matchMethod : 'NONE')
    }));
    setExtractedData({ ...extractedData, items: newItems });
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
          productId: (item.isNonStock || !item.matchedProductId) ? null : Number(item.matchedProductId),
          isNonStock: !!item.isNonStock,
          code: item.code,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal)
        })),
        netAmount: Number(extractedData.netAmount),
        taxAmount: Number(extractedData.taxAmount),
        percepcionPampa: Number(extractedData.percepcionPampa || 0),
        percepcionBsAs: Number(extractedData.percepcionBsAs || 0),
        percepcionIva: Number(extractedData.percepcionIva || 0),
        percepcionIva5329: Number(extractedData.percepcionIva5329 || 0),
        impuestosInternos: Number(extractedData.impuestosInternos || 0),
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
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      backdropFilter: 'blur(8px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px',
      animation: 'fadeIn 0.2s ease-out'
    }}>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
      `}</style>
      <div style={{
        backgroundColor: 'var(--bg-card)',
        borderRadius: '16px',
        border: '1px solid var(--border-color)',
        width: '96vw',
        maxWidth: '1600px',
        height: '94vh',
        display: 'flex',
        flexDirection: 'column',
        boxShadow: '0 25px 50px -12px rgba(0,0,0,0.15)',
        overflow: 'hidden'
      }}>
        
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '18px 24px',
          borderBottom: '1px solid var(--border-color)',
          backgroundColor: 'var(--accent-bg-light)'
        }}>
          <div>
            <h2 style={{ fontSize: '1.2rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <FileText size={20} style={{ color: 'var(--color-corp-red)' }} /> 
              Escáner de Facturas (IA)
            </h2>
            <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
              Cargue y valide facturas de proveedores con extracción inteligente y actualización automática de stock.
            </p>
          </div>
          <button 
            onClick={onClose} 
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-secondary)',
              padding: '6px',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              transition: 'background-color 0.15s'
            }}
            onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
            onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
          >
            <X size={20} />
          </button>
        </div>



        {/* Content */}
        <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
          
          {/* Left Panel: Preview or Instructions */}
          <div style={{
            width: '58%',
            padding: '20px',
            borderRight: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-app)',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
            alignItems: 'center'
          }}>
            {previewUrl ? (
              isPdf ? (
                <iframe
                  src={`${previewUrl}#toolbar=0&navpanes=0`}
                  title="Vista previa del documento PDF"
                  style={{
                    width: '100%',
                    height: '80vh',
                    border: '1px solid var(--border-color)',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-lg)',
                    backgroundColor: '#FFFFFF'
                  }}
                />
              ) : (
                <img 
                  src={previewUrl} 
                  alt="Vista previa del documento" 
                  style={{
                    maxWidth: '100%',
                    maxHeight: '78vh',
                    objectFit: 'contain',
                    borderRadius: '12px',
                    boxShadow: 'var(--shadow-lg)',
                    border: '1px solid var(--border-color)'
                  }} 
                />
              )
            ) : (
              <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '320px', color: 'var(--text-secondary)' }}>
                <HelpCircle size={48} style={{ color: 'var(--text-muted)', margin: '0 auto' }} />
                <p style={{ fontSize: '14px', lineHeight: '1.5' }}>
                  Suba un nuevo documento de factura o remito utilizando el botón "Escanear Factura" en el panel principal.
                </p>
              </div>
            )}
          </div>

          {/* Right Panel: Data Validation */}
          <div className="custom-scrollbar" style={{
            width: '42%',
            padding: '24px',
            backgroundColor: '#FFFFFF',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            gap: '24px'
          }}>
            {loading ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: '16px', padding: '80px 20px' }}>
                <Loader size={40} style={{ color: 'var(--color-corp-red)', animation: 'spin 1s linear infinite' }} />
                <div>
                  <p style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '16px', margin: 0 }}>Procesando con Gemini 3.5 Flash...</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px' }}>Analizando CUITs, artículos y correspondencia fiscal.</p>
                </div>
                <style>{`
                  @keyframes spin {
                    to { transform: rotate(360deg); }
                  }
                `}</style>
              </div>
            ) : errorMsg && !extractedData ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', textAlign: 'center', gap: '16px', padding: '80px 20px' }}>
                <AlertCircle size={48} style={{ color: 'var(--color-corp-red)' }} />
                <div>
                  <p style={{ color: 'var(--color-danger)', fontWeight: 600, fontSize: '16px', margin: 0 }}>Ocurrió un error</p>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '13px', marginTop: '4px', maxWidth: '360px' }}>{errorMsg}</p>
                </div>
                <button 
                  onClick={() => file && processUploadedDocument(file)} 
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'var(--accent-bg-light)',
                    border: '1px solid var(--border-color)',
                    borderRadius: '8px',
                    fontSize: '13px',
                    color: 'var(--text-primary)',
                    cursor: 'pointer',
                    fontWeight: 500,
                    transition: 'all 0.15s ease'
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-bg-light)'}
                >
                  Reintentar Procesamiento
                </button>
              </div>
            ) : extractedData ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                
                {errorMsg && (
                  <div style={{
                    padding: '14px 18px',
                    backgroundColor: 'var(--color-danger-bg)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <AlertCircle size={20} style={{ color: 'var(--color-danger)', flexShrink: 0, marginTop: '2px' }} />
                    <p style={{ fontSize: '13px', color: 'var(--color-danger)', margin: 0 }}>{errorMsg}</p>
                  </div>
                )}

                {/* Sucursal Auto-detected Alert */}
                {extractedData.billingType === 'OFFICIAL' ? (
                  <div style={{
                    padding: '14px 18px',
                    backgroundColor: 'var(--color-success-bg)',
                    border: '1px solid rgba(16, 185, 129, 0.2)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <Check size={20} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-success)', margin: 0 }}>Sucursal A (Oficial) Pre-seleccionada</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                        El CUIT del comprador en la Factura coincide con el de la distribuidora (<strong>20163165059</strong>).
                      </p>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    padding: '14px 18px',
                    backgroundColor: 'var(--color-warning-bg)',
                    border: '1px solid rgba(245, 158, 11, 0.2)',
                    borderRadius: '10px',
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '12px'
                  }}>
                    <AlertCircle size={20} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: '2px' }} />
                    <div>
                      <p style={{ fontSize: '13px', fontWeight: 600, color: 'var(--color-warning)', margin: 0 }}>Sucursal X (Interna) Pre-seleccionada</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
                        Documento de control interno (Remito o factura no dirigida al CUIT oficial).
                      </p>
                    </div>
                  </div>
                )}

                {/* Info General */}
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '16px',
                  backgroundColor: 'var(--bg-app)'
                }}>
                  <h3 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                    Datos Generales Extraídos
                  </h3>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Proveedor Detectado
                      </label>
                      <input 
                        type="text" 
                        value={extractedData.supplierName || ''} 
                        onChange={(e) => setExtractedData({...extractedData, supplierName: e.target.value})}
                        style={{
                          width: '100%',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        ID Proveedor (Sistema)
                      </label>
                      <input 
                        type="number" 
                        value={extractedData.providerId || ''} 
                        onChange={(e) => setExtractedData({...extractedData, providerId: e.target.value})}
                        placeholder="Ej: 936"
                        style={{
                          width: '100%',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Tipo Comprobante
                      </label>
                      <input 
                        type="text" 
                        value={extractedData.documentType || ''} 
                        onChange={(e) => setExtractedData({...extractedData, documentType: e.target.value})}
                        style={{
                          width: '100%',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Número Comprobante
                      </label>
                      <input 
                        type="text" 
                        value={extractedData.documentNumber || ''} 
                        onChange={(e) => setExtractedData({...extractedData, documentNumber: e.target.value})}
                        style={{
                          width: '100%',
                          backgroundColor: '#FFFFFF',
                          border: '1px solid var(--border-color)',
                          borderRadius: '8px',
                          padding: '8px 12px',
                          fontSize: '13px',
                          color: 'var(--text-primary)',
                          boxShadow: 'var(--shadow-sm)'
                        }}
                      />
                    </div>
                    <div style={{ gridColumn: 'span 2' }}>
                      <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                        Imputación Contable (Sucursal)
                      </label>
                      <div style={{ position: 'relative' }}>
                        <select 
                          value={extractedData.billingType || 'OFFICIAL'} 
                          onChange={(e) => setExtractedData({...extractedData, billingType: e.target.value})}
                          style={{
                            width: '100%',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid var(--border-color)',
                            borderRadius: '8px',
                            padding: '8px 36px 8px 12px',
                            fontSize: '13px',
                            color: 'var(--text-primary)',
                            boxShadow: 'var(--shadow-sm)',
                            appearance: 'none',
                            backgroundImage: `url("data:image/svg+xml;charset=UTF-8,%3csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%234B5563' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3e%3cpolyline points='6 9 12 15 18 9'%3e%3c/polyline%3e%3c/svg%3e")`,
                            backgroundRepeat: 'no-repeat',
                            backgroundPosition: 'right 12px center',
                            backgroundSize: '16px'
                          }}
                        >
                          <option value="OFFICIAL">Sucursal A</option>
                          <option value="INTERNAL">Sucursal X</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Items */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <h3 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>
                      Artículos y Vinculación con Stock
                    </h3>
                    {extractedData.items && extractedData.items.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const allNonStock = extractedData.items.every((i: any) => i.isNonStock);
                          handleMarkAllNonStock(!allNonStock);
                        }}
                        style={{
                          fontSize: '11px',
                          fontWeight: 500,
                          padding: '4px 10px',
                          borderRadius: '6px',
                          border: '1px solid var(--border-color)',
                          backgroundColor: 'var(--accent-bg-light)',
                          color: 'var(--text-primary)',
                          cursor: 'pointer',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                          transition: 'all 0.15s ease'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-bg-light)'}
                      >
                        {extractedData.items.every((i: any) => i.isNonStock)
                          ? 'Desmarcar todos como Gasto'
                          : '⚡ Marcar todos como Gasto (Sin Stock)'}
                      </button>
                    )}
                  </div>
                  
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                    {extractedData.items?.map((item: any, idx: number) => {
                      const showSearch = activeSearchIndex === idx;
                      const results = productSearchResults[idx] || [];
                      const searchQuery = productSearchQueries[idx] || '';

                      const hasMatch = !!item.matchedProductId;

                      return (
                        <div 
                          key={idx} 
                          style={{
                            padding: '16px',
                            backgroundColor: '#FFFFFF',
                            border: '1px solid var(--border-color)',
                            borderRadius: '12px',
                            display: 'flex',
                            flexDirection: 'column',
                            gap: '12px',
                            boxShadow: 'var(--shadow-sm)',
                            position: 'relative'
                          }}
                        >
                          
                          {/* Item Info Extracted */}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '12px' }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minWidth: 0 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{
                                  fontSize: '11px',
                                  fontFamily: 'monospace',
                                  backgroundColor: 'var(--accent-bg-light)',
                                  color: 'var(--text-secondary)',
                                  padding: '2px 6px',
                                  borderRadius: '4px',
                                  fontWeight: 'bold',
                                  border: '1px solid var(--border-color)',
                                  whiteSpace: 'nowrap'
                                }}>
                                  Cod: {item.code || 'S/C'}
                                </span>
                                <span style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', lineHeight: '1.4' }}>
                                  {item.description}
                                </span>
                              </div>
                              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                                Cantidad: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{item.quantity}</span> | 
                                P.U: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>${item.unitPrice}</span>
                              </p>
                            </div>
                            <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                              <span style={{ fontSize: '14px', fontWeight: 'bold', color: 'var(--text-primary)' }}>${item.subtotal}</span>
                              <div>
                                {item.isNonStock ? (
                                  <span style={{ fontSize: '10px', fontWeight: 600, backgroundColor: 'var(--accent-bg-light)', color: 'var(--text-secondary)', padding: '2px 8px', borderRadius: '20px', border: '1px solid var(--border-color)' }}>⚡ Gasto (Sin Stock)</span>
                                ) : (
                                  <>
                                    {item.matchMethod === 'PREVIOUS_MAPPING' && (
                                      <span style={{ fontSize: '10px', fontWeight: 600, backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(16, 185, 129, 0.2)' }}>Mapeo Recordado</span>
                                    )}
                                    {item.matchMethod === 'CODE_MATCH' && (
                                      <span style={{ fontSize: '10px', fontWeight: 600, backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>Código SKU/Barras</span>
                                    )}
                                    {item.matchMethod === 'DESCRIPTION_EXACT' && (
                                      <span style={{ fontSize: '10px', fontWeight: 600, backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>Nombre Exacto</span>
                                    )}
                                    {item.matchMethod === 'DESCRIPTION_PARTIAL' && (
                                      <span style={{ fontSize: '10px', fontWeight: 600, backgroundColor: 'var(--color-warning-bg)', color: 'var(--color-warning)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(245, 158, 11, 0.2)' }}>Nombre Parcial</span>
                                    )}
                                    {item.matchMethod === 'MANUAL' && (
                                      <span style={{ fontSize: '10px', fontWeight: 600, backgroundColor: 'var(--color-info-bg)', color: 'var(--color-info)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(59, 130, 246, 0.2)' }}>Vínculo Manual</span>
                                    )}
                                    {(!item.matchMethod || item.matchMethod === 'NONE') && (
                                      <span style={{ fontSize: '10px', fontWeight: 600, backgroundColor: 'var(--color-danger-bg)', color: 'var(--color-danger)', padding: '2px 8px', borderRadius: '20px', border: '1px solid rgba(239, 68, 68, 0.2)' }}>Sin Vincular</span>
                                    )}
                                  </>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Matching Input */}
                          <div style={{ paddingTop: '12px', borderTop: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                            {item.isNonStock ? (
                              <div style={{
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '10px 14px',
                                borderRadius: '8px',
                                fontSize: '12px',
                                border: '1px solid var(--border-color)',
                                backgroundColor: 'var(--accent-bg-light)',
                                color: 'var(--text-secondary)'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <CornerDownRight size={14} style={{ color: 'var(--text-muted)' }} />
                                  <span style={{ fontWeight: 500, color: 'var(--text-primary)' }}>
                                    ⚡ Marcado como Gasto / Servicio (No ingresa al inventario)
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleToggleNonStock(idx)}
                                  style={{
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    border: '1px solid var(--border-color)',
                                    borderRadius: '6px',
                                    padding: '4px 10px',
                                    backgroundColor: '#FFFFFF',
                                    color: 'var(--text-primary)',
                                    cursor: 'pointer'
                                  }}
                                >
                                  Vincular a producto local
                                </button>
                              </div>
                            ) : (
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <CornerDownRight size={14} style={{ color: 'var(--text-muted)', flexShrink: 0 }} />
                                <div style={{ flex: 1, position: 'relative' }}>
                                  {showSearch ? (
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', position: 'relative' }}>
                                      <div style={{ position: 'relative' }}>
                                        <input
                                          type="text"
                                          autoFocus
                                          placeholder="Escriba para buscar producto..."
                                          value={searchQuery}
                                          onChange={(e) => handleProductSearch(idx, e.target.value)}
                                          style={{
                                            width: '100%',
                                            backgroundColor: '#FFFFFF',
                                            border: '1px solid var(--color-corp-red)',
                                            borderRadius: '8px',
                                            padding: '8px 12px 8px 36px',
                                            fontSize: '12px',
                                            color: 'var(--text-primary)',
                                            boxShadow: '0 0 0 2px rgba(227, 6, 19, 0.1)',
                                            outline: 'none'
                                          }}
                                        />
                                        <Search size={14} style={{ color: 'var(--text-muted)', position: 'absolute', left: '12px', top: '10px' }} />
                                      </div>
                                      
                                      {/* Dropdown Results */}
                                      {results.length > 0 && (
                                        <div style={{
                                          position: 'absolute',
                                          left: 0,
                                          right: 0,
                                          top: '40px',
                                          backgroundColor: '#FFFFFF',
                                          border: '1px solid var(--border-color)',
                                          borderRadius: '8px',
                                          boxShadow: '0 10px 15px -3px rgba(0, 0, 0, 0.1), 0 4px 6px -2px rgba(0, 0, 0, 0.05)',
                                          zIndex: 100,
                                          maxHeight: '200px',
                                          overflowY: 'auto'
                                        }} className="custom-scrollbar">
                                          {results.map((p) => (
                                            <button
                                              key={p.id}
                                              type="button"
                                              onClick={() => handleSelectProduct(idx, p)}
                                              style={{
                                                width: '100%',
                                                border: 'none',
                                                borderBottom: '1px solid var(--border-color)',
                                                backgroundColor: 'transparent',
                                                padding: '10px 14px',
                                                textAlign: 'left',
                                                cursor: 'pointer',
                                                display: 'flex',
                                                justifyContent: 'space-between',
                                                alignItems: 'center',
                                                transition: 'background-color 0.1s ease'
                                              }}
                                              onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-bg-light)'}
                                              onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                                            >
                                              <div>
                                                <p style={{ fontWeight: 600, fontSize: '12px', color: 'var(--text-primary)', margin: 0 }}>{p.name}</p>
                                                <p style={{ fontSize: '10px', color: 'var(--text-secondary)', marginTop: '2px', margin: 0 }}>
                                                  SKU: {p.sku} | Barras: {p.barcode || 'S/B'}
                                                </p>
                                              </div>
                                              <span style={{ fontSize: '10px', backgroundColor: 'var(--accent-bg-light)', color: 'var(--text-secondary)', padding: '2px 6px', borderRadius: '4px' }}>
                                                ID: {p.id}
                                              </span>
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
                                      style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        padding: '10px 14px',
                                        borderRadius: '8px',
                                        fontSize: '12px',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                        border: hasMatch ? '1px dashed var(--color-success)' : '1px dashed var(--color-danger)',
                                        backgroundColor: hasMatch ? 'var(--color-success-bg)' : 'var(--color-danger-bg)',
                                        color: hasMatch ? 'var(--text-primary)' : 'var(--color-danger)',
                                      }}
                                      onMouseEnter={(e) => {
                                        e.currentTarget.style.borderColor = hasMatch ? 'var(--color-success)' : 'var(--color-danger)';
                                        e.currentTarget.style.backgroundColor = hasMatch ? 'rgba(16, 185, 129, 0.08)' : 'rgba(239, 68, 68, 0.08)';
                                      }}
                                      onMouseLeave={(e) => {
                                        e.currentTarget.style.borderColor = hasMatch ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)';
                                        e.currentTarget.style.backgroundColor = hasMatch ? 'var(--color-success-bg)' : 'var(--color-danger-bg)';
                                      }}
                                    >
                                      <span style={{
                                        overflow: 'hidden',
                                        textOverflow: 'ellipsis',
                                        whiteSpace: 'nowrap',
                                        fontWeight: hasMatch ? 500 : 400
                                      }}>
                                        {hasMatch 
                                          ? `VINCULADO: ${item.matchedProductName} (ID: ${item.matchedProductId})` 
                                          : '⚠️ Haga clic aquí para buscar y vincular a un producto local.'
                                        }
                                      </span>
                                      <Search size={14} style={{ color: 'var(--text-muted)', marginLeft: '8px', flexShrink: 0 }} />
                                    </div>
                                  )}
                                </div>
                                <button
                                  type="button"
                                  onClick={() => handleToggleNonStock(idx)}
                                  title="Marcar este renglón como gasto o insumo sin afectación de stock"
                                  style={{
                                    padding: '9px 12px',
                                    fontSize: '11px',
                                    fontWeight: 500,
                                    borderRadius: '8px',
                                    border: '1px solid var(--border-color)',
                                    backgroundColor: 'var(--accent-bg-light)',
                                    color: 'var(--text-secondary)',
                                    cursor: 'pointer',
                                    whiteSpace: 'nowrap',
                                    transition: 'all 0.15s ease',
                                    flexShrink: 0
                                  }}
                                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--border-color)'}
                                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'var(--accent-bg-light)'}
                                >
                                  ⚡ Gasto (Sin Stock)
                                </button>
                              </div>
                            )}
                          </div>

                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Totales */}
                <div style={{
                  border: '1px solid var(--border-color)',
                  borderRadius: '12px',
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  backgroundColor: 'var(--bg-app)'
                }}>
                  <h3 style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0, marginBottom: '4px' }}>
                    Totales del Comprobante
                  </h3>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', margin: '8px 0' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Neto Gravado</label>
                      <input 
                        type="number" 
                        value={extractedData.netAmount ?? 0} 
                        onChange={(e) => setExtractedData({...extractedData, netAmount: Number(e.target.value)})}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>IVA (21%)</label>
                      <input 
                        type="number" 
                        value={extractedData.taxAmount ?? 0} 
                        onChange={(e) => setExtractedData({...extractedData, taxAmount: Number(e.target.value)})}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', margin: '8px 0' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>IIBB La Pampa</label>
                      <input 
                        type="number" 
                        value={extractedData.percepcionPampa ?? 0} 
                        onChange={(e) => setExtractedData({
                          ...extractedData, 
                          percepcionPampa: Number(e.target.value)
                        })}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Percepcion IIBB Bs As</label>
                      <input 
                        type="number" 
                        value={extractedData.percepcionBsAs ?? 0} 
                        onChange={(e) => setExtractedData({
                          ...extractedData, 
                          percepcionBsAs: Number(e.target.value)
                        })}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', margin: '8px 0' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Percepción IVA RG 3337</label>
                      <input 
                        type="number" 
                        value={extractedData.percepcionIva ?? 0} 
                        onChange={(e) => setExtractedData({
                          ...extractedData, 
                          percepcionIva: Number(e.target.value)
                        })}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                      />
                    </div>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Percepción IVA RG 5329</label>
                      <input 
                        type="number" 
                        value={extractedData.percepcionIva5329 ?? 0} 
                        onChange={(e) => setExtractedData({
                          ...extractedData, 
                          percepcionIva5329: Number(e.target.value)
                        })}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '13px', margin: '8px 0' }}>
                    <div>
                      <label style={{ display: 'block', fontSize: '10px', color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: 600 }}>Impuestos Internos</label>
                      <input 
                        type="number" 
                        value={extractedData.impuestosInternos ?? 0} 
                        onChange={(e) => setExtractedData({
                          ...extractedData, 
                          impuestosInternos: Number(e.target.value)
                        })}
                        style={{ width: '100%', padding: '6px 8px', fontSize: '12px', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', color: 'var(--text-primary)' }}
                      />
                    </div>
                  </div>
                  
                  <div style={{
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <span style={{ color: 'var(--text-primary)', fontWeight: 600, fontSize: '14px' }}>Monto Factura</span>
                    <input 
                      type="number" 
                      value={extractedData.totalAmount ?? 0} 
                      onChange={(e) => setExtractedData({...extractedData, totalAmount: Number(e.target.value)})}
                      style={{ width: '140px', padding: '6px 10px', fontSize: '15px', fontWeight: 'bold', border: '1px solid var(--color-corp-red)', borderRadius: '6px', backgroundColor: '#fff', color: 'var(--color-corp-red)', textAlign: 'right' }}
                    />
                  </div>

                  {extractedData.providerId && (
                    <div style={{
                      paddingTop: '12px',
                      borderTop: '1px dashed var(--border-color)',
                      fontSize: '11px',
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}>
                      <AlertCircle size={14} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                      <span>
                        Se registrará la deuda de <strong>${extractedData.totalAmount}</strong> en la CC del proveedor ID: {extractedData.providerId}.
                      </span>
                    </div>
                  )}
                </div>

              </div>
            ) : null}
          </div>
        </div>

        {/* Footer */}
        <div style={{
          padding: '16px 24px',
          borderTop: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'flex-end',
          gap: '12px',
          backgroundColor: 'var(--bg-app)'
        }}>
          <button 
            onClick={onClose}
            disabled={loading}
            style={{
              padding: '10px 20px',
              borderRadius: '8px',
              border: '1px solid var(--border-color)',
              backgroundColor: '#FFFFFF',
              color: 'var(--text-secondary)',
              fontSize: '13px',
              fontWeight: 500,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              opacity: loading ? 0.5 : 1
            }}
            onMouseEnter={(e) => { if (!loading) e.currentTarget.style.backgroundColor = 'var(--accent-bg-light)'; }}
            onMouseLeave={(e) => { if (!loading) e.currentTarget.style.backgroundColor = '#FFFFFF'; }}
          >
            Cancelar
          </button>
          {(() => {
            const allItemsValid = extractedData?.items?.length > 0 && extractedData.items.every((i: any) => i.isNonStock || !!i.matchedProductId);
            const allNonStock = extractedData?.items?.length > 0 && extractedData.items.every((i: any) => i.isNonStock);
            const isDisabled = loading || !extractedData || !allItemsValid;

            const buttonLabel = allNonStock
              ? 'Confirmar Factura (Sin afectar stock)'
              : 'Confirmar e Inyectar Stock';

            return (
              <button 
                onClick={handleConfirm}
                disabled={isDisabled}
                style={{
                  padding: '10px 20px',
                  borderRadius: '8px',
                  border: 'none',
                  backgroundColor: 'var(--color-corp-red)',
                  color: '#FFFFFF',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: '0 4px 6px -1px rgba(227, 6, 19, 0.2)',
                  transition: 'all 0.15s ease',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  opacity: isDisabled ? 0.5 : 1
                }}
                onMouseEnter={(e) => {
                  if (!isDisabled) e.currentTarget.style.backgroundColor = '#C70510';
                }}
                onMouseLeave={(e) => {
                  if (!isDisabled) e.currentTarget.style.backgroundColor = 'var(--color-corp-red)';
                }}
              >
                {loading ? (
                  <Loader size={16} style={{ animation: 'spin 1s linear infinite' }} />
                ) : (
                  <Check size={16} />
                )}
                <span>{buttonLabel}</span>
              </button>
            );
          })()}
        </div>
      </div>
    </div>
  );
};
