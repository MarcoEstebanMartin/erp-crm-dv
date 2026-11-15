import { useState, useEffect } from 'react';
import { api } from '../../../utils/api';

interface UsePurchaseScannerParams {
  isOpen: boolean;
  file: File | null;
  onSuccess: () => void;
  onClose: () => void;
}

const initExtractedData = (response: any) => {
  const rawPercAmount = Number(response.extracted.percepcionAmount || 0);
  const rawIIBB = Number(response.extracted.percepcionIIBBAmount || 0);
  const rawIva = Number(response.extracted.percepcionIvaAmount || 0);
  const jurisdiction = response.extracted.percepcionJurisdiction || '';

  const isPampa = jurisdiction.toLowerCase().includes('pampa') || jurisdiction.toUpperCase() === 'AR-L';
  const isBsAs = jurisdiction.toLowerCase().includes('buenos') || jurisdiction.toLowerCase().includes('bs') || jurisdiction.toUpperCase() === 'AR-B';

  const percepcionPampa = isPampa ? (rawIIBB || rawPercAmount) : 0;
  const percepcionBsAs = isBsAs ? (rawIIBB || rawPercAmount) : 0;
  const percepcionIva = rawIva || 0;
  const percepcionIva5329 = 0;
  const impuestosInternos = 0;

  const netAmount = Number(response.extracted.netAmount || 0);
  const taxAmount = Number(response.extracted.taxAmount || 0);

  const calculatedTotal = Number((netAmount + taxAmount + percepcionPampa + percepcionBsAs + percepcionIva + percepcionIva5329 + impuestosInternos).toFixed(2));
  const extractedTotal = Number(response.extracted.totalAmount || 0);
  const totalAmount = calculatedTotal > extractedTotal ? calculatedTotal : (extractedTotal > 0 ? extractedTotal : calculatedTotal);

  return {
    ...response.extracted,
    providerId: response.matchedProvider ? response.matchedProvider.id : '',
    netAmount,
    taxAmount,
    percepcionPampa,
    percepcionBsAs,
    percepcionIva,
    percepcionIva5329,
    impuestosInternos,
    totalAmount,
  };
};

export function usePurchaseScanner({ isOpen, file, onSuccess, onClose }: UsePurchaseScannerParams) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);

  const [productSearchResults, setProductSearchResults] = useState<Record<number, any[]>>({});
  const [productSearchQueries, setProductSearchQueries] = useState<Record<number, string>>({});
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);

  const processUploadedDocument = async (fileToProcess: File) => {
    setLoading(true);
    setErrorMsg(null);
    setExtractedData(null);
    try {
      const response = await api.uploadPurchaseDocument(fileToProcess);
      setExtractedData(initExtractedData(response));
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar el documento.');
    } finally {
      setLoading(false);
    }
  };

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

  const updateExtractedField = (field: string, rawVal: any) => {
    setExtractedData((prev: any) => {
      if (!prev) return prev;
      const val = Number(rawVal) || 0;
      const updated = { ...prev, [field]: val };
      if (field === 'netAmount' && (!prev.taxAmount || prev.taxAmount === 0)) {
        updated.taxAmount = Number((val * 0.21).toFixed(2));
      }
      updated.totalAmount = Number((
        Number(updated.netAmount || 0)
        + Number(updated.taxAmount || 0)
        + Number(updated.percepcionPampa || 0)
        + Number(updated.percepcionBsAs || 0)
        + Number(updated.percepcionIva || 0)
        + Number(updated.percepcionIva5329 || 0)
        + Number(updated.impuestosInternos || 0)
      ).toFixed(2));
      return updated;
    });
  };

  const handleProductSearch = async (index: number, query: string) => {
    setProductSearchQueries((prev) => ({ ...prev, [index]: query }));
    if (query.trim().length < 2) {
      setProductSearchResults((prev) => ({ ...prev, [index]: [] }));
      return;
    }
    try {
      const products = await api.getProducts(query);
      setProductSearchResults((prev) => ({ ...prev, [index]: products || [] }));
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
    setProductSearchResults((prev) => ({ ...prev, [index]: [] }));
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
      matchMethod: nonStock ? 'NON_STOCK' : (item.matchedProductId ? item.matchMethod : 'NONE'),
    }));
    setExtractedData({ ...extractedData, items: newItems });
  };

  const handleConfirm = async () => {
    if (!extractedData.providerId) {
      setErrorMsg('Seleccione un proveedor válido.');
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
          productId: item.isNonStock || !item.matchedProductId ? null : Number(item.matchedProductId),
          isNonStock: !!item.isNonStock,
          code: item.code,
          description: item.description,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          subtotal: Number(item.subtotal),
        })),
        netAmount: Number(extractedData.netAmount),
        taxAmount: Number(extractedData.taxAmount),
        percepcionPampa: Number(extractedData.percepcionPampa || 0),
        percepcionBsAs: Number(extractedData.percepcionBsAs || 0),
        percepcionIva: Number(extractedData.percepcionIva || 0),
        percepcionIva5329: Number(extractedData.percepcionIva5329 || 0),
        impuestosInternos: Number(extractedData.impuestosInternos || 0),
        totalAmount: Number(extractedData.totalAmount),
      });
      onSuccess();
      onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al confirmar el documento.');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading, errorMsg, extractedData, setExtractedData, previewUrl, isPdf,
    productSearchResults, productSearchQueries, activeSearchIndex, setActiveSearchIndex,
    processUploadedDocument, updateExtractedField, handleProductSearch,
    handleSelectProduct, handleToggleNonStock, handleMarkAllNonStock, handleConfirm,
  };
}
