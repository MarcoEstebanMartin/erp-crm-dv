import { useState, useEffect, useMemo, useRef, type FormEvent, type KeyboardEvent } from 'react';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { api } from '../utils/api';
import { PurchaseScannerModal } from './PurchaseScannerModal';
import { useConfirm } from '../context/ConfirmContext';
import { ComprasOrdenesRecepcionesTabs } from './compras/ComprasOrdenesRecepcionesTabs';
import { ComprasFacturasTab, ComprasProveedoresTab } from './compras/ComprasFacturasProveedoresTabs';
import { ComprasCreateReceiveModals } from './compras/ComprasCreateReceiveModals';
import { ComprasSupplierInvoiceAndPayModals } from './compras/ComprasSupplierInvoiceAndPayModals';
import { ComprasProviderModals } from './compras/ComprasProviderModals';

export type ComprasSubTab = 'proveedores' | 'facturas' | 'ordenes' | 'recepciones';

const SUB_TABS: Array<{ id: ComprasSubTab; label: string }> = [
  { id: 'proveedores', label: 'Proveedores' },
  { id: 'facturas', label: 'Facturas de Compra' },
  { id: 'ordenes', label: 'Órdenes de Compra' },
  { id: 'recepciones', label: 'Recepciones' },
];

export interface ComprasDashboardProps {
  initialSubTab?: ComprasSubTab;
  refreshKey?: number;
  onProvidersChanged?: () => void;
}

const INITIAL_SUPPLIER_FORM = () => ({
  personaId: '', invoiceNumber: '', invoiceType: 'FACTURA_A',
  issueDate: new Date().toISOString().split('T')[0],
  dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
  netAmount: '', taxAmount: '', percepcionAmount: '', percepcionPampa: '', percepcionBsAs: '',
  percepcionIva: '', percepcionIva5329: '', impuestosInternos: '', totalAmount: '', billingType: 'OFFICIAL',
});

export default function ComprasDashboard({
  initialSubTab = 'proveedores',
  refreshKey,
  onProvidersChanged,
}: ComprasDashboardProps = {}) {
  const currentUser = api.getCurrentUser();
  const isAdmin = currentUser?.role === 'ADMIN';
  const confirm = useConfirm();
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const [activeSubTab, setActiveSubTab] = useState<ComprasSubTab>(initialSubTab);
  const [purchaseOrders, setPurchaseOrders] = useState<any[]>([]);
  const [providers, setProviders] = useState<any[]>([]);
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
  const [accountSummaryModal, setAccountSummaryModal] = useState<any | null>(null);
  const [ledgerData, setLedgerData] = useState<any[]>([]);

  const [payInvoiceModal, setPayInvoiceModal] = useState<{ open: boolean; invoice: any | null }>({ open: false, invoice: null });
  const [paymentForm, setPaymentForm] = useState({ amount: '', paymentMethod: 'CASH', bankAccountId: '', branch: 'A', description: '' });
  const [paymentItems, setPaymentItems] = useState<Array<{ amount: string; paymentMethod: string; bankAccountId: string }>>([{ amount: '', paymentMethod: 'CASH', bankAccountId: '' }]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const loadData = async () => {
    try {
      const [orders, personas, allProducts, invoices] = await Promise.all([
        api.getPurchaseOrders(),
        api.getPersonas('provider', ''),
        api.getProducts(''),
        api.getSupplierInvoices({ startDate: supplierStartDate, endDate: supplierEndDate, query: supplierQuery }),
      ]);
      setPurchaseOrders(orders);
      setProviders(personas.filter((p: any) => p.isActive !== false));
      setProducts(allProducts);
      setSupplierInvoices(invoices);
    } catch { setErrorMsg('Error al cargar datos del módulo de compras.'); }
  };

  useEffect(() => { loadData(); }, [supplierStartDate, supplierEndDate, supplierQuery, refreshKey]);
  useEffect(() => { setSuccessMsg(null); setErrorMsg(null); }, [activeSubTab]);

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % SUB_TABS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + SUB_TABS.length) % SUB_TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = SUB_TABS.length - 1;
    else return;
    e.preventDefault();
    setActiveSubTab(SUB_TABS[nextIdx].id);
    tabRefs.current[nextIdx]?.focus();
    tabRefs.current[nextIdx]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  };

  const filteredInvoices = supplierInvoices.filter((inv) => branchFilter === 'ALL' || inv.billingType === branchFilter);
  const filteredProviders = useMemo(() => {
    if (!providerSearch) return providers;
    const q = providerSearch.toLowerCase();
    return providers.filter((p) => p.name.toLowerCase().includes(q) || (p.cuit && p.cuit.includes(q)));
  }, [providerSearch, providers]);

  const supplierMetrics = useMemo(() => {
    let totalDeuda = 0, vencidasCount = 0, totalVencidas = 0, proximasCount = 0, totalProximas = 0;
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const in7Days = new Date(); in7Days.setDate(today.getDate() + 7); in7Days.setHours(23, 59, 59, 999);
    filteredInvoices.forEach((inv) => {
      if (inv.status === 'PAID') return;
      const pending = Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0);
      totalDeuda += pending;
      if (inv.dueDate) {
        const due = new Date(inv.dueDate);
        if (due < today) { vencidasCount++; totalVencidas += pending; }
        else if (due >= today && due <= in7Days) { proximasCount++; totalProximas += pending; }
      }
    });
    return { totalDeuda, vencidasCount, totalVencidas, proximasCount, totalProximas };
  }, [filteredInvoices]);

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
      setErrorMsg(null);
      setSuccessMsg(`Pago registrado para factura ${inv.invoiceNumber}.`);
      setPayInvoiceModal({ open: false, invoice: null });
      loadData();
      onProvidersChanged?.();
    } catch (err: any) { setErrorMsg(err.message || 'Error al registrar pago.'); }
  };

  const handleCreateOrderSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!selectedProviderId || cart.length === 0) return setErrorMsg('Seleccione proveedor y agregue artículos.');
    try {
      await api.createPurchaseOrder({ personaId: Number(selectedProviderId), items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, costPrice: i.costPrice })) });
      setErrorMsg(null);
      setSuccessMsg('Orden de compra creada.');
      setShowCreateModal(false); setSelectedProviderId(''); setCart([]); loadData();
    } catch (err: any) { setErrorMsg(err.message || 'Error al guardar orden de compra.'); }
  };

  const handleOpenReceiveModal = (order: any) => {
    setErrorMsg(null);
    setInvoiceNumber('');
    const initial: Record<number, { lotNumber: string; expirationDate: string }> = {};
    order.items.forEach((item: any) => { initial[item.productId] = { lotNumber: `LOTE-PO-${order.id}`, expirationDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0] }; });
    setLotAssignments(initial);
    setShowReceiveModal(order);
  };

  const handleReceiveOrderSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!showReceiveModal) return;
    try {
      await api.receivePurchaseOrder(showReceiveModal.id, { invoiceNumber, lotAssignments });
      setErrorMsg(null);
      setSuccessMsg(`Orden de compra #${showReceiveModal.id} recibida.`);
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
      setErrorMsg(null);
      setSuccessMsg('Factura de compra registrada.');
      setShowSupplierModal(false); loadData(); onProvidersChanged?.();
    } catch (err: any) { setErrorMsg(err.message || 'Error al guardar factura.'); }
  };

  const handleProviderSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!providerModal?.data.name) return setErrorMsg('El nombre es obligatorio.');
    try {
      const d = providerModal.data;
      const payload = providerModal.mode === 'create'
        ? { ...d, isClient: false, isProvider: true, isSeller: false, isCommissionAgent: false }
        : { ...d, isClient: Boolean(d.isClient), isProvider: true, isSeller: Boolean(d.isSeller), isCommissionAgent: Boolean(d.isCommissionAgent) };
      if (providerModal.mode === 'create') await api.createPersona(payload);
      else await api.updatePersona(d.id, payload);
      setErrorMsg(null);
      setProviderModal(null); setSuccessMsg('Proveedor guardado.'); loadData(); onProvidersChanged?.();
    } catch (err: any) { setErrorMsg(err.message || 'Error al guardar proveedor.'); }
  };

  const hasFormModalOpen = showCreateModal || Boolean(showReceiveModal) || showSupplierModal || payInvoiceModal.open || Boolean(providerModal?.open);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {successMsg && (
        <div role="status" className="alert alert-success" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><CheckCircle size={16} aria-hidden="true" />{successMsg}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setSuccessMsg(null)} aria-label="Cerrar notificación"><X size={15} aria-hidden="true" /></button>
        </div>
      )}
      {errorMsg && !hasFormModalOpen && (
        <div role="alert" className="alert alert-danger" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', margin: 0 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}><AlertTriangle size={16} aria-hidden="true" />{errorMsg}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={() => setErrorMsg(null)} aria-label="Cerrar alerta"><X size={15} aria-hidden="true" /></button>
        </div>
      )}

      <div role="tablist" aria-label="Secciones de Compras" className="linear-tablist">
        {SUB_TABS.map((tab, idx) => {
          const isActive = activeSubTab === tab.id;
          return (
            <button
              key={tab.id} ref={(el) => { tabRefs.current[idx] = el; }} id={`compras-tab-${tab.id}`}
              type="button" role="tab" aria-selected={isActive} tabIndex={isActive ? 0 : -1} className="linear-tab"
              onClick={() => { setActiveSubTab(tab.id); tabRefs.current[idx]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' }); }}
              onKeyDown={(e) => handleTabKeyDown(e, idx)}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-labelledby={`compras-tab-${activeSubTab}`}>
        {(activeSubTab === 'ordenes' || activeSubTab === 'recepciones') && (
          <ComprasOrdenesRecepcionesTabs
            activeSubTab={activeSubTab} purchaseOrders={purchaseOrders}
            onOpenCreateModal={() => { setErrorMsg(null); setShowCreateModal(true); }}
            onOpenReceiveModal={handleOpenReceiveModal}
            onViewDetailsModal={setViewDetailsModal}
            onSelectScannerFile={(file) => { setScannerFile(file); setShowScannerModal(true); }}
          />
        )}

        {activeSubTab === 'facturas' && (
          <ComprasFacturasTab
            isAdmin={isAdmin} supplierMetrics={supplierMetrics} filteredInvoices={filteredInvoices}
            supplierQuery={supplierQuery} setSupplierQuery={setSupplierQuery}
            supplierStartDate={supplierStartDate} setSupplierStartDate={setSupplierStartDate}
            supplierEndDate={supplierEndDate} setSupplierEndDate={setSupplierEndDate}
            branchFilter={branchFilter} setBranchFilter={setBranchFilter}
            onOpenSupplierModal={() => { setErrorMsg(null); setShowSupplierModal(true); }}
            onOpenPayInvoice={handleOpenPayInvoice}
            onDeleteInvoice={async (id, num) => { if (await confirm(`¿Anular factura ${num}?`, { type: 'danger' })) { await api.deleteSupplierInvoice(id); loadData(); onProvidersChanged?.(); } }}
          />
        )}

        {activeSubTab === 'proveedores' && (
          <ComprasProveedoresTab
            isAdmin={isAdmin} filteredProviders={filteredProviders} providerSearch={providerSearch} setProviderSearch={setProviderSearch}
            onOpenCreateProvider={() => { setErrorMsg(null); setProviderModal({ open: true, mode: 'create', data: { id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', paymentTermDays: 30, rubro: '', contacts: [] } }); }}
            onOpenAccountSummary={async (p) => { const res = await api.getPersonaLedger(p.id); setAccountSummaryModal(p); setLedgerData(res.ledger || []); }}
            onOpenEditProvider={(p) => { setErrorMsg(null); setProviderModal({ open: true, mode: 'edit', data: { ...p, rubro: p.rubro || '', contacts: Array.isArray(p.contacts) ? p.contacts : [] } }); }}
            onDeleteProvider={async (id, name) => { if (await confirm(`¿Eliminar proveedor ${name}?`, { type: 'danger' })) { await api.deletePersona(id); loadData(); onProvidersChanged?.(); } }}
          />
        )}
      </div>

      <ComprasCreateReceiveModals
        showCreateModal={showCreateModal} setShowCreateModal={setShowCreateModal} providers={providers} products={products}
        selectedProviderId={selectedProviderId} setSelectedProviderId={setSelectedProviderId} cart={cart} setCart={setCart} onCreateSubmit={handleCreateOrderSubmit}
        showReceiveModal={showReceiveModal} setShowReceiveModal={setShowReceiveModal} invoiceNumber={invoiceNumber} setInvoiceNumber={setInvoiceNumber}
        lotAssignments={lotAssignments} onLotAssignmentChange={(pid, f, v) => setLotAssignments((prev) => ({ ...prev, [pid]: { ...prev[pid], [f]: v } }))}
        onReceiveSubmit={handleReceiveOrderSubmit} viewDetailsModal={viewDetailsModal} setViewDetailsModal={setViewDetailsModal}
        errorMsg={errorMsg} setErrorMsg={setErrorMsg}
      />

      <ComprasSupplierInvoiceAndPayModals
        showSupplierModal={showSupplierModal} setShowSupplierModal={setShowSupplierModal} providers={providers}
        supplierForm={supplierForm} setSupplierForm={setSupplierForm} autoCalculatedTotal={autoCalculatedTotal}
        onNetChange={(val) => setSupplierForm((prev) => ({ ...prev, netAmount: val, taxAmount: ((Number(val) || 0) * 0.21).toFixed(2) }))}
        onSupplierInvoiceSubmit={handleCreateSupplierInvoiceSubmit}
        payInvoiceModal={payInvoiceModal} setPayInvoiceModal={setPayInvoiceModal}
        paymentForm={paymentForm} setPaymentForm={setPaymentForm} paymentItems={paymentItems} setPaymentItems={setPaymentItems}
        bankAccounts={bankAccounts} onPayInvoiceSubmit={handlePayInvoiceSubmit}
        errorMsg={errorMsg} setErrorMsg={setErrorMsg}
      />

      <ComprasProviderModals
        providerModal={providerModal} setProviderModal={setProviderModal} onProviderSubmit={handleProviderSubmit}
        accountSummaryModal={accountSummaryModal} setAccountSummaryModal={setAccountSummaryModal} ledgerData={ledgerData}
        errorMsg={errorMsg} setErrorMsg={setErrorMsg}
      />

      <PurchaseScannerModal
        isOpen={showScannerModal} onClose={() => setShowScannerModal(false)} file={scannerFile}
        onSuccess={() => { setSuccessMsg('Documento procesado.'); loadData(); onProvidersChanged?.(); }}
      />
    </div>
  );
}
