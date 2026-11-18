import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { computeSupplierInvoicesMetrics } from './providersHelpers';

export const INITIAL_SUPPLIER_FORM = () => ({
  personaId: '', invoiceNumber: '', invoiceType: 'FACTURA_A',
  issueDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
  netAmount: '', taxAmount: '', percepcionAmount: '', percepcionPampa: '', percepcionBsAs: '',
  percepcionIva: '', percepcionIva5329: '', impuestosInternos: '', totalAmount: '', billingType: 'OFFICIAL',
});

export function useComprasController(
  activeSubTab: string,
  refreshKey?: number,
  onProvidersChanged?: () => void,
) {
  const confirm = useConfirm();
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [allProviders, setAllProviders] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [supplierInvoices, setSupplierInvoices] = useState<any[]>([]);

  const [supplierQuery, setSupplierQuery] = useState('');
  const [supplierStartDate, setSupplierStartDate] = useState('');
  const [supplierEndDate, setSupplierEndDate] = useState('');
  const [branchFilter, setBranchFilter] = useState<'ALL' | 'OFFICIAL' | 'INTERNAL'>('ALL');
  const [providerSearch, setProviderSearch] = useState('');

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showReceiveModal, setShowReceiveModal] = useState<any | null>(null);
  const [viewDetailsModal, setViewDetailsModal] = useState<any | null>(null);
  const [scannerFile, setScannerFile] = useState<File | null>(null);
  const [showScannerModal, setShowScannerModal] = useState(false);

  const [selectedProviderId, setSelectedProviderId] = useState('');
  const [cart, setCart] = useState<{ productId: number; name: string; sku: string; quantity: number; costPrice: number }[]>([]);
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [lotAssignments, setLotAssignments] = useState<Record<number, { lotNumber: string; expirationDate: string }>>({});

  const [showSupplierModal, setShowSupplierModal] = useState(false);
  const [supplierForm, setSupplierForm] = useState(INITIAL_SUPPLIER_FORM);

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
      const [orders, personas, allProducts] = await Promise.all([
        api.getPurchaseOrders(),
        api.getPersonas('provider', ''),
        api.getProducts(''),
      ]);
      setPurchaseOrders(orders || []);
      setAllProviders(personas || []);
      setProducts(allProducts || []);
    } catch { setErrorMsg('Error al cargar datos del módulo de compras.'); }
  }, []);

  const loadSupplierInvoices = useCallback(async () => {
    try {
      const invoices = await api.getSupplierInvoices({ startDate: supplierStartDate, endDate: supplierEndDate, query: supplierQuery });
      setSupplierInvoices(invoices || []);
    } catch { setErrorMsg('Error al cargar facturas de compra.'); }
  }, [supplierStartDate, supplierEndDate, supplierQuery]);

  const loadData = useCallback(() => {
    void loadMasterData();
    void loadSupplierInvoices();
  }, [loadMasterData, loadSupplierInvoices]);

  useEffect(() => { void loadMasterData(); }, [loadMasterData, refreshKey]);
  useEffect(() => {
    const timer = setTimeout(() => { void loadSupplierInvoices(); }, supplierQuery ? 250 : 0);
    return () => clearTimeout(timer);
  }, [loadSupplierInvoices, supplierQuery, refreshKey]);
  useEffect(() => { setSuccessMsg(null); setErrorMsg(null); }, [activeSubTab]);

  const providers = useMemo(() => allProviders.filter((p) => p.isActive !== false), [allProviders]);
  const filteredInvoices = useMemo(
    () => supplierInvoices.filter((inv) => branchFilter === 'ALL' || inv.billingType === branchFilter),
    [supplierInvoices, branchFilter],
  );
  const supplierMetrics = useMemo(() => computeSupplierInvoicesMetrics(filteredInvoices), [filteredInvoices]);

  const autoCalculatedTotal = useMemo(() => {
    const sum = (Number(supplierForm.netAmount) || 0) + (Number(supplierForm.taxAmount) || 0) + (Number(supplierForm.percepcionPampa) || 0) + (Number(supplierForm.percepcionBsAs) || 0) + (Number(supplierForm.percepcionIva) || 0) + (Number(supplierForm.percepcionIva5329) || 0) + (Number(supplierForm.impuestosInternos) || 0);
    return sum.toFixed(2);
  }, [supplierForm.netAmount, supplierForm.taxAmount, supplierForm.percepcionPampa, supplierForm.percepcionBsAs, supplierForm.percepcionIva, supplierForm.percepcionIva5329, supplierForm.impuestosInternos]);

  useEffect(() => {
    setSupplierForm((prev) => (prev.totalAmount === autoCalculatedTotal ? prev : { ...prev, totalAmount: autoCalculatedTotal }));
  }, [autoCalculatedTotal]);

  const handleOpenPayInvoice = async (inv: any) => {
    setErrorMsg(null);
    const pendingAmount = Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0);
    const initialAmt = pendingAmount > 0 ? pendingAmount.toFixed(2) : Number(inv.totalAmount || 0).toFixed(2);
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
      if (validItems.length > 1) {
        await api.registerPayment(inv.personaId, { payments: validItems, description: paymentForm.description, branch: paymentForm.branch, supplierInvoiceId: inv.id });
      } else {
        await api.registerPayment(inv.personaId, { amount: validItems[0].amount, paymentMethod: validItems[0].paymentMethod, bankAccountId: validItems[0].bankAccountId, description: paymentForm.description, branch: paymentForm.branch, supplierInvoiceId: inv.id });
      }
      setErrorMsg(null); setSuccessMsg(`Pago registrado para factura ${inv.invoiceNumber}.`);
      setPayInvoiceModal({ open: false, invoice: null }); loadData(); onProvidersChanged?.();
    } catch (err: any) { setErrorMsg(err.message || 'Error al registrar pago.'); }
  };

  const handleCreateOrderSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProviderId || cart.length === 0) return setErrorMsg('Seleccione proveedor y agregue artículos.');
    try {
      await api.createPurchaseOrder({ personaId: Number(selectedProviderId), items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, costPrice: i.costPrice })) });
      setErrorMsg(null); setSuccessMsg('Orden de compra creada.');
      setShowCreateModal(false); setSelectedProviderId(''); setCart([]); loadData();
    } catch (err: any) { setErrorMsg(err.message || 'Error al guardar orden de compra.'); }
  };

  const handleOpenReceiveModal = (order: any) => {
    setErrorMsg(null); setInvoiceNumber('');
    const initial: Record<number, { lotNumber: string; expirationDate: string }> = {};
    order.items.forEach((item: any) => { initial[item.productId] = { lotNumber: `LOTE-PO-${order.id}`, expirationDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0] }; });
    setLotAssignments(initial); setShowReceiveModal(order);
  };

  const handleReceiveOrderSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!showReceiveModal) return;
    try {
      await api.receivePurchaseOrder(showReceiveModal.id, { invoiceNumber, lotAssignments });
      setErrorMsg(null); setSuccessMsg(`Orden de compra #${showReceiveModal.id} recibida.`);
      setShowReceiveModal(null); loadData(); onProvidersChanged?.();
    } catch (err: any) { setErrorMsg(err.message || 'Error al procesar recepción.'); }
  };

  const handleCreateSupplierInvoiceSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const f = supplierForm;
    if (!f.personaId || !f.invoiceNumber || !f.netAmount || !f.totalAmount) return setErrorMsg('Complete los campos obligatorios.');
    try {
      await api.createSupplierInvoice({
        personaId: Number(f.personaId), invoiceNumber: f.invoiceNumber, invoiceType: f.invoiceType,
        issueDate: new Date(f.issueDate).toISOString(), dueDate: new Date(f.dueDate).toISOString(),
        netAmount: Number(f.netAmount), taxAmount: Number(f.taxAmount || 0),
        percepcionAmount: Number(f.percepcionPampa || 0) + Number(f.percepcionBsAs || 0),
        percepcionPampa: Number(f.percepcionPampa || 0), percepcionBsAs: Number(f.percepcionBsAs || 0),
        percepcionIva: Number(f.percepcionIva || 0), impuestosInternos: Number(f.impuestosInternos || 0),
        totalAmount: Number(f.totalAmount), billingType: f.billingType || 'OFFICIAL',
      });
      setErrorMsg(null); setSuccessMsg('Factura de compra registrada.');
      setShowSupplierModal(false); loadData(); onProvidersChanged?.();
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
      if (providerModal.mode === 'create') await api.createPersona(payload);
      else await api.updatePersona(d.id, payload);
      setErrorMsg(null); setProviderModal(null); setSuccessMsg('Proveedor guardado.');
      void loadMasterData(); onProvidersChanged?.();
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
    try {
      await api.deletePersona(id);
      setErrorMsg(null); setSuccessMsg(`Proveedor ${name} eliminado.`); void loadMasterData(); onProvidersChanged?.();
    } catch (err: any) { setErrorMsg(err?.message || 'No se pudo eliminar el proveedor.'); }
  };

  const handleDeleteInvoice = async (id: number, num: string) => {
    if (!(await confirm(`¿Anular factura ${num}?`, { type: 'danger' }))) return;
    try {
      await api.deleteSupplierInvoice(id);
      setErrorMsg(null); setSuccessMsg(`Factura ${num} anulada.`); loadData(); onProvidersChanged?.();
    } catch (err: any) { setErrorMsg(err?.message || 'No se pudo anular la factura.'); }
  };

  return {
    purchaseOrders, allProviders, providers, products, filteredInvoices, supplierMetrics, autoCalculatedTotal,
    supplierQuery, setSupplierQuery, supplierStartDate, setSupplierStartDate, supplierEndDate, setSupplierEndDate,
    branchFilter, setBranchFilter, providerSearch, setProviderSearch,
    showCreateModal, setShowCreateModal, showReceiveModal, setShowReceiveModal, viewDetailsModal, setViewDetailsModal,
    scannerFile, setScannerFile, showScannerModal, setShowScannerModal,
    selectedProviderId, setSelectedProviderId, cart, setCart, invoiceNumber, setInvoiceNumber,
    lotAssignments, setLotAssignments, showSupplierModal, setShowSupplierModal, supplierForm, setSupplierForm,
    providerModal, setProviderModal, savingProvider, accountSummaryModal, setAccountSummaryModal,
    ledgerData, summaryLoading, summaryError, payInvoiceModal, setPayInvoiceModal,
    paymentForm, setPaymentForm, paymentItems, setPaymentItems, bankAccounts,
    successMsg, setSuccessMsg, errorMsg, setErrorMsg,
    loadData, handleOpenPayInvoice, handlePayInvoiceSubmit, handleCreateOrderSubmit,
    handleOpenReceiveModal, handleReceiveOrderSubmit, handleCreateSupplierInvoiceSubmit,
    handleProviderSubmit, handleOpenAccountSummary, handleDeleteProvider, handleDeleteInvoice,
  };
}
