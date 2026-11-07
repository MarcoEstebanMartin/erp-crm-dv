import React, { useState, useEffect } from 'react';
import { api } from '../../utils/api';
import AfipExportDashboard from '../../pages/AfipExportDashboard';
import { 
  UserPlus, 
  RotateCcw, 
  Eye, 
  EyeOff, 
  Trash2, 
  RefreshCw,
  Edit3,
  Key,
  Shield,
  Crown,
  Building2,
  Truck,
  Package,
  Users,
  FileText,
  Scale,
  Receipt,
  Tag,
  Phone,
  Briefcase
} from 'lucide-react';
import { useConfirm } from '../../context/ConfirmContext';

interface ConfigTabProps {
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
  initialTab?: string;
}

export default function ConfigTab({
  setErrorMsg,
  setSuccessMsg,
  initialTab = 'general'
}: ConfigTabProps) {
  const confirm = useConfirm();
  // Tab navigation state
  const [configTab, setConfigTab] = useState<string>(initialTab);

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
  const [userModal, setUserModal] = useState<{ open: boolean; isEdit?: boolean; id?: number; username: string; password?: string; role: string; permissions?: any }>({
    open: false,
    isEdit: false,
    username: '',
    password: '',
    role: 'VENDEDOR',
    permissions: { canSell: true, canPick: false, canDeliver: true, canCollect: true, canManageStock: false }
  });
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
    if (!userModal.isEdit && (!userModal.username || !userModal.password)) {
      setErrorMsg('Usuario y contraseña son requeridos.');
      return;
    }
    try {
      if (userModal.isEdit && userModal.id) {
        await api.updateUser(userModal.id, {
          username: userModal.username,
          role: userModal.role,
          password: userModal.password,
          permissions: userModal.permissions
        });
        setSuccessMsg(`Empleado ${userModal.username} actualizado correctamente.`);
      } else {
        await api.createUser({
          username: userModal.username,
          password: userModal.password,
          role: userModal.role,
          permissions: userModal.permissions
        });
        setSuccessMsg('Usuario creado exitosamente.');
      }
      setUserModal({ open: false, isEdit: false, username: '', password: '', role: 'VENDEDOR' });
      const dataUsers = await api.getUsers();
      setUsers(dataUsers);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al procesar usuario.');
    }
  };
  const getDefaultPermissionsForRole = (role: string) => {
    if (role === 'ADMIN' || role === 'FACTURACION') {
      return { canSell: true, canPick: true, canDeliver: true, canCollect: true, canManageStock: true };
    }
    if (role === 'DEPOSITO') {
      return { canSell: false, canPick: true, canDeliver: true, canCollect: false, canManageStock: true };
    }
    return { canSell: true, canPick: false, canDeliver: true, canCollect: true, canManageStock: false };
  };

  const handleOpenEditUser = (u: any) => {
    setUserModal({
      open: true,
      isEdit: true,
      id: u.id,
      username: u.username,
      password: '',
      role: u.role,
      permissions: u.permissions || getDefaultPermissionsForRole(u.role)
    });
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
    if (!await confirm(`¿Está seguro de eliminar permanentemente al usuario ${username}? Esta acción no se puede deshacer.`, { type: 'danger' })) return;
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
    if (!await confirm('¿Está seguro de eliminar esta regla de descuento?', { type: 'danger' })) return;
    setErrorMsg(null);
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
    if (!await confirm('¿Está seguro de eliminar esta configuración de división?', { type: 'danger' })) return;
    setErrorMsg(null);
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
      <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', marginBottom: '12px', overflowX: 'auto', paddingRight: '4px' }}>
        {[
          { id: 'general', label: 'General & Empresa', icon: <Building2 size={15} /> },
          { id: 'personal', label: 'Empleados & Roles', icon: <Users size={15} /> },
          { id: 'arca', label: 'Cierre Fiscal (ARCA)', icon: <FileText size={15} /> },
          { id: 'audit', label: 'Auditoría (Logs)', icon: <FileText size={15} /> },
          { id: 'percepciones', label: 'Impuestos & Percepciones', icon: <Receipt size={15} /> },
          { id: 'reconcile', label: 'Auditoría de Saldos', icon: <Scale size={15} /> },
          { id: 'prices', label: 'Reglas de Precios', icon: <Tag size={15} /> }
        ].map(tab => (
          <button 
            key={tab.id}
            type="button"
            className="btn" 
            style={{ 
              backgroundColor: configTab === tab.id ? 'var(--color-primary)' : '#fff',
              color: configTab === tab.id ? '#fff' : 'var(--text-primary)',
              border: configTab === tab.id ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
              fontWeight: 600,
              fontSize: '0.85rem',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px'
            }}
            onClick={() => setConfigTab(tab.id)}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Sub-tab Cierre Fiscal (ARCA) */}
      {configTab === 'arca' && (
        <AfipExportDashboard />
      )}


      {/* Sub-tab 1: General & Empresa */}
      {configTab === 'general' && (
        <form onSubmit={handleSaveCompanyConfig} className="card" style={{ padding: '24px' }}>
          <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: '8px', margin: '0 0 4px 0' }}>
            🏢 Datos de la Empresa & Configuración
          </h3>
          <p style={{ fontSize: '0.85rem', marginBottom: '20px', color: 'var(--text-secondary)' }}>
            Configure la información comercial y los parámetros fiscales del emisor para la facturación.
          </p>
          
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '20px', marginBottom: '24px' }}>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Razón Social</label>
              <input type="text" className="input" value={companyRazonSocial} onChange={(e) => setCompanyRazonSocial(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Nombre de Fantasía (Logo)</label>
              <input type="text" className="input" value={companyNombreFantasia} onChange={(e) => setCompanyNombreFantasia(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>CUIT del Emisor</label>
              <input type="text" className="input" value={companyCuit} onChange={(e) => setCompanyCuit(e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Dirección Comercial</label>
              <input type="text" className="input" value={companyDireccion} onChange={(e) => setCompanyDireccion(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Teléfono de Contacto</label>
              <input type="text" className="input" value={companyTelefono} onChange={(e) => setCompanyTelefono(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Email de Contacto</label>
              <input type="email" className="input" value={companyEmail} onChange={(e) => setCompanyEmail(e.target.value)} />
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>Punto de Venta Oficial (Fact. Electrónica)</label>
              <input type="text" className="input" value={companyPos} onChange={(e) => setCompanyPos(e.target.value)} />
            </div>
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label>IVA General Defecto (%)</label>
              <input type="text" className="input" value={companyDefaultIva} onChange={(e) => setCompanyDefaultIva(e.target.value)} />
            </div>
          </div>

          <div 
            onClick={() => setIgnoreStockCheck(!ignoreStockCheck)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'space-between',
              padding: '14px 18px', 
              backgroundColor: '#ffffff',
              border: '1px solid var(--border-color)',
              borderRadius: '8px',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              marginBottom: '24px',
              userSelect: 'none'
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = 'var(--text-secondary)')}
            onMouseLeave={(e) => (e.currentTarget.style.borderColor = 'var(--border-color)')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: ignoreStockCheck ? '#10b981' : '#9ca3af',
                transition: 'background-color 0.2s ease',
                flexShrink: 0
              }} />
              <div>
                <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '0.88rem' }}>
                  Habilitar Facturación sin Stock Físico <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.825rem' }}>(Venta en negativo)</span>
                </div>
                <div style={{ fontSize: '0.825rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  Permite realizar ventas y emitir comprobantes incluso cuando el inventario del producto sea cero o negativo.
                </div>
              </div>
            </div>
            <div style={{
              width: '38px',
              height: '22px',
              backgroundColor: ignoreStockCheck ? '#10b981' : '#e5e7eb',
              borderRadius: '11px',
              position: 'relative',
              transition: 'background-color 0.2s ease',
              flexShrink: 0,
              marginLeft: '16px'
            }}>
              <div style={{
                width: '18px',
                height: '18px',
                backgroundColor: '#ffffff',
                borderRadius: '50%',
                position: 'absolute',
                top: '2px',
                left: ignoreStockCheck ? '18px' : '2px',
                transition: 'left 0.2s ease',
                boxShadow: '0 1px 2px rgba(0,0,0,0.15)'
              }} />
            </div>
          </div>

          <div style={{ marginTop: '20px', display: 'flex', justifyContent: 'flex-end' }}>
            <button type="submit" className="btn btn-primary" style={{ padding: '10px 24px', fontWeight: 600 }}>Guardar Cambios Empresa</button>
          </div>
        </form>
      )}

      {/* Sub-tab 3: Empleados */}
      {configTab === 'personal' && (
        <div className="card" style={{ padding: '20px 24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Users size={20} color="var(--color-primary)" /> Nómina de Empleados & Roles
              </h3>
              <p style={{ margin: '2px 0 0 0', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                Gestión unificada de accesos organizada por jerarquía y áreas de trabajo.
              </p>
            </div>
            <button className="btn btn-primary" style={{ padding: '8px 16px', fontSize: '0.85rem' }} onClick={() => setUserModal({ open: true, isEdit: false, username: '', password: '', role: 'VENDEDOR' })}>
              <UserPlus size={16} /> <span style={{ marginLeft: '6px' }}>Agregar Nuevo Empleado</span>
            </button>
          </div>

          <div className="table-container">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={{ padding: '8px 12px', fontSize: '0.8rem' }}>Usuario (Login)</th>
                  <th style={{ padding: '8px 12px', fontSize: '0.8rem' }}>Rol Asignado</th>
                  <th style={{ padding: '8px 12px', fontSize: '0.8rem' }}>Estado</th>
                  <th style={{ padding: '8px 12px', fontSize: '0.8rem', textAlign: 'right' }}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {[
                  {
                    roleKey: 'ADMIN',
                    title: 'Administración General',
                    desc: 'Pablo, Esteban y Administración principal',
                    icon: <Crown size={14} />,
                    bg: '#FDEDEC',
                    color: '#C0392B'
                  },
                  {
                    roleKey: 'FACTURACION',
                    title: 'Oficina / Administración',
                    desc: 'Dario, Agustin (Facturación, recibos, notas de crédito, listas de precio)',
                    icon: <Building2 size={14} />,
                    bg: '#EBF5FB',
                    color: '#2980B9'
                  },
                  {
                    roleKey: 'VENDEDOR',
                    title: 'Vendedores de Calle',
                    desc: 'Preventa y toma de pedidos en ruta',
                    icon: <Truck size={14} />,
                    bg: '#E8F8F5',
                    color: '#117A65'
                  },
                  {
                    roleKey: 'DEPOSITO',
                    title: 'Depósito y Logística',
                    desc: 'Armado de pedidos, pesables y control de stock',
                    icon: <Package size={14} />,
                    bg: '#FEF9E7',
                    color: '#B7950B'
                  }
                ].map(group => {
                  const groupUsers = users.filter(u => u.role === group.roleKey);
                  return (
                    <React.Fragment key={group.roleKey}>
                      {/* Fila Encabezado de Rol */}
                      <tr style={{ backgroundColor: group.bg, borderTop: '2px solid var(--border-color)', borderBottom: '1px solid var(--border-color)' }}>
                        <td colSpan={4} style={{ padding: '6px 12px', fontWeight: 700, fontSize: '0.82rem', color: group.color }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              {group.icon}
                              <span>{group.title}</span>
                              <span style={{ fontSize: '0.75rem', opacity: 0.8, fontWeight: 600 }}>({groupUsers.length})</span>
                            </div>
                            <span style={{ fontSize: '0.75rem', fontWeight: 500, color: 'var(--text-secondary)', fontStyle: 'italic' }}>
                              {group.desc}
                            </span>
                          </div>
                        </td>
                      </tr>

                      {/* Filas de Empleados del Rol */}
                      {groupUsers.length === 0 ? (
                        <tr>
                          <td colSpan={4} style={{ padding: '8px 12px', fontSize: '0.8rem', color: 'var(--text-secondary)', fontStyle: 'italic', textAlign: 'center' }}>
                            Sin cuentas asignadas en este rol.
                          </td>
                        </tr>
                      ) : (
                        groupUsers.map(u => (
                          <tr key={u.id} style={{ borderBottom: '1px solid #F1F5F9' }}>
                            <td style={{ padding: '8px 12px', fontWeight: 600, fontSize: '0.88rem' }}>
                              {u.username}
                              {u.username.toUpperCase() === 'OFICINA' && (
                                <span style={{ marginLeft: '8px', fontSize: '0.7rem', color: '#2980B9', background: '#EBF5FB', padding: '1px 6px', borderRadius: '4px', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                                  <Phone size={10} /> Teléfono / WhatsApp
                                </span>
                              )}
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span className="badge" style={{ backgroundColor: group.bg, color: group.color, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.78rem', padding: '2px 8px' }}>
                                {group.icon}
                                {group.title}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px' }}>
                              <span style={{ fontWeight: 600, fontSize: '0.82rem', color: u.isActive !== false ? 'var(--color-success)' : 'var(--color-danger)', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: u.isActive !== false ? 'var(--color-success)' : 'var(--color-danger)', display: 'inline-block' }} />
                                {u.isActive !== false ? 'Activo' : 'Desactivado'}
                              </span>
                            </td>
                            <td style={{ padding: '8px 12px', textAlign: 'right' }}>
                              <div style={{ display: 'flex', gap: '4px', justifyContent: 'flex-end' }}>
                                <button className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: '0.78rem' }} title="Editar Rol o Clave" onClick={() => handleOpenEditUser(u)}>
                                  <Edit3 size={13} /> Editar
                                </button>
                                <button className="btn btn-secondary btn-sm" style={{ padding: '3px 8px', fontSize: '0.78rem' }} onClick={() => handleToggleUserActive(u.id, u.username, u.isActive === false)}>
                                  {u.isActive !== false ? 'Desactivar' : 'Activar'}
                                </button>
                                <button className="btn btn-ghost btn-sm" style={{ padding: '3px 6px', color: 'var(--color-corp-red)' }} title="Eliminar Empleado" onClick={() => handleDeleteUser(u.username)}>
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}





      {/* Sub-tab 4: Auditoría (Logs) */}
      {configTab === 'audit' && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <div>
              <h3 className="card-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <FileText size={20} color="var(--color-primary)" /> Registro de Auditoría del Sistema
              </h3>
              <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                Historial completo en español de todas las operaciones realizadas por usuarios y procesos automáticos.
              </p>
            </div>
          </div>
          
          <div className="table-container">
            <table style={{ width: '100%', fontSize: '0.85rem' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 12px' }}>Fecha y Hora</th>
                  <th style={{ padding: '10px 12px' }}>Usuario en Sesión</th>
                  <th style={{ padding: '10px 12px' }}>Acción / Categoría</th>
                  <th style={{ padding: '10px 12px' }}>Detalle de la Operación</th>
                </tr>
              </thead>
              <tbody>
                {auditLogs.length === 0 ? (
                  <tr>
                    <td colSpan={4} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                      No hay registros de auditoría disponibles en esta página.
                    </td>
                  </tr>
                ) : (
                  auditLogs.map(l => {
                    // Formateo de usuario a español
                    const rawUser = l.user?.username || l.username;
                    const displayUser = (!rawUser || rawUser.toLowerCase() === 'system' || rawUser.toLowerCase() === 'sistema')
                      ? '⚙️ Sistema (Automático)'
                      : rawUser;

                    // Traducir acciones técnicas a español para el badge
                    const act = (l.action || l.category || '').toUpperCase();
                    let actionBadge = { label: l.category || l.action || 'Operación', bg: '#F1F5F9', color: '#475569' };

                    if (act.includes('CREATE_USER')) actionBadge = { label: 'Creación de Empleado', bg: '#FDEDEC', color: '#C0392B' };
                    else if (act.includes('UPDATE_USER')) actionBadge = { label: 'Edición de Empleado', bg: '#EBF5FB', color: '#2980B9' };
                    else if (act.includes('TOGGLE_USER')) actionBadge = { label: 'Cambio Estado Empleado', bg: '#FEF9E7', color: '#B7950B' };
                    else if (act.includes('DELETE_USER')) actionBadge = { label: 'Eliminación de Empleado', bg: '#FDEDEC', color: '#C0392B' };
                    else if (act.includes('LOGIN')) actionBadge = { label: 'Inicio de Sesión', bg: '#E8F8F5', color: '#117A65' };
                    else if (act.includes('DELETE_SUPPLIER') || act.includes('PURCHASE')) actionBadge = { label: 'Factura de Compra', bg: '#FDEDEC', color: '#C0392B' };
                    else if (act.includes('UPDATE_PERSONA') || act.includes('CREATE_PERSONA')) actionBadge = { label: 'Cliente / Proveedor', bg: '#EBF5FB', color: '#2980B9' };
                    else if (act.includes('RECORD_PERSONA_PAYMENT') || act.includes('PAYMENT')) actionBadge = { label: 'Cobro / Recibo', bg: '#E8F8F5', color: '#117A65' };
                    else if (act.includes('INVOICE') || act.includes('ORDER')) actionBadge = { label: 'Gestión de Pedido', bg: '#EBF5FB', color: '#2980B9' };
                    else if (act.includes('CONFIRM_ARMADO')) actionBadge = { label: 'Armado de Pedido', bg: '#FEF9E7', color: '#B7950B' };
                    else if (act.includes('COLLECTION') || act.includes('RENDICION')) actionBadge = { label: 'Rendición de Cobranza', bg: '#E8F8F5', color: '#117A65' };
                    else if (act.includes('STOCK')) actionBadge = { label: 'Ajuste de Stock', bg: '#FEF9E7', color: '#B7950B' };
                    else if (act.includes('CREDIT')) actionBadge = { label: 'Nota de Crédito', bg: '#FDEDEC', color: '#C0392B' };
                    else if (act.includes('CONFIG')) actionBadge = { label: 'Configuración Servidor', bg: '#F4ECF7', color: '#8E44AD' };
                    else if (act.includes('SYNC') || act.includes('RECONCILE')) actionBadge = { label: 'Auditoría de Saldos', bg: '#EBF5FB', color: '#2980B9' };

                    // Formatear mensaje descriptivo a español amigable
                    let rawMsg = l.message;
                    if (!rawMsg) {
                      const actionMap: Record<string, string> = {
                        CREATE_USER: 'Creó una nueva cuenta de empleado',
                        UPDATE_USER: 'Modificó datos o contraseña de empleado',
                        TOGGLE_USER_STATUS: 'Cambió estado activo/desactivado de empleado',
                        DELETE_USER: 'Eliminó una cuenta de empleado',
                        LOGIN: 'Inició sesión en el sistema',
                        UPDATE_CONFIG: 'Modificó la configuración general del servidor',
                        RECONCILE_STOCK: 'Ejecutó auditoría y control de desvío de stock',
                        SYNC_BALANCES: 'Sincronizó saldos de cuentas corrientes'
                      };
                      const actText = actionMap[l.action] || l.action || 'Realizó una operación';
                      const entText = l.entityType ? `en ${l.entityType}` : '';
                      const idText = l.entityId ? `(ID ${l.entityId})` : '';

                      let detail = '';
                      if (l.newValues) {
                        if (l.newValues.username) detail += ` [Usuario: ${l.newValues.username}]`;
                        if (l.newValues.role) detail += ` [Rol: ${l.newValues.role}]`;
                      }
                      rawMsg = `${actText} ${entText} ${idText}${detail}`.trim();
                    }

                    // Reemplazo visual a español fluido
                    const displayMessage = rawMsg
                      .replace(/DELETE_SUPPLIER_INVOICE/g, 'Eliminó factura de compra')
                      .replace(/UPDATE_PERSONA/g, 'Actualizó ficha de cliente/proveedor')
                      .replace(/CREATE_PERSONA/g, 'Creó ficha de cliente/proveedor')
                      .replace(/RECORD_PERSONA_PAYMENT/g, 'Registró cobro/recibo de cliente')
                      .replace(/INVOICE_ORDER/g, 'Facturó el pedido')
                      .replace(/CREATE_ORDER/g, 'Creó el pedido')
                      .replace(/CONFIRM_ARMADO/g, 'Confirmó armado de pedido en depósito')
                      .replace(/CREATE_COLLECTION/g, 'Registró rendición de cobranza')
                      .replace(/SupplierInvoice/g, 'Factura de Compra')
                      .replace(/CreditNote/g, 'Nota de Crédito')
                      .replace(/CashDrawer/g, 'Caja Registradora')
                      .replace(/Transaction/g, 'Movimiento Financiero')
                      .replace(/Persona/g, 'Cliente/Proveedor')
                      .replace(/Order/g, 'Pedido')
                      .replace(/User/g, 'Empleado');

                    return (
                      <tr key={l.id}>
                        <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                          {new Date(l.createdAt).toLocaleString('es-AR')}
                        </td>
                        <td style={{ fontWeight: 600 }}>
                          {displayUser}
                        </td>
                        <td>
                          <span className="badge" style={{ backgroundColor: actionBadge.bg, color: actionBadge.color, fontWeight: 700, fontSize: '0.78rem', padding: '2px 8px' }}>
                            {actionBadge.label}
                          </span>
                        </td>
                        <td style={{ color: 'var(--text-primary)' }}>
                          {displayMessage}
                        </td>
                      </tr>
                    );
                  })
                )}

              </tbody>
            </table>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px' }}>
            <button className="btn btn-secondary" onClick={() => setAuditPage(p => Math.max(1, p - 1))} disabled={auditPage === 1}>Anterior</button>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Página {auditPage} de {auditTotalPages}</span>
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

      {/* Modal de Agregar / Editar Empleado */}
      {userModal.open && (
        <div className="modal-overlay animate-fade-in" style={{ zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content" style={{ maxWidth: '480px', width: '100%', padding: '24px', borderRadius: '12px', background: '#fff', boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <UserPlus size={20} color="var(--primary-color)" />
                {userModal.isEdit ? `Editar Empleado: ${userModal.username}` : 'Registrar Nuevo Empleado'}
              </h3>
              <button type="button" className="btn btn-ghost" style={{ padding: '4px', cursor: 'pointer' }} onClick={() => setUserModal({ ...userModal, open: false })}>✕</button>
            </div>
            <form onSubmit={handleUserSubmit}>
              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>Nombre de usuario (Login)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="ej: esteban, pablo, oficina..."
                  value={userModal.username}
                  onChange={(e) => setUserModal({ ...userModal, username: e.target.value })}
                  required
                  style={{ width: '100%' }}
                />
              </div>

              <div className="form-group" style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>
                  {userModal.isEdit ? 'Nueva Contraseña (dejar en blanco para conservar actual)' : 'Contraseña de Acceso'}
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showPassword ? "text" : "password"}
                    className="input"
                    placeholder={userModal.isEdit ? "•••••••• (Ingresá nueva clave solo si querés cambiarla)" : "••••••••"}
                    value={userModal.password || ''}
                    onChange={(e) => setUserModal({ ...userModal, password: e.target.value })}
                    required={!userModal.isEdit}
                    style={{ width: '100%', paddingRight: '40px' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '10px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      color: '#6b7280'
                    }}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="form-group" style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 600, marginBottom: '6px' }}>Rol y Nivel de Acceso en Distribuidora</label>
                <select
                  className="select"
                  value={userModal.role}
                  onChange={(e) => setUserModal({ ...userModal, role: e.target.value })}
                  style={{ width: '100%', height: '40px', padding: '0 10px', fontSize: '0.85rem' }}
                >
                  <option value="ADMIN">Administrador General (Pablo / Esteban - Acceso Total)</option>
                  <option value="FACTURACION">Oficina / Administración (Facturación, Listas de Precio, Recibos, Notas de Crédito)</option>
                  <option value="VENDEDOR">Vendedor de Calle (Toma de pedidos en ruta)</option>
                  <option value="DEPOSITO">Depósito y Logística (Armado de pedidos, Balanza, Stock)</option>
                </select>
              </div>

              <div style={{ padding: '12px', backgroundColor: 'var(--bg-light, #fafafa)', borderRadius: '8px', border: '1px solid var(--border-color)', marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.82rem', fontWeight: 700, marginBottom: '8px', color: 'var(--text-primary)' }}>
                  ⚡ Matriz de Permisos Granulares por Módulo
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '8px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input type="checkbox" checked={userModal.permissions?.canSell ?? true} onChange={(e) => setUserModal({ ...userModal, permissions: { ...userModal.permissions, canSell: e.target.checked } })} />
                    🛒 Toma de Pedidos / Venta
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input type="checkbox" checked={userModal.permissions?.canPick ?? false} onChange={(e) => setUserModal({ ...userModal, permissions: { ...userModal.permissions, canPick: e.target.checked } })} />
                    📦 Armado Depósito (Picking)
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input type="checkbox" checked={userModal.permissions?.canDeliver ?? true} onChange={(e) => setUserModal({ ...userModal, permissions: { ...userModal.permissions, canDeliver: e.target.checked } })} />
                    🚚 Hojas de Reparto & GPS
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input type="checkbox" checked={userModal.permissions?.canCollect ?? true} onChange={(e) => setUserModal({ ...userModal, permissions: { ...userModal.permissions, canCollect: e.target.checked } })} />
                    💰 Cobranzas & Recibos
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.78rem', cursor: 'pointer', fontWeight: 500 }}>
                    <input type="checkbox" checked={userModal.permissions?.canManageStock ?? false} onChange={(e) => setUserModal({ ...userModal, permissions: { ...userModal.permissions, canManageStock: e.target.checked } })} />
                    📊 Inventario & Stock
                  </label>
                </div>
              </div>

              <div className="modal-footer" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
                <button type="button" className="btn btn-secondary" onClick={() => setUserModal({ ...userModal, open: false })}>Cancelar</button>
                <button type="submit" className="btn btn-primary">
                  {userModal.isEdit ? 'Guardar Cambios' : 'Crear Usuario'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

