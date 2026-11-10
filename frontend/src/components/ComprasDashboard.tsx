import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { PurchaseScannerModal } from './PurchaseScannerModal';
import { useConfirm } from '../context/ConfirmContext';
import { ComprasOrdenesRecepcionesTabs } from './compras/ComprasOrdenesRecepcionesTabs';
import { ComprasFacturasTab, ComprasProveedoresTab } from './compras/ComprasFacturasProveedoresTabs';
import { ComprasCreateReceiveModals } from './compras/ComprasCreateReceiveModals';
import { ComprasSupplierInvoiceAndPayModals } from './compras/ComprasSupplierInvoiceAndPayModals';
import { ComprasProviderModals } from './compras/ComprasProviderModals';

export default function ComprasDashboard() {
  const currentUser = api.getCurrentUser();
  const isAdmin = currentUser?.role === 'ADMIN';
  const confirm = useConfirm();

  const [activeSubTab, setActiveSubTab] = useState<'ordenes' | 'recepciones' | 'facturas' | 'proveedores'>('ordenes');
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
  const [supplierForm, setSupplierForm] = useState({
    personaId: '', invoiceNumber: '', invoiceType: 'FACTURA_A',
    issueDate: new Date().toISOString().split('T')[0],
    dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
    netAmount: '', taxAmount: '', percepcionAmount: '', percepcionPampa: '', percepcionBsAs: '',
    percepcionIva: '', percepcionIva5329: '', impuestosInternos: '', totalAmount: '', billingType: 'OFFICIAL',
  });

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

  useEffect(() => { loadData(); }, [supplierStartDate, supplierEndDate, supplierQuery]);
  useEffect(() => { setSuccessMsg(null); setErrorMsg(null); }, [activeSubTab]);

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
    const pendingAmount = Number(inv.totalAmount || 0) - Number(inv.paidAmount || 0);
    const initialAmt = pendingAmount > 0 ? pendingAmount.toFixed(2) : Number(inv.totalAmount || 0).toFixed(2);
    setPaymentForm({ amount: initialAmt, paymentMethod: 'CASH', bankAccountId: '', branch: inv.billingType === 'OFFICIAL' ? 'A' : 'X', description: `Pago Factura ${inv.invoiceNumber}` });
    setPaymentItems([{ amount: initialAmt, paymentMethod: 'CASH', bankAccountId: '' }]);
    setPayInvoiceModal({ open: true, invoice: inv });
    try { setBankAccounts((await api.getBankAccounts()) || []); } catch {}
  };

  const handlePayInvoiceSubmit = async (e: React.FormEvent) => {
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
      setSuccessMsg(`✅ Pago registrado para factura ${inv.invoiceNumber}.`);
      setPayInvoiceModal({ open: false, invoice: null });
      loadData();
    } catch (err: any) { setErrorMsg(err.message || 'Error al registrar pago.'); }
  };

  const handleCreateOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProviderId || cart.length === 0) return setErrorMsg('Seleccione proveedor y agregue artículos.');
    try {
      await api.createPurchaseOrder({ personaId: Number(selectedProviderId), items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, costPrice: i.costPrice })) });
      setSuccessMsg('✨ Orden de compra creada con éxito.');
      setShowCreateModal(false); setSelectedProviderId(''); setCart([]); loadData();
    } catch (err: any) { setErrorMsg(err.message || 'Error al guardar orden de compra.'); }
  };

  const handleOpenReceiveModal = (order: any) => {
    setInvoiceNumber('');
    const initial: Record<number, { lotNumber: string; expirationDate: string }> = {};
    order.items.forEach((item: any) => { initial[item.productId] = { lotNumber: `LOTE-PO-${order.id}`, expirationDate: new Date(Date.now() + 180 * 24 * 3600 * 1000).toISOString().split('T')[0] }; });
    setLotAssignments(initial);
    setShowReceiveModal(order);
  };

  const handleReceiveOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!showReceiveModal) return;
    try {
      await api.receivePurchaseOrder(showReceiveModal.id, { invoiceNumber, lotAssignments });
      setSuccessMsg(`✨ Orden de compra #${showReceiveModal.id} recibida e ingresada al depósito.`);
      setShowReceiveModal(null); loadData();
    } catch (err: any) { setErrorMsg(err.message || 'Error al procesar recepción.'); }
  };

  const handleCreateSupplierInvoiceSubmit = async (e: React.FormEvent) => {
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
      setSuccessMsg('✅ Factura de compra registrada con éxito.');
      setShowSupplierModal(false); loadData();
    } catch (err: any) { setErrorMsg(err.message || 'Error al guardar factura.'); }
  };

  const handleProviderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!providerModal?.data.name) return setErrorMsg('El nombre es obligatorio.');
    try {
      const payload = { ...providerModal.data, isClient: false, isProvider: true, isSeller: false, isCommissionAgent: false };
      if (providerModal.mode === 'create') await api.createPersona(payload);
      else await api.updatePersona(providerModal.data.id, payload);
      setProviderModal(null); setSuccessMsg('✨ Proveedor guardado.'); loadData();
    } catch (err: any) { setErrorMsg(err.message || 'Error al guardar proveedor.'); }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      {successMsg && <div className="alert alert-success" onClick={() => setSuccessMsg(null)}>{successMsg}</div>}
      {errorMsg && <div className="alert alert-danger" onClick={() => setErrorMsg(null)}>{errorMsg}</div>}

      <div style={{ display: 'flex', gap: '4px', backgroundColor: '#EAEAEA', padding: '4px', borderRadius: '8px', width: 'fit-content', flexWrap: 'wrap' }}>
        {[
          { id: 'ordenes', label: '📋 Órdenes de Compra' },
          { id: 'recepciones', label: '📦 Recepción e Ingresos' },
          { id: 'facturas', label: '📥 Facturas de Compra' },
          { id: 'proveedores', label: '👥 Fichero de Proveedores' },
        ].map((tab) => (
          <button key={tab.id} className="btn" onClick={() => setActiveSubTab(tab.id as any)} style={{ padding: '6px 14px', fontSize: '0.82rem', fontWeight: 600, backgroundColor: activeSubTab === tab.id ? '#FFFFFF' : 'transparent', color: activeSubTab === tab.id ? '#1C1C1E' : '#5E5E62', border: 'none', borderRadius: '6px', cursor: 'pointer' }}>
            {tab.label}
          </button>
        ))}
      </div>

      {(activeSubTab === 'ordenes' || activeSubTab === 'recepciones') && (
        <ComprasOrdenesRecepcionesTabs
          activeSubTab={activeSubTab} purchaseOrders={purchaseOrders}
          onOpenCreateModal={() => setShowCreateModal(true)} onOpenReceiveModal={handleOpenReceiveModal}
          onViewDetailsModal={setViewDetailsModal} onSelectScannerFile={(file) => { setScannerFile(file); setShowScannerModal(true); }}
        />
      )}

      {activeSubTab === 'facturas' && (
        <ComprasFacturasTab
          isAdmin={isAdmin} supplierMetrics={supplierMetrics} filteredInvoices={filteredInvoices}
          supplierQuery={supplierQuery} setSupplierQuery={setSupplierQuery}
          supplierStartDate={supplierStartDate} setSupplierStartDate={setSupplierStartDate}
          supplierEndDate={supplierEndDate} setSupplierEndDate={setSupplierEndDate}
          branchFilter={branchFilter} setBranchFilter={setBranchFilter}
          onOpenSupplierModal={() => setShowSupplierModal(true)} onOpenPayInvoice={handleOpenPayInvoice}
          onDeleteInvoice={async (id, num) => { if (await confirm(`¿Anular factura ${num}?`, { type: 'danger' })) { await api.deleteSupplierInvoice(id); loadData(); } }}
        />
      )}

      {activeSubTab === 'proveedores' && (
        <ComprasProveedoresTab
          isAdmin={isAdmin} filteredProviders={filteredProviders} providerSearch={providerSearch} setProviderSearch={setProviderSearch}
          onOpenCreateProvider={() => setProviderModal({ open: true, mode: 'create', data: { id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', paymentTermDays: 30, rubro: '', contacts: [] } })}
          onOpenAccountSummary={async (p) => { const res = await api.getPersonaLedger(p.id); setAccountSummaryModal(p); setLedgerData(res.ledger || []); }}
          onOpenEditProvider={(p) => setProviderModal({ open: true, mode: 'edit', data: { ...p, rubro: p.rubro || '', contacts: Array.isArray(p.contacts) ? p.contacts : [] } })}
          onDeleteProvider={async (id, name) => { if (await confirm(`¿Eliminar proveedor ${name}?`, { type: 'danger' })) { await api.deletePersona(id); loadData(); } }}
        />
      )}

      <ComprasCreateReceiveModals
        showCreateModal={showCreateModal} setShowCreateModal={setShowCreateModal} providers={providers} products={products}
        selectedProviderId={selectedProviderId} setSelectedProviderId={setSelectedProviderId} cart={cart} setCart={setCart} onCreateSubmit={handleCreateOrderSubmit}
        showReceiveModal={showReceiveModal} setShowReceiveModal={setShowReceiveModal} invoiceNumber={invoiceNumber} setInvoiceNumber={setInvoiceNumber}
        lotAssignments={lotAssignments} onLotAssignmentChange={(pid, f, v) => setLotAssignments((prev) => ({ ...prev, [pid]: { ...prev[pid], [f]: v } }))}
        onReceiveSubmit={handleReceiveOrderSubmit} viewDetailsModal={viewDetailsModal} setViewDetailsModal={setViewDetailsModal}
      />

      <ComprasSupplierInvoiceAndPayModals
        showSupplierModal={showSupplierModal} setShowSupplierModal={setShowSupplierModal} providers={providers}
        supplierForm={supplierForm} setSupplierForm={setSupplierForm} autoCalculatedTotal={autoCalculatedTotal}
        onNetChange={(val) => setSupplierForm((prev) => ({ ...prev, netAmount: val, taxAmount: ((Number(val) || 0) * 0.21).toFixed(2) }))}
        onSupplierInvoiceSubmit={handleCreateSupplierInvoiceSubmit}
        payInvoiceModal={payInvoiceModal} setPayInvoiceModal={setPayInvoiceModal}
        paymentForm={paymentForm} setPaymentForm={setPaymentForm} paymentItems={paymentItems} setPaymentItems={setPaymentItems}
        bankAccounts={bankAccounts} onPayInvoiceSubmit={handlePayInvoiceSubmit}
      />

      <ComprasProviderModals
        providerModal={providerModal} setProviderModal={setProviderModal} onProviderSubmit={handleProviderSubmit}
        accountSummaryModal={accountSummaryModal} setAccountSummaryModal={setAccountSummaryModal} ledgerData={ledgerData}
      />

      <PurchaseScannerModal
        isOpen={showScannerModal} onClose={() => setShowScannerModal(false)} file={scannerFile}
        onSuccess={() => { setSuccessMsg('✨ Documento procesado con éxito.'); loadData(); }}
      />
    </div>
  );
}
