import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, FileText, CheckCircle, ChevronLeft } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';

interface Persona {
  id: number;
  name: string;
  address: string;
  city: string;
  outstandingBalance: number;
  phone: string | null;
}

interface MobileCobrosProps {
  selectedCityFilters?: string[];
  setSelectedCityFilters?: (filters: string[]) => void;
  uniqueCities?: string[];
  cleanCityName?: (city: string | null | undefined) => string;
}

const MobileCobros: React.FC<MobileCobrosProps> = ({
  selectedCityFilters = [],
  setSelectedCityFilters,
  uniqueCities = [],
  cleanCityName,
}) => {
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [billingType, setBillingType] = useState('OFFICIAL'); // OFFICIAL = A, INTERNAL = X
  const [loading, setLoading] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<any>(null);
  const [pendingInvoices, setPendingInvoices] = useState<any[]>([]);
  const [selectedInvoiceId, setSelectedInvoiceId] = useState<number | null>(null);

  useEffect(() => {
    fetchPending();
  }, []);

  useEffect(() => {
    if (selectedPersona) {
      fetchPendingInvoices(selectedPersona.id);
    } else {
      setPendingInvoices([]);
      setSelectedInvoiceId(null);
      setBillingType('OFFICIAL');
    }
  }, [selectedPersona]);

  const fetchPending = async () => {
    try {
      const res = await axios.get(`${API_BASE_URL}/collections/pending`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (Array.isArray(res.data)) {
        setPersonas(res.data);
      } else {
        setPersonas([]);
        console.error('Expected array of personas, got:', res.data);
      }
    } catch (error) {
      console.error('Error fetching pending balances', error);
    }
  };

  const fetchPendingInvoices = async (personaId: number) => {
    try {
      const res = await axios.get(`${API_BASE_URL}/personas/${personaId}/pending-invoices`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      if (res.data?.status === 'success' && Array.isArray(res.data?.data?.invoices)) {
        setPendingInvoices(res.data.data.invoices);
      }
    } catch (error) {
      console.error('Error fetching pending invoices', error);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPersona) return;
    if (loading) return;

    const parsedAmount = parseFloat(amount);
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      alert('Por favor, ingresa un monto válido mayor a cero.');
      return;
    }

    // Advertencia de sobrepago
    if (parsedAmount > selectedPersona.outstandingBalance) {
      const confirmOverpayment = window.confirm(
        `El monto a cobrar (${formatCurrency(parsedAmount)}) supera el saldo pendiente del cliente (${formatCurrency(selectedPersona.outstandingBalance)}). El cliente quedará con saldo a favor. ¿Deseas continuar?`
      );
      if (!confirmOverpayment) return;
    }
    
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE_URL}/collections/register`, {
        personaId: selectedPersona.id,
        amount: parsedAmount,
        paymentMethod,
        billingType,
        orderId: selectedInvoiceId
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      
      setSuccessReceipt(res.data.transaction);
      // Actualizar listado localmente o refetch
      fetchPending();
    } catch (error: any) {
      console.error('Error registering collection', error);
      const errMsg = error.response?.data?.error || 'Hubo un error al registrar el cobro';
      alert(errMsg);
    } finally {
      setLoading(false);
    }
  };


  const formatCurrency = (val: number | string) => {
    return Number(val).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };

  // Renderizar la vista de éxito
  if (successReceipt) {
    return (
      <div className="p-4 max-w-md mx-auto bg-gray-50 min-h-screen">
        <div className="bg-white rounded-xl shadow-lg p-6 text-center mt-10">
          <CheckCircle className="w-16 h-16 text-green-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-800">Cobro Registrado</h2>
          <p className="text-gray-500 mt-2">Recibo {successReceipt.receiptNumber}</p>
          
          <div className="my-6 bg-gray-100 p-4 rounded-lg text-left">
            <p className="text-sm text-gray-600">Cliente: <span className="font-semibold text-gray-800">{selectedPersona?.name}</span></p>
            <p className="text-sm text-gray-600">Monto: <span className="font-bold text-gray-900 text-lg">{formatCurrency(successReceipt.amount)}</span></p>
            <p className="text-sm text-gray-600">Medio: <span className="font-semibold text-gray-800">{successReceipt.paymentMethod}</span></p>
            <p className="text-sm text-gray-600">Sucursal: <span className="font-semibold text-gray-800">{successReceipt.billingType === 'OFFICIAL' ? 'A' : 'X'}</span></p>
            <div className="mt-4 pt-4 border-t border-gray-200">
              <p className="text-xs text-blue-700 font-medium bg-blue-50 p-3 rounded-lg border border-blue-100 leading-relaxed text-center">
                💬 <strong>Notificación Enviada:</strong> El ERP ha enviado el recibo digital provisorio por WhatsApp al cliente.
              </p>
              <p className="text-[10px] text-gray-400 mt-2 text-center">
                🔒 El cobro está registrado para auditoría. No se puede descargar ni modificar desde este dispositivo móvil. Impactará en la cuenta corriente una vez verificado físicamente.
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => { setSuccessReceipt(null); setSelectedPersona(null); setAmount(''); }}
            className="w-full bg-gray-900 hover:bg-gray-800 text-white font-bold py-3 px-4 rounded-lg transition-colors"
          >
            Volver a Cobros
          </button>
        </div>
      </div>
    );
  }

  // Renderizar Formulario de Cobro
  if (selectedPersona) {
    return (
      <div className="p-4 max-w-md mx-auto bg-gray-50 min-h-screen">
        <button 
          onClick={() => setSelectedPersona(null)} 
          className="flex items-center text-gray-600 mb-6 font-medium"
        >
          <ChevronLeft className="w-5 h-5 mr-1" />
          Volver
        </button>

        <h2 className="text-2xl font-bold text-gray-800 mb-1">Registrar Cobro</h2>
        <p className="text-gray-500 mb-6">{selectedPersona.name}</p>

        {selectedPersona.outstandingBalance < 0 ? (
          <div className="bg-emerald-50 border border-emerald-100 p-4 rounded-lg mb-6 flex justify-between items-center">
            <span className="text-emerald-700 font-medium">Saldo a Favor</span>
            <span className="text-emerald-700 font-bold text-lg">{formatCurrency(Math.abs(selectedPersona.outstandingBalance))}</span>
          </div>
        ) : (
          <div className="bg-red-50 border border-red-100 p-4 rounded-lg mb-6 flex justify-between items-center">
            <span className="text-red-700 font-medium">Saldo Pendiente</span>
            <span className="text-red-700 font-bold text-lg">{formatCurrency(selectedPersona.outstandingBalance)}</span>
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-5">
          {pendingInvoices.length > 0 && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Imputar a Factura</label>
              <select
                value={selectedInvoiceId || ''}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === '') {
                    setSelectedInvoiceId(null);
                    setAmount(selectedPersona.outstandingBalance.toString());
                  } else {
                    const invId = Number(val);
                    setSelectedInvoiceId(invId);
                    const inv = pendingInvoices.find(i => i.id === invId);
                    if (inv) {
                      setAmount(inv.pendingAmount.toString());
                      if (inv.billingType) {
                        setBillingType(inv.billingType);
                      }
                    }
                  }
                }}
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 py-3 border bg-white text-base"
              >
                <option value="">Entrega a cuenta general (sin factura específica)</option>
                {pendingInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} (Pendiente: {formatCurrency(inv.pendingAmount)})
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Monto a Cobrar</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <DollarSign className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="pl-10 block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-lg py-3 border bg-white"
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Medio de Pago</label>
            <select
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-red-500 focus:ring-red-500 py-3 border bg-white text-base"
            >
              <option value="CASH">Efectivo</option>
              <option value="BANK_TRANSFER">Transferencia</option>
              <option value="CHECK">Cheque</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Corresponde a Sucursal</label>
            <div className="flex bg-gray-100 p-1 rounded-lg">
              <button
                type="button"
                disabled={selectedInvoiceId !== null}
                className={`flex-1 py-2 rounded-md font-medium text-sm transition-all ${billingType === 'OFFICIAL' ? 'bg-white shadow text-gray-900' : 'text-gray-500'} ${selectedInvoiceId !== null ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={() => setBillingType('OFFICIAL')}
              >
                Sucursal A (Oficial)
              </button>
              <button
                type="button"
                disabled={selectedInvoiceId !== null}
                className={`flex-1 py-2 rounded-md font-medium text-sm transition-all ${billingType === 'INTERNAL' ? 'bg-white shadow text-gray-900' : 'text-gray-500'} ${selectedInvoiceId !== null ? 'opacity-60 cursor-not-allowed' : ''}`}
                onClick={() => setBillingType('INTERNAL')}
              >
                Sucursal X (Interno)
              </button>
            </div>
            {selectedInvoiceId !== null && (
              <p className="text-xs text-gray-500 mt-1">
                La sucursal está determinada automáticamente por la factura seleccionada.
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={loading || !amount || parseFloat(amount) <= 0}
            className="w-full bg-[var(--color-corp-red)] hover:bg-red-700 text-white font-bold py-4 px-4 rounded-lg flex justify-center items-center gap-2 mt-8 disabled:opacity-50 transition-colors shadow-md"
          >
            {loading ? 'Procesando...' : 'Confirmar Cobro'}
          </button>
        </form>
      </div>
    );
  }

  // Filtrar localmente por ruta/ciudad seleccionada
  const filteredPersonas = personas.filter(p => {
    if (selectedCityFilters.length === 0) return true;
    const cleanCity = cleanCityName ? cleanCityName(p.city) : (p.city || '').toUpperCase().trim();
    return selectedCityFilters.includes(cleanCity);
  });

  // Renderizar Listado de Clientes con Saldo
  return (
    <div className="p-4 max-w-md mx-auto bg-gray-50 min-h-screen">
      <h2 className="text-2xl font-bold text-gray-800 mb-1 mt-4">Cobranzas</h2>
      <p className="text-gray-500 mb-4">Selecciona un cliente para registrar un cobro</p>

      {/* Chips horizontales de localidad (sincronizados) */}
      {uniqueCities.length > 0 && setSelectedCityFilters && (
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          overflowX: 'auto', 
          padding: '8px 4px', 
          marginBottom: '16px', 
          WebkitOverflowScrolling: 'touch',
          scrollbarWidth: 'none',
        }}>
          <button
            type="button"
            onClick={() => setSelectedCityFilters([])}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '0.8rem',
              fontWeight: 600,
              border: '1px solid',
              borderColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : 'var(--border-color)',
              backgroundColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : '#fff',
              color: selectedCityFilters.length === 0 ? '#fff' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.2s ease'
            }}
          >
            Todas
          </button>
          {uniqueCities.map(city => {
            const isActive = selectedCityFilters.includes(city);
            return (
              <button
                key={city}
                type="button"
                onClick={() => {
                  if (isActive) {
                    setSelectedCityFilters(selectedCityFilters.filter(c => c !== city));
                  } else {
                    setSelectedCityFilters([...selectedCityFilters, city]);
                  }
                }}
                style={{
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '0.8rem',
                  fontWeight: 600,
                  border: '1px solid',
                  borderColor: isActive ? 'var(--accent-color)' : 'var(--border-color)',
                  backgroundColor: isActive ? 'rgba(var(--color-corp-red-rgb), 0.08)' : '#fff',
                  color: isActive ? 'var(--accent-color)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease'
                }}
              >
                {city}
              </button>
            );
          })}
        </div>
      )}

      {filteredPersonas.length === 0 ? (
        <div className="text-center py-10 bg-white rounded-lg border border-gray-100 shadow-sm">
          <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500">
            {personas.length === 0 
              ? 'No hay saldos pendientes.' 
              : 'No hay saldos pendientes en las rutas seleccionadas.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredPersonas.map((p) => (
            <div 
              key={p.id} 
              onClick={() => {
                setSelectedPersona(p);
                setAmount(p.outstandingBalance.toString()); // Pre-fill con el total
              }}
              className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex justify-between items-center cursor-pointer hover:shadow-md transition-shadow active:scale-[0.98]"
            >
              <div>
                <h3 className="font-semibold text-gray-800">{p.name}</h3>
                <p className="text-xs text-gray-400 mt-1">{p.address || p.city}</p>
              </div>
              <div className="text-right">
                {p.outstandingBalance < 0 ? (
                  <>
                    <p className="text-sm font-medium text-green-600">{formatCurrency(Math.abs(p.outstandingBalance))} (A Favor)</p>
                    <div className="mt-1 flex justify-end">
                      <div className="bg-green-50 text-green-600 p-1.5 rounded-full">
                        <CreditCard className="w-4 h-4" />
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-medium text-red-600">{formatCurrency(p.outstandingBalance)}</p>
                    <div className="mt-1 flex justify-end">
                      <div className="bg-red-50 text-red-600 p-1.5 rounded-full">
                        <CreditCard className="w-4 h-4" />
                      </div>
                    </div>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MobileCobros;
