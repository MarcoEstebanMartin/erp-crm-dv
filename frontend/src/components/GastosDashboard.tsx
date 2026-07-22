import React, { useState, useEffect } from 'react';
import { api } from '../utils/api';
import { DollarSign, Plus, Trash2, X, RefreshCw, Calendar, FileText, CheckCircle, Tag, Truck, UploadCloud, AlertCircle, Filter, Check, FileSpreadsheet, TrendingDown, Info, Car } from 'lucide-react';
import { useConfirm } from '../context/ConfirmContext';

interface ExpenseCategory {
  id: number;
  name: string;
  description: string | null;
}

interface Expense {
  id: number;
  amount: string;
  date: string;
  description: string;
  categoryId: number;
  category: ExpenseCategory;
  paymentMethod: string;
  cashDrawerId: number | null;
  bankAccountId: number | null;
  vehicleId: number | null;
  vehicle?: { id: number; plate: string; brand: string; model: string } | null;
  user: { id: number; username: string };
  transaction?: any;
}

export default function GastosDashboard() {
  const confirm = useConfirm();
  // Datos principales
  const [gastos, setGastos] = useState<any[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);
  
  // Estado de carga y errores
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  
  // Filtros (Inicializado en el mes actual)
  const [selectedYear, setSelectedYear] = useState<number>(new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState<number>(new Date().getMonth() + 1);
  const [filterCategoryId, setFilterCategoryId] = useState<string>('');
  const [filterPaymentMethod, setFilterPaymentMethod] = useState<string>('');
  
  // Modales
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  
  // Formulario nuevo gasto
  const [newAmount, setNewAmount] = useState('');
  const [newCategoryId, setNewCategoryId] = useState('');
  const [newDescription, setNewDescription] = useState('');
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [newPaymentMethod, setNewPaymentMethod] = useState('CASH');
  const [newBankAccountId, setNewBankAccountId] = useState('');
  const [newVehicleId, setNewVehicleId] = useState('');
  const [newBillingType, setNewBillingType] = useState('INTERNAL');

  // Carga inicial
  useEffect(() => {
    fetchInitialData();
  }, []);

  // Recargar al cambiar filtros de período
  useEffect(() => {
    fetchExpenses();
  }, [selectedYear, selectedMonth, filterCategoryId, filterPaymentMethod]);

  const fetchInitialData = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Cargar Categorías
      const cats = await api.getExpenseCategories();
      setCategories(cats || []);
      
      // 2. Cargar Bancos y Cajas
      try {
        const fleetData = await api.getCashDrawers();
        const bankData = await api.getBankAccounts();
        setBankAccounts(bankData || []);
      } catch (e) {
        console.error('Error fetching bank accounts', e);
      }
      
      // Intentamos cargar vehículos usando la ruta directa en el backend
      try {
        const token = localStorage.getItem('auth_token');
        const res = await fetch(`http://${window.location.hostname}:3000/api/fleet/vehicles`, {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        const json = await res.json();
        if (json.status === 'success') {
          setVehicles(json.data.vehicles || []);
        }
      } catch (e) {
        console.error('Error fetching vehicles', e);
      }

      try {
        await fetchExpenses();
      } catch (e) {
        console.error('Error fetching expenses', e);
      }
    } catch (error: any) {
      console.error(error);
      setErrorMsg('Error al cargar la información inicial.');
    } finally {
      setLoading(false);
    }
  };

  const fetchExpenses = async () => {
    try {
      const filters: any = {
        year: selectedYear,
        month: selectedMonth
      };
      if (filterCategoryId) filters.categoryId = Number(filterCategoryId);
      if (filterPaymentMethod) filters.paymentMethod = filterPaymentMethod;

      const data = await api.getExpensesList(filters);
      setExpenses(data || []);
    } catch (err: any) {
      console.error(err);
      setErrorMsg('Error al obtener el listado de gastos.');
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    
    const amount = Number(newAmount);
    if (isNaN(amount) || amount <= 0) {
      setErrorMsg('Por favor, ingrese un monto válido mayor a 0.');
      return;
    }
    if (!newCategoryId) {
      setErrorMsg('Debe seleccionar una categoría para el gasto.');
      return;
    }
    if (!newDescription.trim()) {
      setErrorMsg('La descripción es obligatoria.');
      return;
    }

    setSubmitting(true);
    try {
      await api.createExpenseNew({
        amount,
        categoryId: Number(newCategoryId),
        description: newDescription.trim(),
        date: newDate ? new Date(newDate).toISOString() : undefined,
        paymentMethod: newPaymentMethod,
        bankAccountId: newPaymentMethod === 'BANK_TRANSFER' ? Number(newBankAccountId) : undefined,
        vehicleId: newVehicleId ? Number(newVehicleId) : undefined,
        billingType: newBillingType
      });

      setSuccessMsg('Gasto registrado con éxito.');
      setIsCreateModalOpen(false);
      resetForm();
      fetchExpenses();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al registrar el gasto.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: number) => {
    if (!await confirm('¿Está seguro de que desea eliminar este gasto? Si afectó a una cuenta bancaria, se revertirá el saldo correspondiente.', { type: 'danger' })) {
      return;
    }

    setErrorMsg(null);
    try {
      await api.deleteExpenseNew(id);
      setSuccessMsg('Gasto eliminado con éxito.');
      fetchExpenses();
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al eliminar el gasto.');
    }
  };

  // Importar Excel
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleImportExcel = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      setErrorMsg('Por favor seleccione un archivo Excel.');
      return;
    }

    setImporting(true);
    setErrorMsg(null);
    try {
      const res = await api.importExpensesExcel(selectedFile);
      setSuccessMsg(res.message || 'Gastos importados exitosamente.');
      setIsImportModalOpen(false);
      setSelectedFile(null);
      
      // Auto-seleccionar Mayo 2026 para visualizar inmediatamente los datos del Excel
      setSelectedYear(2026);
      setSelectedMonth(5);
      
      fetchExpenses();
      setTimeout(() => setSuccessMsg(null), 5000);
    } catch (err: any) {
      console.error(err);
      setErrorMsg(err.message || 'Error al importar los gastos del Excel.');
    } finally {
      setImporting(false);
    }
  };

  const resetForm = () => {
    setNewAmount('');
    setNewCategoryId('');
    setNewDescription('');
    setNewDate(new Date().toISOString().split('T')[0]);
    setNewPaymentMethod('CASH');
    setNewBankAccountId('');
    setNewVehicleId('');
    setNewBillingType('INTERNAL');
  };

  // Cálculos estadísticos
  const totalGasto = expenses.reduce((sum, e) => sum + Number(e.amount), 0);
  
  // Agrupar por categoría
  const categoryTotals: { [key: string]: { amount: number; description: string | null } } = {};
  expenses.forEach(e => {
    const catName = e.category?.name || 'General';
    if (!categoryTotals[catName]) {
      categoryTotals[catName] = { amount: 0, description: e.category?.description || 'Gastos operativos generales' };
    }
    categoryTotals[catName].amount += Number(e.amount);
  });

  const sortedCategories = Object.keys(categoryTotals)
    .map(name => ({
      name,
      amount: categoryTotals[name].amount,
      pct: totalGasto > 0 ? (categoryTotals[name].amount / totalGasto) * 100 : 0,
      description: categoryTotals[name].description
    }))
    .sort((a, b) => b.amount - a.amount);

  const getMethodLabel = (method: string) => {
    switch (method) {
      case 'CASH': return 'Efectivo';
      case 'BANK_TRANSFER': return 'Transf. Bancaria';
      case 'CHECK': return 'Cheque';
      default: return method;
    }
  };

  const getMonthName = (m: number) => {
    const months = [
      'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
      'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
    ];
    return months[m - 1];
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '24px', padding: '4px' }}>
      
      {/* Mensajes de feedback */}
      {errorMsg && (
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: '#fff5f5', 
          color: '#c53030', 
          borderRadius: '6px', 
          fontSize: '0.88rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          border: '1px solid #feb2b2'
        }}>
          <AlertCircle size={16} />
          <span>{errorMsg}</span>
        </div>
      )}

      {successMsg && (
        <div style={{ 
          padding: '12px 16px', 
          backgroundColor: '#f0fff4', 
          color: '#22543d', 
          borderRadius: '6px', 
          fontSize: '0.88rem', 
          display: 'flex', 
          alignItems: 'center', 
          gap: '10px',
          border: '1px solid #9ae6b4'
        }}>
          <Check size={16} style={{ color: '#38a169' }} />
          <span>{successMsg}</span>
        </div>
      )}

      {/* Cabecera del Dashboard */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Control de Gastos Operativos</h2>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Lleva el registro y categorización de egresos para el cálculo exacto de la rentabilidad.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '12px' }}>
          <button 
            className="btn btn-secondary" 
            onClick={() => setIsImportModalOpen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px' }}
          >
            <FileSpreadsheet size={16} />
            <span>Importar Excel</span>
          </button>
          
          <button 
            className="btn" 
            onClick={() => setIsCreateModalOpen(true)}
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              gap: '8px', 
              backgroundColor: 'var(--color-primary)', 
              color: '#fff', 
              padding: '10px 16px',
              borderRadius: '6px',
              fontWeight: 500
            }}
          >
            <Plus size={16} />
            <span>Registrar Gasto</span>
          </button>
        </div>
      </div>

      {/* Barra de Filtros */}
      <div className="card" style={{ padding: '16px 20px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '16px', alignItems: 'flex-end' }}>
          <div style={{ minWidth: '120px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Año</label>
            <select 
              value={selectedYear} 
              onChange={e => setSelectedYear(Number(e.target.value))}
              className="select"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}
            >
              <option value={2026}>2026</option>
              <option value={2025}>2025</option>
              <option value={2024}>2024</option>
            </select>
          </div>

          <div style={{ minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Mes</label>
            <select 
              value={selectedMonth} 
              onChange={e => setSelectedMonth(Number(e.target.value))}
              className="select"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}
            >
              {[1,2,3,4,5,6,7,8,9,10,11,12].map(m => (
                <option key={m} value={m}>{getMonthName(m)}</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Categoría</label>
            <select 
              value={filterCategoryId} 
              onChange={e => setFilterCategoryId(e.target.value)}
              className="select"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}
            >
              <option value="">Todas las categorías</option>
              {categories.map(c => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </div>

          <div style={{ minWidth: '160px' }}>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '6px' }}>Medio de Pago</label>
            <select 
              value={filterPaymentMethod} 
              onChange={e => setFilterPaymentMethod(e.target.value)}
              className="select"
              style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card)' }}
            >
              <option value="">Todos los medios</option>
              <option value="CASH">Efectivo</option>
              <option value="BANK_TRANSFER">Transferencia</option>
              <option value="CHECK">Cheque</option>
            </select>
          </div>
        </div>
      </div>

      {/* Grid de Contenido Principal */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px', alignItems: 'stretch' }}>
        
        {/* LADO IZQUIERDO: KPIs y Gráfico de Categorías */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Tarjeta de Resumen Financiero */}
          <div className="card" style={{ 
            padding: '24px', 
            borderRadius: 'var(--radius-md)', 
            border: '1px solid var(--border-color)',
            backgroundColor: '#111827', // Diseño oscuro Stripe premium
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            position: 'relative',
            overflow: 'hidden'
          }}>
            <div>
              <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Gastos Totales - {getMonthName(selectedMonth)} {selectedYear}
              </span>
              <h3 style={{ fontSize: '2.4rem', fontWeight: 700, margin: '8px 0 4px 0', fontFamily: 'monospace', letterSpacing: '-0.02em' }}>
                ${totalGasto.toLocaleString('es-AR', { minimumFractionDigits: 2 })}
              </h3>
              <p style={{ fontSize: '0.85rem', color: '#9CA3AF', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Info size={14} />
                <span>{expenses.length} gastos operativos registrados.</span>
              </p>
            </div>
            <div style={{ 
              width: '56px', 
              height: '56px', 
              borderRadius: '12px', 
              backgroundColor: 'rgba(255,255,255,0.08)', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              color: '#fff'
            }}>
              <TrendingDown size={28} style={{ color: 'var(--color-corp-red)' }} />
            </div>
          </div>

          {/* Gráfico de Distribución (Barras Horizontales Premium) */}
          <div className="card" style={{ padding: '24px', borderRadius: 'var(--radius-md)', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', flex: 1 }}>
            <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 16px 0', display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span>Distribución de Gastos por Categoría</span>
            </h3>
            
            {sortedCategories.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', minHeight: '200px', color: 'var(--text-secondary)', gap: '12px' }}>
                <TrendingDown size={36} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.9rem' }}>No hay gastos en este mes para graficar.</span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', overflowY: 'auto', maxHeight: '350px', paddingRight: '4px' }}>
                {sortedCategories.map((cat, idx) => (
                  <div key={idx} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.85rem', fontWeight: 500 }}>
                      <span style={{ color: 'var(--text-primary)' }}>{cat.name}</span>
                      <div style={{ display: 'flex', gap: '10px' }}>
                        <span style={{ fontWeight: 600 }}>${cat.amount.toLocaleString('es-AR')}</span>
                        <span style={{ color: 'var(--text-muted)' }}>({cat.pct.toFixed(1)}%)</span>
                      </div>
                    </div>
                    {/* Barra de Progreso CSS pura con transición suave */}
                    <div style={{ width: '100%', height: '8px', backgroundColor: '#F3F4F6', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ 
                        width: `${cat.pct}%`, 
                        height: '100%', 
                        // Gradiente de grises elegantes de Stripe/Linear, o rojo corporativo para el top 1
                        backgroundColor: idx === 0 ? 'var(--color-corp-red)' : 'var(--color-primary)',
                        borderRadius: '4px',
                        transition: 'width 0.8s cubic-bezier(0.25, 1, 0.5, 1)'
                      }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* LADO DERECHO: Tabla / Listado de Gastos */}
        <div className="card" style={{ 
          padding: '24px', 
          borderRadius: 'var(--radius-md)', 
          border: '1px solid var(--border-color)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch'
        }}>
          <h3 style={{ fontSize: '1.05rem', fontWeight: 600, margin: '0 0 16px 0' }}>Detalle de Transacciones</h3>
          
          <div style={{ overflowX: 'auto', flex: 1, minHeight: '380px' }}>
            {expenses.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: '12px', padding: '40px 0' }}>
                <Info size={32} style={{ color: 'var(--text-muted)' }} />
                <span style={{ fontSize: '0.9rem' }}>No se encontraron gastos registrados para los filtros seleccionados.</span>
              </div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                <thead>
                  <tr style={{ borderBottom: '2px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 600, textAlign: 'left' }}>
                    <th style={{ padding: '10px 8px' }}>Fecha</th>
                    <th style={{ padding: '10px 8px' }}>Descripción</th>
                    <th style={{ padding: '10px 8px' }}>Categoría</th>
                    <th style={{ padding: '10px 8px', textAlign: 'right' }}>Monto</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Pago</th>
                    <th style={{ padding: '10px 8px', textAlign: 'center' }}>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {expenses.map((e) => (
                    <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)', height: '44px' }}>
                      <td style={{ padding: '8px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                        {new Date(e.date).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
                      </td>
                      <td style={{ padding: '8px', fontWeight: 500 }}>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <span>{e.description}</span>
                          {e.vehicle && (
                            <span style={{ fontSize: '0.72rem', color: '#1a73e8', display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <Car size={10} />
                              <span>{e.vehicle.brand} {e.vehicle.model} ({e.vehicle.plate})</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ padding: '8px' }}>
                        <span style={{ 
                          padding: '3px 8px', 
                          borderRadius: '4px', 
                          backgroundColor: '#F3F4F6', 
                          fontSize: '0.75rem',
                          fontWeight: 500,
                          color: 'var(--text-primary)'
                        }}>
                          {e.category?.name || 'General'}
                        </span>
                      </td>
                      <td style={{ padding: '8px', textAlign: 'right', fontWeight: 600, fontFamily: 'monospace' }}>
                        ${Number(e.amount).toLocaleString('es-AR', { minimumFractionDigits: 2 })}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.75rem' }}>
                        {getMethodLabel(e.paymentMethod)}
                      </td>
                      <td style={{ padding: '8px', textAlign: 'center' }}>
                        <button 
                          onClick={() => handleDeleteExpense(e.id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: 'var(--color-danger)',
                            cursor: 'pointer',
                            padding: '4px',
                            borderRadius: '4px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'background-color var(--transition-fast)'
                          }}
                          onMouseEnter={e => e.currentTarget.style.backgroundColor = 'var(--color-danger-bg)'}
                          onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}
                          title="Eliminar Gasto"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* ====================================================================
          MODAL: REGISTRAR GASTO MANUAL
          ==================================================================== */}
      {isCreateModalOpen && (
        <div className="modal-overlay" onClick={() => !submitting && setIsCreateModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '500px', padding: '24px' }}>
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Registrar Gasto Operativo</h3>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setIsCreateModalOpen(false)} 
                disabled={submitting}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateExpense} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 500, fontSize: '0.8rem', marginBottom: '6px', display: 'block' }}>Monto ($)</label>
                  <input 
                    type="number"
                    className="input"
                    required
                    min="0.01"
                    step="0.01"
                    placeholder="0.00"
                    value={newAmount}
                    onChange={e => setNewAmount(e.target.value)}
                    style={{ fontSize: '1.1rem', fontFamily: 'monospace', width: '100%' }}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 500, fontSize: '0.8rem', marginBottom: '6px', display: 'block' }}>Fecha</label>
                  <input 
                    type="date"
                    className="input"
                    required
                    value={newDate}
                    onChange={e => setNewDate(e.target.value)}
                    style={{ width: '100%' }}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 500, fontSize: '0.8rem', marginBottom: '6px', display: 'block' }}>Categoría de Gasto</label>
                <select 
                  className="input"
                  required
                  value={newCategoryId}
                  onChange={e => setNewCategoryId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: '#fff', borderRadius: '6px' }}
                >
                  <option value="">Seleccione una categoría...</option>
                  {categories.map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 500, fontSize: '0.8rem', marginBottom: '6px', display: 'block' }}>Detalle / Descripción</label>
                <input 
                  type="text"
                  className="input"
                  required
                  placeholder="Ej: Pago de luz depósito Villegas, Reparación furgón Partner..."
                  value={newDescription}
                  onChange={e => setNewDescription(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 500, fontSize: '0.8rem', marginBottom: '6px', display: 'block' }}>Medio de Pago</label>
                  <select 
                    className="input" 
                    value={newPaymentMethod} 
                    onChange={e => {
                      setNewPaymentMethod(e.target.value);
                      if (e.target.value === 'BANK_TRANSFER' && bankAccounts.length > 0) {
                        setNewBankAccountId(String(bankAccounts[0].id));
                      }
                    }}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: '#fff', borderRadius: '6px' }}
                  >
                    <option value="CASH">Efectivo (Caja Chica)</option>
                    <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                    <option value="CHECK">Cheque diferido</option>
                  </select>
                </div>

                <div className="form-group">
                  <label className="form-label" style={{ fontWeight: 500, fontSize: '0.8rem', marginBottom: '6px', display: 'block' }}>Canal Contable</label>
                  <select 
                    className="input" 
                    value={newBillingType} 
                    onChange={e => setNewBillingType(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: '#fff', borderRadius: '6px' }}
                  >
                    <option value="INTERNAL">Interno (Sucursal X)</option>
                    <option value="OFFICIAL">Oficial (Sucursal A)</option>
                  </select>
                </div>
              </div>

              {/* Campos condicionales */}
              {newPaymentMethod === 'BANK_TRANSFER' && (
                <div className="form-group fade-in">
                  <label className="form-label" style={{ fontWeight: 500, fontSize: '0.8rem', marginBottom: '6px', display: 'block' }}>Cuenta Bancaria Destino</label>
                  <select 
                    className="input"
                    required
                    value={newBankAccountId}
                    onChange={e => setNewBankAccountId(e.target.value)}
                    style={{ width: '100%', padding: '10px 12px', backgroundColor: '#fff', borderRadius: '6px' }}
                  >
                    <option value="">Seleccione cuenta...</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>{b.name} (${Number(b.balance).toLocaleString('es-AR')})</option>
                    ))}
                  </select>
                </div>
              )}

              <div className="form-group">
                <label className="form-label" style={{ fontWeight: 500, fontSize: '0.8rem', marginBottom: '6px', display: 'block' }}>Asociar a Vehículo de Flota (Opcional)</label>
                <select 
                  className="input"
                  value={newVehicleId}
                  onChange={e => setNewVehicleId(e.target.value)}
                  style={{ width: '100%', padding: '10px 12px', backgroundColor: '#fff', borderRadius: '6px' }}
                >
                  <option value="">Ningún vehículo (Gasto general)</option>
                  {vehicles.map(v => (
                    <option key={v.id} value={v.id}>{v.brand} {v.model} - Patente: {v.plate}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsCreateModalOpen(false)}
                  disabled={submitting}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn" 
                  disabled={submitting}
                  style={{ 
                    backgroundColor: 'var(--color-primary)', 
                    color: '#fff', 
                    border: 'none', 
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: submitting ? 'default' : 'pointer'
                  }}
                >
                  {submitting ? 'Guardando...' : 'Confirmar Gasto'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL: IMPORTAR DESDE EXCEL
          ==================================================================== */}
      {isImportModalOpen && (
        <div className="modal-overlay" onClick={() => !importing && setIsImportModalOpen(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '480px', padding: '24px' }}>
            <div className="modal-header" style={{ marginBottom: '20px' }}>
              <h3 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>Importar Planilla de Gastos</h3>
              <button 
                type="button" 
                className="btn btn-ghost" 
                onClick={() => setIsImportModalOpen(false)} 
                disabled={importing}
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleImportExcel} style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Sube el archivo Excel con el detalle de los gastos de la distribuidora (`GastosDistribuidora.xlsx`). El sistema desglosará de manera inteligente los gastos generales, los sueldos del personal y las patentes de camiones.
              </p>

              {/* Zona de Drop/Upload */}
              <div 
                style={{
                  border: '2px dashed var(--border-color)',
                  borderRadius: '8px',
                  padding: '30px 20px',
                  textAlign: 'center',
                  backgroundColor: '#F9FAFB',
                  cursor: 'pointer',
                  transition: 'border-color var(--transition-fast)',
                  position: 'relative'
                }}
                onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--text-secondary)'}
                onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border-color)'}
              >
                <input 
                  type="file" 
                  accept=".xlsx, .xls"
                  onChange={handleFileChange}
                  style={{
                    position: 'absolute',
                    top: 0,
                    left: 0,
                    width: '100%',
                    height: '100%',
                    opacity: 0,
                    cursor: 'pointer'
                  }}
                  disabled={importing}
                />
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' }}>
                  <UploadCloud size={36} style={{ color: 'var(--text-muted)' }} />
                  <span style={{ fontSize: '0.88rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                    {selectedFile ? selectedFile.name : 'Seleccionar o arrastrar archivo'}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    Formatos admitidos: .xlsx, .xls (Tamaño máximo: 5MB)
                  </span>
                </div>
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '12px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setIsImportModalOpen(false)}
                  disabled={importing}
                >
                  Cancelar
                </button>
                <button 
                  type="submit" 
                  className="btn" 
                  disabled={!selectedFile || importing}
                  style={{ 
                    backgroundColor: 'var(--color-corp-red)', // Rojo corporativo para CTAs críticos
                    color: '#fff', 
                    border: 'none', 
                    padding: '10px 20px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: (!selectedFile || importing) ? 'default' : 'pointer'
                  }}
                >
                  {importing ? 'Procesando Archivo...' : 'Iniciar Importación'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
