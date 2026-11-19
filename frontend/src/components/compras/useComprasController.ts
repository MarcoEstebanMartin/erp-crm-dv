import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { addDaysIso, computeSupplierInvoicesMetrics, parseExactCents } from './providersHelpers';
import { KNOWN_WMS_LOCATION_SET } from '../deposito/depositoHelpers';

export const INITIAL_SUPPLIER_FORM = () => {
  const todayIso = new Date().toISOString().split('T')[0];
  return {
    personaId: '', invoiceNumber: '', invoiceType: 'FACTURA_A',
    issueDate: todayIso, dueDate: addDaysIso(todayIso, 30),
    netAmount: '', taxAmount: '', percepcionAmount: '', percepcionPampa: '', percepcionBsAs: '',
    percepcionIva: '', percepcionIva5329: '', impuestosInternos: '', totalAmount: '',
    billingType: 'OFFICIAL', receptionMode: 'NONE' as 'NONE' | 'IN_TRANSIT' | 'IMMEDIATE',
  };
};

export function useComprasController(activeSubTab: string, refreshKey?: number, onProvidersChanged?: () => void) {
  const confirm = useConfirm();
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [allProviders, setAllProviders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);

  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierStartDate, setSupplierStartDate] = useState('');
  const [supplierEndDate, setSupplierEndDate] = useState('');
  const [branchFilter, setBranchFilter] = useState<'ALL' | 'OFFICIAL' | 'INTERNAL'>('ALL');
  const [invoiceReceptionFilter, setInvoiceReceptionFilter] = useState<'ALL' | 'IN_TRANSIT' | 'RECEIVED'>('ALL');
  const [providerSearch, setProviderSearch] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState<any | null>(null);
  const [viewDetailsModal, setViewDetailsModal] = useState<any | null>(null);
  const [scannerFile, setScannerFile] = useState<File | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);

  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [cart, setCart] = useState<{ productId: number; name: string; sku: string; quantity: number; costPrice: number }[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [receiveForm, setReceiveForm] = useState<{ billingType: 'OFFICIAL' | 'INTERNAL'; invoiceType: string }>({ billingType: 'OFFICIAL', invoiceType: 'FACTURA_A' });
  const [receivedQuantities, setReceivedQuantities] = useState<Record<number, number>>({});
  const [lotAssignments, setLotAssignments] = useState<
    Record<number, { lotNumber: string; expirationDate: string; location: string }>
  >({});

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState(INITIAL_SUPPLIER_FORM);
  const [manualInvoiceItems, setManualInvoiceItems] = useState<{ productId: number; name: string; sku: string; quantity: number; costPrice: number }[]>([]);

  const [providerModal, setProviderModal] = useState<{ open: boolean; mode: 'create' | 'edit'; data: any } | null>(null);
  const [savingProvider, setSavingProvider] = useState(false);
  const [accountSummaryModal, setAccountSummaryModal] = useState<any | null>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(false);
  const [summaryError, setSummaryError] = useState<string | null>(null);

  const [payInvoiceModal, setPayInvoiceModal] = useState<{ open: boolean; invoice: any | null }>({ open: false, invoice: null });
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMethod: 'CASH', bankAccountId: '', branch: 'A', description: '' });
  const [paymentItems, setPaymentItems] = useState<Array<{ amount: string; paymentMethod: string; bankAccountId: string }>>([{ amount: '', paymentMethod: 'CASH', bankAccountId: '' }]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadMasterData = useCallback(async () => {
    try {
      const [orders, personas, allProducts] = await Promise.all([api.getPurchaseOrders(), api.getPersonas('provider', ''), api.getProducts('')]);
      setPurchaseOrders(orders || []); setAllProviders(personas || []); setProducts(allProducts || []);
    } catch { setErrorMsg('Error al cargar datos del módulo de compras.'); }
  }, []);

  const loadSupplierInvoices = useCallback(async () => {
    try {
      const invoices = await api.getSupplierInvoices({ startDate: supplierStartDate, endDate: supplierEndDate, query: supplierQuery });
      setSupplierInvoices(invoices || []);
    } catch { setErrorMsg('Error al cargar facturas de compra.'); }
  }, [supplierStartDate, supplierEndDate, supplierQuery]);

  const loadData = useCallback(() => { void loadMasterData(); void loadSupplierInvoices(); }, [loadMasterData, loadSupplierInvoices]);

  useEffect(() => { void loadMasterData(); }, [loadMasterData, refreshKey]);
  useEffect(() => {
    const timer = setTimeout(() => { void loadSupplierInvoices(); }, supplierQuery ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadSupplierInvoices, supplierQuery, refreshKey]);
  useEffect(() => { setSuccessMsg(null); setErrorMsg(null); }, [activeSubTab]);

  const providers = useMemo(() => allProviders.filter((p) => p.isActive !== false), [allProviders]);
  const inTransitCount = useMemo(() => purchaseOrders.filter((o) => o.status === 'PENDING').length, [purchaseOrders]);
  const baseBranchInvoices = useMemo(
    () => supplierInvoices.filter((inv) => branchFilter === 'ALL' || inv.billingType === branchFilter),
    [supplierInvoices, branchFilter],
  );
  const supplierMetrics = useMemo(() => computeSupplierInvoicesMetrics(baseBranchInvoices), [baseBranchInvoices]);
  const filteredInvoices = useMemo(
    () =>
      baseBranchInvoices.filter((inv) => {
        if (invoiceReceptionFilter === 'ALL') return true;
        return inv.receptionStatus === invoiceReceptionFilter;
      }),
    [baseBranchInvoices, invoiceReceptionFilter],
  );

  const autoCalculatedTotal = useMemo(() => {
    const cents = parseExactCents(supplierForm.netAmount) + parseExactCents(supplierForm.taxAmount) +
      parseExactCents(supplierForm.percepcionPampa) + parseExactCents(supplierForm.percepcionBsAs) +
      parseExactCents(supplierForm.percepcionIva) + parseExactCents(supplierForm.percepcionIva5329) + parseExactCents(supplierForm.impuestosInternos);
    return (cents / 100).toFixed(2);
  }, [supplierForm.netAmount, supplierForm.taxAmount, supplierForm.percepcionPampa, supplierForm.percepcionBsAs, supplierForm.percepcionIva, supplierForm.percepcionIva5329, supplierForm.impuestosInternos]);

  useEffect(() => {
    setSupplierForm((prev) => (prev.totalAmount === autoCalculatedTotal ? prev : { ...prev, totalAmount: autoCalculatedTotal }));
  }, [autoCalculatedTotal]);

  const handleSupplierNetChange = (val: string) => {
    setSupplierForm((prev) => {
      const calcIva = prev.billingType === 'OFFICIAL' && (prev.invoiceType === 'FACTURA_A' || prev.invoiceType === 'FACTURA_B');
      return { ...prev, netAmount: val, taxAmount: calcIva ? (Math.round(parseExactCents(val) * 0.21) / 100).toFixed(2) : '0' };
    });
  };

  const handleSupplierFieldChange = (patch: Partial<ReturnType<typeof INITIAL_SUPPLIER_FORM>>) => {
    setSupplierForm((prev) => {
      const next = { ...prev, ...patch };
      if (patch.personaId !== undefined || patch.issueDate !== undefined) {
        const prov = providers.find((pr) => String(pr.id) === String(next.personaId));
        next.dueDate = addDaysIso(next.issueDate, Number(prov?.paymentTermDays || 30));
      }
      if (patch.invoiceType !== undefined || patch.billingType !== undefined) {
        const calcIva = next.billingType === 'OFFICIAL' && (next.invoiceType === 'FACTURA_A' || next.invoiceType === 'FACTURA_B');
        next.taxAmount = calcIva ? (Math.round(parseExactCents(next.netAmount) * 0.21) / 100).toFixed(2) : '0';
      }
      return next;
    });
  };

  const handleOpenPayInvoice = async (inv: any) => {
    setErrorMsg(null);
    const pendingCents = Math.max(0, parseExactCents(inv.totalAmount) - parseExactCents(inv.paidAmount));
    const initialAmt = (pendingCents > 0 ? pendingCents / 100 : parseExactCents(inv.totalAmount) / 100).toFixed(2);
    setPaymentForm({ amount: initialAmt, paymentMethod: 'CASH', bankAccountId: '', branch: inv.billingType === 'OFFICIAL' ? 'A' : 'X', description: `Pago Factura ${inv.invoiceNumber}` });
    setPaymentItems([{ amount: initialAmt, paymentMethod: 'CASH', bankAccountId: '' }]);
    setPayInvoiceModal({ open: true, invoice: inv });
    try { setBankAccounts((await api.getBankAccounts()) || []); } catch {}
  };

  const handlePayInvoiceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const inv = payInvoiceModal.invoice;
    if (!inv) return;
    const validItems = paymentItems.map((i) => ({ amount: Number(i.amount), paymentMethod: i.paymentMethod, bankAccountId: i.bankAccountId ? Number(i.bankAccountId) : null }));
    if (validItems.some((i) => !i.amount || i.amount <= 0)) return setErrorMsg('Ingrese montos válidos mayores a 0.');
    try {
      if (validItems.length > 1) await api.registerPayment(inv.personaId, { payments: validItems, description: paymentForm.description, branch: paymentForm.branch, supplierInvoiceId: inv.id });
      else await api.registerPayment(inv.personaId, { amount: validItems[0].amount, paymentMethod: validItems[0].paymentMethod, bankAccountId: validItems[0].bankAccountId, description: paymentForm.description, branch: paymentForm.branch, supplierInvoiceId: inv.id });
      setErrorMsg(null); setSuccessMsg(`Pago registrado para factura ${inv.invoiceNumber}.`);
      setPayInvoiceModal({ open: false, invoice: null }); loadData(); onProvidersChanged?.();
    } catch (err: any) { setErrorMsg(err.message || 'Error al registrar pago.'); }
  };

  const handleCreateOrderSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProviderId || cart.length === 0) return setErrorMsg('Seleccione proveedor y agregue artículos.');
    try {
      await api.createPurchaseOrder({ personaId: Number(selectedProviderId), items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, costPrice: i.costPrice })) });
      setErrorMsg(null); setSuccessMsg('Ingreso pendiente registrado.');
      setShowCreateModal(false); setSelectedProviderId(''); setCart([]); loadData();
    } catch (err: any) { setErrorMsg(err.message || 'Error al registrar ingreso.'); }
  };

  const handleOpenReceiveModal = (orderOrInvoice: any) => {
    const order = orderOrInvoice?.purchaseOrder ? { ...orderOrInvoice.purchaseOrder, supplierInvoice: orderOrInvoice, persona: orderOrInvoice.persona } : orderOrInvoice;
    setErrorMsg(null); setInvoiceNumber('');
    setReceiveForm({ billingType: 'OFFICIAL', invoiceType: 'FACTURA_A' });
    const initialLots: Record<number, { lotNumber: string; expirationDate: string; location: string }> = {};
    const initialQtys: Record<number, number> = {};
    (order?.items || []).forEach((item: any) => {
      const prod = products.find((pr) => pr.id === item.productId) || item.product;
      const defLoc = prod?.defaultLocation ? String(prod.defaultLocation).trim().toUpperCase() : '';
      const suggestedLoc = defLoc && KNOWN_WMS_LOCATION_SET.has(defLoc) ? defLoc : 'S/U';
      initialLots[item.productId] = { lotNumber: '', expirationDate: '', location: suggestedLoc };
      initialQtys[item.productId] = Number(item.quantity || 0);
    });
    setLotAssignments(initialLots); setReceivedQuantities(initialQtys); setShowReceiveModal(order);
  };

  const handleReceiveOrderSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!showReceiveModal) return;
    if ((showReceiveModal.items || []).length > 0 && !Object.values(receivedQuantities).some((q) => Number(q) > 0)) {
      return setErrorMsg('Ingrese al menos una unidad para recibir.');
    }
    try {
      await api.receivePurchaseOrder(showReceiveModal.id, {
        invoiceNumber: invoiceNumber.trim() || undefined,
        billingType: receiveForm.billingType,
        invoiceType: receiveForm.invoiceType,
        lotAssignments,
        receivedQuantities,
      });
      setErrorMsg(null); setSuccessMsg(`Recepción #${showReceiveModal.id} confirmada.`);
      setShowReceiveModal(null); loadData(); onProvidersChanged?.();
    } catch (err: any) { setErrorMsg(err.message || 'Error al procesar recepción.'); }
  };

  const handleCreateSupplierInvoiceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const f = supplierForm;
    if (!f.personaId || !f.invoiceNumber || !f.netAmount || !f.totalAmount) return setErrorMsg('Complete los campos obligatorios.');
    if (f.receptionMode !== 'NONE' && manualInvoiceItems.length === 0) {
      return setErrorMsg('Agregue al menos un producto para el ingreso de mercadería.');
    }
    try {
      await api.createSupplierInvoice({
        personaId: Number(f.personaId), invoiceNumber: f.invoiceNumber, invoiceType: f.invoiceType,
        issueDate: new Date(f.issueDate).toISOString(), dueDate: new Date(f.dueDate).toISOString(),
        netAmount: Number(f.netAmount), taxAmount: Number(f.taxAmount || 0),
        percepcionAmount: Number(f.percepcionPampa || 0) + Number(f.percepcionBsAs || 0),
        percepcionPampa: Number(f.percepcionPampa || 0), percepcionBsAs: Number(f.percepcionBsAs || 0),
        percepcionIva: Number(f.percepcionIva || 0), percepcionIva5329: Number(f.percepcionIva5329 || 0),
        impuestosInternos: Number(f.impuestosInternos || 0), totalAmount: Number(f.totalAmount),
        billingType: f.billingType || 'OFFICIAL', receptionMode: f.receptionMode,
        items: f.receptionMode === 'NONE' ? [] : manualInvoiceItems.map((i) => ({ productId: i.productId, quantity: i.quantity, costPrice: i.costPrice })),
      });
      setErrorMsg(null); setSuccessMsg('Factura de compra registrada.');
      setShowSupplierModal(false); setSupplierForm(INITIAL_SUPPLIER_FORM()); setManualInvoiceItems([]);
      loadData(); onProvidersChanged?.();
    } catch (err: any) { setErrorMsg(err.message || 'Error al guardar factura.'); }
  };

  const handleProviderSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!providerModal?.data.name?.trim()) return setErrorMsg('La razón social es obligatoria.');
    try {
      setSavingProvider(true);
      const d = providerModal.data;
      const base = { ...d, name: d.name.trim(), isActive: d.isActive !== false };
      const payload = providerModal.mode === 'create'
        ? { ...base, isClient: false, isProvider: true, isSeller: false, isCommissionAgent: false }
        : { ...base, isClient: Boolean(d.isClient), isProvider: true, isSeller: Boolean(d.isSeller), isCommissionAgent: Boolean(d.isCommissionAgent) };
      if (providerModal.mode === 'create') await api.createPersona(payload); else await api.updatePersona(d.id, payload);
      setErrorMsg(null); setProviderModal(null); setSuccessMsg('Proveedor guardado.'); void loadMasterData(); onProvidersChanged?.();
    } catch (err: any) { setErrorMsg(err.message || 'Error al guardar proveedor.'); } finally { setSavingProvider(false); }
  };

  const handleOpenAccountSummary = async (p: any) => {
    setSummaryError(null); setAccountSummaryModal(p); setLedgerData([]); setSummaryLoading(true);
    try {
      const res = await api.getPersonaLedger(p.id);
      if (res?.persona) setAccountSummaryModal({ ...p, ...res.persona });
      setLedgerData(res?.ledger || []);
    } catch (err: any) { setSummaryError(err?.message || 'Error al cargar cuenta corriente.'); } finally { setSummaryLoading(false); }
  };

  const handleDeleteProvider = async (id: number, name: string) => {
    if (!(await confirm(`¿Eliminar proveedor ${name}?`, { type: 'danger', confirmText: 'Eliminar' }))) return;
    try { await api.deletePersona(id); setErrorMsg(null); setSuccessMsg(`Proveedor ${name} eliminado.`); void loadMasterData(); onProvidersChanged?.(); }
    catch (err: any) { setErrorMsg(err?.message || 'No se pudo eliminar el proveedor.'); }
  };

  const handleDeleteInvoice = async (id: number, num: string) => {
    if (!(await confirm(`¿Anular factura ${num}?`, { type: 'danger' }))) return;
    try { await api.deleteSupplierInvoice(id); setErrorMsg(null); setSuccessMsg(`Factura ${num} anulada.`); loadData(); onProvidersChanged?.(); }
    catch (err: any) { setErrorMsg(err?.message || 'No se pudo anular la factura.'); }
  };

  return {
    purchaseOrders, inTransitCount, allProviders, providers, products, baseBranchInvoices, filteredInvoices, supplierMetrics, autoCalculatedTotal,
    supplierQuery, setSupplierQuery, supplierStartDate, setSupplierStartDate, supplierEndDate, setSupplierEndDate,
    branchFilter, setBranchFilter, invoiceReceptionFilter, setInvoiceReceptionFilter, providerSearch, setProviderSearch,
    showCreateModal, setShowCreateModal, showReceiveModal, setShowReceiveModal, viewDetailsModal, setViewDetailsModal,
    scannerFile, setScannerFile, showScannerModal, setShowScannerModal,
    selectedProviderId, setSelectedProviderId, cart, setCart, invoiceNumber, setInvoiceNumber,
    receiveForm, setReceiveForm, receivedQuantities, setReceivedQuantities, lotAssignments, setLotAssignments,
    showSupplierModal, setShowSupplierModal, supplierForm, setSupplierForm, manualInvoiceItems, setManualInvoiceItems,
    handleSupplierNetChange, handleSupplierFieldChange,
    providerModal, setProviderModal, savingProvider, accountSummaryModal, setAccountSummaryModal, ledgerData, summaryLoading, summaryError,
    payInvoiceModal, setPayInvoiceModal, paymentForm, setPaymentForm, paymentItems, setPaymentItems, bankAccounts,
    successMsg, setSuccessMsg, errorMsg, setErrorMsg,
    loadData, handleOpenPayInvoice, handlePayInvoiceSubmit, handleCreateOrderSubmit, handleOpenReceiveModal,
    handleReceiveOrderSubmit, handleCreateSupplierInvoiceSubmit, handleProviderSubmit, handleOpenAccountSummary, handleDeleteProvider, handleDeleteInvoice,
  };
}
