import React from 'react';
import { Trash2 } from 'lucide-react';
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

export function DirectInvoiceCartTable({
  directCart,
  setDirectCart,
  promoEval,
  handleRemoveDirectProduct,
}: DirectInvoiceCartTableProps) {
  return (
    <div
      className="table-container table-container--sticky"
      role="region"
      aria-label="Artículos en carrito de facturación directa"
      tabIndex={0}
      style={{
        flex: 1,
        overflowY: 'auto',
        border: '1px solid var(--border-color)',
        borderRadius: '6px',
        backgroundColor: '#fff',
        minHeight: '180px',
      }}
    >
      <table style={{ margin: 0 }}>
        <thead style={{ position: 'sticky', top: 0, zIndex: 10, backgroundColor: 'var(--bg-app)' }}>
          <tr>
            <th scope="col">Producto</th>
            <th scope="col">Precio Unit.</th>
            <th scope="col" style={{ width: '85px' }}>Cant.</th>
            <th scope="col" style={{ textAlign: 'center' }}>Empaque / Bultos</th>
            <th scope="col" style={{ width: '100px' }}>Kilos</th>
            <th scope="col">Subtotal</th>
            <th scope="col" style={{ width: '40px' }}>
              <span className="visually-hidden">Acciones</span>
            </th>
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
              const unitsPerBox =
                item.product.unitsPerBox && Number(item.product.unitsPerBox) > 1
                  ? Number(item.product.unitsPerBox)
                  : 1;
              const fullBoxes = unitsPerBox > 1 ? Math.floor(Number(item.quantity || 0) / unitsPerBox) : 0;
              const remainderUnits = unitsPerBox > 1 ? Number(item.quantity || 0) % unitsPerBox : Number(item.quantity || 0);
              const belowMin =
                item.product.minOrderQuantity &&
                item.product.minOrderQuantity > 1 &&
                Number(item.quantity) < item.product.minOrderQuantity;
              const evalLine = promoEval?.byProductId?.[item.product.id];
              const displayUnitPrice = evalLine?.promoApplied ? evalLine.effectiveUnitPrice : Number(item.unitPrice);
              const displaySubtotal = evalLine?.promoApplied ? evalLine.lineSubtotal : Number(item.subtotal);

              return (
                <tr key={item.product.id}>
                  <td>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                      <span>{item.product.name}</span>
                      {evalLine?.promoApplied && (
                        <span
                          style={{
                            backgroundColor: '#F3F4F6',
                            color: '#111827',
                            border: '1px solid #D1D5DB',
                            fontSize: '0.68rem',
                            fontWeight: 700,
                            padding: '1px 6px',
                            borderRadius: '4px',
                          }}
                        >
                          {evalLine.appliedPromoName || 'Oferta'}
                        </span>
                      )}
                    </div>
                    <div
                      style={{
                        fontSize: '0.7rem',
                        color: 'var(--text-secondary)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '6px',
                        flexWrap: 'wrap',
                        marginTop: '2px',
                      }}
                    >
                      <span>SKU: {item.product.sku}</span>
                      {item.product.isPesable && (
                        <span
                          className="badge"
                          style={{
                            backgroundColor: '#F3F4F6',
                            color: '#374151',
                            border: '1px solid #E5E7EB',
                            fontSize: '0.68rem',
                            padding: '1px 5px',
                            borderRadius: '4px',
                          }}
                        >
                          Pesable
                        </span>
                      )}
                      {item.product.minOrderQuantity && item.product.minOrderQuantity > 1 && (
                        <span
                          style={{
                            color: belowMin ? '#E30613' : '#374151',
                            fontWeight: 600,
                            fontSize: '0.68rem',
                            backgroundColor: belowMin ? '#FEF2F2' : '#F9FAFB',
                            border: `1px solid ${belowMin ? '#FECACA' : '#E5E7EB'}`,
                            padding: '1px 5px',
                            borderRadius: '4px',
                          }}
                        >
                          {belowMin
                            ? `Mínimo exigido: ${item.product.minOrderQuantity} u.`
                            : `Mín. ${item.product.minOrderQuantity} u. OK`}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="tabular-nums">
                    {evalLine?.promoApplied && Number(item.unitPrice) > displayUnitPrice && (
                      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textDecoration: 'line-through' }}>
                        ${Number(item.unitPrice).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                    )}
                    <span style={{ fontWeight: evalLine?.promoApplied ? 700 : 400, color: evalLine?.promoApplied ? '#111827' : 'inherit' }}>
                      ${displayUnitPrice.toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </span>
                  </td>
                  <td>
                    <input
                      type="number"
                      className="input tabular-nums"
                      aria-label={`Cantidad de ${item.product.name}`}
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
                        <button
                          type="button"
                          className="btn btn-secondary"
                          title={`Clic para sumar 1 caja (+${unitsPerBox}u)`}
                          aria-label={`Sumar 1 caja de ${unitsPerBox} unidades a ${item.product.name}`}
                          onClick={() => {
                            const nextQty = Number(directCart[index].quantity || 0) + unitsPerBox;
                            setDirectCart(updateCartRowQty(directCart, index, String(nextQty)));
                          }}
                          style={{
                            backgroundColor: '#F9FAFB',
                            color: '#111827',
                            border: '1px solid #D1D5DB',
                            fontSize: '0.78rem',
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '3px',
                          }}
                        >
                          {fullBoxes > 0
                            ? `${fullBoxes} ${fullBoxes === 1 ? 'Caja' : 'Cajas'}${remainderUnits > 0 ? ` + ${remainderUnits}u` : ''}`
                            : `${remainderUnits} u sueltas`}
                        </button>
                        <span style={{ fontSize: '0.68rem', color: '#6B7280', fontWeight: 500 }}>Caja x{unitsPerBox}u</span>
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
                        className="input tabular-nums"
                        aria-label={`Peso en kg de ${item.product.name}`}
                        style={{ padding: '4px 8px', fontSize: '0.85rem' }}
                        value={item.weight || ''}
                        onChange={(e) => setDirectCart(updateCartRowWeight(directCart, index, e.target.value))}
                      />
                    ) : (
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No Aplica</span>
                    )}
                  </td>
                  <td className="tabular-nums" style={{ fontWeight: 600 }}>
                    {formatIntegerARS(displaySubtotal)}
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-ghost"
                      aria-label={`Quitar ${item.product.name} del carrito`}
                      style={{ color: '#E30613', padding: '4px' }}
                      onClick={() => handleRemoveDirectProduct(item.product.id)}
                    >
                      <Trash2 size={16} aria-hidden="true" />
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
              <tr key={`bonus-${bonus.productId}`} style={{ backgroundColor: '#F9FAFB' }}>
                <td>
                  <div style={{ fontWeight: 600, color: '#111827' }}>{bonus.productName}</div>
                  <div style={{ fontSize: '0.7rem', color: lowStock ? '#E30613' : '#4B5563', fontWeight: lowStock ? 700 : 500 }}>
                    {lowStock
                      ? `Stock insuficiente para incluir bonificación (Disponible: ${cartProd.stock}, Req: ${reqStock})`
                      : `Bonificación sin cargo · ${bonus.promoName}`}
                  </div>
                </td>
                <td className="tabular-nums" style={{ color: '#111827', fontWeight: 600 }}>$0,00</td>
                <td className="tabular-nums" style={{ fontWeight: 700, color: '#111827', textAlign: 'center' }}>+{bonus.quantity}</td>
                <td style={{ textAlign: 'center', fontSize: '0.75rem', color: '#4B5563' }}>Sin cargo</td>
                <td style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>No Aplica</td>
                <td className="tabular-nums" style={{ fontWeight: 700, color: '#111827' }}>$0,00</td>
                <td></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
