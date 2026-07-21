import React, { useState, useEffect, useMemo } from 'react';
import { X, CheckCircle, Search, Save, DollarSign } from 'lucide-react';
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

  // Billing configuration
  const [billingType, setBillingType] = useState<BillingType>(order.billingType || BillingType.INTERNAL);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.CASH);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    // Inicializar pesos de los pesables
    const initialWeights: any = {};
    order.items.forEach((item: any) => {
      if (item.weight) {
        initialWeights[item.id] = Number(item.weight);
      } else if (item.product?.isPesable) {
        // Suggested weight based on approximate
        initialWeights[item.id] = item.quantity * (item.product.approximateWeight || 1);
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
    order.items.forEach((item: any) => {
      const price = Number(item.unitPrice ?? item.price ?? 0);
      const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
      if (isPesable) {
        const currentWeight = pesableWeights[item.id] || 0;
        total += currentWeight * price;
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
      // 1. Guardar pesos si hay pesables
      const weightItems = Object.entries(pesableWeights).map(([orderItemId, weight]) => ({
        orderItemId: Number(orderItemId),
        weight: Number(weight)
      })).filter(i => i.weight > 0);
      
      if (weightItems.length > 0) {
        await api.confirmOrderArmado(order.id, weightItems);
      } else {
        await api.confirmOrderArmado(order.id, []);
      }

      // 3. Facturar
      await api.invoiceOrder(
        order.id,
        billingType,
        paymentMethod,
        undefined, // payment description
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
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '800px' }}>
        <div className="modal-header">
          <h2>Confirmar Armado y Facturar - Pedido #{order.id}</h2>
          <button className="btn-close" onClick={onClose}><X size={24} /></button>
        </div>
        
        {errorMsg && (
          <div style={{ backgroundColor: 'var(--accent-bg-light)', color: 'var(--accent-color)', padding: '12px', borderRadius: '4px', marginBottom: '16px' }}>
            {errorMsg}
          </div>
        )}

        <div style={{ display: 'flex', gap: '20px', marginBottom: '20px' }}>
          <div style={{ flex: 2 }}>
            <h3 style={{ marginBottom: '12px', fontSize: '1.1rem' }}>Artículos Preparados</h3>
            <div className="table-container" style={{ maxHeight: '350px', overflowY: 'auto' }}>
              <table style={{ minWidth: '100%' }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th style={{ textAlign: 'right' }}>Cant</th>
                    <th style={{ textAlign: 'center' }}>Peso Real (Kg)</th>
                    <th style={{ textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items.map((item: any) => {
                    const price = Number(item.unitPrice ?? item.price ?? 0);
                    const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                    
                    let subtotal = 0;
                    if (isPesable) {
                      subtotal = (pesableWeights[item.id] || 0) * price;
                    } else {
                      subtotal = item.quantity * price;
                    }

                    return (
                      <tr key={item.id}>
                        <td style={{ fontWeight: 500 }}>
                          {item.product?.name}
                          {isPesable && <span className="badge" style={{ marginLeft: '8px', fontSize: '0.7rem' }}>Pesable</span>}
                        </td>
                        <td style={{ textAlign: 'right' }}>{item.quantity} u</td>
                        <td style={{ textAlign: 'center' }}>
                          {isPesable ? (
                            <input
                              type="number"
                              className="input"
                              style={{ width: '80px', textAlign: 'center', padding: '4px' }}
                              value={pesableWeights[item.id] || ''}
                              onChange={(e) => handleWeightChange(item.id, e.target.value)}
                              step="0.001"
                            />
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>-</span>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontWeight: 600 }}>
                          ${Math.round(subtotal).toLocaleString('es-AR')}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            
            <div style={{ marginTop: '16px', display: 'flex', justifyContent: 'flex-end', fontSize: '1.4rem', fontWeight: 'bold' }}>
              Total: ${Math.round(currentTotal).toLocaleString('es-AR')}
            </div>
          </div>
          
          <div style={{ flex: 1, backgroundColor: 'var(--background-alt)', padding: '16px', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <h3 style={{ fontSize: '1.1rem', margin: 0, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <DollarSign size={18} /> Facturación
            </h3>
            
            <div className="form-group">
              <label>Cliente</label>
              <div style={{ fontWeight: 600 }}>{order.client?.name}</div>
            </div>

            <div className="form-group">
              <label>Canal de Facturación</label>
              <select className="select" value={billingType} onChange={(e) => setBillingType(e.target.value as BillingType)}>
                <option value="OFFICIAL">Sucursal A (Oficial con CAE)</option>
                <option value="INTERNAL">Sucursal X (Interno)</option>
              </select>
            </div>

            <div className="form-group">
              <label>Medio de Pago</label>
              <select className="select" value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value as PaymentMethod)}>
                <option value="CASH">Efectivo</option>
                <option value="BANK_TRANSFER">Transferencia</option>
                <option value="CHECK">Cheque</option>
                <option value="OTHER">Otro (Pendiente en Cta. Cte.)</option>
              </select>
            </div>

            {paymentMethod === 'BANK_TRANSFER' && bankAccounts.length > 0 && (
              <div className="form-group">
                <label>Cuenta Bancaria Destino</label>
                <select className="select" value={selectedBankId} onChange={(e) => setSelectedBankId(e.target.value)}>
                  {bankAccounts.map(b => (
                    <option key={b.id} value={b.id}>{b.name}</option>
                  ))}
                </select>
              </div>
            )}
            
            <div style={{ flexGrow: 1 }} />
            
            <button 
              className="btn btn-primary" 
              style={{ width: '100%', padding: '12px', fontSize: '1.1rem', display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}
              onClick={handleConfirmAndInvoice}
              disabled={loading}
            >
              {loading ? (
                <>Procesando...</>
              ) : (
                <><CheckCircle size={20} /> Confirmar y Facturar</>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
