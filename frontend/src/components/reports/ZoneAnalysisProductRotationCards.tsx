import React from 'react';
import { TrendingUp, Package } from 'lucide-react';

interface ZoneAnalysisProductRotationCardsProps {
  zoneTopProducts: any[];
  zoneBottomProducts: any[];
  zoneDeadStockProducts: any[];
  bottomProductsTab: 'lento' | 'sin_ventas';
  setBottomProductsTab: (val: 'lento' | 'sin_ventas') => void;
}

export const ZoneAnalysisProductRotationCards: React.FC<ZoneAnalysisProductRotationCardsProps> = ({
  zoneTopProducts,
  zoneBottomProducts,
  zoneDeadStockProducts,
  bottomProductsTab,
  setBottomProductsTab
}) => {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))', gap: '24px' }}>
      <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
        <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 16px 0', color: '#137333', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <TrendingUp size={20} /> Productos Más Vendidos (Top Salida)
        </h4>
        {zoneTopProducts.length === 0 ? (
          <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No hay ventas registradas.</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {zoneTopProducts.map((p: any, idx: number) => (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                    <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>#{idx + 1}</span>{p.name}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>SKU: {p.sku}</div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.qty} unidades</div>
                  <div style={{ fontSize: '0.75rem', color: '#137333', fontWeight: 600 }}>${p.revenue.toLocaleString()}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', flexWrap: 'wrap', gap: '8px' }}>
          <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Package size={20} color="var(--text-secondary)" /> Alertas y Baja Rotación
          </h4>
          <div style={{ display: 'flex', gap: '2px', backgroundColor: 'var(--bg-light)', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => setBottomProductsTab('lento')}
              style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: bottomProductsTab === 'lento' ? '#fff' : 'transparent', color: bottomProductsTab === 'lento' ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Lento Movimiento
            </button>
            <button
              onClick={() => setBottomProductsTab('sin_ventas')}
              style={{ padding: '4px 8px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: bottomProductsTab === 'sin_ventas' ? '#fff' : 'transparent', color: bottomProductsTab === 'sin_ventas' ? 'var(--text-primary)' : 'var(--text-secondary)', border: 'none', borderRadius: '4px', cursor: 'pointer' }}
            >
              Stock Muerto
            </button>
          </div>
        </div>

        {bottomProductsTab === 'lento' ? (
          zoneBottomProducts.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No hay ventas registradas.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {zoneBottomProducts.map((p: any, idx: number) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>#{idx + 1}</span>{p.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>SKU: {p.sku}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{p.qty} unidades</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>${p.revenue.toLocaleString()}</div>
                  </div>
                </div>
              ))}
            </div>
          )
        ) : (
          zoneDeadStockProducts.length === 0 ? (
            <p style={{ color: 'var(--text-secondary)', margin: 0 }}>Excelente. No hay stock inmovilizado en esta zona.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {zoneDeadStockProducts.map((p: any, idx: number) => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', paddingBottom: '12px', borderBottom: '1px solid var(--border-color)' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>
                      <span style={{ color: 'var(--text-secondary)', marginRight: '6px' }}>#{idx + 1}</span>{p.name}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>SKU: {p.sku}</div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span className="badge" style={{ backgroundColor: '#FCE8E6', color: 'var(--color-corp-red)', fontSize: '0.75rem', fontWeight: 600, padding: '4px 8px', borderRadius: '4px' }}>
                      {p.stock} u en depósito
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
};
