import { useState, useEffect } from 'react';
import { api } from '../../../utils/api';
import { parseExactCents } from '../providersHelpers';

export type ScannerReceptionMode = 'IN_TRANSIT' | 'IMMEDIATE' | 'NONE';

interface UsePurchaseScannerParams {
  isOpen: boolean;
  file: File | null;
  onSuccess: () => void;
  onClose: () => void;
}

const VALID_DOC_TYPES = new Set([
  'FACTURA_A',
  'FACTURA_B',
  'FACTURA_C',
  'NOTA_CREDITO_A',
  'NOTA_CREDITO_B',
  'NOTA_CREDITO_C',
  'REMITO',
]);

const sumTaxTotalCents = (d: any) =>
  parseExactCents(d.netAmount) + parseExactCents(d.taxAmount) +
  parseExactCents(d.percepcionPampa) + parseExactCents(d.percepcionBsAs) +
  parseExactCents(d.percepcionIva) + parseExactCents(d.percepcionIva5329) +
  parseExactCents(d.impuestosInternos);

const allowsVat21 = (docType: string, billingType: string) =>
  billingType !== 'INTERNAL' &&
  (docType === 'FACTURA_A' || docType === 'FACTURA_B' || docType === 'NOTA_CREDITO_A' || docType === 'NOTA_CREDITO_B');

const initExtractedData = (response: any) => {
  const ext = response.extracted || {};
  const rawPerc = Number(ext.percepcionAmount || 0);
  const rawIIBB = Number(ext.percepcionIIBBAmount || 0);
  const rawIva = Number(ext.percepcionIvaAmount || 0);
  const jurisdiction = String(ext.percepcionJurisdiction || '').toLowerCase();

  const isPampa = jurisdiction.includes('pampa') || jurisdiction === 'ar-l';
  const isBsAs = jurisdiction.includes('buenos') || jurisdiction.includes('bs') || jurisdiction === 'ar-b';
  const rawType = String(ext.documentType || '').toUpperCase();
  const documentType = VALID_DOC_TYPES.has(rawType) ? rawType : 'FACTURA_A';
  const billingType = ext.billingType === 'INTERNAL' ? 'INTERNAL' : 'OFFICIAL';
  const rawDate = String(ext.issueDate || '').trim();
  const issueDate = /^\d{4}-\d{2}-\d{2}/.test(rawDate) ? rawDate.slice(0, 10) : new Date().toISOString().split('T')[0];

  const percepcionPampa = isPampa ? (rawIIBB || rawPerc) : 0;
  const percepcionBsAs = isBsAs ? (rawIIBB || rawPerc) : 0;
  const percepcionIva = rawIva || 0;
  const netAmount = Number(ext.netAmount || 0);
  const taxAmount = allowsVat21(documentType, billingType) ? Number(ext.taxAmount || 0) : 0;

  const draft = { ...ext, documentType, billingType, issueDate, netAmount, taxAmount, percepcionPampa, percepcionBsAs, percepcionIva, percepcionIva5329: 0, impuestosInternos: 0 };
  const calcCents = sumTaxTotalCents(draft);
  const extCents = parseExactCents(ext.totalAmount);
  const totalAmount = Number(((calcCents > extCents ? calcCents : extCents > 0 ? extCents : calcCents) / 100).toFixed(2));

  return {
    ...draft,
    providerId: response.matchedProvider ? response.matchedProvider.id : '',
    totalAmount,
  };
};

export function usePurchaseScanner({ isOpen, file, onSuccess, onClose }: UsePurchaseScannerParams) {
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [extractedData, setExtractedData] = useState<any>(null);
  const [receptionMode, setReceptionMode] = useState<ScannerReceptionMode>('IN_TRANSIT');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isPdf, setIsPdf] = useState(false);

  const [productSearchResults, setProductSearchResults] = useState<Record<number, any[]>>({});
  const [productSearchQueries, setProductSearchQueries] = useState<Record<number, string>>({});
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null);

  const processUploadedDocument = async (fileToProcess: File) => {
    setLoading(true); setErrorMsg(null); setExtractedData(null);
    try {
      const response = await api.uploadPurchaseDocument(fileToProcess);
      const data = initExtractedData(response);
      setExtractedData(data);
      const isCreditNote = String(data.documentType || '').startsWith('NOTA_CREDITO');
      const hasStockItems = !isCreditNote && Array.isArray(data.items) && data.items.some((i: any) => !i.isNonStock);
      setReceptionMode(hasStockItems ? 'IN_TRANSIT' : 'NONE');
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
      void processUploadedDocument(file);
    }
    return () => { if (url) URL.revokeObjectURL(url); };
  }, [isOpen, file]);

  const updateDocMeta = (patch: Record<string, any>) => {
    if (typeof patch.documentType === 'string' && patch.documentType.startsWith('NOTA_CREDITO')) {
      setReceptionMode('NONE');
    }
    setExtractedData((prev: any) => {
      if (!prev) return prev;
      const next = { ...prev, ...patch };
      if (patch.documentType !== undefined || patch.billingType !== undefined) {
        if (!allowsVat21(next.documentType, next.billingType)) {
          next.taxAmount = 0;
        } else if (Number(next.taxAmount || 0) === 0 && Number(next.netAmount || 0) > 0) {
          next.taxAmount = Number((Math.round(parseExactCents(next.netAmount) * 0.21) / 100).toFixed(2));
        }
        next.totalAmount = Number((sumTaxTotalCents(next) / 100).toFixed(2));
      }
      return next;
    });
  };

  const updateExtractedField = (field: string, rawVal: any) => {
    setExtractedData((prev: any) => {
      if (!prev) return prev;
      const val = Number(rawVal) || 0;
      const updated = { ...prev, [field]: val };
      if (field === 'netAmount' && (!prev.taxAmount || prev.taxAmount === 0) && allowsVat21(prev.documentType, prev.billingType)) {
        updated.taxAmount = Number((Math.round(parseExactCents(val) * 0.21) / 100).toFixed(2));
      }
      updated.totalAmount = Number((sumTaxTotalCents(updated) / 100).toFixed(2));
      return updated;
    });
  };

  const handleProductSearch = async (index: number, query: string) => {
    setProductSearchQueries((prev) => ({ ...prev, [index]: query }));
    if (query.trim().length < 2) { setProductSearchResults((prev) => ({ ...prev, [index]: [] })); return; }
    try {
      const products = await api.getProducts(query);
      setProductSearchResults((prev) => ({ ...prev, [index]: products || [] }));
    } catch (err) {
      console.error('Error buscando productos:', err);
    }
  };

  const handleSelectProduct = (index: number, product: any) => {
    const newItems = [...extractedData.items];
    newItems[index] = { ...newItems[index], matchedProductId: product.id, matchedProductName: product.name, matchMethod: 'MANUAL', isNonStock: false };
    setExtractedData({ ...extractedData, items: newItems });
    if (receptionMode === 'NONE') setReceptionMode('IN_TRANSIT');
    setActiveSearchIndex(null);
    setProductSearchResults((prev) => ({ ...prev, [index]: [] }));
  };

  const handleToggleNonStock = (index: number) => {
    const newItems = [...extractedData.items];
    const nextNonStock = !newItems[index].isNonStock;
    newItems[index] = {
      ...newItems[index],
      isNonStock: nextNonStock,
      matchedProductId: nextNonStock ? null : newItems[index].matchedProductId,
      matchedProductName: nextNonStock ? null : newItems[index].matchedProductName,
      matchMethod: nextNonStock ? 'NON_STOCK' : 'NONE',
    };
    setExtractedData({ ...extractedData, items: newItems });
    const allNonStockNow = newItems.every((i: any) => i.isNonStock);
    if (allNonStockNow) setReceptionMode('NONE');
    else if (receptionMode === 'NONE') setReceptionMode('IN_TRANSIT');
  };

  const handleMarkAllNonStock = (nonStock: boolean) => {
    if (!extractedData?.items) return;
    const newItems = extractedData.items.map((item: any) => ({
      ...item, isNonStock: nonStock,
      matchedProductId: nonStock ? null : item.matchedProductId,
      matchedProductName: nonStock ? null : item.matchedProductName,
      matchMethod: nonStock ? 'NON_STOCK' : (item.matchedProductId ? item.matchMethod : 'NONE'),
    }));
    setExtractedData({ ...extractedData, items: newItems });
    setReceptionMode(nonStock ? 'NONE' : 'IN_TRANSIT');
  };

  const handleConfirm = async () => {
    if (!extractedData.providerId) return setErrorMsg('Seleccione un proveedor válido.');
    setLoading(true); setErrorMsg(null);
    try {
      await api.confirmPurchaseDocument({
        providerId: Number(extractedData.providerId),
        documentType: extractedData.documentType,
        documentNumber: extractedData.documentNumber,
        issueDate: extractedData.issueDate,
        billingType: extractedData.billingType || 'OFFICIAL',
        receptionMode,
        items: extractedData.items.map((item: any) => ({
          productId: item.isNonStock || !item.matchedProductId ? null : Number(item.matchedProductId),
          isNonStock: !!item.isNonStock,
          code: item.code, description: item.description,
          quantity: Number(item.quantity), unitPrice: Number(item.unitPrice), subtotal: Number(item.subtotal),
        })),
        netAmount: Number(extractedData.netAmount), taxAmount: Number(extractedData.taxAmount),
        percepcionPampa: Number(extractedData.percepcionPampa || 0), percepcionBsAs: Number(extractedData.percepcionBsAs || 0),
        percepcionIva: Number(extractedData.percepcionIva || 0), percepcionIva5329: Number(extractedData.percepcionIva5329 || 0),
        impuestosInternos: Number(extractedData.impuestosInternos || 0), totalAmount: Number(extractedData.totalAmount),
      });
      onSuccess(); onClose();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al confirmar el documento.');
    } finally {
      setLoading(false);
    }
  };

  return {
    loading, errorMsg, extractedData, setExtractedData, receptionMode, setReceptionMode, previewUrl, isPdf,
    productSearchResults, productSearchQueries, activeSearchIndex, setActiveSearchIndex,
    processUploadedDocument, updateDocMeta, updateExtractedField, handleProductSearch,
    handleSelectProduct, handleToggleNonStock, handleMarkAllNonStock, handleConfirm,
  };
}
