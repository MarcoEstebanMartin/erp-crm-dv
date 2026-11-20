import { formatIntegerARS } from '../../utils/currency';
import { isBonusOrderItem } from '../../utils/weeklyPromoCartEvaluator';
import {
  calculateFulfillmentLineSubtotalInt,
  computeSuggestedItemWeightKg,
  isOrderItemWeighable,
  type FulfillmentWeightAnomaly,
} from './orderFulfillmentMath';

interface OrderFulfillmentItemsTableProps {
  items: any[];
  pesableWeights: Record<number, number>;
  anomalies: FulfillmentWeightAnomaly[];
  currentTotal: number;
  onWeightChange: (orderItemId: number, value: string) => void;
}

export default function OrderFulfillmentItemsTable({
  items,
  pesableWeights,
  anomalies,
  currentTotal,
  onWeightChange,
}: OrderFulfillmentItemsTableProps) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', minHeight: 0 }}>
      <div style={{ flexShrink: 0, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <h3 id="fulfillment-items-heading" style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>
          Artículos Preparados
        </h3>
        <span className="tabular-nums" style={{ fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
          {items.length} ítems
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
              <th scope="col" style={{ padding: '12px 16px' }}>Producto</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'center' }}>Empaque / Bultos</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'right' }}>Cant Total</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'center' }}>Peso Real (Kg)</th>
              <th scope="col" style={{ padding: '12px 16px', textAlign: 'right' }}>Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item: any) => {
              const bonus = isBonusOrderItem(item);
              const isPesable = !bonus && isOrderItemWeighable(item);
              const suggestedKg = isPesable ? computeSuggestedItemWeightKg(item) : 0;
              const unitsPerBox =
                item.product?.unitsPerBox && Number(item.product.unitsPerBox) > 1
                  ? Number(item.product.unitsPerBox)
                  : 1;
              const fullBoxes = unitsPerBox > 1 ? Math.floor(item.quantity / unitsPerBox) : 0;
              const remUnits = unitsPerBox > 1 ? item.quantity % unitsPerBox : item.quantity;
              const anomalyInfo = isPesable ? anomalies.find((a) => a.item.id === item.id) : undefined;
              const isAnomaly = Boolean(anomalyInfo);
              const subtotal = calculateFulfillmentLineSubtotalInt(item, pesableWeights);

              return (
                <tr
                  key={item.id}
                  style={{
                    borderBottom: '1px solid var(--border-color)',
                    backgroundColor: isAnomaly ? '#FEF2F2' : bonus ? '#F9FAFB' : undefined,
                  }}
                >
                  <td style={{ padding: '12px 16px', fontWeight: 500 }}>
                    <div>{item.product?.name}</div>
                    {bonus && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: '#F3F4F6',
                          color: '#111827',
                          border: '1px solid #D1D5DB',
                          fontSize: '0.73rem',
                          marginTop: '4px',
                          display: 'inline-block',
                        }}
                      >
                        Bonificación sin cargo
                      </span>
                    )}
                    {!bonus && isPesable && (
                      <span
                        className="badge"
                        style={{
                          backgroundColor: '#F3F4F6',
                          color: '#374151',
                          border: '1px solid #E5E7EB',
                          fontSize: '0.73rem',
                          marginTop: '4px',
                          display: 'inline-block',
                        }}
                      >
                        Pesable ({formatIntegerARS(item.unitPrice ?? item.price ?? 0)}/kg)
                      </span>
                    )}
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {unitsPerBox > 1 ? (
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span
                          className="badge"
                          style={{
                            backgroundColor: '#F9FAFB',
                            color: '#111827',
                            border: '1px solid #E5E7EB',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          {fullBoxes > 0
                            ? `${fullBoxes} ${fullBoxes === 1 ? 'Caja' : 'Cajas'}${remUnits > 0 ? ` + ${remUnits}u` : ''}`
                            : `${remUnits} u sueltas`}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: 500 }}>
                          Caja x{unitsPerBox}u
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>-</span>
                    )}
                  </td>
                  <td className="tabular-nums" style={{ padding: '12px 16px', textAlign: 'right', fontWeight: 700 }}>
                    {item.quantity} u
                  </td>
                  <td style={{ padding: '12px 16px', textAlign: 'center' }}>
                    {isPesable ? (
                      <>
                        <input
                          type="number"
                          className="input tabular-nums"
                          aria-label={`Peso real en kg para ${item.product?.name || 'artículo'}`}
                          style={{
                            width: '110px',
                            textAlign: 'center',
                            padding: '6px 8px',
                            fontWeight: 700,
                            borderColor: isAnomaly ? '#E30613' : '#D1D5DB',
                            backgroundColor: isAnomaly ? '#FEF2F2' : undefined,
                            color: isAnomaly ? '#E30613' : undefined,
                          }}
                          placeholder={`${suggestedKg}`}
                          value={
                            pesableWeights[item.id] !== undefined && pesableWeights[item.id] !== 0
                              ? pesableWeights[item.id]
                              : suggestedKg
                          }
                          onChange={(e) => onWeightChange(item.id, e.target.value)}
                          step="0.001"
                          min="0"
                        />
                        {isAnomaly ? (
                          <div style={{ marginTop: '4px' }}>
                            <span style={{ fontSize: '0.72rem', color: '#E30613', fontWeight: 700, display: 'block' }}>
                              Peso fuera de promedio (~{suggestedKg} kg)
                            </span>
                            {anomalyInfo?.possibleDecimalFix && (
                              <button
                                type="button"
                                onClick={() => onWeightChange(item.id, anomalyInfo.possibleDecimalFix!.toString())}
                                style={{
                                  marginTop: '4px',
                                  padding: '3px 8px',
                                  fontSize: '0.72rem',
                                  backgroundColor: '#FEF2F2',
                                  color: '#E30613',
                                  border: '1px solid #FECACA',
                                  borderRadius: '4px',
                                  cursor: 'pointer',
                                  fontWeight: 700,
                                }}
                              >
                                Corregir a {anomalyInfo.possibleDecimalFix} kg
                              </button>
                            )}
                          </div>
                        ) : (
                          <span
                            style={{
                              fontSize: '0.72rem',
                              color:
                                pesableWeights[item.id] && pesableWeights[item.id] !== suggestedKg
                                  ? '#111827'
                                  : '#6B7280',
                              display: 'block',
                              marginTop: '3px',
                              fontWeight: 600,
                            }}
                          >
                            {pesableWeights[item.id] && pesableWeights[item.id] !== suggestedKg
                              ? 'Peso balanza'
                              : `Promedio (${suggestedKg} kg)`}
                          </span>
                        )}
                      </>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>-</span>
                    )}
                  </td>
                  <td
                    className="tabular-nums"
                    style={{
                      padding: '12px 16px',
                      textAlign: 'right',
                      fontWeight: 700,
                      color: isAnomaly ? '#E30613' : undefined,
                    }}
                  >
                    {formatIntegerARS(subtotal)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div
        style={{
          flexShrink: 0,
          marginTop: '16px',
          padding: '16px 20px',
          backgroundColor: 'var(--background-alt)',
          borderRadius: '8px',
          border: '1px solid var(--border-color)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <span style={{ fontSize: '1.05rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Total del Pedido</span>
        <span className="tabular-nums" style={{ fontSize: '1.65rem', fontWeight: 800, color: 'var(--text-primary)' }}>
          {formatIntegerARS(currentTotal)}
        </span>
      </div>
    </div>
  );
}
