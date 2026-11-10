import React from 'react';
import { Plus, Check, DollarSign, Trash2, Search, UserPlus, Eye, Edit } from 'lucide-react';

export const ComprasFacturasTab: React.FC<{
  isAdmin: boolean;
  supplierMetrics: { totalDeuda: number; vencidasCount: number; totalVencidas: number; proximasCount: number; totalProximas: number };
  filteredInvoices: any[];
  supplierQuery: string;
  setSupplierQuery: (v: string) => void;
  supplierStartDate: string;
  setSupplierStartDate: (v: string) => void;
  supplierEndDate: string;
  setSupplierEndDate: (v: string) => void;
  branchFilter: 'ALL' | 'OFFICIAL' | 'INTERNAL';
  setBranchFilter: (v: 'ALL' | 'OFFICIAL' | 'INTERNAL') => void;
  onOpenSupplierModal: () => void;
  onOpenPayInvoice: (inv: any) => void;
  onDeleteInvoice: (id: number, num: string) => void;
}> = ({
  isAdmin, supplierMetrics, filteredInvoices, supplierQuery, setSupplierQuery,
  supplierStartDate, setSupplierStartDate, supplierEndDate, setSupplierEndDate,
  branchFilter, setBranchFilter, onOpenSupplierModal, onOpenPayInvoice, onDeleteInvoice,
}) => {
  return (
    <div>
      {isAdmin && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginBottom: '20px' }}>
          <div className="card" style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>Deuda Pendiente Total</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 700 }}>${Math.round(supplierMetrics.totalDeuda).toLocaleString('es-AR')}</span>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--color-danger)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: 'var(--color-danger)', fontWeight: 600 }}>⚠️ Facturas Vencidas ({supplierMetrics.vencidasCount})</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-danger)' }}>${Math.round(supplierMetrics.totalVencidas).toLocaleString('es-AR')}</span>
          </div>
          <div className="card" style={{ padding: '16px', borderLeft: '4px solid var(--color-warning)', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.78rem', color: '#B78103', fontWeight: 600 }}>⏳ Próximos Vencimientos 7d ({supplierMetrics.proximasCount})</span>
            <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#B78103' }}>${Math.round(supplierMetrics.totalProximas).toLocaleString('es-AR')}</span>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
          <div>
            <h3 className="card-title" style={{ margin: 0 }}>📥 Comprobantes y Facturas de Compra</h3>
            <p style={{ fontSize: '0.8rem', marginTop: '2px' }}>Historial impositivo y contable de compras vinculadas al IVA Crédito Fiscal.</p>
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <input type="text" placeholder="Buscar factura o proveedor..." className="input" style={{ fontSize: '0.8rem', padding: '6px 12px' }} value={supplierQuery} onChange={(e) => setSupplierQuery(e.target.value)} />
            <input type="date" className="input" style={{ fontSize: '0.8rem', padding: '6px 12px' }} value={supplierStartDate} onChange={(e) => setSupplierStartDate(e.target.value)} />
            <input type="date" className="input" style={{ fontSize: '0.8rem', padding: '6px 12px' }} value={supplierEndDate} onChange={(e) => setSupplierEndDate(e.target.value)} />
            <select className="input" style={{ fontSize: '0.8rem', padding: '6px 12px', minWidth: '175px' }} value={branchFilter} onChange={(e) => setBranchFilter(e.target.value as any)}>
              <option value="ALL">🏢 Todas las Sucursales</option>
              <option value="OFFICIAL">Sucursal A</option>
              <option value="INTERNAL">Sucursal X</option>
            </select>
            <button className="btn btn-primary" onClick={onOpenSupplierModal}><Plus size={16} /> Cargar Factura Manual</button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>Fecha Emisión</th>
                <th>Fecha Vto.</th>
                <th>Tipo</th>
                <th>Sucursal</th>
                <th>Nro Comprobante</th>
                <th>Proveedor</th>
                <th>Neto</th>
                <th>IVA</th>
                <th>Total</th>
                <th>Pagado</th>
                <th>Estado</th>
                <th style={{ textAlign: 'center' }}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filteredInvoices.length === 0 ? (
                <tr><td colSpan={12} style={{ textAlign: 'center' }}>No se encontraron comprobantes de compra.</td></tr>
              ) : (
                filteredInvoices.map((inv) => {
                  const isOverdue = inv.dueDate && new Date(inv.dueDate) < new Date() && inv.status !== 'PAID';
                  return (
                    <tr key={inv.id} style={isOverdue ? { backgroundColor: '#FFF5F5' } : undefined}>
                      <td>{new Date(inv.issueDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}</td>
                      <td>{inv.dueDate ? new Date(inv.dueDate).toLocaleDateString('es-AR', { timeZone: 'UTC' }) : 'S/D'}</td>
                      <td style={{ fontWeight: 600 }}>{inv.invoiceType?.replace('_', ' ')}</td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: inv.billingType === 'OFFICIAL' ? '#E8F5E9' : '#ECEFF1', color: inv.billingType === 'OFFICIAL' ? '#2E7D32' : '#37474F' }}>
                          {inv.billingType === 'OFFICIAL' ? 'Suc. A' : 'Suc. X'}
                        </span>
                      </td>
                      <td style={{ fontFamily: 'monospace' }}>{inv.invoiceNumber}</td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{inv.persona?.name}</div>
                        <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>CUIT: {inv.persona?.cuit}</div>
                      </td>
                      <td>${Number(inv.netAmount || 0).toLocaleString('es-AR')}</td>
                      <td>${Number(inv.taxAmount || 0).toLocaleString('es-AR')}</td>
                      <td style={{ fontWeight: 700 }}>${Number(inv.totalAmount || 0).toLocaleString('es-AR')}</td>
                      <td>${Number(inv.paidAmount || 0).toLocaleString('es-AR')}</td>
                      <td>
                        <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 6px', borderRadius: '4px', backgroundColor: inv.status === 'PAID' ? 'var(--color-success-bg)' : isOverdue ? '#FFF0F0' : 'var(--color-warning-bg)', color: inv.status === 'PAID' ? 'var(--color-success)' : isOverdue ? 'var(--color-danger)' : 'var(--color-warning)' }}>
                          {inv.status === 'PAID' ? 'Saldada' : isOverdue ? 'Vencida' : 'Pendiente'}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                          {inv.status === 'PAID' ? (
                            <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '3px 8px', borderRadius: '6px', backgroundColor: 'var(--color-success-bg)', color: 'var(--color-success)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                              <Check size={12} /> Saldada
                            </span>
                          ) : (
                            <button onClick={() => onOpenPayInvoice(inv)} className="btn" style={{ padding: '4px 10px', fontSize: '0.76rem', fontWeight: 600, backgroundColor: 'var(--color-success)', color: '#FFFFFF', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                              <DollarSign size={13} /> Cargar Pago
                            </button>
                          )}
                          <button onClick={() => onDeleteInvoice(inv.id, inv.invoiceNumber)} style={{ background: 'none', border: 'none', padding: '4px', cursor: 'pointer', color: 'var(--color-danger)' }} title="Anular Factura">
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export const ComprasProveedoresTab: React.FC<{
  isAdmin: boolean;
  filteredProviders: any[];
  providerSearch: string;
  setProviderSearch: (v: string) => void;
  onOpenCreateProvider: () => void;
  onOpenAccountSummary: (p: any) => void;
  onOpenEditProvider: (p: any) => void;
  onDeleteProvider: (id: number, name: string) => void;
}> = ({
  isAdmin, filteredProviders, providerSearch, setProviderSearch,
  onOpenCreateProvider, onOpenAccountSummary, onOpenEditProvider, onDeleteProvider,
}) => {
  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h3 className="card-title" style={{ margin: 0 }}>👥 Fichero de Proveedores ({filteredProviders.length})</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Administración de cuentas corrientes, datos de facturación y contactos.</p>
        </div>
        <div style={{ display: 'flex', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px', padding: '4px 10px', gap: '6px' }}>
            <Search size={14} />
            <input type="text" placeholder="Buscar CUIT o nombre..." value={providerSearch} onChange={(e) => setProviderSearch(e.target.value)} style={{ border: 'none', outline: 'none', fontSize: '0.8rem', width: '180px' }} />
          </div>
          <button className="btn btn-primary" onClick={onOpenCreateProvider}><UserPlus size={16} /> Registrar Proveedor</button>
        </div>
      </div>

      <div className="table-container">
        <table>
          <thead>
            <tr>
              <th>Proveedor / Razón Social</th>
              <th>Rubro / Marcas Provistas</th>
              <th>Contactos y Teléfonos</th>
              <th style={{ width: '110px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProviders.length === 0 ? (
              <tr><td colSpan={4} style={{ textAlign: 'center' }}>No se encontraron proveedores.</td></tr>
            ) : (
              filteredProviders.map((p) => (
                <tr key={p.id}>
                  <td>
                    <div style={{ fontWeight: 600, fontSize: '0.88rem' }}>{p.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>📍 {p.address ? `${p.address} (${p.city || 'S/D'})` : 'Sin Dirección'}</div>
                    <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontFamily: 'monospace' }}>{p.cuit ? `CUIT: ${p.cuit}` : 'Sin CUIT'}{p.email ? ` | ✉️ ${p.email}` : ''}</div>
                  </td>
                  <td>
                    {p.rubro ? (
                      <span style={{ backgroundColor: 'rgba(227, 6, 19, 0.05)', color: 'var(--color-corp-red)', padding: '4px 8px', borderRadius: '6px', fontSize: '0.78rem', fontWeight: 500, border: '1px solid rgba(227, 6, 19, 0.1)' }}>{p.rubro}</span>
                    ) : <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>Sin especificar</span>}
                  </td>
                  <td>
                    {Array.isArray(p.contacts) && p.contacts.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {p.contacts.map((c: any, idx: number) => (
                          <div key={idx} style={{ fontSize: '0.76rem' }}><strong>{c.name}</strong> {c.phone ? `📞 ${c.phone}` : ''}</div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{p.phone ? `📞 ${p.phone}` : 'Sin contacto'}</span>
                    )}
                  </td>
                  <td>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }} onClick={() => onOpenAccountSummary(p)}><Eye size={12} /> Resumen</button>
                      <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }} onClick={() => onOpenEditProvider(p)}><Edit size={12} /> Editar</button>
                      {isAdmin && (
                        <button className="btn btn-secondary" style={{ padding: '4px 8px', fontSize: '0.76rem', display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center', color: 'var(--color-danger)' }} onClick={() => onDeleteProvider(p.id, p.name)}><Trash2 size={12} /> Eliminar</button>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
