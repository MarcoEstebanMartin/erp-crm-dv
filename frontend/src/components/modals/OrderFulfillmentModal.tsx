import { useEffect, useMemo, useRef, useState } from 'react';
import { AlertCircle, AlertTriangle, SkipForward, Truck, X } from 'lucide-react';
import { BillingType, PaymentMethod } from '../../utils/types';
import { api } from '../../utils/api';
import { isBonusOrderItem } from '../../utils/weeklyPromoCartEvaluator';
import { NativeModalDialog } from './NativeModalDialog';
import OrderFulfillmentBillingPanel from './OrderFulfillmentBillingPanel';
import OrderFulfillmentItemsTable from './OrderFulfillmentItemsTable';
import { getNextQueueIndex } from './fulfillmentQueue.helper';
import { formatDeliveryRouteOptionLabel } from '../../utils/orderDeliveryHelpers';
import {
  buildInitialFulfillmentWeights,
  calculateFulfillmentOrderTotalInt,
  detectFulfillmentWeightAnomalies,
  isOrderItemWeighable,
  needsArmadoConfirmationBeforeInvoice,
} from './orderFulfillmentMath';

interface OrderFulfillmentModalProps {
  order?: any;
  queueOrders?: any[];
  onClose: () => void;
  onSuccess: () => void;
}

export default function OrderFulfillmentModal({
  order,
  queueOrders,
  onClose,
  onSuccess,
}: OrderFulfillmentModalProps) {
  const isQueueMode = Boolean(queueOrders && queueOrders.length > 0);
  const [queueIndex, setQueueIndex] = useState(0);
  const [invoicedCount, setInvoicedCount] = useState(0);
  const activeOrder = isQueueMode ? queueOrders![queueIndex] : order;

  const [pesableWeights, setPesableWeights] = useState<Record<number, number>>({});
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmAnomalyBypass, setConfirmAnomalyBypass] = useState(false);
  const [deferCae, setDeferCae] = useState(false);

  const [billingType, setBillingType] = useState<BillingType>(activeOrder?.billingType || BillingType.INTERNAL);
  const [deliveryMethod, setDeliveryMethod] = useState<'DELIVERY' | 'PICKUP'>(
    activeOrder?.deliveryMethod === 'PICKUP' ? 'PICKUP' : 'DELIVERY',
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
    if (!activeOrder) return;
    setPesableWeights(buildInitialFulfillmentWeights(activeOrder?.items));
    setBillingType(activeOrder?.billingType || BillingType.INTERNAL);
    setDeliveryMethod(activeOrder?.deliveryMethod === 'PICKUP' ? 'PICKUP' : 'DELIVERY');
    setMarkPickedUpNow(true);
    setPaymentMethod(PaymentMethod.OTHER);
    setCheckNumber('');
    setErrorMsg(null);
    setConfirmAnomalyBypass(false);
  }, [activeOrder?.id]);

  const handleWeightChange = (orderItemId: number, val: string) => {
    const num = parseFloat(val);
    setConfirmAnomalyBypass(false);
    setPesableWeights((prev) => ({
      ...prev,
      [orderItemId]: Number.isFinite(num) && num >= 0 ? num : 0,
    }));
  };

  const anomalies = useMemo(
    () => detectFulfillmentWeightAnomalies(activeOrder?.items, pesableWeights),
    [activeOrder?.items, pesableWeights],
  );
  const currentTotal = useMemo(
    () => calculateFulfillmentOrderTotalInt(activeOrder?.items, pesableWeights),
    [activeOrder?.items, pesableWeights],
  );

  const finishOrClose = (didInvoice: boolean) => {
    if (didInvoice) {
      onSuccess();
    } else {
      onClose();
    }
  };

  const advanceQueue = (nextInvoicedCount: number) => {
    const nextIdx = getNextQueueIndex(queueIndex, queueOrders?.length ?? 0);
    if (nextIdx !== null) {
      setQueueIndex(nextIdx);
    } else {
      finishOrClose(nextInvoicedCount > 0);
    }
  };

  const handleSkip = () => {
    if (!isQueueMode || loading) return;
    advanceQueue(invoicedCount);
  };

  const executeConfirmAndInvoice = async () => {
    if (!activeOrder) return;
    setConfirmAnomalyBypass(false);
    setLoading(true);
    setErrorMsg(null);
    try {
      if (needsArmadoConfirmationBeforeInvoice(activeOrder, pesableWeights)) {
        const weighableIds = new Set<number>(
          (activeOrder?.items || [])
            .filter((item: any) => isOrderItemWeighable(item) && !isBonusOrderItem(item))
            .map((item: any) => Number(item.id)),
        );
        const weightItems = Object.entries(pesableWeights)
          .filter(([id, w]) => weighableIds.has(Number(id)) && Number(w) > 0)
          .map(([id, w]) => ({ orderItemId: Number(id), weight: Number(w) }));

        await api.confirmOrderArmado(activeOrder.id, weightItems);
      }
      const paymentDesc =
        paymentMethod === 'CHECK' && checkNumber.trim() ? `Cheque N° ${checkNumber.trim()}` : undefined;
      await api.invoiceOrder(
        activeOrder.id,
        billingType,
        paymentMethod === 'OTHER' ? undefined : paymentMethod,
        paymentDesc,
        paymentMethod === 'BANK_TRANSFER' ? Number(selectedBankId) : undefined,
        deferCae,
        deliveryLocked ? undefined : deliveryMethod,
        !deliveryLocked && deliveryMethod === 'PICKUP' ? markPickedUpNow : undefined,
      );

      if (isQueueMode) {
        const nextCount = invoicedCount + 1;
        setInvoicedCount(nextCount);
        advanceQueue(nextCount);
      } else {
        onSuccess();
      }
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

  const confirmRef = useRef(handleConfirmAndInvoice);
  confirmRef.current = handleConfirmAndInvoice;

  useEffect(() => {
    if (!isQueueMode || loading || confirmAnomalyBypass) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
        e.preventDefault();
        void confirmRef.current();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isQueueMode, loading, confirmAnomalyBypass]);

  if (!activeOrder) return null;

  const clientInfo = activeOrder.persona || activeOrder.client;
  const deliveryLocked = Boolean(
    activeOrder?.deliveryRouteId &&
      (activeOrder?.deliveryRoute?.status === 'IN_TRANSIT' || activeOrder?.deliveryRoute?.status === 'COMPLETED'),
  );
  const assignedRouteLabel = activeOrder?.deliveryRouteId
    ? formatDeliveryRouteOptionLabel(activeOrder.deliveryRoute || { id: activeOrder.deliveryRouteId })
    : null;
  const isLastInQueue = isQueueMode && queueIndex === queueOrders!.length - 1;
  const queueProgressPct = isQueueMode ? Math.round(((queueIndex + 1) / queueOrders!.length) * 100) : 0;

  return (
    <NativeModalDialog
      isOpen
      onClose={() => finishOrClose(invoicedCount > 0)}
      ariaLabelledBy="fulfillment-modal-title"
      style={{ width: '95vw', maxWidth: '1220px', height: '84vh', minHeight: '600px' }}
    >
      <div style={{ height: '100%', padding: '22px 26px', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {isQueueMode && (
          <div style={{ flexShrink: 0, height: '4px', backgroundColor: '#F3F4F6', borderRadius: '999px', overflow: 'hidden', marginBottom: '12px' }}>
            <div style={{ width: `${queueProgressPct}%`, height: '100%', backgroundColor: '#111827', transition: 'width 0.2s ease' }} />
          </div>
        )}

        <div
          className="modal-header"
          style={{ flexShrink: 0, marginBottom: '14px', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
            {isQueueMode && (
              <span className="badge-minimal badge-minimal--solid tabular-nums" style={{ fontSize: '0.8rem', padding: '3px 9px' }}>
                {queueIndex + 1} / {queueOrders!.length}
              </span>
            )}
            <h2 id="fulfillment-modal-title" style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>
              Pedido #{activeOrder.id}
            </h2>
            {activeOrder.deliveryZone && (
              <span className="badge-minimal">
                <Truck size={13} aria-hidden="true" />
                {activeOrder.deliveryZone}
              </span>
            )}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {isQueueMode && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={loading}
                onClick={handleSkip}
                style={{ height: '30px', padding: '0 10px', fontSize: '0.8rem', fontWeight: 600 }}
              >
                <SkipForward size={13} aria-hidden="true" />
                Saltar
              </button>
            )}
            <button
              type="button"
              className="btn-close"
              aria-label="Cerrar"
              onClick={() => finishOrClose(invoicedCount > 0)}
              style={{ padding: '5px', borderRadius: '6px' }}
            >
              <X size={20} aria-hidden="true" />
            </button>
          </div>
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
            items={activeOrder.items || []}
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
            submitLabel={isQueueMode ? (isLastInQueue ? 'Facturar' : 'Facturar y seguir') : 'Facturar'}
            shortcutHint={isQueueMode ? 'Ctrl+Enter' : undefined}
          />
        </div>
      </div>
    </NativeModalDialog>
  );
}
