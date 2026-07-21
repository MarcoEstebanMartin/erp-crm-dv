import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import { 
  UserPlus, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Trash2, 
  RefreshCw 
} from 'lucide-react';

interface ConfigTabProps {
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

export default function ConfigTab({
  setErrorMsg,
  setSuccessMsg
}: ConfigTabProps) {
  // Tab navigation state
  const [configTab, setConfigTab] = useState<string>('general');

  // General & Company settings (localStorage read-write)
  const [companyRazonSocial, setCompanyRazonSocial] = useState<string>(() => localStorage.getItem('company_razon_social') || 'Distribuidora de Bebidas SRL');
  const [companyNombreFantasia, setCompanyNombreFantasia] = useState<string>(() => localStorage.getItem('company_nombre_fantasia') || 'Bebidas del Sur');
  const [companyCuit, setCompanyCuit] = useState<string>(() => localStorage.getItem('company_cuit') || '30-71717171-9');
  const [companyDireccion, setCompanyDireccion] = useState<string>(() => localStorage.getItem('company_direccion') || 'Av. San Martín 1234, Ciudad Autónoma de Buenos Aires');
  const [companyTelefono, setCompanyTelefono] = useState<string>(() => localStorage.getItem('company_telefono') || '011-4567-8900');
  const [companyEmail, setCompanyEmail] = useState<string>(() => localStorage.getItem('company_email') || 'ventas@bebidasdelsur.com');
  const [companyPos, setCompanyPos] = useState<string>(() => localStorage.getItem('company_pos') || '1');
  const [companyDefaultIva, setCompanyDefaultIva] = useState<string>(() => localStorage.getItem('company_default_iva') || '21');
  
  const [ignoreStockCheck, setIgnoreStockCheck] = useState<boolean>(() => {
    return api.getServerConfig()?.ignoreStock || false;
  });

  // Employee Management
  const [users, setUsers] = useState<any[]>([]);
  const [userModal, setUserModal] = useState({ open: false, username: '', password: '', role: 'VENDEDOR' });
  const [showPassword, setShowPassword] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditCategoryFilter, setAuditCategoryFilter] = useState<string>('ALL');
  const [auditPage, setAuditPage] = useState(1);
  const [auditTotalPages, setAuditTotalPages] = useState(1);

  // Tax Perceptions
  const [perceptions, setPerceptions] = useState<any[]>([]);
  const [perceptionForm, setPerceptionForm] = useState({ name: '', aliquot: 0, affectsIvaBook: false, jurisdiction: '' });

  // Balance Reconcile
  const [reconcileMismatches, setReconcileMismatches] = useState<any[]>([]);
  const [loadingReconcile, setLoadingReconcile] = useState(false);

  // Pricing Rules
  const [pricingRules, setPricingRules] = useState<{ discountRules: any[]; splitConfigs: any[] }>({ discountRules: [], splitConfigs: [] });
  const [loadingPricing, setLoadingPricing] = useState(false);
  const [clients, setClients] = useState<any[]>([]);
  const [rubrosList, setRubrosList] = useState<any[]>([]);

  const [discountRuleForm, setDiscountRuleForm] = useState({
    name: '',
    personaId: '' as any,
    priceList: '',
    rubroId: '' as any,
    productId: '' as any,
    billingType: '',
    discount: 0
  });

  const [splitConfigForm, setSplitConfigForm] = useState({
    personaId: '',
    rubroId: '',
    percentageOfficial: 50,
    percentageInternal: 50
  });

  // Fetch Pricing metadata and lists
  useEffect(() => {
    if (configTab === 'prices') {
      const fetchPricingMetadata = async () => {
        setLoadingPricing(true);
        try {
          const res = await api.getPricingRules();
          setPricingRules(res || { discountRules: [], splitConfigs: [] });
          const cls = await api.getPersonas('client');
          setClients(cls || []);
          const rbs = await api.getRubros();
          setRubrosList(rbs || []);
        } catch (e) {
          console.error("Error fetching pricing metadata:", e);
        } finally {
          setLoadingPricing(false);
        }
      };
      fetchPricingMetadata();
    }
  }, [configTab]);

  // Fetch Employees
  useEffect(() => {
    if (configTab === 'personal') {
      api.getUsers()
        .then(setUsers)
        .catch(() => setUsers([]));
    }
  }, [configTab]);

  // Fetch Audit Logs
  useEffect(() => {
    if (configTab === 'audit') {
      api.getAuditLogs(auditPage, 30)
        .then((res: any) => {
          setAuditLogs(res.logs || []);
          setAuditTotalPages(res.totalPages || 1);
        })
        .catch(() => setAuditLogs([]));
    }
  }, [configTab, auditPage]);

  // Fetch Perceptions
  useEffect(() => {
    if (configTab === 'percepciones') {
      api.getPerceptions()
        .then((res: any) => {
          setPerceptions(res.perceptions || []);
        })
        .catch(() => setPerceptions([]));
    }
  }, [configTab]);

  const handleSaveCompanyConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('company_razon_social', companyRazonSocial);
    localStorage.setItem('company_nombre_fantasia', companyNombreFantasia);
    localStorage.setItem('company_cuit', companyCuit);
    localStorage.setItem('company_direccion', companyDireccion);
    localStorage.setItem('company_telefono', companyTelefono);
    localStorage.setItem('company_email', companyEmail);
    localStorage.setItem('company_pos', companyPos);
    localStorage.setItem('company_default_iva', companyDefaultIva);
    
    try {
      await api.updateServerConfig({ ignoreStockCheck });
      setSuccessMsg('Configuración de la empresa y servidor guardada exitosamente.');
    } catch {
      setErrorMsg('Error al guardar configuración del servidor.');
    }
    setTimeout(() => setSuccessMsg(null), 3000);
  };

  // Employee handlers
  const handleUserSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userModal.username || !userModal.password) {
      setErrorMsg('Usuario y contraseña son requeridos.');
      return;
    }
    try {
      await api.createUser({
        username: userModal.username,
        password: userModal.password,
        role: userModal.role
      });
      setUserModal({ open: false, username: '', password: '', role: 'VENDEDOR' });
      setSuccessMsg('Usuario creado exitosamente.');
      const dataUsers = await api.getUsers();
      setUsers(dataUsers);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear usuario.');
    }
  };

  const handleToggleUserActive = async (id: number, username: string, active: boolean) => {
    try {
      await api.toggleUserStatus(id);
      setSuccessMsg(`Usuario ${username} ${active ? 'activado' : 'desactivado'} con éxito.`);
      const dataUsers = await api.getUsers();
      setUsers(dataUsers);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al cambiar estado.');
    }
  };

  const handleDeleteUser = async (username: string) => {
    if (!window.confirm(`¿Está seguro de eliminar permanentemente al usuario ${username}? Esta acción no se puede deshacer.`)) return;
    try {
      await api.deleteUser(username);
      setSuccessMsg(`Usuario ${username} eliminado correctamente.`);
      const dataUsers = await api.getUsers();
      setUsers(dataUsers);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar usuario.');
    }
  };

  // Reconcile Balances
  const handleRunReconcile = async () => {
    setLoadingReconcile(true);
    setReconcileMismatches([]);
    try {
      const res = await api.reconcileAllClientBalances();
      if (res && Array.isArray(res.mismatches)) {
        setReconcileMismatches(res.mismatches);
        if (res.mismatches.length === 0) {
          setSuccessMsg('✅ ¡Perfecto! Todos los saldos coinciden con sus libros de cuenta corriente.');
        } else {
          setErrorMsg(`Se encontraron ${res.mismatches.length} clientes con inconsistencias entre su saldo y el libro.`);
        }
      }
    } catch (e: any) {
      setErrorMsg(e.message || 'Error al ejecutar conciliación.');
    } finally {
      setLoadingReconcile(false);
    }
  };

  const handleFixBalance = async (clientId: number) => {
    try {
      await api.recalculateAndFixClientBalance(clientId);
      setSuccessMsg('Saldo corregido exitosamente.');
      handleRunReconcile();
    } catch (e: any) {
      setErrorMsg(e.message || 'Error al corregir el saldo.');
    }
  };

  // Discount rules
  const handleCreateDiscountRule = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.createDiscountRule({
        name: discountRuleForm.name || '',
        personaId: discountRuleForm.personaId ? Number(discountRuleForm.personaId) : null,
        priceList: discountRuleForm.priceList || null,
        rubroId: discountRuleForm.rubroId ? Number(discountRuleForm.rubroId) : null,
        productId: discountRuleForm.productId ? Number(discountRuleForm.productId) : null,
        billingType: discountRuleForm.billingType || null,
        discount: Number(discountRuleForm.discount)
      });
      setSuccessMsg('Regla de descuento creada con éxito.');
      setDiscountRuleForm({
        name: '',
        personaId: '' as any,
        priceList: '',
        rubroId: '' as any,
        productId: '' as any,
        billingType: '',
        discount: 0
      });
      const res = await api.getPricingRules();
      setPricingRules(res || { discountRules: [], splitConfigs: [] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al crear la regla.');
    }
  };

  const handleDeleteDiscountRule = async (id: number) => {
    if (!window.confirm('¿Está seguro de eliminar esta regla de descuento?')) return;
    try {
      await api.deleteDiscountRule(id);
      setSuccessMsg('Regla eliminada.');
      const res = await api.getPricingRules();
      setPricingRules(res || { discountRules: [], splitConfigs: [] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar.');
    }
  };

  // Split configurations
  const handleCreateSplitConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);
    try {
      await api.createSplitConfig({
        personaId: Number(splitConfigForm.personaId),
        rubroId: Number(splitConfigForm.rubroId),
        percentageOfficial: Number(splitConfigForm.percentageOfficial),
        percentageInternal: Number(splitConfigForm.percentageInternal)
      });
      setSuccessMsg('División de facturación configurada con éxito.');
      setSplitConfigForm({
        personaId: '',
        rubroId: '',
        percentageOfficial: 50,
        percentageInternal: 50
      });
      const res = await api.getPricingRules();
      setPricingRules(res || { discountRules: [], splitConfigs: [] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al configurar división.');
    }
  };

  const handleDeleteSplitConfig = async (id: number) => {
    if (!window.confirm('¿Está seguro de eliminar esta configuración de división?')) return;
    try {
      await api.deleteSplitConfig(id);
      setSuccessMsg('Configuración de división eliminada.');
      const res = await api.getPricingRules();
      setPricingRules(res || { discountRules: [], splitConfigs: [] });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar.');
    }
  };

  // Perceptions
  const handleCreatePerception = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPerception(perceptionForm);
      setSuccessMsg('Impuesto/Percepción creado correctamente.');
      const res = await api.getPerceptions();
      setPerceptions(res.perceptions || []);
      setPerceptionForm({ name: '', aliquot: 0, affectsIvaBook: false, jurisdiction: '' });
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar percepción.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Sub-tab Navigation */}
      <div style={{ display: 'flex', gap: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px', overflowX: 'auto', paddingRight: '4px' }}>
        {[
          { id: 'general', label: '🏢 General & Empresa' },
          { id: 'personal', label: '👥 Empleados' },
          { id: 'audit', label: '📜 Auditoría (Logs)' },
          { id: 'percepciones', label: '📊 Impuestos & Percepciones' },
          { id: 'reconcile', label: '⚖️ Auditoría de Saldos' },
          { id: 'prices', label: '🏷️ Reglas de Precios' }
        ].map(tab => (
          <button 
            key={tab.id}
            type="button"
            className="btn" 
            style={{ 
              backgroundColor: configTab === tab.id ? 'var(--color-primary)' : 'transparent',
              color: configTab === tab.id ? '#fff' : 'var(--text-primary)',
              border: configTab === tab.id ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
              fontWeight: 600,
              fontSize: '0.85rem',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap'
            }}
            onClick={() => setConfigTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab 1: General & Empresa */}
      {configTab === 'general' && (
        <form onSubmit={handleSaveCompanyConfig} className="card" style={{ padding: '24px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 4px 0' }}>
            🏢 Datos de la Empresa & Configuración
          </h3>
          <p style={{ fontSize: '0.85rem', marginBottom: '20px', color: 'var(--text-secondary)' }}>
            Configure la información comercial y los parámetros fiscales del emisor para la facturación.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '20px', marginBottom: '20px' }}>
            <div className="form-group">
              <label>Razón Social</label>
              <input type="text" className="input" value={companyRazonSocial} onChange={(e) => setCompanyRazonSocial(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Nombre de Fantasía (Logo)</label>
              <input type="text" className="input" value={companyNombreFantasia} onChange={(e) => setCompanyNombreFantasia(e.target.value)} />
            </div>
            <div className="form-group">
              <label>CUIT del Emisor</label>
              <input type="text" className="input" value={companyCuit} onChange={(e) => setCompanyCuit(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Dirección Comercial</label>
              <input type="text" className="input" value={companyDireccion} onChange={(e) => setCompanyDireccion(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Teléfono de Contacto</label>
              <input type="text" className="input" value={companyTelefono} onChange={(e) => setCompanyTelefono(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Email de Contacto</label>
              <input type="email" className="input" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
            </div>
            <div className="form-group">
              <label>Punto de Venta Oficial (Factura Electrónica)</label>
              <input type="text" className="input" value={companyPos} onChange={(e) => setCompanyPos(e.target.value)} />
            </div>
            <div className="form-group" style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              backgroundColor: 'var(--bg-light, #f8f9fa)', 
              padding: '12px', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color, #e5e5e7)' 
            }}>
              <label style={{ color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.8rem', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: 'var(--color-primary, #1a73e8)' }}>⚖️</span> IVA General Defecto (%)
              </label>
              <input 
                type="text" 
                className="input" 
                style={{ 
                  marginTop: '4px', 
                  backgroundColor: '#fff', 
                  border: '1px solid var(--border-color, #e5e5e7)', 
                  fontWeight: 600, 
                  color: 'var(--text-primary)' 
                }} 
                value={companyDefaultIva} 
                onChange={(e) => setCompanyDefaultIva(e.target.value)} 
              />
            </div>
          </div>

          <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '16px' }}>
            <input type="checkbox" id="ignoreStockCheck" checked={ignoreStockCheck} onChange={(e) => setIgnoreStockCheck(e.target.checked)} style={{ width: '18px', height: '18px' }} />
            <label htmlFor="ignoreStockCheck" style={{ cursor: 'pointer', fontWeight: 600, margin: 0 }}>⚠️ Habilitar Facturación sin Stock Físico (Venta en negativo)</label>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', fontWeight: 600 }}>Guardar Cambios Empresa</button>
          </div>
        </form>
      )}

      {/* Sub-tab 3: Empleados */}
      {configTab === 'personal' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h3 className="card-title" style={{ margin: 0 }}>👥 Nómina de Empleados & Roles</h3>
            <button className="btn btn-primary" onClick={() => setUserModal({ open: true, username: '', password: '', role: 'VENDEDOR' })}>
              <UserPlus size={16} /> <span style={{ marginLeft: '6px' }}>Agregar Nuevo Empleado</span>
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Usuario</th>
                  <th>Rol</th>
                  <th>Estado</th>
                  <th style={{ textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {users.map(u => (
                  <tr key={u.id}>
                    <td style={{ fontWeight: 600 }}>{u.username}</td>
                    <td>
                      <span className="badge" style={{ backgroundColor: u.role === 'ADMIN' ? '#FDEDEC' : '#EBF5FB', color: u.role === 'ADMIN' ? '#C0392B' : '#2980B9', fontWeight: 600 }}>
                        {u.role === 'ADMIN' ? 'Administrador' : u.role === 'REPARTIDOR' ? 'Repartidor / Chofer' : u.role === 'VENDEDOR' ? 'Vendedor de Calle' : u.role}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontWeight: 500, color: u.isActive !== false ? 'var(--color-success)' : 'var(--color-danger)' }}>
                        {u.isActive !== false ? 'Activo' : 'Desactivado'}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-secondary btn-sm" onClick={() => handleToggleUserActive(u.id, u.username, u.isActive === false)}>
                          {u.isActive !== false ? 'Desactivar' : 'Activar'}
                        </button>
                        <button className="btn btn-ghost btn-sm" style={{ color: 'var(--color-corp-red)' }} onClick={() => handleDeleteUser(u.username)}>Eliminar</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Sub-tab 4: Auditoría (Logs) */}
      {configTab === 'audit' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 className="card-title">📜 Registro de Auditoría del Sistema</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>Historial en tiempo real de operaciones de usuarios, ventas, stock y modificaciones de cuenta corriente.</p>
          
          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Fecha</th>
                  <th>Usuario</th>
                  <th>Categoría</th>
                  <th>Descripción</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.map(l => (
                  <tr key={l.id}>
                    <td style={{ fontFamily: 'monospace' }}>{new Date(l.createdAt).toLocaleString('es-AR')}</td>
                    <td style={{ fontWeight: 600 }}>{l.username || 'System'}</td>
                    <td><strong>{l.category}</strong></td>
                    <td>{l.message}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <button className="btn btn-secondary" onClick={() => setAuditPage(p => Math.max(1, p - 1))} disabled={auditPage === 1}>Anterior</button>
            <span>Página {auditPage} de {auditTotalPages}</span>
            <button className="btn btn-secondary" onClick={() => setAuditPage(p => Math.min(auditTotalPages, p + 1))} disabled={auditPage === auditTotalPages}>Siguiente</button>
          </div>
        </div>
      )}

      {/* Sub-tab 5: Impuestos & Percepciones */}
      {configTab === 'percepciones' && (
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '20px' }}>
          <form onSubmit={handleCreatePerception} className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700 }}>Nuevo Impuesto / Percepción</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div className="form-group">
                <label>Nombre / Código</label>
                <input type="text" className="input" placeholder="ej: IVA_5329" value={perceptionForm.name} onChange={(e) => setPerceptionForm({ ...perceptionForm, name: e.target.value })} required />
              </div>
              <div className="form-group">
                <label>Alícuota (%)</label>
                <input type="number" step="0.01" className="input" value={perceptionForm.aliquot} onChange={(e) => setPerceptionForm({ ...perceptionForm, aliquot: Number(e.target.value) })} required />
              </div>
              <div className="form-group">
                <label>Jurisdicción (IIBB)</label>
                <input type="text" className="input" placeholder="ej: AR-B para Buenos Aires" value={perceptionForm.jurisdiction} onChange={(e) => setPerceptionForm({ ...perceptionForm, jurisdiction: e.target.value })} />
              </div>
              <div className="form-group" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <input type="checkbox" checked={perceptionForm.affectsIvaBook} onChange={(e) => setPerceptionForm({ ...perceptionForm, affectsIvaBook: e.target.checked })} style={{ width: '16px', height: '16px' }} />
                <label style={{ cursor: 'pointer', margin: 0 }}>¿Afecta Libro IVA Ventas?</label>
              </div>
              <button type="submit" className="btn btn-primary">Guardar Impuesto</button>
            </div>
          </form>

          <div className="card" style={{ padding: '20px' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1rem', fontWeight: 700 }}>Impuestos Configurados</h3>
            <div className="table-container">
              <table>
                <thead>
                  <tr>
                    <th>Nombre / Código</th>
                    <th>Alícuota</th>
                    <th>Jurisdicción</th>
                    <th>Libro IVA</th>
                  </tr>
                </thead>
                <tbody>
                  {perceptions.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: 600 }}>{p.name}</td>
                      <td>{Number(p.aliquot)}%</td>
                      <td>{p.jurisdiction || 'N/A'}</td>
                      <td>{p.affectsIvaBook ? 'Sí' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Sub-tab 6: Auditoría de Saldos */}
      {configTab === 'reconcile' && (
        <div className="card" style={{ padding: '24px' }}>
          <h3 className="card-title">⚖️ Auditoría de Saldos y Conciliación Contable</h3>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Valide la concordancia del saldo virtual actual de cada cliente contra la suma aritmética real de su libro histórico de movimientos (facturas, cobros y notas de crédito).
          </p>
          <button className="btn btn-primary" onClick={handleRunReconcile} disabled={loadingReconcile}>
            {loadingReconcile ? 'Conciliando...' : 'Iniciar Conciliación de Saldos'}
          </button>

          {reconcileMismatches.length > 0 && (
            <div style={{ marginTop: '20px' }}>
              <h4 style={{ color: 'var(--color-danger)' }}>Inconsistencias Detectadas:</h4>
              <div className="table-container" style={{ marginTop: '12px' }}>
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Saldo Guardado (CC)</th>
                      <th>Saldo Calculado (Libro)</th>
                      <th>Desvío</th>
                      <th style={{ textAlign: 'right' }}>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {reconcileMismatches.map(m => (
                      <tr key={m.clientId}>
                        <td style={{ fontWeight: 600 }}>{m.clientName}</td>
                        <td style={{ color: 'var(--color-danger)' }}>${Number(m.currentBalance).toLocaleString()}</td>
                        <td style={{ color: 'var(--color-success)' }}>${Number(m.calculatedBalance).toLocaleString()}</td>
                        <td style={{ fontWeight: 700 }}>${Math.abs(Number(m.currentBalance) - Number(m.calculatedBalance)).toLocaleString()}</td>
                        <td style={{ textAlign: 'right' }}>
                          <button className="btn btn-secondary btn-sm" onClick={() => handleFixBalance(m.clientId)}>
                            Corregir Saldo CC
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Sub-tab 7: Reglas de Precios */}
      {configTab === 'prices' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div className="card" style={{ padding: '24px' }}>
            <h3 className="card-title" style={{ margin: '0 0 6px 0' }}>🏷️ Reglas de Descuentos & Bonificaciones Especiales</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
              Define descuentos porcentuales específicos para clientes individuales, agrupaciones por lista de precios, rubros de productos o artículos concretos.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px', alignItems: 'start' }}>
              
              {/* Formulario descuento */}
              <form onSubmit={handleCreateDiscountRule} style={{ borderRight: '1px solid var(--border-color)', paddingRight: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Nueva Regla de Descuento</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Nombre Descriptivo</label>
                  <input 
                    type="text" 
                    className="input" 
                    placeholder="ej: Descuento Quesos 3%"
                    value={discountRuleForm.name}
                    onChange={(e) => setDiscountRuleForm({ ...discountRuleForm, name: e.target.value })}
                    style={{ height: '36px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Aplicar a Cliente</label>
                  <select 
                    className="select"
                    value={discountRuleForm.personaId}
                    onChange={(e) => setDiscountRuleForm({ ...discountRuleForm, personaId: e.target.value })}
                    style={{ height: '36px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', backgroundColor: '#fff' }}
                  >
                    <option value="">-- Todos los Clientes --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>O aplicar a Lista de Precios</label>
                  <select 
                    className="select"
                    value={discountRuleForm.priceList}
                    onChange={(e) => setDiscountRuleForm({ ...discountRuleForm, priceList: e.target.value })}
                    style={{ height: '36px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', backgroundColor: '#fff' }}
                  >
                    <option value="">-- Ninguna --</option>
                    <option value="A">Lista A (Estándar)</option>
                    <option value="B">Lista B (Especial)</option>
                    <option value="C">Lista C (Distribuidor)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Rubro de Productos</label>
                  <select 
                    className="select"
                    value={discountRuleForm.rubroId}
                    onChange={(e) => setDiscountRuleForm({ ...discountRuleForm, rubroId: e.target.value })}
                    style={{ height: '36px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', backgroundColor: '#fff' }}
                  >
                    <option value="">-- Todos los Rubros --</option>
                    {rubrosList.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Sucursal / Caja</label>
                  <select 
                    className="select"
                    value={discountRuleForm.billingType}
                    onChange={(e) => setDiscountRuleForm({ ...discountRuleForm, billingType: e.target.value })}
                    style={{ height: '36px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', backgroundColor: '#fff' }}
                  >
                    <option value="">-- Ambas --</option>
                    <option value="OFFICIAL">Sucursal A (Oficial)</option>
                    <option value="INTERNAL">Sucursal X (Interna)</option>
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Porcentaje de Descuento (%)</label>
                  <input 
                    type="number" 
                    step="0.01"
                    className="input" 
                    value={discountRuleForm.discount}
                    onChange={(e) => setDiscountRuleForm({ ...discountRuleForm, discount: Number(e.target.value) })}
                    style={{ height: '36px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                    required
                  />
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  ➕ Crear Regla
                </button>
              </form>

              {/* Tabla descuento */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Reglas Activas</h4>
                {loadingPricing ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Cargando reglas...</div>
                ) : pricingRules.discountRules.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>No hay reglas de descuento cargadas.</div>
                ) : (
                  <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Nombre / Ámbito</th>
                          <th>Rubro / Prod.</th>
                          <th>Sucursal</th>
                          <th style={{ textAlign: 'right' }}>Descuento</th>
                          <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricingRules.discountRules.map(r => (
                          <tr key={r.id}>
                            <td style={{ fontWeight: 600 }}>
                              {r.name || 'Descuento Sin Nombre'}
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 'normal' }}>
                                {r.persona ? `Cliente: ${r.persona.name}` : r.priceList ? `Lista: ${r.priceList}` : 'Global'}
                              </div>
                            </td>
                            <td>{r.product ? `Art: ${r.product.sku}` : r.rubro ? `Rubro: ${r.rubro.name}` : 'Todos'}</td>
                            <td>{r.billingType === 'OFFICIAL' ? 'Sucursal A' : r.billingType === 'INTERNAL' ? 'Sucursal X' : 'Cualquiera'}</td>
                            <td style={{ textAlign: 'right', fontWeight: 'bold', color: '#27AE60' }}>{Number(r.discount)}%</td>
                            <td style={{ textAlign: 'right' }}>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteDiscountRule(r.id)} style={{ color: 'var(--color-corp-red)', padding: '4px' }}>Eliminar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Facturación Dividida (Split Billing) */}
          <div className="card" style={{ padding: '24px' }}>
            <h3 className="card-title" style={{ margin: '0 0 6px 0' }}>⚖️ División Automática de Facturación (Split Billing)</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', margin: '0 0 20px 0' }}>
              Configura reglas para dividir pedidos armados automáticamente. Los productos de los rubros indicados se dividirán entre Oficial (Sucursal A) e Interna (Sucursal X) en los porcentajes definidos.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 2fr', gap: '24px', alignItems: 'start' }}>
              
              {/* Formulario split */}
              <form onSubmit={handleCreateSplitConfig} style={{ borderRight: '1px solid var(--border-color)', paddingRight: '24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Nueva Regla de División</h4>
                
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Cliente (Requerido)</label>
                  <select 
                    className="select"
                    value={splitConfigForm.personaId}
                    onChange={(e) => setSplitConfigForm({ ...splitConfigForm, personaId: e.target.value })}
                    style={{ height: '36px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', backgroundColor: '#fff' }}
                    required
                  >
                    <option value="">-- Seleccionar Cliente --</option>
                    {clients.map(c => (
                      <option key={c.id} value={c.id}>{c.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>Rubro a Dividir (Requerido)</label>
                  <select 
                    className="select"
                    value={splitConfigForm.rubroId}
                    onChange={(e) => setSplitConfigForm({ ...splitConfigForm, rubroId: e.target.value })}
                    style={{ height: '36px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box', backgroundColor: '#fff' }}
                    required
                  >
                    <option value="">-- Seleccionar Rubro --</option>
                    {rubrosList.map(r => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>% Sucursal A (Oficial)</label>
                    <input 
                      type="number" 
                      className="input" 
                      value={splitConfigForm.percentageOfficial}
                      onChange={(e) => setSplitConfigForm({ ...splitConfigForm, percentageOfficial: Number(e.target.value) })}
                      style={{ height: '36px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 600, marginBottom: '4px' }}>% Sucursal X (Interno)</label>
                    <input 
                      type="number" 
                      className="input" 
                      value={splitConfigForm.percentageInternal}
                      onChange={(e) => setSplitConfigForm({ ...splitConfigForm, percentageInternal: Number(e.target.value) })}
                      style={{ height: '36px', padding: '6px 12px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', boxSizing: 'border-box' }}
                      required
                    />
                  </div>
                </div>

                <button type="submit" className="btn btn-primary" style={{ marginTop: '8px', height: '36px', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                  ➕ Crear Configuración
                </button>
              </form>

              {/* Tabla split */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                <h4 style={{ margin: '0 0 8px 0', fontSize: '0.9rem', fontWeight: 600 }}>Configuraciones de División Activas</h4>
                {loadingPricing ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px' }}>Cargando divisiones...</div>
                ) : pricingRules.splitConfigs.length === 0 ? (
                  <div style={{ textAlign: 'center', color: 'var(--text-secondary)', padding: '20px', border: '1px dashed var(--border-color)', borderRadius: '6px' }}>No hay configuraciones de división de facturación.</div>
                ) : (
                  <div className="table-container" style={{ maxHeight: '420px', overflowY: 'auto' }}>
                    <table style={{ width: '100%', fontSize: '0.8rem' }}>
                      <thead>
                        <tr>
                          <th>Cliente</th>
                          <th>Rubro</th>
                          <th style={{ textAlign: 'center' }}>Distribución A / X</th>
                          <th style={{ textAlign: 'right' }}>Acciones</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pricingRules.splitConfigs.map(c => (
                          <tr key={c.id}>
                            <td style={{ fontWeight: 600 }}>{c.persona.name}</td>
                            <td>{c.rubro.name}</td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold' }}>
                              <span style={{ color: '#2980B9' }}>{Number(c.percentageOfficial)}% A</span>
                              <span style={{ margin: '0 6px', color: 'var(--text-secondary)' }}>/</span>
                              <span style={{ color: '#E67E22' }}>{Number(c.percentageInternal)}% X</span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <button type="button" className="btn btn-ghost btn-sm" onClick={() => handleDeleteSplitConfig(c.id)} style={{ color: 'var(--color-corp-red)', padding: '4px' }}>Eliminar</button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
