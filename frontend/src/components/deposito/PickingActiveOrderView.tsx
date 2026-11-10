import React from 'react';
import { Check, AlertTriangle } from 'lucide-react';
import { sortItemsByOptimalRoute, detectWeightAnomaly } from './depositoHelpers';

interface PickingActiveOrderViewProps {
  selectedOrder: any;
  selectedZone: string;
  setSelectedZone: (zone: string) => void;
  lotAssignments: Record<number, Record<number, number>>;
  confirmedLocations: Record<number, boolean>;
  setConfirmedLocations: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  pesableWeights: Record<number, number>;
  setPesableWeights: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  isOrderFullyAssigned: boolean;
  onBack: () => void;
  onFIFOAutoFill: (item: any) => void;
  onFIFOAutoFillAll: () => void;
  onLotQtyChange: (orderItemId: number, lotId: number, value: number, maxStock: number) => void;
  onFinishPicking: (orderId: number) => void;
}

export const PickingActiveOrderView: React.FC<PickingActiveOrderViewProps> = ({
  selectedOrder, selectedZone, setSelectedZone, lotAssignments, confirmedLocations, setConfirmedLocations,
  pesableWeights, setPesableWeights, isOrderFullyAssigned, onBack, onFIFOAutoFill, onFIFOAutoFillAll, onLotQtyChange, onFinishPicking,
}) => {
  const filteredItems = sortItemsByOptimalRoute(
    selectedOrder.items.filter((item: any) => selectedZone === 'ALL' || (item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS') === selectedZone),
  );
  const countZone = (zId: string) => zId === 'ALL' ? selectedOrder.items.length : selectedOrder.items.filter((i: any) => (i.product?.pickingZone || i.product?.rubro?.pickingZone || 'CAJAS') === zId).length;

  const totalItemsCount = selectedOrder.items.length;
  const itemsPreparedCount = selectedOrder.items.filter((item: any) => {
    const assignedSum = Object.values(lotAssignments[item.id] || {}).reduce((sum: number, qty) => sum + (qty || 0), 0);
    return assignedSum === item.quantity;
  }).length;
  const itemsPartialCount = selectedOrder.items.filter((item: any) => {
    const assignedSum = Object.values(lotAssignments[item.id] || {}).reduce((sum: number, qty) => sum + (qty || 0), 0);
    return assignedSum > 0 && assignedSum < item.quantity;
  }).length;
  const progressPercent = totalItemsCount > 0 ? Math.round(((itemsPreparedCount + itemsPartialCount) / totalItemsCount) * 100) : 0;

  return (
    <div className="card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <h3>Preparando Pedido #{selectedOrder.id}</h3>
        <button className="btn btn-secondary" onClick={onBack}>Regresar al Listado</button>
      </div>

      <div style={{ marginBottom: '20px', fontSize: '0.9rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div>
          <p><strong>Cliente:</strong> {selectedOrder.client?.name || selectedOrder.persona?.name}</p>
          <p><strong>Dirección:</strong> {selectedOrder.client?.address || selectedOrder.persona?.address || 'Retiro en depósito'}</p>
        </div>
        <div>
          <p><strong>Fecha pedido:</strong> {new Date(selectedOrder.createdAt).toLocaleDateString('es-AR')}</p>
          <p><strong>Vendedor:</strong> {selectedOrder.seller?.username || 'S/D'}</p>
        </div>
      </div>

      <div style={{ marginBottom: '24px', backgroundColor: 'var(--bg-secondary)', padding: '14px 18px', borderRadius: '6px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
          <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Progreso de Preparación</span>
          <span style={{ fontSize: '0.88rem', fontWeight: 800, color: progressPercent === 100 ? 'var(--color-success)' : 'var(--text-primary)' }}>
            {itemsPreparedCount} listos, {itemsPartialCount} parciales de {totalItemsCount} productos ({progressPercent}%)
          </span>
        </div>
        <div style={{ width: '100%', height: '6px', backgroundColor: 'rgba(0,0,0,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
          <div style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: progressPercent === 100 ? 'var(--color-success)' : '#4A5568', transition: 'width 0.4s cubic-bezier(0.4, 0, 0.2, 1)' }} />
        </div>
      </div>

      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '12px', flexWrap: 'wrap' }}>
        {[
          { id: 'ALL', label: '🌐 Todos los Sectores', color: '#1e293b' },
          { id: 'FRIO', label: '❄️ Sector Frío', color: '#007AFF' },
          { id: 'TABLA', label: '🍾 Sector Tabla/Bebidas', color: '#FF9500' },
          { id: 'CAJAS', label: '📦 Sector Secos/Cajas', color: '#8E8E93' },
        ].map((zone) => (
          <button
            key={zone.id} type="button" className="btn"
            style={{
              padding: '6px 14px', fontSize: '0.85rem', borderRadius: '20px',
              backgroundColor: selectedZone === zone.id ? zone.color : 'var(--bg-secondary)',
              color: selectedZone === zone.id ? '#fff' : 'var(--text-primary)',
              border: selectedZone === zone.id ? `1px solid ${zone.color}` : '1px solid var(--border-color)',
              fontWeight: 600,
            }}
            onClick={() => setSelectedZone(zone.id)}
          >
            {zone.label} ({countZone(zone.id)})
          </button>
        ))}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h4 style={{ fontSize: '0.95rem', margin: 0 }}>Lista de Artículos a Preparar (Picking List)</h4>
        <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: 'var(--bg-secondary)' }} onClick={onFIFOAutoFillAll}>
          ⚡ Auto-completar Todo (FIFO)
        </button>
      </div>

      <div className="table-container" style={{ border: '1px solid var(--border-color)', marginBottom: '20px' }}>
        <table>
          <thead>
            <tr>
              <th>Artículo y Trazabilidad de Lotes</th>
              <th>Cantidad Pedida</th>
              <th>Stock General</th>
              <th>Código SKU</th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item: any, idx: number) => {
              const isLowStock = item.product ? item.product.stock < item.quantity : false;
              const productLots = item.product?.lots || [];
              const itemAssignments = lotAssignments[item.id] || {};
              const assignedSum = Object.values(itemAssignments).reduce((sum: number, qty) => sum + (qty || 0), 0);
              const itemZone = item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS';
              const unitsPerBox = item.product?.unitsPerBox || 1;

              let packingType = '📥 Fracc. Secos';
              let badgeStyle: React.CSSProperties = { backgroundColor: 'rgba(142, 142, 147, 0.08)', color: '#8E8E93', border: '1px solid rgba(142, 142, 147, 0.15)' };
              if (unitsPerBox > 1 && item.quantity % unitsPerBox === 0) {
                packingType = `📦 ${item.quantity / unitsPerBox} Caja(s) Cerrada(s)`;
                badgeStyle = { backgroundColor: 'rgba(52, 199, 89, 0.08)', color: '#34C759', border: '1px solid rgba(52, 199, 89, 0.15)' };
              } else if (itemZone === 'FRIO') {
                packingType = '❄️ Fracc. Frío';
                badgeStyle = { backgroundColor: 'rgba(0, 122, 255, 0.08)', color: '#007AFF', border: '1px solid rgba(0, 122, 255, 0.15)' };
              } else if (itemZone === 'TABLA') {
                packingType = '🍾 Tabla/Consol.';
                badgeStyle = { backgroundColor: 'rgba(255, 149, 0, 0.08)', color: '#FF9500', border: '1px solid rgba(255, 149, 0, 0.15)' };
              }

              const currentWeightVal = Number(pesableWeights[item.id] || 0);
              const anomaly = item.product?.isPesable
                ? detectWeightAnomaly(currentWeightVal, item.quantity, item.product?.approximateWeight)
                : { isAnomaly: false, expectedKg: 0, suggestedKg: null };

              return (
                <tr key={idx} style={{ backgroundColor: isLowStock ? 'var(--accent-bg-light)' : 'transparent', borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '16px 12px', borderLeft: assignedSum === item.quantity ? '4px solid var(--color-success)' : assignedSum > 0 ? '4px solid var(--color-warning)' : '4px solid #CBD5E0' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{item.product?.name}</span>
                      {item.product?.defaultLocation && (
                        <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 700, backgroundColor: 'var(--bg-secondary)', border: '1px solid var(--border-color)' }}>
                          📍 {item.product.defaultLocation}
                        </span>
                      )}
                      <span style={{ padding: '2px 8px', borderRadius: '4px', fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', ...badgeStyle }}>
                        {packingType}
                      </span>
                    </div>

                    <div style={{ backgroundColor: 'var(--bg-secondary)', padding: '12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-color)', marginTop: '10px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                        <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Lotes Disponibles en Góndola:</span>
                        <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.75rem', height: 'auto', color: 'var(--accent-color)' }} onClick={() => onFIFOAutoFill(item)}>
                          ⚡ Auto-completar (FIFO)
                        </button>
                      </div>

                      {productLots.length === 0 ? (
                        <div style={{ fontSize: '0.8rem', color: 'var(--accent-color)' }}>⚠️ Sin lotes registrados en depósito.</div>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {productLots.map((lot: any) => {
                            const qty = itemAssignments[lot.id] || 0;
                            const isConfirmed = !lot.location || lot.location === 'S/U' || confirmedLocations[lot.id];
                            return (
                              <div key={lot.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', flexWrap: 'wrap', gap: '4px' }}>
                                  <strong>Lote: {lot.lotNumber}</strong> (Físico: {lot.stock} u.)
                                  <span style={{ color: 'var(--text-secondary)' }}>[Vence: {new Date(lot.expirationDate).toLocaleDateString('es-AR', { timeZone: 'UTC' })}]</span>
                                  {lot.location && lot.location !== 'S/U' && (
                                    <span style={{ display: 'inline-flex', alignItems: 'center', padding: '2px 6px', backgroundColor: isConfirmed ? '#e6f4ea' : '#fef7e0', border: isConfirmed ? '1px solid #137333' : '1px solid #b06000', borderRadius: '4px', fontWeight: 600, fontSize: '0.72rem', color: isConfirmed ? '#137333' : '#b06000', marginLeft: '6px' }}>
                                      Estante: {lot.location}
                                      <button type="button" onClick={() => setConfirmedLocations((prev) => ({ ...prev, [lot.id]: !prev[lot.id] }))} style={{ marginLeft: '6px', background: 'none', border: 'none', color: isConfirmed ? '#137333' : '#b06000', cursor: 'pointer', padding: 0, fontWeight: 700, fontSize: '0.7rem' }}>
                                        {isConfirmed ? '✓' : 'Confirmar'}
                                      </button>
                                    </span>
                                  )}
                                </span>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <input
                                    type="number" className="input"
                                    style={{ width: '70px', padding: '4px 6px', fontSize: '0.8rem', height: '28px', textAlign: 'center', opacity: isConfirmed ? 1 : 0.6 }}
                                    min={0} max={lot.stock} value={qty || ''}
                                    onChange={(e) => onLotQtyChange(item.id, lot.id, Number(e.target.value), lot.stock)}
                                    placeholder="0" disabled={!isConfirmed}
                                  />
                                  <span style={{ color: 'var(--text-secondary)' }}>u.</span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}

                      <div style={{ marginTop: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.8rem', borderTop: '1px solid var(--border-color)', paddingTop: '8px' }}>
                        <span style={{ fontWeight: 600, color: assignedSum === item.quantity ? 'var(--color-success)' : assignedSum > 0 ? 'var(--color-warning)' : 'var(--accent-color)' }}>
                          {assignedSum === item.quantity ? '✓ Completado' : assignedSum > 0 ? `⚠️ Armado parcial (Faltante de ${item.quantity - assignedSum} u.)` : '⚠️ Pendiente de asignación'}
                        </span>
                        <span style={{ fontWeight: 700 }}>{assignedSum} de {item.quantity} u.</span>
                      </div>

                      {item.product?.isPesable && (
                        <div style={{ marginTop: '10px', paddingTop: '10px', borderTop: '1px solid var(--border-color)' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--accent-color)' }}>⚖️ Peso Exacto Total (Balanza):</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <input
                                type="number" step="0.001" className="input" style={{ width: '95px', textAlign: 'right', fontWeight: 700 }}
                                placeholder={item.product?.approximateWeight ? `Aprox: ${(Number(item.quantity) * Number(item.product.approximateWeight)).toFixed(2)}` : 'Ej: 4.250'}
                                value={pesableWeights[item.id] || ''}
                                onChange={(e) => setPesableWeights((prev) => ({ ...prev, [item.id]: Number(e.target.value) }))}
                              />
                              <span style={{ fontSize: '0.8rem', fontWeight: 600 }}>Kg</span>
                            </div>
                          </div>
                          {anomaly.isAnomaly && (
                            <div style={{ marginTop: '8px', padding: '8px 10px', backgroundColor: '#FEF3C7', border: '1px solid #F59E0B', borderRadius: '6px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.76rem', color: '#92400E', fontWeight: 600 }}>
                                <AlertTriangle size={14} />
                                <span>Peso inusual ({currentWeightVal} kg vs esperado ~{anomaly.expectedKg} kg). ¿Faltó la coma decimal?</span>
                              </div>
                              {anomaly.suggestedKg !== null && (
                                <button type="button" className="btn" style={{ backgroundColor: '#D97706', color: '#fff', fontSize: '0.74rem', padding: '4px 10px', fontWeight: 700, borderRadius: '6px' }} onClick={() => setPesableWeights((prev) => ({ ...prev, [item.id]: anomaly.suggestedKg! }))}>
                                  🪄 Corregir coma ({anomaly.suggestedKg} kg)
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </td>
                  <td style={{ fontWeight: 700, verticalAlign: 'top', paddingTop: '16px' }}>{item.quantity} u.</td>
                  <td style={{ verticalAlign: 'top', paddingTop: '16px' }}>{item.product ? `${item.product.stock} u.` : 'S/D'}</td>
                  <td style={{ fontFamily: 'monospace', fontSize: '0.85rem', verticalAlign: 'top', paddingTop: '16px' }}>{item.product?.sku}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="modal-footer" style={{ borderTop: '1px solid var(--border-color)', paddingTop: '20px' }}>
        <button className="btn btn-secondary" onClick={onBack}>Cancelar Picking</button>
        <button className="btn btn-primary" onClick={() => onFinishPicking(selectedOrder.id)} disabled={!isOrderFullyAssigned}>
          <Check size={16} /><span>Marcar como Armado y Cerrar Bulto</span>
        </button>
      </div>
    </div>
  );
};
