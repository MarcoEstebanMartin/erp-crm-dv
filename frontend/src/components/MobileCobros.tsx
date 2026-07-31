import React, { useState, useEffect } from 'react';
import { CreditCard, DollarSign, FileText, CheckCircle, ChevronLeft, RefreshCw, Loader2, Landmark, Banknote, ScrollText } from 'lucide-react';
import axios from 'axios';
import { API_BASE_URL } from '../utils/api';
import { useConfirm } from '../context/ConfirmContext';

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
  const confirm = useConfirm();
  const [personas, setPersonas] = useState<Persona[]>([]);
  const [selectedPersona, setSelectedPersona] = useState<Persona | null>(null);
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState('CASH');
  const [checkNumber, setCheckNumber] = useState('');
  const [isEcheq, setIsEcheq] = useState(false);
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
      setCheckNumber('');
      setIsEcheq(false);
    }
  }, [selectedPersona]);

  // Polling automático cada 30 segundos para mantener saldos actualizados
  useEffect(() => {
    const interval = setInterval(() => {
      fetchPending();
      if (selectedPersona) {
        fetchPendingInvoices(selectedPersona.id);
      }
    }, 30000);
    return () => clearInterval(interval);
  }, [selectedPersona]);

  const handleSync = async () => {
    setLoading(true);
    await fetchPending();
    if (selectedPersona) {
      await fetchPendingInvoices(selectedPersona.id);
    }
    setLoading(false);
  };

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

    if (paymentMethod === 'CHECK' && !checkNumber.trim()) {
      alert('Por favor, ingresa el número de cheque.');
      return;
    }

    // Advertencia de sobrepago
    if (parsedAmount > selectedPersona.outstandingBalance) {
      const confirmOverpayment = await confirm(
        `El monto a cobrar (${formatCurrency(parsedAmount)}) supera el saldo pendiente del cliente (${formatCurrency(selectedPersona.outstandingBalance)}). El cliente quedará con saldo a favor. ¿Deseas continuar?`,
        { type: 'warning' }
      );
      if (!confirmOverpayment) return;
    }
    
    setLoading(true);
    try {
      const finalCheckStr = paymentMethod === 'CHECK' 
        ? (isEcheq ? `E-CHEQ #${checkNumber.trim()}` : checkNumber.trim()) 
        : undefined;

      const res = await axios.post(`${API_BASE_URL}/collections/register`, {
        personaId: selectedPersona.id,
        amount: parsedAmount,
        paymentMethod,
        billingType,
        orderId: selectedInvoiceId,
        checkNumber: finalCheckStr
      }, {
        headers: { Authorization: `Bearer ${localStorage.getItem('auth_token')}` }
      });
      
      setSuccessReceipt(res.data.transaction);
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

  // 1. Vista de Éxito / Recibo Generado
  if (successReceipt) {
    return (
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '16px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-lg)',
          padding: '28px 20px',
          textAlign: 'center',
          marginTop: '20px'
        }}>
          <div style={{
            width: '64px',
            height: '64px',
            borderRadius: '50%',
            backgroundColor: '#ECFDF5',
            color: '#10B981',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px'
          }}>
            <CheckCircle size={36} />
          </div>
          
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', marginBottom: '4px' }}>
            Cobro Registrado
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '20px', fontWeight: 500 }}>
            Recibo N° {successReceipt.receiptNumber}
          </p>
          
          <div style={{
            backgroundColor: '#F9FAFB',
            borderRadius: '12px',
            border: '1px solid var(--border-color)',
            padding: '16px',
            textAlign: 'left',
            marginBottom: '24px'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cliente</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>{selectedPersona?.name}</span>
            </div>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6', alignItems: 'center' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Monto Cobrado</span>
              <span style={{ fontSize: '1.2rem', fontWeight: 700, color: 'var(--text-primary)' }}>{formatCurrency(successReceipt.amount)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Medio de Pago</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {successReceipt.paymentMethod === 'CASH' ? 'Efectivo' : successReceipt.paymentMethod === 'BANK_TRANSFER' ? 'Transferencia (Mercado Pago / Banco)' : (isEcheq ? 'Cheque (E-Cheq)' : 'Cheque Físico')}
              </span>
            </div>

            {checkNumber && paymentMethod === 'CHECK' && (
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid #F3F4F6' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>N° de Cheque</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {isEcheq ? `📱 E-CHEQ #${checkNumber}` : `📄 ${checkNumber}`}
                </span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '10px' }}>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Sucursal</span>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                {successReceipt.billingType === 'OFFICIAL' ? 'Sucursal A (Oficial)' : 'Sucursal X (Interno)'}
              </span>
            </div>

            <div style={{ marginTop: '16px', paddingTop: '14px', borderTop: '1px solid var(--border-color)' }}>
              <div style={{
                backgroundColor: '#EFF6FF',
                border: '1px solid #BFDBFE',
                borderRadius: '8px',
                padding: '12px',
                fontSize: '0.8rem',
                color: '#1E40AF',
                textAlign: 'center',
                lineHeight: '1.4'
              }}>
                💬 <strong>Notificación Enviada:</strong> El ERP ha enviado el recibo digital provisorio por WhatsApp al cliente.
              </div>
              <p style={{ fontSize: '0.72rem', color: 'var(--text-muted)', marginTop: '8px', textAlign: 'center', lineHeight: '1.3' }}>
                🔒 El cobro está registrado para auditoría. Se consolidará en la cuenta corriente una vez verificado físicamente en caja.
              </p>
            </div>
          </div>
          
          <button 
            onClick={() => { setSuccessReceipt(null); setSelectedPersona(null); setAmount(''); setCheckNumber(''); setIsEcheq(false); }}
            style={{
              width: '100%',
              backgroundColor: 'var(--accent-color)',
              color: '#FFFFFF',
              fontWeight: 600,
              padding: '14px',
              borderRadius: '10px',
              fontSize: '0.95rem',
              border: 'none',
              cursor: 'pointer',
              boxShadow: 'var(--shadow-sm)',
              transition: 'var(--transition-fast)'
            }}
          >
            Volver a Cobros
          </button>
        </div>
      </div>
    );
  }


  // 2. Vista de Formulario de Cobro (Cliente Seleccionado)
  if (selectedPersona) {
    const isOverpayment = parseFloat(amount) > selectedPersona.outstandingBalance && selectedPersona.outstandingBalance > 0;
    
    return (
      <div style={{ maxWidth: '500px', margin: '0 auto', padding: '16px' }}>
        {/* Botón Volver */}
        <button 
          onClick={() => setSelectedPersona(null)} 
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '4px',
            backgroundColor: 'transparent',
            border: 'none',
            color: 'var(--text-secondary)',
            fontSize: '0.9rem',
            fontWeight: 500,
            cursor: 'pointer',
            padding: '4px 0',
            marginBottom: '16px'
          }}
        >
          <ChevronLeft size={20} />
          Volver a Clientes
        </button>

        {/* Hero Card del Cliente y Saldo */}
        <div style={{
          backgroundColor: '#FFFFFF',
          borderRadius: '14px',
          border: '1px solid var(--border-color)',
          padding: '18px 20px',
          boxShadow: 'var(--shadow-sm)',
          marginBottom: '20px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
            <div>
              <span style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                CLIENTE SELECCIONADO
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--text-primary)', margin: '2px 0 0 0' }}>
                {selectedPersona.name}
              </h2>
              {selectedPersona.city && (
                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  📍 {selectedPersona.city}
                </span>
              )}
            </div>
          </div>

          {selectedPersona.outstandingBalance < 0 ? (
            <div style={{
              backgroundColor: '#ECFDF5',
              border: '1px solid #A7F3D0',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#047857', display: 'block' }}>SALDO A FAVOR</span>
                <span style={{ fontSize: '1.3rem', fontWeight: 700, color: '#065F46' }}>
                  {formatCurrency(Math.abs(selectedPersona.outstandingBalance))}
                </span>
              </div>
              <span style={{ fontSize: '0.75rem', backgroundColor: '#D1FAE5', color: '#065F46', padding: '4px 10px', borderRadius: '20px', fontWeight: 600 }}>
                Crédito
              </span>
            </div>
          ) : (
            <div style={{
              backgroundColor: '#FEF2F2',
              border: '1px solid #FCA5A5',
              borderRadius: '10px',
              padding: '12px 16px',
              display: 'flex',
              justify: 'space-between',
              alignItems: 'center'
            }}>
              <div>
                <span style={{ fontSize: '0.75rem', fontWeight: 600, color: '#B91C1C', display: 'block' }}>SALDO PENDIENTE TOTAL</span>
                <span style={{ fontSize: '1.4rem', fontWeight: 700, color: '#991B1B' }}>
                  {formatCurrency(selectedPersona.outstandingBalance)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAmount(selectedPersona.outstandingBalance.toString())}
                style={{
                  fontSize: '0.75rem',
                  backgroundColor: '#FFFFFF',
                  color: '#991B1B',
                  border: '1px solid #FCA5A5',
                  padding: '6px 12px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxShadow: 'var(--shadow-sm)',
                  transition: 'all 0.15s ease'
                }}
              >
                Cobrar Total
              </button>
            </div>
          )}
        </div>

        {/* Formulario */}
        <form onSubmit={handleRegister} style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
          
          {/* Imputación a Factura */}
          {pendingInvoices.length > 0 && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Imputar a Comprobante Específico (Opcional)
              </label>
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
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-primary)',
                  fontSize: '0.9rem',
                  outline: 'none',
                  boxShadow: 'var(--shadow-sm)'
                }}
              >
                <option value="">Entrega a cuenta general (Sin factura específica)</option>
                {pendingInvoices.map((inv) => (
                  <option key={inv.id} value={inv.id}>
                    {inv.invoiceNumber} — Pendiente: {formatCurrency(inv.pendingAmount)}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Campo de Monto a Cobrar */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Monto a Cobrar (ARS)
              </label>
              {selectedPersona.outstandingBalance > 0 && (
                <button
                  type="button"
                  onClick={() => setAmount((selectedPersona.outstandingBalance / 2).toFixed(0))}
                  style={{
                    backgroundColor: 'transparent',
                    border: 'none',
                    color: 'var(--text-secondary)',
                    fontSize: '0.75rem',
                    cursor: 'pointer',
                    textDecoration: 'underline'
                  }}
                >
                  Usar 50%
                </button>
              )}
            </div>

            <div style={{
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#FFFFFF',
              border: `1.5px solid ${isOverpayment ? '#F59E0B' : 'var(--border-color)'}`,
              borderRadius: '10px',
              padding: '4px 14px',
              boxShadow: 'var(--shadow-sm)',
              transition: 'border-color 0.2s ease'
            }}>
              <span style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-secondary)', marginRight: '10px', userSelect: 'none' }}>
                $
              </span>
              <input
                type="number"
                step="0.01"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                style={{
                  width: '100%',
                  border: 'none',
                  outline: 'none',
                  backgroundColor: 'transparent',
                  fontSize: '1.4rem',
                  fontWeight: 700,
                  color: 'var(--text-primary)',
                  padding: '10px 0'
                }}
              />
            </div>
            {isOverpayment && (
              <span style={{ fontSize: '0.75rem', color: '#D97706', marginTop: '2px' }}>
                ⚠️ El monto supera el saldo pendiente. El cliente quedará con saldo a favor.
              </span>
            )}
          </div>

          {/* Selector de Medio de Pago (Chips interactivos) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Medio de Pago
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
              {[
                { id: 'CASH', label: 'Efectivo', icon: Banknote },
                { id: 'BANK_TRANSFER', label: 'Transferencia', icon: Landmark },
                { id: 'CHECK', label: 'Cheque', icon: ScrollText },
              ].map((method) => {
                const Icon = method.icon;
                const isActive = paymentMethod === method.id;
                return (
                  <button
                    key={method.id}
                    type="button"
                    onClick={() => setPaymentMethod(method.id)}
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justify: 'center',
                      gap: '6px',
                      padding: '12px 8px',
                      borderRadius: '10px',
                      fontSize: '0.8rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      border: '1px solid',
                      borderColor: isActive ? 'var(--accent-color)' : 'var(--border-color)',
                      backgroundColor: isActive ? 'var(--accent-color)' : '#FFFFFF',
                      color: isActive ? '#FFFFFF' : 'var(--text-secondary)',
                      boxShadow: isActive ? 'var(--shadow-sm)' : 'none',
                      transition: 'all 0.15s ease'
                    }}
                  >
                    <Icon size={18} />
                    <span>{method.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Banner de Promoción Mercado Pago si selecciona Transferencia */}
          {paymentMethod === 'BANK_TRANSFER' && (
            <div style={{
              backgroundColor: '#EFF6FF',
              border: '1px solid #BFDBFE',
              borderRadius: '10px',
              padding: '14px',
              display: 'flex',
              flexDirection: 'column',
              gap: '10px'
            }}>
              <p style={{ fontSize: '0.82rem', color: '#1E40AF', margin: 0, lineHeight: '1.4' }}>
                💡 <strong>Recomendación:</strong> Solicitar al cliente que realice la transferencia preferentemente a la cuenta oficial de Mercado Pago para verificación instantánea.
              </p>

              <div style={{
                backgroundColor: '#FFFFFF',
                borderRadius: '8px',
                padding: '10px 12px',
                border: '1px solid #93C5FD',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center'
              }}>
                <div>
                  <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', display: 'block', fontWeight: 600, textTransform: 'uppercase' }}>
                    ALIAS OFICIAL MERCADO PAGO
                  </span>
                  <span style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    donvenancio2024
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText('donvenancio2024');
                    alert('¡Alias MercadoPago (donvenancio2024) copiado al portapapeles!');
                  }}
                  style={{
                    fontSize: '0.75rem',
                    backgroundColor: '#2563EB',
                    color: '#FFFFFF',
                    border: 'none',
                    padding: '6px 12px',
                    borderRadius: '6px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: 'var(--shadow-sm)'
                  }}
                >
                  Copiar Alias
                </button>
              </div>

              <div style={{ fontSize: '0.73rem', color: '#1E40AF', marginTop: '2px' }}>
                <strong>CVU MP:</strong> <code>0000003100085432453321</code>
              </div>
            </div>
          )}

          {/* Campo de Número de Cheque si selecciona Cheque */}
          {paymentMethod === 'CHECK' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                Número de Cheque *
              </label>
              <input
                type="text"
                required
                value={checkNumber}
                onChange={(e) => setCheckNumber(e.target.value)}
                placeholder="Ej: CH-90824102"
                style={{
                  width: '100%',
                  padding: '12px 14px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: '#FFFFFF',
                  color: 'var(--text-primary)',
                  fontSize: '0.95rem',
                  fontWeight: 600,
                  outline: 'none',
                  boxShadow: 'var(--shadow-sm)'
                }}
              />

              {/* Checkbox / Toggle para E-Cheq */}
              <label style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                backgroundColor: isEcheq ? '#F0F9FF' : '#F9FAFB',
                border: `1px solid ${isEcheq ? '#0EA5E9' : 'var(--border-color)'}`,
                padding: '10px 14px',
                borderRadius: '8px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                userSelect: 'none'
              }}>
                <input
                  type="checkbox"
                  checked={isEcheq}
                  onChange={(e) => setIsEcheq(e.target.checked)}
                  style={{
                    width: '18px',
                    height: '18px',
                    accentColor: '#0284C7',
                    cursor: 'pointer'
                  }}
                />
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <span style={{ fontSize: '0.85rem', fontWeight: 700, color: isEcheq ? '#0369A1' : 'var(--text-primary)' }}>
                    📱 Es E-Cheq (Cheque Electrónico / Digital)
                  </span>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    Marcar si el cheque ingresó por plataforma bancaria digital sin papel físico.
                  </span>
                </div>
              </label>
            </div>
          )}


          {/* Selector de Sucursal (Pill Segmented Toggle) */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <label style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
              Corresponde a Sucursal
            </label>
            <div style={{
              display: 'flex',
              backgroundColor: '#F3F4F6',
              padding: '4px',
              borderRadius: '10px',
              border: '1px solid var(--border-color)'
            }}>
              <button
                type="button"
                disabled={selectedInvoiceId !== null}
                onClick={() => setBillingType('OFFICIAL')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '7px',
                  fontSize: '0.83rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: selectedInvoiceId !== null ? 'not-allowed' : 'pointer',
                  backgroundColor: billingType === 'OFFICIAL' ? '#FFFFFF' : 'transparent',
                  color: billingType === 'OFFICIAL' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: billingType === 'OFFICIAL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  opacity: selectedInvoiceId !== null && billingType !== 'OFFICIAL' ? 0.4 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                Sucursal A (Oficial)
              </button>
              <button
                type="button"
                disabled={selectedInvoiceId !== null}
                onClick={() => setBillingType('INTERNAL')}
                style={{
                  flex: 1,
                  padding: '10px',
                  borderRadius: '7px',
                  fontSize: '0.83rem',
                  fontWeight: 600,
                  border: 'none',
                  cursor: selectedInvoiceId !== null ? 'not-allowed' : 'pointer',
                  backgroundColor: billingType === 'INTERNAL' ? '#FFFFFF' : 'transparent',
                  color: billingType === 'INTERNAL' ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: billingType === 'INTERNAL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                  opacity: selectedInvoiceId !== null && billingType !== 'INTERNAL' ? 0.4 : 1,
                  transition: 'all 0.15s ease'
                }}
              >
                Sucursal X (Interno)
              </button>
            </div>
            {selectedInvoiceId !== null && (
              <span style={{ fontSize: '0.73rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                ℹ️ La sucursal fue asignada automáticamente según la factura seleccionada.
              </span>
            )}
          </div>

          {/* Botón de Confirmación Principal */}
          <button
            type="submit"
            disabled={loading || !amount || parseFloat(amount) <= 0}
            style={{
              width: '100%',
              backgroundColor: 'var(--color-corp-red)',
              color: '#FFFFFF',
              fontWeight: 700,
              fontSize: '1rem',
              padding: '14px',
              borderRadius: '10px',
              border: 'none',
              cursor: (loading || !amount || parseFloat(amount) <= 0) ? 'not-allowed' : 'pointer',
              opacity: (loading || !amount || parseFloat(amount) <= 0) ? 0.5 : 1,
              boxShadow: '0 4px 12px rgba(227, 6, 19, 0.25)',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              gap: '8px',
              marginTop: '10px',
              transition: 'all 0.15s ease'
            }}
          >
            {loading ? (
              <>
                <Loader2 size={18} className="spin-animation" />
                <span>Procesando Cobro...</span>
              </>
            ) : (
              'Confirmar Cobro'
            )}
          </button>
        </form>
      </div>
    );
  }

  // 3. Vista Principal: Listado de Clientes con Saldo Pendiente
  const filteredPersonas = personas.filter(p => {
    if (selectedCityFilters.length === 0) return true;
    const cleanCity = cleanCityName ? cleanCityName(p.city) : (p.city || '').toUpperCase().trim();
    return selectedCityFilters.includes(cleanCity);
  });

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
      {/* Header con Título y Botón Sync */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px', marginTop: '8px' }}>
        <h2 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Cobranzas
        </h2>
        <button
          onClick={handleSync}
          disabled={loading}
          style={{
            backgroundColor: '#FFFFFF',
            border: '1px solid var(--border-color)',
            boxShadow: 'var(--shadow-sm)',
            color: 'var(--text-secondary)',
            padding: '6px 12px',
            borderRadius: '8px',
            fontSize: '0.82rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            cursor: loading ? 'not-allowed' : 'pointer'
          }}
          title="Actualizar saldos"
        >
          <RefreshCw size={14} className={loading ? "spin-animation" : ""} />
          <span>Sincronizar</span>
        </button>
      </div>
      
      <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        Selecciona un cliente para registrar un cobro o abono a su cuenta
      </p>

      {/* Chips de filtro por localidad */}
      {uniqueCities.length > 0 && setSelectedCityFilters && (
        <div style={{ 
          display: 'flex', 
          gap: '8px', 
          overflowX: 'auto', 
          padding: '4px 2px 14px 2px', 
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
              backgroundColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : '#FFFFFF',
              color: selectedCityFilters.length === 0 ? '#FFFFFF' : 'var(--text-secondary)',
              whiteSpace: 'nowrap',
              cursor: 'pointer',
              transition: 'all 0.15s ease'
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
                  borderColor: isActive ? 'var(--color-corp-red)' : 'var(--border-color)',
                  backgroundColor: isActive ? 'rgba(227, 6, 19, 0.08)' : '#FFFFFF',
                  color: isActive ? 'var(--color-corp-red)' : 'var(--text-secondary)',
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  transition: 'all 0.15s ease'
                }}
              >
                {city}
              </button>
            );
          })}
        </div>
      )}

      {/* Lista de Clientes */}
      {filteredPersonas.length === 0 ? (
        <div style={{
          textAlign: 'center',
          padding: '40px 20px',
          backgroundColor: '#FFFFFF',
          borderRadius: '12px',
          border: '1px solid var(--border-color)',
          boxShadow: 'var(--shadow-sm)'
        }}>
          <FileText size={40} style={{ color: 'var(--text-muted)', marginBottom: '12px' }} />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>
            {personas.length === 0 
              ? 'No hay clientes con saldos pendientes actualmente.' 
              : 'No hay saldos pendientes en las rutas/localidades seleccionadas.'}
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredPersonas.map((p) => (
            <div 
              key={p.id} 
              onClick={() => {
                setSelectedPersona(p);
                setAmount(p.outstandingBalance > 0 ? p.outstandingBalance.toString() : '');
              }}
              style={{
                backgroundColor: '#FFFFFF',
                padding: '14px 16px',
                borderRadius: '12px',
                border: '1px solid var(--border-color)',
                boxShadow: 'var(--shadow-sm)',
                display: 'flex',
                justify: 'space-between',
                alignItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease'
              }}
            >
              <div>
                <h3 style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
                  {p.name}
                </h3>
                {p.city && (
                  <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                    {p.city}
                  </span>
                )}
              </div>
              
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  SALDO
                </span>
                {p.outstandingBalance < 0 ? (
                  <span style={{
                    fontSize: '0.85rem',
                    fontWeight: 700,
                    color: '#059669',
                    backgroundColor: '#ECFDF5',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid #A7F3D0',
                    display: 'inline-block'
                  }}>
                    {formatCurrency(Math.abs(p.outstandingBalance))} (A Favor)
                  </span>
                ) : (
                  <span style={{
                    fontSize: '0.9rem',
                    fontWeight: 700,
                    color: '#DC2626',
                    backgroundColor: '#FEF2F2',
                    padding: '3px 8px',
                    borderRadius: '6px',
                    border: '1px solid #FCA5A5',
                    display: 'inline-block'
                  }}>
                    {formatCurrency(p.outstandingBalance)}
                  </span>
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
