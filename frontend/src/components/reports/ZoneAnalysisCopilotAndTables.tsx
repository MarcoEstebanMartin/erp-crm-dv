import type { Dispatch, FC, SetStateAction } from 'react';
import { Package, Search, Sparkles, Users } from 'lucide-react';
import { ZoneAnalysisProductRotationCards } from './ZoneAnalysisProductRotationCards';

interface ZoneAnalysisCopilotAndTablesProps {
  zoneData: any;
  clientSearch: string;
  setClientSearch: (val: string) => void;
  clientPage: number;
  setClientPage: Dispatch<SetStateAction<number>>;
  bottomProductsTab: 'lento' | 'sin_ventas';
  setBottomProductsTab: (val: 'lento' | 'sin_ventas') => void;
}

export const ZoneAnalysisCopilotAndTables: FC<ZoneAnalysisCopilotAndTablesProps> = ({
  zoneData,
  clientSearch,
  setClientSearch,
  clientPage,
  setClientPage,
  bottomProductsTab,
  setBottomProductsTab
}) => {
  const zoneClientsWithMovements = zoneData.clientsWithMovements || [];
  const filteredClients = zoneClientsWithMovements.filter((c: any) =>
    c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
    c.city.toLowerCase().includes(clientSearch.toLowerCase()) ||
    (c.sellerName && c.sellerName.toLowerCase().includes(clientSearch.toLowerCase()))
  );
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(Math.ceil(filteredClients.length / ITEMS_PER_PAGE), 1);
  const startIndex = (clientPage - 1) * ITEMS_PER_PAGE;
  const paginatedClients = filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={18} color="#1a73e8" aria-hidden="true" />
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Recomendaciones</h4>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {!zoneData.salesRecommendations || zoneData.salesRecommendations.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.85rem' }}>
                Sin alertas en el período.
              </div>
            ) : (
              zoneData.salesRecommendations.map((rec: any, idx: number) => {
                const isHigh = rec.severity === 'high';
                const isMed = rec.severity === 'medium';
                const borderLeftColor = isHigh ? 'var(--color-corp-red)' : isMed ? '#1a73e8' : '#f2994a';
                const iconBg = isHigh ? '#fdebee' : isMed ? '#e8f0fe' : '#fef3e6';
                const iconColor = isHigh ? 'var(--color-corp-red)' : isMed ? '#1a73e8' : '#f2994a';

                return (
                  <div key={idx} style={{ padding: '16px', borderRadius: '8px', backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-color)', borderLeft: `4px solid ${borderLeftColor}`, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{rec.title}</span>
                      <span style={{ fontSize: '0.72rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', backgroundColor: iconBg, color: iconColor }}>
                        {rec.type === 'CRITICAL_DROP' ? 'Alerta' : rec.type === 'CROSS_SELLING' ? 'Oportunidad' : 'Stock'}
                      </span>
                    </div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>{rec.description}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      <strong style={{ color: 'var(--text-secondary)' }}>Sugerencia:</strong> {rec.action}
                    </div>
                    {rec.script && (
                      <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: 'var(--bg-light)', border: '1px solid var(--border-color)', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'block', fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', fontStyle: 'normal' }}>
                          Guión vendedores
                        </span>
                        "{rec.script}"
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={18} color="#137333" aria-hidden="true" />
            </div>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Ventas por rubro</h4>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
            {!zoneData.rubroMetrics || zoneData.rubroMetrics.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.85rem' }}>
                Sin ventas por rubro en esta zona.
              </div>
            ) : (
              <div className="table-container" role="region" aria-label="Rendimiento por rubro" tabIndex={0} style={{ margin: 0, boxShadow: 'none', border: 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                      <th scope="col" style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>Rubro</th>
                      <th scope="col" style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'right' }}>Ventas</th>
                      <th scope="col" style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'center' }}>Share</th>
                      <th scope="col" style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'right' }}>Tendencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zoneData.rubroMetrics.map((r: any, idx: number) => {
                      const isPositive = r.trend > 0;
                      return (
                        <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.85rem' }}>
                          <td style={{ padding: '10px 4px', fontWeight: 600 }}>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <span>{r.name}</span>
                              {r.topProducts && r.topProducts.length > 0 && (
                                <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                  Top: {r.topProducts[0]?.name.substring(0, 24)}...
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="tabular-nums" style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 600, color: '#137333' }}>${r.totalSales.toLocaleString()}</td>
                          <td className="tabular-nums" style={{ padding: '10px 4px', textAlign: 'center' }}>
                            <span className="badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.75rem' }}>
                              {r.percentageOfTotal}%
                            </span>
                          </td>
                          <td className="tabular-nums" style={{ padding: '10px 4px', textAlign: 'right' }}>
                            {r.trend === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>0%</span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isPositive ? '#137333' : 'var(--color-corp-red)', backgroundColor: isPositive ? '#e6f4ea' : '#fdebee', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                {isPositive ? `+${r.trend}%` : `${r.trend}%`}
                              </span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: '24px' }}>
        <div className="card" style={{ padding: '24px', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '12px' }}>
            <h4 style={{ fontSize: '1.05rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={18} color="var(--text-secondary)" aria-hidden="true" /> Clientes con ventas
            </h4>
            <search aria-label="Buscar clientes con movimientos" style={{ position: 'relative', width: '280px' }}>
              <label htmlFor="zone-client-search" className="visually-hidden">Buscar cliente</label>
              <input
                id="zone-client-search"
                type="text"
                placeholder="Buscar cliente, localidad o vendedor..."
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setClientPage(1); }}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                style={{ padding: '6px 12px 6px 32px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-light)', color: 'var(--text-primary)', width: '100%', outline: 'none' }}
              />
              <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
            </search>
          </div>

          {filteredClients.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Sin clientes con movimientos.</div>
          ) : (
            <>
              <div className="table-container" role="region" aria-label="Clientes con ventas" tabIndex={0}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.85rem' }}>
                      <th scope="col" style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>#</th>
                      <th scope="col" style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Cliente</th>
                      <th scope="col" style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Localidad</th>
                      <th scope="col" style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Vendedor</th>
                      <th scope="col" style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'center' }}>Pedidos</th>
                      <th scope="col" style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedClients.map((c: any, idx: number) => (
                      <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }} className="table-row-hover">
                        <td className="tabular-nums" style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>{startIndex + idx + 1}</td>
                        <td style={{ padding: '12px 8px', fontWeight: 600 }}>{c.name}</td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{c.city}</td>
                        <td style={{ padding: '12px 8px', color: 'var(--text-primary)' }}>{c.sellerName || 'Sin vendedor'}</td>
                        <td className="tabular-nums" style={{ padding: '12px 8px', textAlign: 'center' }}>{c.ordersCount}</td>
                        <td className="tabular-nums" style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: '#137333' }}>${c.totalSpent.toLocaleString()}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                  <span className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredClients.length)} de {filteredClients.length}
                  </span>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <button
                      type="button"
                      onClick={() => setClientPage(prev => Math.max(prev - 1, 1))}
                      disabled={clientPage === 1}
                      style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, backgroundColor: clientPage === 1 ? 'transparent' : 'var(--bg-light)', color: clientPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: clientPage === 1 ? 'not-allowed' : 'pointer' }}
                    >
                      Anterior
                    </button>
                    <button
                      type="button"
                      onClick={() => setClientPage(prev => Math.min(prev + 1, totalPages))}
                      disabled={clientPage === totalPages}
                      style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, backgroundColor: clientPage === totalPages ? 'transparent' : 'var(--bg-light)', color: clientPage === totalPages ? 'var(--text-secondary)' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: clientPage === totalPages ? 'not-allowed' : 'pointer' }}
                    >
                      Siguiente
                    </button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <ZoneAnalysisProductRotationCards
          zoneTopProducts={zoneData.topProducts || []}
          zoneBottomProducts={zoneData.bottomProducts || []}
          zoneDeadStockProducts={zoneData.deadStockProducts || []}
          bottomProductsTab={bottomProductsTab}
          setBottomProductsTab={setBottomProductsTab}
        />
      </div>
    </>
  );
};
