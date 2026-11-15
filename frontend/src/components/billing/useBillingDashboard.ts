import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../../utils/api';
import { billingApi } from '../../api/billing.api';
import { formatArgentinaDateKey } from '../../utils/orderSearchAndStatus.helper';
import type { SalesInvoiceTypeFilter } from './sales/sales.types';

export type BillingSubTab = 'ventas' | 'retenciones' | 'notas-credito' | 'libro-iva';

export function useBillingDashboard(activeTab: string) {
  const [activeSubTab, setActiveSubTab] = useState<BillingSubTab>('ventas');

  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [taxWithholdings, setTaxWithholdings] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [activeDrawers, setActiveDrawers] = useState<any[]>([]);
  const [ivaPerceptionAliquot, setIvaPerceptionAliquot] = useState(3.0);

  const [query, setQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salesInvoiceTypeFilter, setSalesInvoiceTypeFilter] =
    useState<SalesInvoiceTypeFilter>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [requestingCaeOrderId, setRequestingCaeOrderId] = useState<number | null>(null);

  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [viewCreditNoteModal, setViewCreditNoteModal] = useState<any | null>(null);
  const [cnClientSearchQuery, setCnClientSearchQuery] = useState('');
  const [creditNoteCart, setCreditNoteCart] = useState<any[]>([]);
  const [creditNoteForm, setCreditNoteForm] = useState({
    personaId: '',
    orderId: '',
    billingType: 'INTERNAL',
    reason: 'DEVOLUCION',
    comments: '',
  });

  const requestSeqRef = useRef(0);

  useEffect(() => {
    if (!query.trim()) {
      setDebouncedQuery('');
      return;
    }
    const timer = window.setTimeout(() => setDebouncedQuery(query.trim()), 300);
    return () => window.clearTimeout(timer);
  }, [query]);

  const loadMasterCatalog = useCallback(async () => {
    const warnings: string[] = [];
    const [personasRes, productsRes, perceptionsRes, drawersRes, banksRes] =
      await Promise.allSettled([
        api.getPersonas('ALL', ''),
        api.getProducts(''),
        api.getPerceptions(),
        api.getActiveDrawers(),
        api.getBankAccounts(),
      ]);

    if (personasRes.status === 'fulfilled') {
      setPersonas((personasRes.value || []).filter((p: any) => p.isActive !== false));
    } else {
      warnings.push('No se pudo cargar el padrón de personas.');
    }

    if (productsRes.status === 'fulfilled') {
      setProducts(productsRes.value || []);
    } else {
      warnings.push('No se pudo cargar el catálogo de productos.');
    }

    if (perceptionsRes.status === 'fulfilled') {
      const pIva = perceptionsRes.value?.perceptions?.find((p: any) => p.code === 'IVA_5329');
      if (pIva && pIva.aliquot != null) {
        setIvaPerceptionAliquot(Number(pIva.aliquot));
      }
    }

    if (drawersRes.status === 'fulfilled') {
      setActiveDrawers(drawersRes.value || []);
    } else {
      setActiveDrawers([]);
      warnings.push('No se pudieron cargar las cajas operativas.');
    }

    if (banksRes.status === 'fulfilled') {
      setBankAccounts(banksRes.value || []);
    } else {
      setBankAccounts([]);
      warnings.push('No se pudieron cargar las cuentas bancarias.');
    }

    if (warnings.length > 0) {
      setErrorMsg(warnings.join(' | '));
    }
  }, []);

  const loadDocuments = useCallback(async () => {
    if (activeSubTab === 'libro-iva') {
      setLoading(false);
      return;
    }
    const seq = ++requestSeqRef.current;
    setLoading(true);
    try {
      const baseFilters = {
        ...(startDate ? { startDate } : {}),
        ...(endDate ? { endDate } : {}),
        ...(debouncedQuery ? { query: debouncedQuery } : {}),
      };

      if (activeSubTab === 'ventas') {
        const data = await billingApi.getSalesInvoices({
          ...baseFilters,
          billingType: salesInvoiceTypeFilter,
        });
        if (requestSeqRef.current === seq) setSalesInvoices(data);
      } else if (activeSubTab === 'retenciones') {
        const data = await billingApi.getTaxWithholdings(baseFilters);
        if (requestSeqRef.current === seq) {
          setTaxWithholdings((data || []).filter((w: any) => String(w.type).startsWith('RETENCION_')));
        }
      } else if (activeSubTab === 'notas-credito') {
        const data = await billingApi.getCreditNotes({
          ...baseFilters,
          status: statusFilter,
          billingType: salesInvoiceTypeFilter,
        });
        if (requestSeqRef.current === seq) setCreditNotes(data);
      }
    } catch (err: any) {
      if (requestSeqRef.current === seq) {
        setErrorMsg(err.message || 'Error al cargar los comprobantes e impuestos.');
      }
    } finally {
      if (requestSeqRef.current === seq) setLoading(false);
    }
  }, [activeSubTab, startDate, endDate, debouncedQuery, salesInvoiceTypeFilter, statusFilter]);

  const refreshAfterMutation = useCallback(async () => {
    await Promise.all([loadMasterCatalog(), loadDocuments()]);
  }, [loadMasterCatalog, loadDocuments]);

  useEffect(() => {
    void loadMasterCatalog();
  }, [loadMasterCatalog]);

  useEffect(() => {
    if (activeTab === 'billing' && localStorage.getItem('preselected_billing_client')) {
      setActiveSubTab('ventas');
    }
  }, [activeTab]);

  useEffect(() => {
    void loadDocuments();
  }, [loadDocuments]);

  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [activeSubTab]);

  const handleClearFilters = () => {
    setQuery('');
    setDebouncedQuery('');
    setStartDate('');
    setEndDate('');
    setSalesInvoiceTypeFilter('ALL');
    setStatusFilter('ALL');
  };

  const handleSelectToday = () => {
    const todayAr = formatArgentinaDateKey(new Date());
    setStartDate(todayAr);
    setEndDate(todayAr);
  };

  const handleRequestOrderCae = async (orderId: number) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setRequestingCaeOrderId(orderId);
    try {
      const res = await billingApi.requestOrderCae(orderId);
      setSuccessMsg(res.message || `CAE asignado correctamente al comprobante #${orderId}.`);
      await loadDocuments();
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo obtener el CAE ante AFIP.');
    } finally {
      setRequestingCaeOrderId(null);
    }
  };

  const handleCreateCreditNoteFromInvoice = async (invoice: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);

    const pId = invoice.personaId || invoice.clientId;
    const client =
      personas.find((p: any) => p.id === Number(pId)) || invoice.persona || invoice.client;
    if (!client) {
      setErrorMsg('No se encontró el cliente de la factura.');
      return;
    }

    setCnClientSearchQuery(client.name);
    setLoading(true);
    try {
      let sourceItems = invoice.items;
      if (!sourceItems || sourceItems.length === 0) {
        const orders = await api.getOrders(undefined, 'DELIVERED');
        const matched = orders.find((o: any) => o.id === invoice.id);
        sourceItems = matched?.items || [];
      }

      setCreditNoteForm({
        personaId: String(client.id),
        orderId: String(invoice.id),
        billingType: invoice.billingType || (client.cuit ? 'OFFICIAL' : 'INTERNAL'),
        reason: 'DEVOLUCION',
        comments: `Devolución de comprobante #${invoice.invoiceNumber || invoice.id}`,
      });

      const itemsToDev = (sourceItems || []).map((item: any) => {
        const prod = products.find((p) => p.id === item.productId);
        const isPesable = prod ? prod.isPesable : Boolean(item.product?.isPesable);
        const approxWeight = prod ? prod.approximateWeight : item.product?.approximateWeight ?? null;
        const qty = Number(item.quantity);
        const weight = isPesable
          ? item.weight
            ? Number(item.weight)
            : qty * Number(approxWeight || 1)
          : null;
        const unitPrice = Number(item.unitPrice);
        return {
          productId: item.productId,
          name: prod ? prod.name : item.product?.name || `Producto #${item.productId}`,
          sku: prod ? prod.sku : item.product?.sku || '',
          orderQuantity: qty,
          orderWeight: weight,
          quantity: qty,
          weight,
          isPesable,
          approximateWeight: approxWeight,
          unitPrice,
          subtotal: isPesable ? (weight ? Math.round(weight * unitPrice) : 0) : Math.round(qty * unitPrice),
        };
      });

      setCreditNoteCart(itemsToDev);
      setActiveSubTab('notas-credito');
      setShowCreditNoteModal(true);
    } catch (err: any) {
      setErrorMsg('Error al preparar nota de crédito: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return {
    activeSubTab,
    setActiveSubTab,
    salesInvoices,
    taxWithholdings,
    personas,
    products,
    creditNotes,
    bankAccounts,
    activeDrawers,
    ivaPerceptionAliquot,
    query,
    setQuery,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    salesInvoiceTypeFilter,
    setSalesInvoiceTypeFilter,
    statusFilter,
    setStatusFilter,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    loading,
    requestingCaeOrderId,
    showCreditNoteModal,
    setShowCreditNoteModal,
    viewCreditNoteModal,
    setViewCreditNoteModal,
    cnClientSearchQuery,
    setCnClientSearchQuery,
    creditNoteCart,
    setCreditNoteCart,
    creditNoteForm,
    setCreditNoteForm,
    refreshAfterMutation,
    handleClearFilters,
    handleSelectToday,
    handleRequestOrderCae,
    handleCreateCreditNoteFromInvoice,
  };
}
