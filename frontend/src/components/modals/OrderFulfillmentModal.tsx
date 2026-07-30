import React, { useState, useEffect } from 'react';
import { X, CheckCircle, DollarSign, Truck, AlertCircle } from 'lucide-react';
import { BillingType, PaymentMethod } from '../../utils/types';
import { api } from '../../utils/api';

interface OrderFulfillmentModalProps {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OrderFulfillmentModal({ order, onClose, onSuccess }: OrderFulfillmentModalProps) {
  const [pesableWeights, setPesableWeights] = useState<{ [orderItemId: number]: number }>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Billing configuration - Default to OTHER (Cuenta Corriente)
  const [billingType, setBillingType] = useState<BillingType>(order.billingType || BillingType.INTERNAL);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.OTHER);
  const [checkNumber, setCheckNumber] = useState<string>('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    // Inicializar pesos para productos pesables o con peso previo
    const initialWeights: { [id: number]: number } = {};
    order.items?.forEach((item: any) => {
      const isPesable = item.product?.isPesable || item.isPesable;
      const approxWeightUnit = item.product?.approximateWeight ? Number(item.product.approximateWeight) : 1;
      const defaultAvgWeight = Number((item.quantity * approxWeightUnit).toFixed(3));

      if (item.weight && Number(item.weight) > 0) {
        initialWeights[item.id] = Number(item.weight);
      } else if (isPesable) {
        // Peso promedio sugerido por defecto si es pesable
        initialWeights[item.id] = defaultAvgWeight;
      }
    });
    setPesableWeights(initialWeights);

    // Cargar cuentas bancarias para transferencias
    api.getBankAccounts().then((banks) => {
      setBankAccounts(banks || []);
      if (banks && banks.length > 0) {
        setSelectedBankId(banks[0].id.toString());
      }
    }).catch(console.error);
  }, [order]);

  const handleWeightChange = (orderItemId: number, val: string) => {
    const num = parseFloat(val);
    setPesableWeights(prev => ({
      ...prev,
      [orderItemId]: isNaN(num) ? 0 : num
    }));
  };

  const calculateTotal = () => {
    let total = 0;
    order.items?.forEach((item: any) => {
      const price = Number(item.unitPrice ?? item.price ?? 0);
      const isPesableProduct = item.product?.isPesable || item.isPesable;
      const approxWeightUnit = item.product?.approximateWeight ? Number(item.product.approximateWeight) : 1;
      const suggestedAvgWeight = Number((item.quantity * approxWeightUnit).toFixed(3));
      const currentWeight = pesableWeights[item.id];

      if (currentWeight !== undefined && currentWeight > 0) {
        total += currentWeight * price;
      } else if (isPesableProduct) {
        total += suggestedAvgWeight * price;
      } else {
        total += item.quantity * price;
      }
    });
    return total;
  };

  const handleConfirmAndInvoice = async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      // 1. Guardar pesos de los ítems con peso ingresado (> 0)
      const weightItems = Object.entries(pesableWeights).map(([orderItemId, weight]) => ({
        orderItemId: Number(orderItemId),
        weight: Number(weight)
      })).filter(i => i.weight > 0);
      
      await api.confirmOrderArmado(order.id, weightItems);

      // 2. Facturar
      const paymentDesc = paymentMethod === 'CHECK' && checkNumber.trim() ? `Cheque N° ${checkNumber.trim()}` : undefined;
      await api.invoiceOrder(
        order.id,
        billingType,
        paymentMethod === 'OTHER' ? undefined : paymentMethod, // Si es Cuenta Corriente, enviamos undefined para que afecte el saldo deudor
        paymentDesc,
        paymentMethod === 'BANK_TRANSFER' ? Number(selectedBankId) : undefined
      );

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al completar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  const currentTotal = calculateTotal();

  return (
    <div className="modal-overlay" style={{ zIndex: 1100 }}>
      <div className="modal-content" style={{ width: '94vw', maxWidth: '1200px', padding: '28px', maxHeight: '90vh', overflowY: 'auto' }}>
        <div className="modal-header" style={{ marginBottom: '20px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>
              Confirmar Armado y Facturar — Pedido #{order.id}
            </h2>
            {order.deliveryZone && (
              <span className="badge" style={{ backgroundColor: 'var(--accent-bg-light)', color: 'var(--accent-color)', fontSize: '0.85rem', padding: '4px 10px' }}>
                <Truck size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                {order.deliveryZone}
              </span>
            )}
          </div>
          <button className="btn-close" onClick={onClose} style={{ padding: '6px', borderRadius: '6px' }}>
            <X size={24} />
          </button>
        </div>
        
        {errorMsg && (
          <div style={{ backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '12px 16px', borderRadius: '8px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '28px' }}>
          {/* Columna Izquierda: Tabla de Artículos */}
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600 }}>Artículos Preparados</h3>
              <span style={{ fontSize: '0.9rem', color: 'var(--text-secondary)' }}>
                {order.items?.length || 0} ítems en total
              </span>
            </div>

            <div className="table-container" style={{ maxHeight: '450px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}>
              <table style={{ width: '100%', fontSize: '0.95rem' }}>
                <thead>
                  <tr style={{ backgroundColor: 'var(--background-alt)', textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Producto</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Cant</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Peso Real (Kg)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item: any) => {
                    const price = Number(item.unitPrice ?? item.price ?? 0);
                    const isPesableProduct = item.product?.isPesable || item.isPesable;
                    const approxWeightUnit = item.product?.approximateWeight ? Number(item.product.approximateWeight) : 1;
                    const suggestedAvgWeight = Number((item.quantity * approxWeightUnit).toFixed(3));
                    const currentWeight = pesableWeights[item.id];
                    const hasWeight = currentWeight !== undefined && currentWeight > 0;

                    let subtotal = 0;
                    if (hasWeight) {
                      subtotal = currentWeight * price;
                    } else if (isPesableProduct) {
                      subtotal = suggestedAvgWeight * price;
                    } else {
                      subtotal = item.quantity * price;
                    }

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                          <div>{item.product?.name}</div>
                          {isPesableProduct && (
                            <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', marginTop: '4px', display: 'inline-block' }}>
                              Pesable (${price.toLocaleString('es-AR')}/kg)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                          {item.quantity} u
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          <input
                            type="number"
                            className="input"
                            style={{
                              width: '110px',
                              textAlign: 'center',
                              padding: '6px 8px',
                              fontWeight: 600,
                              fontSize: '0.95rem',
                              borderColor: isPesableProduct ? '#f97316' : undefined,
                              backgroundColor: isPesableProduct && (!pesableWeights[item.id] || pesableWeights[item.id] === suggestedAvgWeight) ? '#fff7ed' : undefined
                            }}
                            placeholder={isPesableProduct ? `${suggestedAvgWeight}` : 'Peso Kg'}
                            value={pesableWeights[item.id] !== undefined && pesableWeights[item.id] !== 0 ? pesableWeights[item.id] : (isPesableProduct ? suggestedAvgWeight : '')}
                            onChange={(e) => handleWeightChange(item.id, e.target.value)}
                            step="0.001"
                            min="0"
                          />
                          {isPesableProduct && (
                            <span style={{ fontSize: '0.72rem', color: pesableWeights[item.id] && pesableWeights[item.id] !== suggestedAvgWeight ? '#16a34a' : '#c2410c', display: 'block', marginTop: '3px', fontWeight: 600 }}>
                              {pesableWeights[item.id] && pesableWeights[item.id] !== suggestedAvgWeight ? '✓ Peso balanza' : `Promedio (${suggestedAvgWeight} kg)`}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, fontSize: '1rem' }}>
                          ${Math.round(subtotal).toLocaleString('es-AR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div style={{ marginTop: '20px', padding: '16px 20px', backgroundColor: 'var(--background-alt)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.1rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Monto Total del Pedido</span>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                ${Math.round(currentTotal).toLocaleString('es-AR')}
              </span>
            </div>
          </div>
          
          {/* Columna Derecha: Panel de Facturación */}
          <div style={{ backgroundColor: 'var(--background-alt)', padding: '22px', borderRadius: '12px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '12px' }}>
              <h3 style={{ fontSize: '1.2rem', margin: 0, display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700 }}>
                <DollarSign size={20} style={{ color: '#E30613' }} /> Facturación y Cobro
              </h3>
            </div>
            
            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Cliente</label>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '4px' }}>
                {order.client?.name}
              </div>
              {order.client?.cuit && (
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                  CUIT: {order.client.cuit}
                </div>
              )}
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Canal de Facturación</label>
              <select className="select" style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem', marginTop: '6px' }} value={billingType} onChange={(e) => setBillingType(e.target.value as BillingType)}>
                <option value="OFFICIAL">Sucursal A (Oficial con CAE)</option>
                <option value="INTERNAL">Sucursal X (Interno)</option>
              </select>
            </div>

            <div className="form-group" style={{ marginBottom: 0 }}>
              <label style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Medio de Pago / Condición</label>
              <select className="select" style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem', fontWeight: 600, marginTop: '6px' }} value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                <option value="OTHER">Cuenta Corriente</option>
                <option value="CASH">Efectivo</option>
                <option value="BANK_TRANSFER">Transferencia</option>
                <option value="CHECK">Cheque</option>
              </select>
            </div>

            {paymentMethod === 'CHECK' && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Número de Cheque</label>
                <input
                  type="text"
                  className="input"
                  style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem', marginTop: '6px' }}
                  placeholder="Ej: CH-0012948"
                  value={checkNumber}
                  onChange={(e) => setCheckNumber(e.target.value)}
                />
              </div>
            )}

            {paymentMethod === 'BANK_TRANSFER' && bankAccounts.length > 0 && (
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label style={{ fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.5px', color: 'var(--text-secondary)', fontWeight: 600 }}>Cuenta Bancaria Destino</label>
                <select className="select" style={{ width: '100%', padding: '10px 12px', fontSize: '0.95rem', marginTop: '6px' }} value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)}>
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div style={{ flexGrow: 1, minHeight: '12px' }} />
            
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '14px', fontSize: '1.1rem', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '10px', backgroundColor: '#E30613', color: '#fff', borderRadius: '8px', border: 'none', cursor: 'pointer', transition: 'background-color 0.2s ease' }}
              onClick={handleConfirmAndInvoice}
              disabled={loading}
            >
              {loading ? (
                <>Procesando...</>
              ) : (
                <><CheckCircle size={22} /> Confirmar y Facturar</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

