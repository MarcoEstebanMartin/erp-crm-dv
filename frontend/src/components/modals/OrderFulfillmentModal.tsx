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

  // Billing configuration - Default to OTHER (Cuenta Corriente) for delivery trips
  const [billingType, setBillingType] = useState<BillingType>(order.billingType || BillingType.INTERNAL);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.OTHER);
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    // Inicializar pesos de los pesables
    const initialWeights: any = {};
    order.items?.forEach((item: any) => {
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
    order.items?.forEach((item: any) => {
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

      // 2. Facturar
      await api.invoiceOrder(
        order.id,
        billingType,
        paymentMethod === 'OTHER' ? undefined : paymentMethod, // Si es OTHER (Cuenta Corriente), enviamos undefined para que afecte el saldo deudor
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
                    const isPesable = item.product?.isPesable || (item.weight && Number(item.weight) > 0);
                    
                    let subtotal = 0;
                    if (isPesable) {
                      subtotal = (pesableWeights[item.id] || 0) * price;
                    } else {
                      subtotal = item.quantity * price;
                    }

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                          <div>{item.product?.name}</div>
                          {isPesable && (
                            <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.75rem', marginTop: '4px', display: 'inline-block' }}>
                              Pesable (${price.toLocaleString('es-AR')}/kg)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 600 }}>
                          {item.quantity} u
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {isPesable ? (
                            <input
                              type="number"
                              className="input"
                              style={{ width: '95px', textAlign: 'center', padding: '6px 8px', fontWeight: 600, fontSize: '0.95rem' }}
                              value={pesableWeights[item.id] || ''}
                              onChange={(e) => handleWeightChange(item.id, e.target.value)}
                              step="0.001"
                            />
                          ) : (
                            <span style={{ color: 'var(--text-secondary)' }}>-</span>
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
                <option value="OTHER">Cuenta Corriente (Cobro en Reparto / Contrareembolso)</option>
                <option value="CASH">Efectivo (Pagado al Armar)</option>
                <option value="BANK_TRANSFER">Transferencia Bancaria</option>
                <option value="CHECK">Cheque</option>
              </select>
            </div>

            {paymentMethod === 'OTHER' && (
              <div style={{ backgroundColor: '#eff6ff', border: '1px solid #bfdbfe', color: '#1e40af', padding: '12px 14px', borderRadius: '8px', fontSize: '0.85rem', lineHeight: '1.4' }}>
                <div style={{ fontWeight: 700, marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Truck size={15} /> Cobro contra entrega en viaje
                </div>
                El saldo de <strong>${Math.round(currentTotal).toLocaleString('es-AR')}</strong> quedará cargado a la Cuenta Corriente del cliente para ser cobrado por el repartidor durante la entrega.
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

