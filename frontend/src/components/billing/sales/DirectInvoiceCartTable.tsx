import React from 'react';
import type { DirectCartItem } from './sales.types';
import { updateCartRowQty, updateCartRowWeight } from './salesBilling.helpers';
import { formatIntegerARS } from '../../../utils/currency';
import type { FrontendCartPromoEvalResult } from '../../../utils/weeklyPromoCartEvaluator';

interface DirectInvoiceCartTableProps {
  directCart: DirectCartItem[];
  setDirectCart: React.Dispatch<React.SetStateAction<DirectCartItem[]>>;
  promoEval?: FrontendCartPromoEvalResult;
  handleRemoveDirectProduct: (prodId: number) => void;
}

function TrashIcon({ size }: { size: number }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-trash-2">
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <line x1="10" x2="10" y1="11" y2="17" />
      <line x1="14" x2="14" y1="11" y2="17" />
    </svg>
  );
}

export function DirectInvoiceCartTable({
  directCart,
  setDirectCart,
  promoEval,
  handleRemoveDirectProduct
}: DirectInvoiceCartTableProps) {
  return (
    <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px', backgroundColor: '#fff', minHeight: '180px' }}>
      <table style={{ margin: 0 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-app)' }}>
          <tr>
            <th>Producto</th>
            <th>Precio Unit.</th>
            <th style={{ width: '85px' }}>Cant.</th>
            <th style={{ textAlign: 'center' }}>Empaque / Bultos</th>
            <th style={{ width: '100px' }}>Kilos</th>
            <th>Subtotal</th>
            <th style={{ width: '40px' }}></th>
          </tr>
        </thead>
        <tbody>
          {directCart.length === 0 ? (
            <tr>
              <td colSpan={7} style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                El carrito de compras está vacío.
              </td>
            </tr>
          ) : (
            directCart.map((item, index) => {
              const unitsPerBox = item.product.unitsPerBox && Number(item.product.unitsPerBox) > 1 ? Number(item.product.unitsPerBox) : 1;
              const fullBoxes = unitsPerBox > 1 ? Math.floor(Number(item.quantity || 0) / unitsPerBox) : 0;
              const remainderUnits = unitsPerBox > 1 ? Number(item.quantity || 0) % unitsPerBox : Number(item.quantity || 0);
              const belowMin = item.product.minOrderQuantity && item.product.minOrderQuantity > 1 && Number(item.quantity) < item.product.minOrderQuantity;
              const evalLine = promoEval?.byProductId?.[item.product.id];
              const displayUnitPrice = evalLine?.promoApplied ? evalLine.effectiveUnitPrice : Number(item.unitPrice);
              const displaySubtotal = evalLine?.promoApplied ? evalLine.lineSubtotal : Number(item.subtotal);

              return (
                <tr key={item.product.id}>
                  <td>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span>{item.product.name}</span>
                      {evalLine?.promoApplied && (
                        <span style={{ backgroundColor: '#ECFDF5', color: '#065F46', border: '1px solid #A7F3D0', fontSize: '0.68rem', fontWeight: 700, padding: '1px 6px', borderRadius: '4px' }}>
                          {evalLine.appliedPromoName || 'Oferta'}
                        </span>
                      )}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginTop: '2px' }}>
                      <span>SKU: {item.product.sku}</span>
                      {item.product.isPesable && (
                        <span className="badge" style={{ backgroundColor: '#e0f2fe', color: '#0369a1', fontSize: '0.68rem', padding: '1px 5px', borderRadius: '4px' }}>
                          Pesable
                        </span>
                      )}
                      {item.product.minOrderQuantity && item.product.minOrderQuantity > 1 && (
                        <span style={{
                          color: belowMin ? '#d97706' : '#059669',
                          fontWeight: 600,
                          fontSize: '0.68rem',
                          backgroundColor: belowMin ? '#fef3c7' : '#ecfdf5',
                          padding: '1px 5px',
                          borderRadius: '4px'
                        }}>
                          {belowMin ? `⚠️ Mínimo exigido: ${item.product.minOrderQuantity} u.` : `Mín. ${item.product.minOrderQuantity} u. OK`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td>
                    {evalLine?.promoApplied && Number(item.unitPrice) > displayUnitPrice && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                        ${Number(item.unitPrice).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                    <span style={{ fontWeight: evalLine?.promoApplied ? 700 : 400, color: evalLine?.promoApplied ? '#065F46' : 'inherit' }}>
                      ${displayUnitPrice.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input"
                      style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                      min="1"
                      value={item.quantity === '' || item.quantity === 0 ? '' : item.quantity}
                      onChange={(e) => setDirectCart(updateCartRowQty(directCart, index, e.target.value))}
                      onBlur={() => {
                        if (!item.quantity || Number(item.quantity) <= 0) {
                          setDirectCart(updateCartRowQty(directCart, index, '1'));
                        }
                      }}
                    />
                  </td>
                  <td style={{ textAlign: 'center', padding: '8px 12px' }}>
                    {unitsPerBox > 1 ? (
                      <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
                        <span
                          className="badge"
                          title={`Clic para sumar 1 caja (+${unitsPerBox}u)`}
                          onClick={() => {
                            const nextQty = Number(directCart[index].quantity || 0) + unitsPerBox;
                            setDirectCart(updateCartRowQty(directCart, index, String(nextQty)));
                          }}
                          style={{
                            backgroundColor: fullBoxes > 0 ? (remainderUnits > 0 ? '#eff6ff' : '#f0fdf4') : '#faf5ff',
                            color: fullBoxes > 0 ? (remainderUnits > 0 ? '#1d4ed8' : '#15803d') : '#7e22ce',
                            border: `1px solid ${fullBoxes > 0 ? (remainderUnits > 0 ? '#bfdbfe' : '#bbf7d0') : '#e9d5ff'}`,
                            fontSize: '0.78rem', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                            cursor: 'pointer', userSelect: 'none', display: 'inline-flex', alignItems: 'center', gap: '3px', transition: 'all 0.15s'
                          }}
                        >
                          📦 {fullBoxes > 0 ? `${fullBoxes} ${fullBoxes === 1 ? 'Caja' : 'Cajas'}${remainderUnits > 0 ? ` + ${remainderUnits}u` : ''}` : `${remainderUnits} u sueltas`}
                        </span>
                        <span style={{ fontSize: '0.68rem', color: '#64748b', fontWeight: 500 }}>Caja x{unitsPerBox}u</span>
                      </div>
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>-</span>
                    )}
                  </td>
                  <td>
                    {item.product.isPesable ? (
                      <input
                        type="number"
                        step="0.001"
                        className="input"
                        style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        value={item.weight || ''}
                        onChange={(e) => setDirectCart(updateCartRowWeight(directCart, index, e.target.value))}
                      />
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No Aplica</span>
                    )}
                  </td>
                  <td style={{ fontWeight: 600 }}>
                    {formatIntegerARS(displaySubtotal)}
                  </td>
                  <td>
                    <button type="button" className="btn btn-ghost" style={{ color: 'var(--color-danger)', padding: '4px' }} onClick={() => handleRemoveDirectProduct(item.product.id)}>
                      <TrashIcon size={16} />
                    </button>
                  </td>
                </tr>
              );
            })
          )}
          {promoEval?.bonusLines?.map((bonus) => {
            const cartProd = directCart.find((c) => c.product.id === bonus.productId)?.product;
            const reqStock = promoEval.stockRequiredByProduct[bonus.productId] || 0;
            const lowStock = cartProd && Number(cartProd.stock || 0) < reqStock;
            return (
              <tr key={`bonus-${bonus.productId}`} style={{ backgroundColor: '#ECFDF5' }}>
                <td>
                  <div style={{ fontWeight: 600, color: '#065F46' }}>{bonus.productName}</div>
                  <div style={{ fontSize: '0.7rem', color: lowStock ? '#E30613' : '#047857', fontWeight: lowStock ? 700 : 500 }}>
                    {lowStock
                      ? `Stock insuficiente para incluir bonificación (Disponible: ${cartProd.stock}, Req: ${reqStock})`
                      : `Bonificación sin cargo · ${bonus.promoName}`}
                  </div>
                </td>
                <td style={{ color: '#065F46', fontWeight: 600 }}>$0,00</td>
                <td style={{ fontWeight: 700, color: '#065F46', textAlign: 'center' }}>+{bonus.quantity}</td>
                <td style={{ textAlign: 'center', fontSize: '0.75rem', color: '#047857' }}>Sin cargo</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No Aplica</td>
                <td style={{ fontWeight: 700, color: '#065F46' }}>$0,00</td>
                <td></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
