import type { FC } from 'react';
import { CreditCard, ShoppingBag, Users } from 'lucide-react';
import type { MostradorClient, MostradorPaymentMethod, MostradorProduct } from './SalesChannelKpisAndShare';

const getPaymentMethodLabel = (method: string) => {
  switch (method) {
    case 'CASH': return { label: 'Efectivo', color: '#10b981' };
    case 'BANK_TRANSFER': return { label: 'Transferencia', color: '#3b82f6' };
    case 'CHECK': return { label: 'Cheque', color: '#8b5cf6' };
    case 'CTA_CORRIENTE': return { label: 'Cuenta Corriente', color: '#f59e0b' };
    default: return { label: 'Otros', color: '#64748b' };
  }
};

interface SalesChannelMostradorTablesProps {
  topProducts: MostradorProduct[];
  topClients: MostradorClient[];
  paymentMethods: MostradorPaymentMethod[];
  mostradorTotalSales: number;
}

export const SalesChannelMostradorTables: FC<SalesChannelMostradorTablesProps> = ({
  topProducts,
  topClients,
  paymentMethods,
  mostradorTotalSales,
}) => {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '20px' }}>
        <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <ShoppingBag size={18} color="#E30613" aria-hidden="true" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
              Top productos mostrador
            </h3>
          </div>

          {topProducts.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
              Sin ventas en el período.
            </div>
          ) : (
            <div className="table-container" role="region" aria-label="Top productos en mostrador" tabIndex={0}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-secondary, #64748b)', fontSize: '0.75rem' }}>
                    <th scope="col" style={{ paddingBottom: '8px', fontWeight: 700 }}>Producto</th>
                    <th scope="col" style={{ paddingBottom: '8px', fontWeight: 700, textAlign: 'center' }}>Cantidad</th>
                    <th scope="col" style={{ paddingBottom: '8px', fontWeight: 700, textAlign: 'right' }}>Facturación</th>
                  </tr>
                </thead>
                <tbody>
                  {topProducts.map((item, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                      <td style={{ padding: '10px 4px 10px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="tabular-nums" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', width: '16px', textAlign: 'center' }}>{index + 1}</span>
                          {item.product.imageUrl ? (
                            <img src={item.product.imageUrl.startsWith('http') ? item.product.imageUrl : (item.product.imageUrl.startsWith('/') ? `${item.product.imageUrl}?v=1.3` : `/uploads/products/${item.product.imageUrl}?v=1.3`)} alt="" style={{ width: '28px', height: '28px', borderRadius: '4px', objectFit: 'cover', border: '1px solid #e2e8f0' }} />
                          ) : (
                            <div className="tabular-nums" style={{ width: '28px', height: '28px', borderRadius: '4px', backgroundColor: '#f1f5f9', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.65rem', fontWeight: 700, color: '#64748b' }}>
                              {item.product.sku.slice(0, 3)}
                            </div>
                          )}
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{item.product.name}</div>
                            <div className="tabular-nums" style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)', fontFamily: 'monospace' }}>SKU: {item.product.sku}</div>
                          </div>
                        </div>
                      </td>
                      <td className="tabular-nums" style={{ padding: '10px 4px', textAlign: 'center', fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>
                        {item.product.isPesable && item.weightSold > 0 ? `${item.weightSold.toFixed(2)} kg` : `${item.unitsSold} u`}
                      </td>
                      <td className="tabular-nums" style={{ padding: '10px 0 10px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                        ${item.totalRevenue.toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
            <Users size={18} color="#E30613" aria-hidden="true" />
            <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
              Top clientes mostrador
            </h3>
          </div>

          {topClients.length === 0 ? (
            <div style={{ padding: '30px 0', textAlign: 'center', fontSize: '0.82rem', color: 'var(--text-secondary, #64748b)' }}>
              Sin clientes en el período.
            </div>
          ) : (
            <div className="table-container" role="region" aria-label="Top clientes en mostrador" tabIndex={0}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.82rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color, #e2e8f0)', color: 'var(--text-secondary, #64748b)', fontSize: '0.75rem' }}>
                    <th scope="col" style={{ paddingBottom: '8px', fontWeight: 700 }}>Cliente</th>
                    <th scope="col" style={{ paddingBottom: '8px', fontWeight: 700, textAlign: 'center' }}>Compras</th>
                    <th scope="col" style={{ paddingBottom: '8px', fontWeight: 700, textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {topClients.map((client, index) => (
                    <tr key={index} style={{ borderBottom: '1px solid var(--border-color, #f1f5f9)' }}>
                      <td style={{ padding: '10px 4px 10px 0' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <span className="tabular-nums" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#94a3b8', width: '16px', textAlign: 'center' }}>{index + 1}</span>
                          <div>
                            <div style={{ fontWeight: 600, color: 'var(--text-primary, #0f172a)' }}>{client.name}</div>
                            <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary, #64748b)' }}>{client.city || 'Sin localidad'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="tabular-nums" style={{ padding: '10px 4px', textAlign: 'center' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '999px', backgroundColor: 'var(--bg-light, #f1f5f9)', color: 'var(--text-primary, #0f172a)', fontSize: '0.75rem', fontWeight: 600 }}>
                          {client.ordersCount}
                        </span>
                      </td>
                      <td className="tabular-nums" style={{ padding: '10px 0 10px 4px', textAlign: 'right', fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>
                        ${client.totalAmount.toLocaleString('es-AR')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div style={{ padding: '20px', backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid var(--border-color, #e2e8f0)', boxShadow: '0 1px 3px rgba(0,0,0,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
          <CreditCard size={18} color="#E30613" aria-hidden="true" />
          <h3 style={{ fontSize: '0.95rem', fontWeight: 700, margin: 0, color: 'var(--text-primary, #0f172a)' }}>
            Medios de pago en mostrador
          </h3>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          {paymentMethods.map((pm, i) => {
            const info = getPaymentMethodLabel(pm.method);
            const percent = mostradorTotalSales > 0 ? Math.round((pm.amount / mostradorTotalSales) * 100) : 0;
            return (
              <div key={i} style={{ padding: '14px', backgroundColor: 'var(--bg-light, #f8fafc)', border: '1px solid var(--border-color, #e2e8f0)', borderRadius: '8px' }}>
                <div className="tabular-nums" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary, #64748b)', marginBottom: '6px' }}>
                  <span>{info.label}</span>
                  <span style={{ fontWeight: 700, color: 'var(--text-primary, #0f172a)' }}>{percent}%</span>
                </div>
                <div className="tabular-nums" style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-primary, #0f172a)', marginBottom: '8px' }}>
                  ${pm.amount.toLocaleString('es-AR')}
                </div>
                <div style={{ height: '6px', width: '100%', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
                  <div style={{ height: '100%', backgroundColor: info.color, width: `${percent}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
};
