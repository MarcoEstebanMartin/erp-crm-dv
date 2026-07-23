import { useState, useEffect } from 'react';
import { 
  Users, 
  DollarSign, 
  Sun, 
  FileText, 
  Plus, 
  Search, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  CreditCard, 
  Building2, 
  Calendar, 
  Briefcase, 
  TrendingUp,
  X,
  Printer,
  ChevronRight,
  UserPlus
} from 'lucide-react';
import { api } from '../utils/api';

export default function HrDashboard() {
  const [activeTab, setActiveTab] = useState<'plantilla' | 'vales' | 'liquidaciones' | 'vacaciones'>('plantilla');
  
  // Estados de datos
  const [employees, setEmployees] = useState<any[]>([]);
  const [advances, setAdvances] = useState<any[]>([]);
  const [payrolls, setPayrolls] = useState<any[]>([]);
  const [vacations, setVacations] = useState<any[]>([]);
  const [cashDrawers, setCashDrawers] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [departmentFilter, setDepartmentFilter] = useState<string>('TODOS');
  
  // Modales
  const [showEmployeeModal, setShowEmployeeModal] = useState<boolean>(false);
  const [showAdvanceModal, setShowAdvanceModal] = useState<boolean>(false);
  const [showPayrollModal, setShowPayrollModal] = useState<boolean>(false);
  const [showVacationModal, setShowVacationModal] = useState<boolean>(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [selectedPayrollReceipt, setSelectedPayrollReceipt] = useState<any | null>(null);
  const [legajoTab, setLegajoTab] = useState<'info' | 'vales' | 'liquidaciones' | 'vacaciones'>('info');

  // Formularios
  const [employeeForm, setEmployeeForm] = useState<any>({
    firstName: '',
    lastName: '',
    dni: '',
    cuil: '',
    email: '',
    phone: '',
    address: '',
    position: 'Chofer / Repartidor',
    department: 'LOGISTICA',
    hireDate: new Date().toISOString().split('T')[0],
    baseSalary: '',
    paymentMethod: 'BANK_TRANSFER',
    cbuAlias: '',
    bankName: 'Mercado Pago / Banco',
    emergencyContact: '',
    notes: ''
  });

  const [advanceForm, setAdvanceForm] = useState<any>({
    employeeId: '',
    amount: '',
    reason: 'Vale de Sueldo',
    paymentMethod: 'CASH',
    cashDrawerId: '',
    bankAccountId: ''
  });

  const [payrollForm, setPayrollForm] = useState<any>({
    employeeId: '',
    periodMonth: new Date().getMonth() + 1,
    periodYear: new Date().getFullYear(),
    baseSalary: 0,
    commissions: 0,
    overtimeAmount: 0,
    bonuses: 0,
    advancesDeduction: 0,
    otherDeductions: 0,
    paymentMethod: 'BANK_TRANSFER',
    cashDrawerId: '',
    bankAccountId: '',
    notes: ''
  });

  const [vacationForm, setVacationForm] = useState<any>({
    employeeId: '',
    year: new Date().getFullYear(),
    type: 'VACATION',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    comments: ''
  });

  const [calcLoading, setCalcLoading] = useState<boolean>(false);

  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [empRes, advRes, payRes, vacRes, drawersRes, banksRes] = await Promise.all([
        api.getEmployees().catch(() => []),
        api.getAdvances().catch(() => []),
        api.getPayrolls().catch(() => []),
        api.getVacations().catch(() => []),
        api.getCashDrawers ? api.getCashDrawers().catch(() => []) : Promise.resolve([]),
        api.getBankAccounts ? api.getBankAccounts().catch(() => []) : Promise.resolve([])
      ]);

      setEmployees(Array.isArray(empRes) ? empRes : []);
      setAdvances(Array.isArray(advRes) ? advRes : []);
      setPayrolls(Array.isArray(payRes) ? payRes : []);
      setVacations(Array.isArray(vacRes) ? vacRes : []);
      setCashDrawers(Array.isArray(drawersRes) ? drawersRes : []);
      setBankAccounts(Array.isArray(banksRes) ? banksRes : []);
    } catch (err) {
      console.error('Error al cargar datos de RRHH:', err);
    } finally {
      setLoading(false);
    }
  };

  // Guardar nuevo Empleado
  const handleSaveEmployee = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createEmployee(employeeForm);
      setShowEmployeeModal(false);
      setEmployeeForm({
        firstName: '', lastName: '', dni: '', cuil: '', email: '', phone: '', address: '',
        position: 'Chofer / Repartidor', department: 'LOGISTICA',
        hireDate: new Date().toISOString().split('T')[0], baseSalary: '',
        paymentMethod: 'BANK_TRANSFER', cbuAlias: '', bankName: 'Mercado Pago / Banco',
        emergencyContact: '', notes: ''
      });
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Error al guardar empleado');
    }
  };

  // Guardar nuevo Vale
  const handleSaveAdvance = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createAdvance({
        employeeId: parseInt(advanceForm.employeeId),
        amount: parseFloat(advanceForm.amount),
        reason: advanceForm.reason,
        paymentMethod: advanceForm.paymentMethod,
        cashDrawerId: advanceForm.cashDrawerId ? parseInt(advanceForm.cashDrawerId) : undefined,
        bankAccountId: advanceForm.bankAccountId ? parseInt(advanceForm.bankAccountId) : undefined
      });
      setShowAdvanceModal(false);
      setAdvanceForm({ employeeId: '', amount: '', reason: 'Vale de Sueldo', paymentMethod: 'CASH', cashDrawerId: '', bankAccountId: '' });
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Error al guardar vale');
    }
  };

  // Al seleccionar empleado en liquidación, precalcular vales y sueldos
  const handleSelectEmployeeForPayroll = async (empIdStr: string) => {
    if (!empIdStr) return;
    const empId = parseInt(empIdStr);
    setCalcLoading(true);
    try {
      const calcRes = await api.calculatePayroll(empId, payrollForm.periodMonth, payrollForm.periodYear);
      if (calcRes) {
        setPayrollForm((prev: any) => ({
          ...prev,
          employeeId: empIdStr,
          baseSalary: calcRes.baseSalary || 0,
          commissions: calcRes.suggestedCommissions || 0,
          advancesDeduction: calcRes.totalAdvances || 0
        }));
      }
    } catch (err) {
      console.error('Error al calcular liquidación:', err);
    } finally {
      setCalcLoading(false);
    }
  };

  // Guardar Liquidación de Sueldo
  const handleSavePayroll = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const result = await api.createPayroll(payrollForm);
      setShowPayrollModal(false);
      setPayrollForm({
        employeeId: '', periodMonth: new Date().getMonth() + 1, periodYear: new Date().getFullYear(),
        baseSalary: 0, commissions: 0, overtimeAmount: 0, bonuses: 0, advancesDeduction: 0, otherDeductions: 0,
        paymentMethod: 'BANK_TRANSFER', cashDrawerId: '', bankAccountId: '', notes: ''
      });
      loadAllData();
      if (result) {
        setSelectedPayrollReceipt(result);
      }
    } catch (err: any) {
      alert(err.message || 'Error al guardar liquidación');
    }
  };

  // Guardar Vacación
  const handleSaveVacation = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createVacation(vacationForm);
      setShowVacationModal(false);
      setVacationForm({
        employeeId: '', year: new Date().getFullYear(), type: 'VACATION',
        startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0], comments: ''
      });
      loadAllData();
    } catch (err: any) {
      alert(err.message || 'Error al registrar vacación');
    }
  };

  // Métricas calculadas
  const activeEmployees = employees.filter(e => e.isActive);
  const totalBaseSalaries = activeEmployees.reduce((acc, curr) => acc + Number(curr.baseSalary || 0), 0);
  const pendingAdvancesTotal = advances.filter(a => a.status === 'PENDING').reduce((acc, curr) => acc + Number(curr.amount || 0), 0);
  const activeVacationsCount = vacations.filter(v => v.status === 'APPROVED' || v.status === 'TAKEN').length;

  const filteredEmployees = employees.filter(emp => {
    const matchesSearch = `${emp.firstName} ${emp.lastName} ${emp.dni} ${emp.position}`.toLowerCase().includes(search.toLowerCase());
    const matchesDept = departmentFilter === 'TODOS' || emp.department === departmentFilter;
    return matchesSearch && matchesDept;
  });

  return (
    <div style={{ padding: '24px', maxWidth: '1400px', margin: '0 auto', color: 'var(--text-primary)' }}>
      {/* Header del Módulo */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
        <div>
          <h1 style={{ fontSize: '1.6rem', fontWeight: 700, margin: 0, display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Users style={{ color: 'var(--color-primary)' }} size={26} />
            Gestión de Recursos Humanos y Nómina
          </h1>
          <p style={{ margin: '4px 0 0 0', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
            Administración centralizada de legajos, adelantos de sueldo, liquidaciones y vacaciones
          </p>
        </div>

        <div style={{ display: 'flex', gap: '12px' }}>
          <button
            onClick={() => setShowAdvanceModal(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontWeight: 600 }}
          >
            <DollarSign size={16} />
            Nuevo Vale / Adelanto
          </button>
          <button
            onClick={() => setShowPayrollModal(true)}
            className="btn btn-secondary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', fontWeight: 600 }}
          >
            <FileText size={16} />
            Liquidación de Sueldos
          </button>
          <button
            onClick={() => setShowEmployeeModal(true)}
            className="btn btn-primary"
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 18px', fontWeight: 600 }}
          >
            <UserPlus size={18} />
            Nuevo Empleado
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas Principales */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '16px', marginBottom: '24px' }}>
        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Personal Activo</span>
            <Briefcase size={18} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{activeEmployees.length}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--color-success)', marginTop: '4px' }}>100% operativo en sistema</div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Masa Salarial Básica</span>
            <TrendingUp size={18} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>${totalBaseSalaries.toLocaleString('es-AR')}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Estimado mensual bruto</div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Vales Pendientes</span>
            <CreditCard size={18} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700, color: pendingAdvancesTotal > 0 ? '#f59e0b' : 'inherit' }}>
            ${pendingAdvancesTotal.toLocaleString('es-AR')}
          </div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            {advances.filter(a => a.status === 'PENDING').length} vale(s) a descontar
          </div>
        </div>

        <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '18px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', color: 'var(--text-secondary)', marginBottom: '8px' }}>
            <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Vacaciones y Licencias</span>
            <Sun size={18} />
          </div>
          <div style={{ fontSize: '1.8rem', fontWeight: 700 }}>{activeVacationsCount}</div>
          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '4px' }}>Programadas / En curso</div>
        </div>
      </div>

      {/* Pestañas de Navegación del Módulo */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border-color)', marginBottom: '20px', gap: '8px' }}>
        {[
          { id: 'plantilla', label: '👥 Plantilla de Empleados', count: employees.length },
          { id: 'vales', label: '💸 Vales y Adelantos', count: advances.filter(a => a.status === 'PENDING').length },
          { id: 'liquidaciones', label: '📄 Liquidación de Sueldos', count: payrolls.length },
          { id: 'vacaciones', label: '🏖️ Vacaciones y Licencias', count: vacations.length }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            style={{
              padding: '12px 20px',
              fontWeight: 600,
              fontSize: '0.92rem',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: activeTab === tab.id ? '2px solid var(--color-primary)' : '2px solid transparent',
              color: activeTab === tab.id ? 'var(--text-primary)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              transition: 'all 0.2s ease'
            }}
          >
            {tab.label}
            {tab.count > 0 && (
              <span style={{
                backgroundColor: activeTab === tab.id ? 'var(--color-primary)' : 'var(--bg-secondary)',
                color: '#fff',
                fontSize: '0.75rem',
                padding: '2px 8px',
                borderRadius: '12px'
              }}>
                {tab.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* CONTENIDO PESTAÑA 1: PLANTILLA DE EMPLEADOS */}
      {activeTab === 'plantilla' && (
        <div>
          {/* Barra de Filtros */}
          <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)' }} />
              <input
                type="text"
                placeholder="Buscar por nombre, apellido, DNI o puesto..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="input"
                style={{ paddingLeft: '38px', width: '100%' }}
              />
            </div>

            <select
              value={departmentFilter}
              onChange={e => setDepartmentFilter(e.target.value)}
              className="input"
              style={{ width: '220px' }}
            >
              <option value="TODOS">Todos los Departamentos</option>
              <option value="LOGISTICA">Logística / Choferes</option>
              <option value="VENTAS">Ventas / Preventa</option>
              <option value="DEPOSITO">Depósito / Operarios</option>
              <option value="ADMINISTRACION">Administración</option>
            </select>
          </div>

          {/* Tabla de Empleados */}
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>Cargando plantilla de personal...</div>
          ) : filteredEmployees.length === 0 ? (
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No se encontraron empleados registrados. Haz clic en <strong>"Nuevo Empleado"</strong> para dar de alta el primer legajo.
            </div>
          ) : (
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Empleado</th>
                    <th style={{ padding: '12px 16px' }}>DNI / CUIL</th>
                    <th style={{ padding: '12px 16px' }}>Puesto y Depto</th>
                    <th style={{ padding: '12px 16px' }}>Ingreso</th>
                    <th style={{ padding: '12px 16px' }}>Sueldo Básico</th>
                    <th style={{ padding: '12px 16px' }}>Pago / CBU</th>
                    <th style={{ padding: '12px 16px' }}>Vales Pend.</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredEmployees.map(emp => {
                    const pendingValesCount = emp.advances ? emp.advances.length : 0;
                    const pendingValesAmount = emp.advances ? emp.advances.reduce((a: number, c: any) => a + Number(c.amount), 0) : 0;

                    return (
                      <tr key={emp.id} style={{ borderBottom: '1px solid var(--border-color)', transition: 'background-color 0.15s' }}>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 600 }}>{emp.lastName}, {emp.firstName}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{emp.phone || emp.email || 'Sin contacto direct.'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div>{emp.dni}</div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{emp.cuil || '-'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontWeight: 500 }}>{emp.position}</div>
                          <span style={{ fontSize: '0.75rem', backgroundColor: 'var(--bg-secondary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>
                            {emp.department}
                          </span>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {new Date(emp.hireDate).toLocaleDateString('es-AR')}
                        </td>
                        <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                          ${Number(emp.baseSalary).toLocaleString('es-AR')}
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          <div style={{ fontSize: '0.82rem' }}>{emp.bankName || 'Efectivo'}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{emp.cbuAlias || '-'}</div>
                        </td>
                        <td style={{ padding: '12px 16px' }}>
                          {pendingValesCount > 0 ? (
                            <span style={{ color: '#f59e0b', fontWeight: 600, fontSize: '0.85rem' }}>
                              ${pendingValesAmount.toLocaleString('es-AR')} ({pendingValesCount})
                            </span>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Al día</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedEmployee(emp)}
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '6px 12px', fontSize: '0.82rem' }}
                          >
                            Ver Legajo
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO PESTAÑA 2: VALES Y ADELANTOS */}
      {activeTab === 'vales' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Historial de Vales y Adelantos Solicitados</h3>
            <button onClick={() => setShowAdvanceModal(true)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> Emitir Nuevo Vale
            </button>
          </div>

          {advances.length === 0 ? (
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No hay adelantos ni vales registrados actualmente.
            </div>
          ) : (
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Fecha</th>
                    <th style={{ padding: '12px 16px' }}>Empleado</th>
                    <th style={{ padding: '12px 16px' }}>Motivo / Concepto</th>
                    <th style={{ padding: '12px 16px' }}>Medio de Pago</th>
                    <th style={{ padding: '12px 16px' }}>Monto</th>
                    <th style={{ padding: '12px 16px' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {advances.map(adv => (
                    <tr key={adv.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 16px' }}>{new Date(adv.date).toLocaleDateString('es-AR')}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {adv.employee ? `${adv.employee.lastName}, ${adv.employee.firstName}` : `ID: ${adv.employeeId}`}
                      </td>
                      <td style={{ padding: '12px 16px' }}>{adv.reason || 'Adelanto de sueldo'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        {adv.paymentMethod === 'CASH' ? 'Efectivo (Caja)' : 'Transferencia Bancaria'}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, color: 'var(--color-primary)' }}>
                        ${Number(adv.amount).toLocaleString('es-AR')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {adv.status === 'PENDING' ? (
                          <span style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', color: '#f59e0b', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.78rem' }}>
                            PENDIENTE DE DESCUENTO
                          </span>
                        ) : (
                          <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.78rem' }}>
                            DESCONTADO EN LIQUIDACIÓN
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO PESTAÑA 3: LIQUIDACIÓN DE SUELDOS (PAYROLL) */}
      {activeTab === 'liquidaciones' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Registro de Liquidaciones de Haberes Procesadas</h3>
            <button onClick={() => setShowPayrollModal(true)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> Nueva Liquidación de Sueldo
            </button>
          </div>

          {payrolls.length === 0 ? (
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No se han procesado liquidaciones de sueldo aún.
            </div>
          ) : (
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Período</th>
                    <th style={{ padding: '12px 16px' }}>Empleado</th>
                    <th style={{ padding: '12px 16px' }}>Básico</th>
                    <th style={{ padding: '12px 16px' }}>Comisiones / Extras</th>
                    <th style={{ padding: '12px 16px' }}>Vales Descontados</th>
                    <th style={{ padding: '12px 16px' }}>Neto Cobrado</th>
                    <th style={{ padding: '12px 16px' }}>Estado / Pago</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Recibo</th>
                  </tr>
                </thead>
                <tbody>
                  {payrolls.map(pay => (
                    <tr key={pay.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>{pay.periodMonth}/{pay.periodYear}</td>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {pay.employee ? `${pay.employee.lastName}, ${pay.employee.firstName}` : `Empleado ID ${pay.employeeId}`}
                      </td>
                      <td style={{ padding: '12px 16px' }}>${Number(pay.baseSalary).toLocaleString('es-AR')}</td>
                      <td style={{ padding: '12px 16px', color: '#10b981' }}>
                        +${(Number(pay.commissions) + Number(pay.overtimeAmount) + Number(pay.bonuses)).toLocaleString('es-AR')}
                      </td>
                      <td style={{ padding: '12px 16px', color: '#ef4444' }}>
                        -${Number(pay.advancesDeduction).toLocaleString('es-AR')}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700, fontSize: '1rem' }}>
                        ${Number(pay.netSalary).toLocaleString('es-AR')}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.78rem' }}>
                          PAGADO ({pay.paymentMethod === 'CASH' ? 'EFECTIVO' : 'CBU'})
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', textAlign: 'right' }}>
                        <button
                          onClick={() => setSelectedPayrollReceipt(pay)}
                          className="btn btn-secondary btn-sm"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}
                        >
                          <Printer size={14} /> Recibo
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* CONTENIDO PESTAÑA 4: VACACIONES Y LICENCIAS */}
      {activeTab === 'vacaciones' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>Calendario de Vacaciones y Licencias</h3>
            <button onClick={() => setShowVacationModal(true)} className="btn btn-primary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Plus size={16} /> Programar Vacaciones / Licencia
            </button>
          </div>

          {vacations.length === 0 ? (
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '40px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              No hay solicitudes ni vacaciones programadas.
            </div>
          ) : (
            <div style={{ backgroundColor: 'var(--card-bg)', border: '1px solid var(--border-color)', borderRadius: '10px', overflow: 'hidden' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.9rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Empleado</th>
                    <th style={{ padding: '12px 16px' }}>Tipo</th>
                    <th style={{ padding: '12px 16px' }}>Desde - Hasta</th>
                    <th style={{ padding: '12px 16px' }}>Días Totales</th>
                    <th style={{ padding: '12px 16px' }}>Observaciones</th>
                    <th style={{ padding: '12px 16px' }}>Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {vacations.map(vac => (
                    <tr key={vac.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '12px 16px', fontWeight: 600 }}>
                        {vac.employee ? `${vac.employee.lastName}, ${vac.employee.firstName}` : `ID: ${vac.employeeId}`}
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ fontWeight: 500 }}>
                          {vac.type === 'VACATION' ? '🏖️ Vacaciones Anuales' : vac.type === 'SICK_LEAVE' ? '🩺 Licencia Médica' : '📋 Licencia Especial'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px' }}>
                        {new Date(vac.startDate).toLocaleDateString('es-AR')} al {new Date(vac.endDate).toLocaleDateString('es-AR')}
                      </td>
                      <td style={{ padding: '12px 16px', fontWeight: 700 }}>{vac.daysCount} días</td>
                      <td style={{ padding: '12px 16px', color: 'var(--text-secondary)' }}>{vac.comments || '-'}</td>
                      <td style={{ padding: '12px 16px' }}>
                        <span style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', color: '#10b981', padding: '4px 8px', borderRadius: '4px', fontWeight: 600, fontSize: '0.78rem' }}>
                          APROBADO
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* MODAL: NUEVO EMPLEADO */}
      {showEmployeeModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>Alta de Empleado (Nuevo Legajo)</h2>
              <button onClick={() => setShowEmployeeModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveEmployee} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Nombre *</label>
                <input type="text" required value={employeeForm.firstName} onChange={e => setEmployeeForm({ ...employeeForm, firstName: e.target.value })} className="input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Apellido *</label>
                <input type="text" required value={employeeForm.lastName} onChange={e => setEmployeeForm({ ...employeeForm, lastName: e.target.value })} className="input" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>DNI *</label>
                <input type="text" required value={employeeForm.dni} onChange={e => setEmployeeForm({ ...employeeForm, dni: e.target.value })} className="input" style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>CUIL</label>
                <input type="text" value={employeeForm.cuil} onChange={e => setEmployeeForm({ ...employeeForm, cuil: e.target.value })} className="input" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Puesto Laboral *</label>
                <select value={employeeForm.position} onChange={e => setEmployeeForm({ ...employeeForm, position: e.target.value })} className="input" style={{ width: '100%' }}>
                  <option value="Chofer / Repartidor">Chofer / Repartidor</option>
                  <option value="Vendedor Preventista">Vendedor Preventista</option>
                  <option value="Operario Depósito">Operario Depósito / Armado</option>
                  <option value="Administrativo Facturación">Administrativo / Facturación</option>
                  <option value="Cajero / Cobrador">Cajero / Cobrador</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Departamento</label>
                <select value={employeeForm.department} onChange={e => setEmployeeForm({ ...employeeForm, department: e.target.value })} className="input" style={{ width: '100%' }}>
                  <option value="LOGISTICA">Logística / Flota</option>
                  <option value="VENTAS">Ventas</option>
                  <option value="DEPOSITO">Depósito</option>
                  <option value="ADMINISTRACION">Administración</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Fecha de Ingreso *</label>
                <input type="date" required value={employeeForm.hireDate} onChange={e => setEmployeeForm({ ...employeeForm, hireDate: e.target.value })} className="input" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Sueldo Básico ($) *</label>
                <input type="number" step="0.01" required value={employeeForm.baseSalary} onChange={e => setEmployeeForm({ ...employeeForm, baseSalary: e.target.value })} className="input" style={{ width: '100%' }} placeholder="Ej: 650000" />
              </div>

              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>CBU / ALIAS para Pago de Haberes</label>
                <input type="text" value={employeeForm.cbuAlias} onChange={e => setEmployeeForm({ ...employeeForm, cbuAlias: e.target.value })} className="input" style={{ width: '100%' }} placeholder="Ej: distribuidora.marquitos.mp" />
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowEmployeeModal(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Registrar Empleado</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVO VALE / ADELANTO */}
      {showAdvanceModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '500px', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Emisión de Vale / Adelanto</h2>
              <button onClick={() => setShowAdvanceModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSaveAdvance} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Empleado *</label>
                <select required value={advanceForm.employeeId} onChange={e => setAdvanceForm({ ...advanceForm, employeeId: e.target.value })} className="input" style={{ width: '100%' }}>
                  <option value="">-- Seleccionar Empleado --</option>
                  {employees.filter(e => e.isActive).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.lastName}, {emp.firstName} ({emp.position})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Monto a Adelantar ($) *</label>
                <input type="number" step="0.01" required value={advanceForm.amount} onChange={e => setAdvanceForm({ ...advanceForm, amount: e.target.value })} className="input" style={{ width: '100%' }} placeholder="Ej: 50000" />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Medio de Pago</label>
                <select value={advanceForm.paymentMethod} onChange={e => setAdvanceForm({ ...advanceForm, paymentMethod: e.target.value })} className="input" style={{ width: '100%' }}>
                  <option value="CASH">Efectivo (Descontar de Caja)</option>
                  <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Motivo / Observaciones</label>
                <input type="text" value={advanceForm.reason} onChange={e => setAdvanceForm({ ...advanceForm, reason: e.target.value })} className="input" style={{ width: '100%' }} placeholder="Ej: Adelanto quincena" />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowAdvanceModal(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Emitir Vale</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: NUEVA LIQUIDACIÓN DE SUELDO */}
      {showPayrollModal && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: 'var(--card-bg)', borderRadius: '12px', border: '1px solid var(--border-color)', width: '100%', maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto', padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ margin: 0, fontSize: '1.3rem', fontWeight: 700 }}>Procesar Liquidación de Sueldo</h2>
              <button onClick={() => setShowPayrollModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer' }}><X size={20} /></button>
            </div>

            <form onSubmit={handleSavePayroll} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Empleado *</label>
                <select required value={payrollForm.employeeId} onChange={e => handleSelectEmployeeForPayroll(e.target.value)} className="input" style={{ width: '100%' }}>
                  <option value="">-- Seleccionar Empleado --</option>
                  {employees.filter(e => e.isActive).map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.lastName}, {emp.firstName} ({emp.position})</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Mes Periodo</label>
                <select value={payrollForm.periodMonth} onChange={e => setPayrollForm({ ...payrollForm, periodMonth: parseInt(e.target.value) })} className="input" style={{ width: '100%' }}>
                  {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                    <option key={m} value={m}>Mes {m}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Año Periodo</label>
                <input type="number" value={payrollForm.periodYear} onChange={e => setPayrollForm({ ...payrollForm, periodYear: parseInt(e.target.value) })} className="input" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Sueldo Básico ($)</label>
                <input type="number" step="0.01" value={payrollForm.baseSalary} onChange={e => setPayrollForm({ ...payrollForm, baseSalary: parseFloat(e.target.value) || 0 })} className="input" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Comisiones Ventas ($)</label>
                <input type="number" step="0.01" value={payrollForm.commissions} onChange={e => setPayrollForm({ ...payrollForm, commissions: parseFloat(e.target.value) || 0 })} className="input" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Vales a Descontar ($)</label>
                <input type="number" step="0.01" value={payrollForm.advancesDeduction} onChange={e => setPayrollForm({ ...payrollForm, advancesDeduction: parseFloat(e.target.value) || 0 })} className="input" style={{ width: '100%' }} />
              </div>

              <div>
                <label style={{ fontSize: '0.82rem', fontWeight: 600, display: 'block', marginBottom: '4px' }}>Horas Extras / Bonos ($)</label>
                <input type="number" step="0.01" value={payrollForm.overtimeAmount} onChange={e => setPayrollForm({ ...payrollForm, overtimeAmount: parseFloat(e.target.value) || 0 })} className="input" style={{ width: '100%' }} />
              </div>

              {/* Total Calculado Neto */}
              <div style={{ gridColumn: 'span 2', backgroundColor: 'var(--bg-secondary)', padding: '16px', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Neto Final a Cobrar:</div>
                  <div style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--color-success)' }}>
                    ${((payrollForm.baseSalary + payrollForm.commissions + payrollForm.overtimeAmount) - payrollForm.advancesDeduction).toLocaleString('es-AR')}
                  </div>
                </div>
              </div>

              <div style={{ gridColumn: 'span 2', display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '16px' }}>
                <button type="button" onClick={() => setShowPayrollModal(false)} className="btn btn-secondary">Cancelar</button>
                <button type="submit" className="btn btn-primary">Aprobar y Registrar Liquidación</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: RECIBO DE SUELDO DIGITAL IMPRIMIBLE */}
      {selectedPayrollReceipt && (
        <div style={{ position: 'fixed', inset: 0, backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
          <div style={{ backgroundColor: '#fff', color: '#111', borderRadius: '12px', width: '100%', maxWidth: '650px', padding: '32px', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '2px solid #222', paddingBottom: '16px', marginBottom: '20px' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 800 }}>DISTRIBUIDORA DV</h2>
                <div style={{ fontSize: '0.85rem', color: '#555' }}>Comprobante de Pago de Haberes</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>PERIODO: {selectedPayrollReceipt.periodMonth}/{selectedPayrollReceipt.periodYear}</div>
                <div style={{ fontSize: '0.8rem', color: '#666' }}>Fecha: {new Date().toLocaleDateString('es-AR')}</div>
              </div>
            </div>

            <div style={{ marginBottom: '20px', fontSize: '0.9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', backgroundColor: '#f8fafc', padding: '12px', borderRadius: '6px' }}>
              <div><strong>Empleado:</strong> {selectedPayrollReceipt.employee?.lastName}, {selectedPayrollReceipt.employee?.firstName}</div>
              <div><strong>DNI:</strong> {selectedPayrollReceipt.employee?.dni}</div>
              <div><strong>Puesto:</strong> {selectedPayrollReceipt.employee?.position}</div>
              <div><strong>Banco / CBU:</strong> {selectedPayrollReceipt.employee?.cbuAlias || 'Efectivo'}</div>
            </div>

            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px', fontSize: '0.9rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid #ccc', textAlign: 'left' }}>
                  <th style={{ padding: '8px 0' }}>Concepto</th>
                  <th style={{ padding: '8px 0', textAlign: 'right' }}>Haberes</th>
                  <th style={{ padding: '8px 0', textAlign: 'right' }}>Deducciones</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style={{ padding: '6px 0' }}>Sueldo Básico</td>
                  <td style={{ padding: '6px 0', textAlign: 'right' }}>${Number(selectedPayrollReceipt.baseSalary).toLocaleString('es-AR')}</td>
                  <td></td>
                </tr>
                {Number(selectedPayrollReceipt.commissions) > 0 && (
                  <tr>
                    <td style={{ padding: '6px 0' }}>Comisiones de Venta</td>
                    <td style={{ padding: '6px 0', textAlign: 'right' }}>${Number(selectedPayrollReceipt.commissions).toLocaleString('es-AR')}</td>
                    <td></td>
                  </tr>
                )}
                {Number(selectedPayrollReceipt.advancesDeduction) > 0 && (
                  <tr>
                    <td style={{ padding: '6px 0' }}>Descuento de Vales Solicitados</td>
                    <td></td>
                    <td style={{ padding: '6px 0', textAlign: 'right', color: '#dc2626' }}>-${Number(selectedPayrollReceipt.advancesDeduction).toLocaleString('es-AR')}</td>
                  </tr>
                )}
              </tbody>
            </table>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '2px solid #222', paddingTop: '12px', fontSize: '1.2rem', fontWeight: 800 }}>
              <span>NETO A COBRAR:</span>
              <span>${Number(selectedPayrollReceipt.netSalary).toLocaleString('es-AR')}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', marginTop: '24px' }}>
              <button onClick={() => window.print()} className="btn btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Printer size={16} /> Imprimir Comprobante
              </button>
              <button onClick={() => setSelectedPayrollReceipt(null)} className="btn btn-primary">Cerrar</button>
            </div>
          </div>
        </div>
      )}

      {/* DRAWER / DETALLE DE LEGAJO DE EMPLEADO */}
      {selectedEmployee && (() => {
        const empAdvances = advances.filter(a => Number(a.employeeId) === Number(selectedEmployee.id));
        const empPayrolls = payrolls.filter(p => Number(p.employeeId) === Number(selectedEmployee.id));
        const empVacations = vacations.filter(v => Number(v.employeeId) === Number(selectedEmployee.id));
        const pendingValesTotal = empAdvances.filter(a => a.status === 'PENDING').reduce((acc, c) => acc + Number(c.amount || 0), 0);

        // Antigüedad
        const hireDateObj = new Date(selectedEmployee.hireDate);
        const nowObj = new Date();
        const yearsDiff = nowObj.getFullYear() - hireDateObj.getFullYear();
        const monthsDiff = nowObj.getMonth() - hireDateObj.getMonth();
        let totalMonths = yearsDiff * 12 + monthsDiff;
        if (totalMonths < 0) totalMonths = 0;
        const yearsAntig = Math.floor(totalMonths / 12);
        const monthsAntig = totalMonths % 12;
        const antigText = yearsAntig > 0 
          ? `${yearsAntig} año(s) ${monthsAntig > 0 ? `y ${monthsAntig} mes(es)` : ''}`
          : `${monthsAntig} mes(es)`;

        return (
          <div style={{
            position: 'fixed',
            inset: 0,
            backgroundColor: 'rgba(15, 23, 42, 0.65)',
            backdropFilter: 'blur(4px)',
            zIndex: 1050,
            display: 'flex',
            justifyContent: 'flex-end'
          }}>
            <div style={{
              backgroundColor: '#FFFFFF',
              color: '#111827',
              width: '100%',
              maxWidth: '580px',
              height: '100%',
              display: 'flex',
              flexDirection: 'column',
              boxShadow: '-8px 0 30px rgba(0,0,0,0.25)',
              borderLeft: '1px solid var(--border-color)',
              position: 'relative'
            }}>
              {/* Header Drawer */}
              <div style={{
                padding: '20px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                backgroundColor: '#FFFFFF'
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{
                    width: '44px',
                    height: '44px',
                    borderRadius: '10px',
                    backgroundColor: 'var(--color-corp-red)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 4px rgba(227,6,19,0.3)'
                  }}>
                    {selectedEmployee.firstName ? selectedEmployee.firstName[0] : 'E'}{selectedEmployee.lastName ? selectedEmployee.lastName[0] : ''}
                  </div>
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                      Legajo N° {String(selectedEmployee.id).padStart(4, '0')}
                    </div>
                    <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {selectedEmployee.lastName}, {selectedEmployee.firstName}
                    </h2>
                  </div>
                </div>
                <button
                  onClick={() => setSelectedEmployee(null)}
                  style={{
                    background: 'var(--bg-secondary)',
                    border: 'none',
                    borderRadius: '8px',
                    width: '32px',
                    height: '32px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--text-secondary)',
                    cursor: 'pointer',
                    transition: 'all 0.15s'
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              {/* Sub-Header con Info Clave y Estado */}
              <div style={{
                backgroundColor: 'var(--bg-app)',
                padding: '16px 24px',
                borderBottom: '1px solid var(--border-color)',
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '12px'
              }}>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Puesto</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedEmployee.position}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Departamento</span>
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedEmployee.department}</span>
                </div>
                <div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block' }}>Estado</span>
                  <span style={{
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color: selectedEmployee.isActive !== false ? '#10B981' : '#EF4444',
                    backgroundColor: selectedEmployee.isActive !== false ? '#ECFDF5' : '#FEF2F2',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    display: 'inline-block'
                  }}>
                    {selectedEmployee.isActive !== false ? '● ACTIVO' : '○ INACTIVO'}
                  </span>
                </div>
              </div>

              {/* Pestañas del Legajo */}
              <div style={{
                display: 'flex',
                borderBottom: '1px solid var(--border-color)',
                backgroundColor: '#FFFFFF',
                padding: '0 16px'
              }}>
                {[
                  { id: 'info', label: '📄 Ficha Técnica' },
                  { id: 'vales', label: `💸 Vales (${empAdvances.length})` },
                  { id: 'liquidaciones', label: `📄 Nómina (${empPayrolls.length})` },
                  { id: 'vacaciones', label: `🏖️ Licencias (${empVacations.length})` }
                ].map(t => (
                  <button
                    key={t.id}
                    onClick={() => setLegajoTab(t.id as any)}
                    style={{
                      flex: 1,
                      padding: '12px 6px',
                      fontSize: '0.82rem',
                      fontWeight: 600,
                      backgroundColor: 'transparent',
                      border: 'none',
                      borderBottom: legajoTab === t.id ? '2px solid var(--color-corp-red)' : '2px solid transparent',
                      color: legajoTab === t.id ? 'var(--color-corp-red)' : 'var(--text-secondary)',
                      cursor: 'pointer',
                      transition: 'all 0.15s'
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              {/* Cuerpo / Contenido Navegable del Drawer */}
              <div style={{ flex: 1, overflowY: 'auto', padding: '24px', backgroundColor: '#FFFFFF' }}>

                {/* TAB 1: FICHA TÉCNICA Y DATOS PERSONALES */}
                {legajoTab === 'info' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>

                    {/* Resumen Financiero Rápido */}
                    <div style={{
                      display: 'grid',
                      gridTemplateColumns: '1fr 1fr',
                      gap: '12px',
                      backgroundColor: 'var(--bg-app)',
                      padding: '14px',
                      borderRadius: '10px',
                      border: '1px solid var(--border-color)'
                    }}>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sueldo Básico Actual</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                          ${Number(selectedEmployee.baseSalary || 0).toLocaleString('es-AR')}
                        </div>
                      </div>
                      <div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Vales a Descontar</div>
                        <div style={{ fontSize: '1.2rem', fontWeight: 700, color: pendingValesTotal > 0 ? '#F59E0B' : '#10B981' }}>
                          ${pendingValesTotal.toLocaleString('es-AR')}
                        </div>
                      </div>
                    </div>

                    {/* Sección 1: Datos de Identificación */}
                    <div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                        Identificación y Contacto
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.88rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem' }}>DNI</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedEmployee.dni}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem' }}>CUIL</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedEmployee.cuil || 'No registrado'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem' }}>Teléfono</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedEmployee.phone || 'Sin datos'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem' }}>Email</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedEmployee.email || 'Sin datos'}</strong>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem' }}>Dirección / Domicilio</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedEmployee.address || 'No registrado'}</strong>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem' }}>Contacto de Emergencia</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedEmployee.emergencyContact || 'No especificado'}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Sección 2: Datos Laborales y Antigüedad */}
                    <div>
                      <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px', borderBottom: '1px solid var(--border-color)', paddingBottom: '6px' }}>
                        Relación Laboral
                      </h4>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', fontSize: '0.88rem' }}>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem' }}>Fecha de Ingreso</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{new Date(selectedEmployee.hireDate).toLocaleDateString('es-AR')}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem' }}>Antigüedad</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{antigText}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem' }}>Forma de Pago</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedEmployee.paymentMethod === 'CASH' ? 'Efectivo en Caja' : 'Transferencia Bancaria'}</strong>
                        </div>
                        <div>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem' }}>Banco / Entidad</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedEmployee.bankName || 'Mercado Pago / Banco'}</strong>
                        </div>
                        <div style={{ gridColumn: 'span 2' }}>
                          <span style={{ color: 'var(--text-secondary)', display: 'block', fontSize: '0.78rem' }}>CBU / Alias</span>
                          <strong style={{ color: 'var(--text-primary)' }}>{selectedEmployee.cbuAlias || 'No configurado'}</strong>
                        </div>
                      </div>
                    </div>

                    {selectedEmployee.notes && (
                      <div>
                        <h4 style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                          Observaciones Internas
                        </h4>
                        <div style={{ backgroundColor: 'var(--bg-app)', padding: '10px 14px', borderRadius: '8px', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          {selectedEmployee.notes}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 2: VALES DEL EMPLEADO */}
                {legajoTab === 'vales' && (
                  <div>
                    {empAdvances.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        Este empleado no tiene vales ni adelantos registrados.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {empAdvances.map(a => (
                          <div key={a.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{a.reason || 'Adelanto de Sueldo'}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                {new Date(a.date).toLocaleDateString('es-AR')} • {a.paymentMethod === 'CASH' ? 'Efectivo' : 'Transferencia'}
                              </div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                              <div style={{ fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)' }}>
                                ${Number(a.amount).toLocaleString('es-AR')}
                              </div>
                              <span style={{
                                fontSize: '0.72rem',
                                fontWeight: 700,
                                color: a.status === 'PENDING' ? '#F59E0B' : '#10B981',
                                backgroundColor: a.status === 'PENDING' ? '#FFFBEB' : '#ECFDF5',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}>
                                {a.status === 'PENDING' ? 'PENDIENTE' : 'DESCONTADO'}
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 3: LIQUIDACIONES Y HABERES */}
                {legajoTab === 'liquidaciones' && (
                  <div>
                    {empPayrolls.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        No hay recibos de haberes procesados para este empleado.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {empPayrolls.map(p => (
                          <div key={p.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 14px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div>
                              <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>Período {p.periodMonth}/{p.periodYear}</div>
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                                Básico: ${Number(p.baseSalary).toLocaleString('es-AR')} • Desc: -${Number(p.advancesDeduction).toLocaleString('es-AR')}
                              </div>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                              <div style={{ textAlign: 'right' }}>
                                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#10B981' }}>
                                  ${Number(p.netSalary).toLocaleString('es-AR')}
                                </div>
                                <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>NETO COBRADO</div>
                              </div>
                              <button
                                onClick={() => setSelectedPayrollReceipt(p)}
                                className="btn btn-secondary btn-sm"
                                style={{ padding: '6px 10px', fontSize: '0.78rem', display: 'flex', alignItems: 'center', gap: '4px' }}
                              >
                                <Printer size={14} /> Recibo
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* TAB 4: VACACIONES Y LICENCIAS */}
                {legajoTab === 'vacaciones' && (
                  <div>
                    {empVacations.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-secondary)', fontSize: '0.9rem' }}>
                        No hay solicitudes ni licencias registradas para este legajo.
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                        {empVacations.map(v => (
                          <div key={v.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '12px 14px' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                              <strong style={{ fontSize: '0.88rem' }}>
                                {v.type === 'VACATION' ? '🏖️ Vacaciones Anuales' : v.type === 'SICK_LEAVE' ? '🩺 Licencia Médica' : '📋 Licencia Especial'}
                              </strong>
                              <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#10B981', backgroundColor: '#ECFDF5', padding: '2px 8px', borderRadius: '4px' }}>
                                {v.daysCount} DÍAS
                              </span>
                            </div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                              Del {new Date(v.startDate).toLocaleDateString('es-AR')} al {new Date(v.endDate).toLocaleDateString('es-AR')}
                            </div>
                            {v.comments && (
                              <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px', fontStyle: 'italic' }}>
                                "{v.comments}"
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Acciones Rápidas en el Pie del Drawer */}
              <div style={{
                padding: '16px 24px',
                borderTop: '1px solid var(--border-color)',
                backgroundColor: 'var(--bg-app)',
                display: 'flex',
                justifyContent: 'space-between',
                gap: '12px'
              }}>
                <button
                  onClick={() => {
                    setAdvanceForm((prev: any) => ({ ...prev, employeeId: String(selectedEmployee.id) }));
                    setShowAdvanceModal(true);
                  }}
                  className="btn btn-secondary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}
                >
                  <DollarSign size={16} /> Emitir Vale
                </button>
                <button
                  onClick={() => {
                    handleSelectEmployeeForPayroll(String(selectedEmployee.id));
                    setShowPayrollModal(true);
                  }}
                  className="btn btn-primary"
                  style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.85rem' }}
                >
                  <FileText size={16} /> Liquidar Sueldo
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
}
