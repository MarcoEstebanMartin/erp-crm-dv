import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, Truck, X } from 'lucide-react';
import { BillingType, PaymentMethod } from '../../utils/types';
import { api } from '../../utils/api';
import { formatIntegerARS } from '../../utils/currency';
import { isBonusOrderItem } from '../../utils/weeklyPromoCartEvaluator';
import OrderFulfillmentBillingPanel from './OrderFulfillmentBillingPanel';
import OrderFulfillmentSuccessView from './OrderFulfillmentSuccessView';
import {
  buildInitialFulfillmentWeights,
  calculateFulfillmentLineSubtotalInt,
  calculateFulfillmentOrderTotalInt,
  computeSuggestedItemWeightKg,
  detectFulfillmentWeightAnomalies,
  isOrderItemWeighable,
} from './orderFulfillmentMath';

interface OrderFulfillmentModalProps {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OrderFulfillmentModal({ order, onClose, onSuccess }: OrderFulfillmentModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [pesableWeights, setPesableWeights] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [billingCompleted, setBillingCompleted] = useState(false);
  const [invoicedOrder, setInvoicedOrder] = useState<any>(null);
  const [deferCae, setDeferCae] = useState(false);

  const [billingType, setBillingType] = useState<BillingType>(order.billingType || BillingType.INTERNAL);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.OTHER);
  const [checkNumber, setCheckNumber] = useState<string>('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    setPesableWeights(buildInitialFulfillmentWeights(order?.items));
    api.getBankAccounts().then((banks) => {
      setBankAccounts(banks || []);
      if (banks && banks.length > 0) setSelectedBankId(banks[0].id.toString());
    }).catch(console.error);
  }, [order]);

  useEffect(() => {
    if (billingCompleted) return;
    const el = dialogRef.current;
    if (el && !el.open && typeof el.showModal === 'function') el.showModal();
  }, [billingCompleted]);

  const handleWeightChange = (orderItemId: number, val: string) => {
    const num = parseFloat(val);
    setPesableWeights((prev) => ({
      ...prev,
      [orderItemId]: Number.isFinite(num) && num >= 0 ? num : 0,
    }));
  };

  const anomalies = useMemo(
    () => detectFulfillmentWeightAnomalies(order?.items, pesableWeights),
    [order?.items, pesableWeights],
  );
  const currentTotal = useMemo(
    () => calculateFulfillmentOrderTotalInt(order?.items, pesableWeights),
    [order?.items, pesableWeights],
  );

  const handleConfirmAndInvoice = async () => {
    if (anomalies.length > 0) {
      const details = anomalies
        .map((a) => `• ${a.item.product?.name}: ${a.currentWeight} kg (Esperado: ~${a.suggestedAvgWeight} kg)`)
        .join('\n');
      const ok = window.confirm(
        `⚠️ ALERTA DE SEGURIDAD EN PESOS:\n\nSe detectaron pesos desproporcionados:\n${details}\n\n¿Desea confirmar y facturar igualmente?`,
      );
      if (!ok) return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      const weighableIds = new Set<number>(
        (order?.items || [])
          .filter((item: any) => isOrderItemWeighable(item) && !isBonusOrderItem(item))
          .map((item: any) => Number(item.id)),
      );
      const weightItems = Object.entries(pesableWeights)
        .filter(([id, w]) => weighableIds.has(Number(id)) && Number(w) > 0)
        .map(([id, w]) => ({ orderItemId: Number(id), weight: Number(w) }));

      await api.confirmOrderArmado(order.id, weightItems);
      const paymentDesc = paymentMethod === 'CHECK' && checkNumber.trim() ? `Cheque N° ${checkNumber.trim()}` : undefined;
      const updatedOrder = await api.invoiceOrder(
        order.id,
        billingType,
        paymentMethod === 'OTHER' ? undefined : paymentMethod,
        paymentDesc,
        paymentMethod === 'BANK_TRANSFER' ? Number(selectedBankId) : undefined,
        deferCae,
      );

      setInvoicedOrder(updatedOrder || { ...order, totalAmount: currentTotal, billingType });
      setBillingCompleted(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al completar el pedido.');
    } finally {
      setLoading(false);
    }
  };

  if (billingCompleted) {
    return (
      <OrderFulfillmentSuccessView
        orderId={order.id}
        billingType={billingType}
        invoicedOrder={invoicedOrder}
        fallbackTotal={currentTotal}
        onSuccess={onSuccess}
      />
    );
  }

  const clientInfo = order.persona || order.client;

  return (
    <dialog
      ref={dialogRef}
      className="app-native-dialog"
      aria-labelledby="fulfillment-modal-title"
      onClose={onClose}
      {...({ closedby: 'any' } as any)}
      style={{ width: '95vw', maxWidth: '1280px', height: '85vh', minHeight: '640px' }}
    >
      <div style={{ height: '100%', padding: '28px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          className="modal-header"
          style={{ flexShrink: 0, marginBottom: '16px', paddingBottom: '14px', borderBottom: '1px solid var(--border-color)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <h2 id="fulfillment-modal-title" style={{ fontSize: '1.35rem', margin: 0, fontWeight: 700 }}>
              Confirmar Armado y Facturar — Pedido #{order.id}
            </h2>
            {order.deliveryZone && (
              <span className="badge" style={{ backgroundColor: 'var(--accent-bg-light)', color: 'var(--accent-color)', fontSize: '0.85rem', padding: '4px 10px' }}>
                <Truck size={14} style={{ marginRight: '4px', verticalAlign: 'middle' }} />
                {order.deliveryZone}
              </span>
            )}
          </div>
          <button type="button" className="btn-close" aria-label="Cerrar ventana" onClick={onClose} style={{ padding: '6px', borderRadius: '6px' }}>
            <X size={22} />
          </button>
        </div>

        {anomalies.length > 0 && (
          <div style={{ flexShrink: 0, backgroundColor: '#fffbe3', color: '#92400e', border: '1px solid #fcd34d', padding: '12px 18px', borderRadius: '10px', marginBottom: '16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <AlertTriangle size={24} style={{ color: '#d97706', flexShrink: 0 }} />
              <div>
                <div style={{ fontWeight: 700, fontSize: '0.95rem', color: '#78350f' }}>
                  Advertencia: Peso fuera de rango respecto al promedio esperado
                </div>
                <div style={{ fontSize: '0.85rem', marginTop: '2px', color: '#92400e' }}>
                  {anomalies.map((a) => `${a.item.product?.name}: ${a.currentWeight} kg (~${a.suggestedAvgWeight} kg)`).join(' | ')}
                </div>
              </div>
            </div>
            {anomalies.some((a) => a.possibleDecimalFix !== null) && (
              <button
                type="button"
                style={{ backgroundColor: '#d97706', color: '#fff', fontWeight: 700, border: 'none', padding: '8px 14px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.85rem', whiteSpace: 'nowrap' }}
                onClick={() => {
                  anomalies.forEach((a) => {
                    if (a.possibleDecimalFix !== null) handleWeightChange(a.item.id, a.possibleDecimalFix.toString());
                  });
                }}
              >
                Corregir coma faltante
              </button>
            )}
          </div>
        )}

        {errorMsg && (
          <div style={{ flexShrink: 0, backgroundColor: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', padding: '12px 16px', borderRadius: '8px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: '28px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
            <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
              <h3 id="fulfillment-items-heading" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
                Artículos Preparados
              </h3>
              <span style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                {order.items?.length || 0} ítems en total
              </span>
            </div>

            <div
              className="table-container"
              tabIndex={0}
              role="region"
              aria-labelledby="fulfillment-items-heading"
              style={{ flex: 1, minHeight: 0, overflow: 'auto', border: '1px solid var(--border-color)', borderRadius: '8px' }}
            >
              <table style={{ width: '100%', fontSize: '0.94rem' }}>
                <thead style={{ position: 'sticky', insetBlockStart: 0, zIndex: 1, backgroundColor: 'var(--background-alt)' }}>
                  <tr style={{ textAlign: 'left' }}>
                    <th style={{ padding: '12px 16px' }}>Producto</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Empaque / Bultos</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Cant Total</th>
                    <th style={{ padding: '12px 16px', textAlign: 'center' }}>Peso Real (Kg)</th>
                    <th style={{ padding: '12px 16px', textAlign: 'right' }}>Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {order.items?.map((item: any) => {
                    const bonus = isBonusOrderItem(item);
                    const isPesable = !bonus && isOrderItemWeighable(item);
                    const suggestedKg = isPesable ? computeSuggestedItemWeightKg(item) : 0;
                    const unitsPerBox = item.product?.unitsPerBox && Number(item.product.unitsPerBox) > 1 ? Number(item.product.unitsPerBox) : 1;
                    const fullBoxes = unitsPerBox > 1 ? Math.floor(item.quantity / unitsPerBox) : 0;
                    const remUnits = unitsPerBox > 1 ? item.quantity % unitsPerBox : item.quantity;
                    const anomalyInfo = isPesable ? anomalies.find((a) => a.item.id === item.id) : undefined;
                    const isAnomaly = Boolean(anomalyInfo);
                    const subtotal = calculateFulfillmentLineSubtotalInt(item, pesableWeights);

                    return (
                      <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)', backgroundColor: isAnomaly ? '#fff5f5' : bonus ? '#f0fdf4' : undefined }}>
                        <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                          <div>{item.product?.name}</div>
                          {bonus && (
                            <span className="badge" style={{ backgroundColor: '#dcfce7', color: '#15803d', fontSize: '0.73rem', marginTop: '4px', display: 'inline-block' }}>
                              Bonificación sin cargo
                            </span>
                          )}
                          {!bonus && isPesable && (
                            <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.73rem', marginTop: '4px', display: 'inline-block' }}>
                              Pesable ({formatIntegerARS(item.unitPrice ?? item.price ?? 0)}/kg)
                            </span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {unitsPerBox > 1 ? (
                            <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                              <span className="badge" style={{ backgroundColor: fullBoxes > 0 ? (remUnits > 0 ? '#eff6ff' : '#f0fdf4') : '#faf5ff', color: fullBoxes > 0 ? (remUnits > 0 ? '#1d4ed8' : '#15803d') : '#7e22ce', border: `1px solid ${fullBoxes > 0 ? (remUnits > 0 ? '#bfdbfe' : '#bbf7d0') : '#e9d5ff'}`, fontSize: '0.78rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px' }}>
                                {fullBoxes > 0 ? `${fullBoxes} ${fullBoxes === 1 ? 'Caja' : 'Cajas'}${remUnits > 0 ? ` + ${remUnits}u` : ''}` : `${remUnits} u sueltas`}
                              </span>
                              <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>Caja x{unitsPerBox}u</span>
                            </div>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>{item.quantity} u</td>
                        <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                          {isPesable ? (
                            <>
                              <input
                                type="number"
                                className="input"
                                style={{ width: '110px', textAlign: 'center', padding: '6px 8px', fontWeight: 700, borderColor: isAnomaly ? '#dc2626' : '#f97316', backgroundColor: isAnomaly ? '#fef2f2' : undefined, color: isAnomaly ? '#b91c1c' : undefined }}
                                placeholder={`${suggestedKg}`}
                                value={pesableWeights[item.id] !== undefined && pesableWeights[item.id] !== 0 ? pesableWeights[item.id] : suggestedKg}
                                onChange={(e) => handleWeightChange(item.id, e.target.value)}
                                step="0.001"
                                min="0"
                              />
                              {isAnomaly ? (
                                <div style={{ marginTop: '4px' }}>
                                  <span style={{ fontSize: '0.72rem', color: '#dc2626', fontWeight: 700, display: 'block' }}>
                                    Peso fuera de promedio (~{suggestedKg} kg)
                                  </span>
                                  {anomalyInfo?.possibleDecimalFix && (
                                    <button
                                      type="button"
                                      onClick={() => handleWeightChange(item.id, anomalyInfo.possibleDecimalFix!.toString())}
                                      style={{ marginTop: '4px', padding: '3px 8px', fontSize: '0.72rem', backgroundColor: '#fee2e2', color: '#991b1b', border: '1px solid #fca5a5', borderRadius: '4px', cursor: 'pointer', fontWeight: 700 }}
                                    >
                                      Corregir a {anomalyInfo.possibleDecimalFix} kg
                                    </button>
                                  )}
                                </div>
                              ) : (
                                <span style={{ fontSize: '0.72rem', color: pesableWeights[item.id] && pesableWeights[item.id] !== suggestedKg ? '#16a34a' : '#c2410c', display: 'block', marginTop: '3px', fontWeight: 600 }}>
                                  {pesableWeights[item.id] && pesableWeights[item.id] !== suggestedKg ? 'Peso balanza' : `Promedio (${suggestedKg} kg)`}
                                </span>
                              )}
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>-</span>
                          )}
                        </td>
                        <td style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700, color: isAnomaly ? '#dc2626' : undefined }}>
                          {formatIntegerARS(subtotal)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ flexShrink: 0, marginTop: '16px', padding: '16px 20px', backgroundColor: 'var(--background-alt)', borderRadius: '8px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Monto Total del Pedido</span>
              <span style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>{formatIntegerARS(currentTotal)}</span>
            </div>
          </div>

          <OrderFulfillmentBillingPanel
            clientName={clientInfo?.name}
            clientCuit={clientInfo?.cuit}
            billingType={billingType}
            onBillingTypeChange={setBillingType}
            deferCae={deferCae}
            onDeferCaeChange={setDeferCae}
            paymentMethod={paymentMethod}
            onPaymentMethodChange={setPaymentMethod}
            checkNumber={checkNumber}
            onCheckNumberChange={setCheckNumber}
            bankAccounts={bankAccounts}
            selectedBankId={selectedBankId}
            onSelectedBankIdChange={setSelectedBankId}
            loading={loading}
            onConfirmAndInvoice={handleConfirmAndInvoice}
          />
        </div>
      </div>
    </dialog>
  );
}
