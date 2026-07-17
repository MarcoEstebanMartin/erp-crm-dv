import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../utils/api';
import { Search, AlertTriangle, CheckCircle } from 'lucide-react';
import SalesBillingTab from './billing/SalesBillingTab';
import TaxWithholdingsTab from './billing/TaxWithholdingsTab';
import CreditNotesTab from './billing/CreditNotesTab';

interface BillingDashboardProps {
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export default function BillingDashboard({ activeTab: _activeTab, setActiveTab: _setActiveTab }: BillingDashboardProps) {
  // Sub-pestañas del módulo de facturación
  const [activeSubTab, setActiveSubTab] = useState<'ventas' | 'retenciones' | 'notas-credito'>('ventas');

  // Listas de datos
  const [salesInvoices, setSalesInvoices] = useState<any[]>([]);
  const [taxWithholdings, setTaxWithholdings] = useState<any[]>([]);
  const [personas, setPersonas] = useState<any[]>([]);
  const [products, setProducts] = useState<any[]>([]);
  const [creditNotes, setCreditNotes] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  const [activeDrawers, setActiveDrawers] = useState<any[]>([]);
  const [ivaPerceptionAliquot, setIvaPerceptionAliquot] = useState(3.00);

  // Filtros compartidos
  const [query, setQuery] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [salesInvoiceTypeFilter, setSalesInvoiceTypeFilter] = useState<'ALL' | 'OFFICIAL' | 'INTERNAL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<string>('ALL');

  // Mensajes de feedback
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Estados compartidos para Notas de Crédito (requeridos para crear NC desde una factura)
  const [showCreditNoteModal, setShowCreditNoteModal] = useState(false);
  const [viewCreditNoteModal, setViewCreditNoteModal] = useState<any | null>(null);
  const [cnClientSearchQuery, setCnClientSearchQuery] = useState('');
  const [creditNoteCart, setCreditNoteCart] = useState<any[]>([]);
  const [creditNoteForm, setCreditNoteForm] = useState({
    personaId: '',
    orderId: '',
    billingType: 'INTERNAL',
    reason: 'DEVOLUCION',
    comments: ''
  });

  // Cargar datos principales
  const loadData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Cargar personas para los selectores de los formularios (Clientes y Proveedores)
      const allPersonas = await api.getPersonas('ALL', '');
      setPersonas(allPersonas.filter((p: any) => p.isActive !== false));

      // Cargar productos para facturación directa
      const allProducts = await api.getProducts('');
      setProducts(allProducts);

      // Cargar alícuota de percepción de IVA activa
      try {
        const response = await api.getPerceptions();
        const pIva = response.perceptions?.find((p: any) => p.code === 'IVA_5329');
        if (pIva) {
          setIvaPerceptionAliquot(Number(pIva.aliquot));
        }
      } catch (e) {
        console.error('Error fetching perceptions rate', e);
      }

      // Cargar cajas operativas activas
      try {
        const activeList = await api.getActiveDrawers();
        setActiveDrawers(activeList || []);
      } catch (drawerErr) {
        setActiveDrawers([]);
      }

      // Cargar cuentas bancarias
      try {
        const banks = await api.getBankAccounts();
        setBankAccounts(banks || []);
      } catch (bankErr) {
        setBankAccounts([]);
      }

      // 2. Cargar datos según la sub-tab activa y los filtros aplicados
      const filters: any = {};
      if (startDate && endDate) {
        filters.startDate = startDate;
        filters.endDate = endDate;
      }
      if (query) {
        filters.query = query;
      }

      if (activeSubTab === 'ventas') {
        const data = await api.getSalesInvoices(filters);
        setSalesInvoices(data || []);
      } else if (activeSubTab === 'retenciones') {
        const data = await api.getTaxWithholdings(filters);
        // Filtrar retenciones sufridas y practicadas
        const retenciones = (data || []).filter((w: any) => w.type.startsWith('RETENCION_'));
        setTaxWithholdings(retenciones);
      } else if (activeSubTab === 'notas-credito') {
        const cnFilters = { ...filters };
        if (statusFilter !== 'ALL') {
          cnFilters.status = statusFilter;
        }
        const data = await api.getCreditNotes(cnFilters);
        setCreditNotes(data || []);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cargar los comprobantes e impuestos.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [activeSubTab, startDate, endDate, query, statusFilter]);

  // Limpiar mensajes al cambiar de pestaña
  useEffect(() => {
    setSuccessMsg(null);
    setErrorMsg(null);
  }, [activeSubTab]);

  // Limpiar filtros
  const handleClearFilters = () => {
    setQuery('');
    setStartDate('');
    setEndDate('');
    setSalesInvoiceTypeFilter('ALL');
    setStatusFilter('ALL');
  };

  // Callback para emitir Nota de Crédito desde una factura de venta
  const handleCreateCreditNoteFromInvoice = async (invoice: any) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    
    const pId = invoice.personaId || invoice.clientId;
    const client = personas.find((p: any) => p.id === Number(pId));
    if (!client) {
      setErrorMsg('No se encontró el cliente de la factura.');
      return;
    }

    setCnClientSearchQuery(client.name);
    
    try {
      setLoading(true);
      // Fetch para poblar el dropdown de órdenes del cliente en el modal
      const orders = await api.getOrders(undefined, 'DELIVERED');
      const filtered = orders.filter((o: any) => o.personaId === client.id || o.clientId === client.id);
      
      setCreditNoteForm({
        personaId: String(client.id),
        orderId: String(invoice.id),
        billingType: invoice.billingType || (client.cuit ? 'OFFICIAL' : 'INTERNAL'),
        reason: 'DEVOLUCION',
        comments: `Devolución de comprobante #${invoice.invoiceNumber || invoice.id}`
      });

      // Si la factura tiene items, los pre-cargamos para la devolución
      if (invoice.items && invoice.items.length > 0) {
        const itemsToDev = invoice.items.map((item: any) => {
          const prod = products.find(p => p.id === item.productId);
          const isPesable = prod ? prod.isPesable : (item.product ? item.product.isPesable : false);
          const approxWeight = prod ? prod.approximateWeight : (item.product ? item.product.approximateWeight : null);
          const qty = Number(item.quantity);
          const weight = isPesable ? (item.weight ? Number(item.weight) : qty * Number(approxWeight || 1)) : null;
          const unitPrice = Number(item.unitPrice);
          return {
            productId: item.productId,
            name: prod ? prod.name : (item.product ? item.product.name : `Producto #${item.productId}`),
            sku: prod ? prod.sku : (item.product ? item.product.sku : ''),
            orderQuantity: qty,
            orderWeight: weight,
            quantity: qty, // Devolución total por defecto
            weight: weight,
            isPesable,
            approximateWeight: approxWeight,
            unitPrice: unitPrice,
            subtotal: isPesable ? (weight ? weight * unitPrice : 0) : qty * unitPrice
          };
        });
        setCreditNoteCart(itemsToDev);
      } else {
        // Si no tiene precargados, buscar por orden asociada
        const matchedOrder = filtered.find((o: any) => o.id === invoice.id);
        if (matchedOrder && matchedOrder.items) {
          const itemsToDev = matchedOrder.items.map((item: any) => {
            const prod = products.find(p => p.id === item.productId);
            const isPesable = prod ? prod.isPesable : (item.product ? item.product.isPesable : false);
            const approxWeight = prod ? prod.approximateWeight : (item.product ? item.product.approximateWeight : null);
            const qty = Number(item.quantity);
            const weight = isPesable ? (item.weight ? Number(item.weight) : qty * Number(approxWeight || 1)) : null;
            const unitPrice = Number(item.unitPrice);
            return {
              productId: item.productId,
              name: prod ? prod.name : (item.product ? item.product.name : `Producto #${item.productId}`),
              sku: prod ? prod.sku : (item.product ? item.product.sku : ''),
              orderQuantity: qty,
              orderWeight: weight,
              quantity: qty,
              weight: weight,
              isPesable,
              approximateWeight: approxWeight,
              unitPrice: unitPrice,
              subtotal: isPesable ? (weight ? weight * unitPrice : 0) : qty * unitPrice
            };
          });
          setCreditNoteCart(itemsToDev);
        } else {
          setCreditNoteCart([]);
        }
      }
      
      // Cambiar a la pestaña de Notas de Crédito y abrir el modal
      setActiveSubTab('notas-credito');
      setShowCreditNoteModal(true);
    } catch (err: any) {
      console.error('Error al preparar nota de crédito desde factura:', err);
      setErrorMsg('Error al preparar nota de crédito: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Mensajes de Feedback con Micro-Animaciones */}
      {successMsg && (
        <div style={{
          backgroundColor: 'var(--color-success-bg)',
          borderLeft: '4px solid var(--color-success)',
          color: 'var(--text-primary)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.88rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'slideDown 0.3s ease'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <CheckCircle size={16} style={{ color: 'var(--color-success)' }} />
            {successMsg}
          </span>
          <button className="btn btn-ghost" style={{ padding: '2px', color: 'var(--text-secondary)' }} onClick={() => setSuccessMsg(null)}>✕</button>
        </div>
      )}

      {errorMsg && (
        <div style={{
          backgroundColor: '#FFF2F2',
          borderLeft: '4px solid var(--color-danger)',
          color: 'var(--text-primary)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '0.88rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          animation: 'slideDown 0.3s ease'
        }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertTriangle size={16} style={{ color: 'var(--color-danger)' }} />
            {errorMsg}
          </span>
          <button className="btn btn-ghost" style={{ padding: '2px', color: 'var(--text-secondary)' }} onClick={() => setErrorMsg(null)}>✕</button>
        </div>
      )}

      {/* Navegación de Sub-Módulos (Tabs) */}
      <div style={{
        display: 'flex',
        gap: '4px',
        backgroundColor: '#EAEAEA',
        padding: '4px',
        borderRadius: '8px',
        width: 'fit-content'
      }}>
        {(['ventas', 'notas-credito', 'retenciones'] as const).map((tab) => {
          const labels = {
            'ventas': 'Comprobantes Venta',
            'notas-credito': 'Notas de Crédito',
            'retenciones': 'Retenciones'
          };
          const isActive = activeSubTab === tab;
          return (
            <button
              key={tab}
              className="btn"
              onClick={() => setActiveSubTab(tab)}
              style={{
                padding: '6px 14px',
                fontSize: '0.82rem',
                fontWeight: 600,
                borderRadius: '6px',
                border: 'none',
                backgroundColor: isActive ? 'var(--bg-card)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                transition: 'var(--transition-fast)'
              }}
            >
              {labels[tab]}
            </button>
          );
        })}
      </div>

      {/* Barra de Filtros Generales */}
      <div className="card" style={{ padding: '16px' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
            
            <div style={{ flex: 1, minWidth: '200px', position: 'relative' }}>
              <Search size={16} style={{ position: 'absolute', left: '12px', top: '12px', color: 'var(--text-muted)' }} />
              <input
                type="text"
                className="input"
                placeholder="🔍 Buscar por comprobante, persona o CUIT..."
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                style={{ paddingLeft: '36px' }}
              />
            </div>

            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <input
                type="date"
                className="input"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{ width: '165px', fontSize: '0.85rem', height: '36px' }}
              />
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>a</span>
              <input
                type="date"
                className="input"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{ width: '165px', fontSize: '0.85rem', height: '36px' }}
              />
            </div>

            {(activeSubTab === 'ventas' || activeSubTab === 'notas-credito') && (
              <select
                className="input"
                value={salesInvoiceTypeFilter}
                onChange={(e) => setSalesInvoiceTypeFilter(e.target.value as any)}
                style={{ width: '240px', fontSize: '0.85rem', height: '36px', padding: '0 10px', lineHeight: 'normal', boxSizing: 'border-box' }}
              >
                <option value="ALL">Todas las Sucursales</option>
                <option value="OFFICIAL">Sucursal A (Oficial)</option>
                <option value="INTERNAL">Sucursal X (Interna)</option>
              </select>
            )}

            {activeSubTab === 'notas-credito' && (
              <select
                className="input"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                style={{ width: '220px', fontSize: '0.85rem', height: '36px', padding: '0 10px', lineHeight: 'normal', boxSizing: 'border-box' }}
              >
                <option value="ALL">Todos los Estados</option>
                <option value="PENDING_APPROVAL">Pendientes</option>
                <option value="APPROVED">Aprobadas</option>
                <option value="REJECTED">Rechazadas</option>
              </select>
            )}

            {(query || startDate || endDate || salesInvoiceTypeFilter !== 'ALL' || statusFilter !== 'ALL') && (
              <button className="btn btn-secondary" style={{ padding: '8px 12px', fontSize: '0.85rem' }} onClick={handleClearFilters}>
                Limpiar Filtros
              </button>
            )}
          </div>
        </div>

      {/* RENDER CONDICIONAL DE CADA TAB MODULARIZADA */}
      {activeSubTab === 'ventas' && (
        <SalesBillingTab
          salesInvoices={salesInvoices}
          personas={personas}
          products={products}
          bankAccounts={bankAccounts}
          activeDrawers={activeDrawers}
          loading={loading}
          loadData={loadData}
          setErrorMsg={setErrorMsg}
          setSuccessMsg={setSuccessMsg}
          handleCreateCreditNoteFromInvoice={handleCreateCreditNoteFromInvoice}
        />
      )}

      {activeSubTab === 'retenciones' && (
        <TaxWithholdingsTab
          taxWithholdings={taxWithholdings}
          personas={personas}
          loading={loading}
          loadData={loadData}
          setErrorMsg={setErrorMsg}
          setSuccessMsg={setSuccessMsg}
        />
      )}

      {activeSubTab === 'notas-credito' && (
        <CreditNotesTab
          creditNotes={creditNotes}
          personas={personas}
          products={products}
          loading={loading}
          loadData={loadData}
          setErrorMsg={setErrorMsg}
          setSuccessMsg={setSuccessMsg}
          showCreditNoteModal={showCreditNoteModal}
          setShowCreditNoteModal={setShowCreditNoteModal}
          creditNoteForm={creditNoteForm}
          setCreditNoteForm={setCreditNoteForm}
          creditNoteCart={creditNoteCart}
          setCreditNoteCart={setCreditNoteCart}
          cnClientSearchQuery={cnClientSearchQuery}
          setCnClientSearchQuery={setCnClientSearchQuery}
          viewCreditNoteModal={viewCreditNoteModal}
          setViewCreditNoteModal={setViewCreditNoteModal}
        />
      )}

      {/* Animaciones CSS Locales */}
      <style>{`
        @keyframes slideDown {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>

    </div>
  );
}
