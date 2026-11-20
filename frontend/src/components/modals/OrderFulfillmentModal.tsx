import { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, Truck, X } from 'lucide-react';
import { BillingType, PaymentMethod } from '../../utils/types';
import { api } from '../../utils/api';
import { isBonusOrderItem } from '../../utils/weeklyPromoCartEvaluator';
import { NativeModalDialog } from './NativeModalDialog';
import OrderFulfillmentBillingPanel from './OrderFulfillmentBillingPanel';
import OrderFulfillmentItemsTable from './OrderFulfillmentItemsTable';
import { formatDeliveryRouteOptionLabel } from '../../utils/orderDeliveryHelpers';
import {
  buildInitialFulfillmentWeights,
  calculateFulfillmentOrderTotalInt,
  detectFulfillmentWeightAnomalies,
  isOrderItemWeighable,
} from './orderFulfillmentMath';

interface OrderFulfillmentModalProps {
  order: any;
  onClose: () => void;
  onSuccess: () => void;
}

export default function OrderFulfillmentModal({ order, onClose, onSuccess }: OrderFulfillmentModalProps) {
  const [pesableWeights, setPesableWeights] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmAnomalyBypass, setConfirmAnomalyBypass] = useState(false);
  const [deferCae, setDeferCae] = useState(false);

  const [billingType, setBillingType] = useState<BillingType>(order?.billingType || BillingType.INTERNAL);
  const [deliveryMethod, setDeliveryMethod] = useState<'DELIVERY' | 'PICKUP'>(
    order?.deliveryMethod === 'PICKUP' ? 'PICKUP' : 'DELIVERY',
  );
  const [markPickedUpNow, setMarkPickedUpNow] = useState(true);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(PaymentMethod.OTHER);
  const [checkNumber, setCheckNumber] = useState<string>('');
  const [selectedBankId, setSelectedBankId] = useState<string>('');
  const [bankAccounts, setBankAccounts] = useState<any[]>([]);

  useEffect(() => {
    api.getBankAccounts().then((banks) => {
      setBankAccounts(banks || []);
      if (banks && banks.length > 0) setSelectedBankId(banks[0].id.toString());
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!order) return;
    setPesableWeights(buildInitialFulfillmentWeights(order?.items));
    setBillingType(order?.billingType || BillingType.INTERNAL);
    setDeliveryMethod(order?.deliveryMethod === 'PICKUP' ? 'PICKUP' : 'DELIVERY');
    setMarkPickedUpNow(true);
    setPaymentMethod(PaymentMethod.OTHER);
    setCheckNumber('');
    setErrorMsg(null);
    setConfirmAnomalyBypass(false);
  }, [order?.id]);

  const handleWeightChange = (orderItemId: number, val: string) => {
    const num = parseFloat(val);
    setConfirmAnomalyBypass(false);
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

  const executeConfirmAndInvoice = async () => {
    if (!order) return;
    setConfirmAnomalyBypass(false);
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
      const paymentDesc =
        paymentMethod === 'CHECK' && checkNumber.trim() ? `Cheque N° ${checkNumber.trim()}` : undefined;
      await api.invoiceOrder(
        order.id,
        billingType,
        paymentMethod === 'OTHER' ? undefined : paymentMethod,
        paymentDesc,
        paymentMethod === 'BANK_TRANSFER' ? Number(selectedBankId) : undefined,
        deferCae,
        deliveryLocked ? undefined : deliveryMethod,
        !deliveryLocked && deliveryMethod === 'PICKUP' ? markPickedUpNow : undefined,
      );

      onSuccess();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al facturar.');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmAndInvoice = async () => {
    if (anomalies.length > 0) {
      setConfirmAnomalyBypass(true);
      return;
    }
    await executeConfirmAndInvoice();
  };

  if (!order) return null;

  const clientInfo = order.persona || order.client;
  const deliveryLocked = Boolean(
    order?.deliveryRouteId &&
      (order?.deliveryRoute?.status === 'IN_TRANSIT' || order?.deliveryRoute?.status === 'COMPLETED'),
  );
  const assignedRouteLabel = order?.deliveryRouteId
    ? formatDeliveryRouteOptionLabel(order.deliveryRoute || { id: order.deliveryRouteId })
    : null;

  return (
    <NativeModalDialog
      isOpen
      onClose={onClose}
      ariaLabelledBy="fulfillment-modal-title"
      style={{ width: '95vw', maxWidth: '1220px', height: '84vh', minHeight: '600px' }}
    >
      <div style={{ height: '100%', padding: '22px 26px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <div
          className="modal-header"
          style={{ flexShrink: 0, marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            <h2 id="fulfillment-modal-title" style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>
              Pedido #{order.id}
            </h2>
            {order.deliveryZone && (
              <span className="badge-minimal">
                <Truck size={13} aria-hidden="true" />
                {order.deliveryZone}
              </span>
            )}
          </div>
          <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} style={{ padding: '5px', borderRadius: '6px' }}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {anomalies.length > 0 && (
          <div
            role={confirmAnomalyBypass ? 'alertdialog' : 'alert'}
            aria-label="Alerta de pesos"
            style={{
              flexShrink: 0,
              backgroundColor: '#FEF2F2',
              color: '#111827',
              border: '1px solid rgba(227, 6, 19, 0.28)',
              padding: '10px 14px',
              borderRadius: '8px',
              marginBottom: '12px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '12px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <AlertTriangle size={20} aria-hidden="true" style={{ color: '#E30613', flexShrink: 0 }} />
              <div style={{ fontSize: '0.84rem', color: '#374151' }}>
                <strong style={{ color: '#E30613', marginRight: '6px' }}>Peso fuera de rango:</strong>
                {anomalies.map((a) => `${a.item.product?.name}: ${a.currentWeight} kg (~${a.suggestedAvgWeight} kg)`).join(' · ')}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              {anomalies.some((a) => a.possibleDecimalFix !== null) && (
                <button
                  type="button"
                  style={{ backgroundColor: '#FFFFFF', color: '#E30613', fontWeight: 700, border: '1px solid #FECACA', padding: '6px 10px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' }}
                  onClick={() => {
                    anomalies.forEach((a) => {
                      if (a.possibleDecimalFix !== null) handleWeightChange(a.item.id, a.possibleDecimalFix.toString());
                    });
                  }}
                >
                  Corregir coma
                </button>
              )}
              {confirmAnomalyBypass && (
                <>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => setConfirmAnomalyBypass(false)}
                    className="btn btn-secondary"
                    style={{ height: '30px', padding: '0 10px', fontSize: '0.82rem' }}
                  >
                    Revisar
                  </button>
                  <button
                    type="button"
                    disabled={loading}
                    onClick={() => void executeConfirmAndInvoice()}
                    style={{ backgroundColor: '#E30613', color: '#FFFFFF', fontWeight: 700, border: 'none', padding: '6px 12px', borderRadius: '6px', cursor: 'pointer', fontSize: '0.82rem' }}
                  >
                    {loading ? 'Procesando...' : 'Facturar igual'}
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {errorMsg && (
          <div role="alert" style={{ flexShrink: 0, backgroundColor: '#FEF2F2', color: '#E30613', border: '1px solid #FECACA', padding: '10px 14px', borderRadius: '8px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem' }}>
            <AlertCircle size={16} aria-hidden="true" />
            <span>{errorMsg}</span>
          </div>
        )}

        <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1.65fr 1fr', gap: '24px' }}>
          <OrderFulfillmentItemsTable
            items={order.items || []}
            pesableWeights={pesableWeights}
            anomalies={anomalies}
            currentTotal={currentTotal}
            onWeightChange={handleWeightChange}
          />

          <OrderFulfillmentBillingPanel
            clientName={clientInfo?.name}
            clientCuit={clientInfo?.cuit}
            billingType={billingType}
            onBillingTypeChange={setBillingType}
            deliveryMethod={deliveryMethod}
            onDeliveryMethodChange={setDeliveryMethod}
            markPickedUpNow={markPickedUpNow}
            onMarkPickedUpNowChange={setMarkPickedUpNow}
            deliveryLocked={deliveryLocked}
            assignedRouteLabel={assignedRouteLabel}
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
    </NativeModalDialog>
  );
}
