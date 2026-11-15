import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { api } from '../../utils/api';
import { NativeModalDialog } from './NativeModalDialog';
import { EditOrderItemsPanel, type EditOrderModalState } from './EditOrderItemsPanel';
import {
  computeClientUnitPrice,
  fetchPricingDiscountRules,
  getClientPriceListLabel,
} from '../billing/sales/salesBilling.helpers';
import { matchesSmartSearch } from '../../utils/orderSearchAndStatus.helper';
import { calculateExactLineSubtotalInt } from '../../utils/weeklyPromoCartEvaluator';

interface EditOrderModalProps {
  editOrderModal: EditOrderModalState | null;
  setEditOrderModal: (val: any) => void;
  products: any[];
  fetchData: () => void;
  setSuccessMsg: (msg: string | null) => void;
  setErrorMsg: (msg: string | null) => void;
}

const EditOrderModal: React.FC<EditOrderModalProps> = ({
  editOrderModal,
  setEditOrderModal,
  products,
  fetchData,
  setSuccessMsg,
  setErrorMsg,
}) => {
  const [prodSearchQuery, setProdSearchQuery] = useState('');
  const [discountRules, setDiscountRules] = useState<any[]>([]);

  useEffect(() => {
    if (!editOrderModal?.open) return;
    let cancelled = false;
    fetchPricingDiscountRules().then((rules) => {
      if (!cancelled) setDiscountRules(rules);
    });
    return () => {
      cancelled = true;
    };
  }, [editOrderModal?.open]);

  if (!editOrderModal || !editOrderModal.open) return null;

  const activeClient = editOrderModal.client || null;
  const priceListLabel = getClientPriceListLabel(activeClient?.priceList);

  const handleEditOrderSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const itemsPayload = editOrderModal.items.map((item) => {
        const prod = products.find((p) => p.id === item.productId);
        const minQty = prod?.minOrderQuantity || 1;
        return {
          productId: item.productId,
          quantity: item.quantity,
          weight: item.weight || null,
          isEmergencyOverride: Boolean((item as any).isEmergencyOverride || item.quantity < minQty),
        };
      });

      await api.updateOrder(editOrderModal.orderId, { items: itemsPayload });
      setEditOrderModal(null);
      setSuccessMsg(`Pedido #${editOrderModal.orderId} actualizado con éxito.`);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al actualizar el pedido.');
    }
  };

  const estimatedTotal = editOrderModal.items.reduce(
    (acc, i) =>
      acc +
      calculateExactLineSubtotalInt({
        unitPriceInt: i.listPrice,
        quantity: i.quantity,
        isPesable: Boolean(i.isPesable),
        weight: i.weight,
        approximateWeight: i.approximateWeight,
      }),
    0,
  );

  return (
    <NativeModalDialog
      isOpen={Boolean(editOrderModal?.open)}
      onClose={() => setEditOrderModal(null)}
      ariaLabelledBy="edit-order-modal-title"
      closeOnBackdrop={false}
      style={{ maxWidth: '820px', width: '95vw', maxHeight: '90vh', padding: '24px' }}
    >
      <div className="modal-header">
        <div>
          <h3 id="edit-order-modal-title">
            Editar Pedido #{editOrderModal.orderId} - {editOrderModal.clientName}
          </h3>
          <div style={{ fontSize: '0.76rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
            Lista aplicable: <strong>{priceListLabel}</strong>
            {Number(activeClient?.discount || 0) > 0
              ? ` · Desc. base ${Number(activeClient.discount)}%`
              : ''}
          </div>
        </div>
        <button
          type="button"
          className="btn btn-ghost"
          style={{ padding: '4px' }}
          onClick={() => setEditOrderModal(null)}
          aria-label="Cerrar edición de pedido"
        >
          <X size={18} aria-hidden="true" />
        </button>
      </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1.1fr 1fr',
            gap: '20px',
            overflowY: 'auto',
            flex: 1,
            padding: '10px 0',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <h4 style={{ marginBottom: '10px', fontSize: '0.9rem' }}>Añadir Artículos</h4>
            <div className="search-input-wrapper" style={{ marginBottom: '10px' }}>
              <label htmlFor="edit-order-product-search" className="visually-hidden">
                Buscar producto por nombre o SKU
              </label>
              <input
                id="edit-order-product-search"
                type="search"
                className="input"
                placeholder="Buscar producto o SKU..."
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                value={prodSearchQuery}
                onChange={(e) => setProdSearchQuery(e.target.value)}
              />
            </div>

            <div
              style={{
                flex: 1,
                overflowY: 'auto',
                maxHeight: '300px',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                padding: '10px',
              }}
            >
              {products
                .filter((p) => matchesSmartSearch(`${p.name || ''} ${p.sku || ''}`, prodSearchQuery))
                .map((p) => {
                  const unitPriceForClient = computeClientUnitPrice(p, activeClient, discountRules);
                  return (
                    <div
                      key={p.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '8px 0',
                        borderBottom: '1px solid #f0f0f0',
                      }}
                    >
                      <div>
                        <div style={{ fontSize: '0.85rem', fontWeight: 600 }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                          Stock: {p.stock} · ${unitPriceForClient.toLocaleString('es-AR')}
                          {p.isPesable ? '/Kg' : ''}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-secondary"
                        style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                        onClick={() => {
                          const existing = editOrderModal.items.find(
                            (item) => item.productId === p.id,
                          );
                          const minQty = p.minOrderQuantity || 1;
                          if (existing) {
                            setEditOrderModal({
                              ...editOrderModal,
                              items: editOrderModal.items.map((item) =>
                                item.productId === p.id
                                  ? { ...item, quantity: item.quantity + 1 }
                                  : item,
                              ),
                            });
                          } else {
                            setEditOrderModal({
                              ...editOrderModal,
                              items: [
                                ...editOrderModal.items,
                                {
                                  id: Date.now(),
                                  productId: p.id,
                                  name: p.name,
                                  sku: p.sku,
                                  quantity: minQty,
                                  isPesable: p.isPesable,
                                  approximateWeight:
                                    p.approximateWeight != null
                                      ? Number(p.approximateWeight)
                                      : undefined,
                                  listPrice: unitPriceForClient,
                                },
                              ],
                            });
                          }
                        }}
                      >
                        + Agregar
                      </button>
                    </div>
                  );
                })}
            </div>
          </div>

          <EditOrderItemsPanel
            editOrderModal={editOrderModal}
            setEditOrderModal={setEditOrderModal}
            estimatedTotal={estimatedTotal}
          />
        </div>

        <div
          className="modal-footer"
          style={{ borderTop: '1px solid var(--border-color)', paddingTop: '16px', marginTop: '10px' }}
        >
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setEditOrderModal(null)}
          >
            Cancelar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleEditOrderSubmit}>
            Guardar Cambios
          </button>
        </div>
    </NativeModalDialog>
  );
};

export default EditOrderModal;
