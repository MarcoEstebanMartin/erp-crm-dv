import React from 'react';
import { Check, RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import type { Order } from '../../types';

interface DepositoReplenishmentTabProps {
  orders: Order[];
  allProducts: any[];
  pendingPurchaseOrders: any[];
  loading: boolean;
  generatingPOForProvider: number | null;
  setGeneratingPOForProvider: (id: number | null) => void;
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
  onRefresh: () => void;
}

export const DepositoReplenishmentTab: React.FC<DepositoReplenishmentTabProps> = ({
  orders,
  allProducts,
  pendingPurchaseOrders,
  loading,
  generatingPOForProvider,
  setGeneratingPOForProvider,
  setErrorMsg,
  setSuccessMsg,
  onRefresh,
}) => {
  const confirm = useConfirm();

  const pendingDemand: Record<number, number> = {};
  orders.forEach((order) => {
    (order.items || []).forEach((item: any) => {
      const prodId = item.productId;
      const qty = item.quantity;
      const assignedQty =
        item.orderItemLots?.reduce((sum: number, oil: any) => sum + (oil.quantity || 0), 0) || 0;
      const remaining = Math.max(0, qty - assignedQty);
      if (remaining > 0) {
        pendingDemand[prodId] = (pendingDemand[prodId] || 0) + remaining;
      }
    });
  });

  const inTransit: Record<number, number> = {};
  pendingPurchaseOrders.forEach((po) => {
    if (po.status === 'PENDING') {
      po.items.forEach((item: any) => {
        inTransit[item.productId] = (inTransit[item.productId] || 0) + item.quantity;
      });
    }
  });

  const suggestionsMap: Record<number, { provider: any; items: any[] }> = {};
  allProducts.forEach((prod) => {
    const currentStock = prod.stock || 0;
    const minStock = prod.minStock || 0;
    const demand = pendingDemand[prod.id] || 0;
    const transit = inTransit[prod.id] || 0;
    const deficit = minStock + demand - currentStock - transit;

    if (deficit > 0) {
      const provider = prod.provider || { id: 0, name: 'Sin Proveedor Asignado' };
      if (!suggestionsMap[provider.id]) {
        suggestionsMap[provider.id] = { provider, items: [] };
      }
      suggestionsMap[provider.id].items.push({
        product: prod,
        currentStock,
        minStock,
        demand,
        transit,
        suggestedQty: deficit,
      });
    }
  });

  const groupedSuggestions = Object.values(suggestionsMap);

  const handleCreatePO = async (providerId: number, items: any[]) => {
    if (!providerId || providerId === 0) {
      alert(
        'No se puede generar orden de compra para productos sin proveedor asignado. Asigná un proveedor al producto primero.',
      );
      return;
    }

    if (
      !(await confirm(
        `¿Deseás generar la Orden de Compra para este proveedor con los ${items.length} productos sugeridos?`,
      ))
    ) {
      return;
    }

    setGeneratingPOForProvider(providerId);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const poItems = items.map((item) => ({
        productId: item.product.id,
        quantity: item.suggestedQty,
        costPrice: Math.round(Number(item.product.costPrice)) || 0,
      }));

      await api.createPurchaseOrder({
        personaId: providerId,
        items: poItems,
      });

      setSuccessMsg('Orden de compra generada con éxito.');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al generar la orden de compra.');
    } finally {
      setGeneratingPOForProvider(null);
    }
  };

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '16px',
        }}
      >
        <div>
          <h3 style={{ margin: 0 }}>Sugerencias de Compra (Reabastecimiento)</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Productos con stock inferior al mínimo o con demanda insatisfecha por pedidos pendientes.
          </p>
        </div>
        <button className="btn btn-secondary" onClick={onRefresh}>
          <RefreshCw size={16} />
        </button>
      </div>

      {loading ? (
        <div style={{ padding: '40px 0', textAlign: 'center' }}>
          <RefreshCw size={24} style={{ animation: 'spin 1.5s linear infinite' }} />
          <p style={{ marginTop: '10px', color: 'var(--text-secondary)' }}>
            Analizando inventario y pedidos...
          </p>
        </div>
      ) : groupedSuggestions.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px 0',
            border: '1px dashed var(--border-color)',
            borderRadius: 'var(--radius-md)',
          }}
        >
          <Check size={32} style={{ color: 'var(--color-success)', marginBottom: '8px' }} />
          <h4 style={{ margin: 0 }}>¡Stock en Niveles Saludables!</h4>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            No se detectaron faltantes ni productos por debajo del stock mínimo.
          </p>
        </div>
      ) : (
        <div className="replenishment-grid">
          {groupedSuggestions.map((group: any) => {
            const totalSum = group.items.reduce(
              (sum: number, item: any) =>
                sum + item.suggestedQty * (Number(item.product.costPrice) || 0),
              0,
            );

            return (
              <div key={group.provider.id} className="provider-card">
                <div className="provider-card-header">
                  <div>
                    <h4 style={{ margin: 0 }}>{group.provider.name}</h4>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      {group.items.length} artículos a reponer
                    </span>
                  </div>
                  {group.provider.id !== 0 && (
                    <button
                      className="btn btn-primary"
                      style={{
                        padding: '6px 12px',
                        fontSize: '0.78rem',
                        backgroundColor: 'var(--color-success)',
                        borderColor: 'var(--color-success)',
                      }}
                      onClick={() => handleCreatePO(group.provider.id, group.items)}
                      disabled={generatingPOForProvider === group.provider.id}
                    >
                      {generatingPOForProvider === group.provider.id ? 'Generando...' : 'Generar OC'}
                    </button>
                  )}
                </div>
                <div style={{ padding: '12px', maxHeight: '350px', overflowY: 'auto' }}>
                  <table style={{ width: '100%', fontSize: '0.8rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>
                        <th style={{ textAlign: 'left', padding: '4px' }}>Artículo</th>
                        <th style={{ textAlign: 'center', padding: '4px' }}>Déficit</th>
                        <th style={{ textAlign: 'right', padding: '4px' }}>Costo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {group.items.map((item: any, idx: number) => {
                        const boxText =
                          item.product.unitsPerBox > 1
                            ? ` (${Math.ceil(item.suggestedQty / item.product.unitsPerBox)} cj)`
                            : '';
                        return (
                          <tr key={idx} style={{ borderBottom: '1px solid var(--bg-secondary)' }}>
                            <td style={{ padding: '8px 4px', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              <strong>{item.product.name}</strong>
                              <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>
                                Stock: {item.currentStock} / Mín: {item.minStock}{' '}
                                {item.demand > 0 && `| Pedido: ${item.demand}`}{' '}
                                {item.transit > 0 && `| Camino: ${item.transit}`}
                              </div>
                            </td>
                            <td style={{ textAlign: 'center', fontWeight: 'bold', color: 'var(--color-danger)' }}>
                              {item.suggestedQty} u.{boxText}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              ${Math.round(Number(item.product.costPrice) || 0).toLocaleString('es-AR')}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div
                  style={{
                    padding: '12px',
                    backgroundColor: 'var(--bg-secondary)',
                    borderTop: '1px solid var(--border-color)',
                    display: 'flex',
                    justifyContent: 'space-between',
                    fontSize: '0.82rem',
                    fontWeight: 600,
                  }}
                >
                  <span>Estimado Orden:</span>
                  <span style={{ color: 'var(--text-primary)' }}>
                    ${Math.round(totalSum).toLocaleString('es-AR')}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
