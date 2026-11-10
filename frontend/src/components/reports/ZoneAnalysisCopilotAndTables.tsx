import React from 'react';
import { Sparkles, Package, Users } from 'lucide-react';
import { ZoneAnalysisProductRotationCards } from './ZoneAnalysisProductRotationCards';

interface ZoneAnalysisCopilotAndTablesProps {
  zoneData: any;
  clientSearch: string;
  setClientSearch: (val: string) => void;
  clientPage: number;
  setClientPage: React.Dispatch<React.SetStateAction<number>>;
  bottomProductsTab: 'lento' | 'sin_ventas';
  setBottomProductsTab: (val: 'lento' | 'sin_ventas') => void;
}

export const ZoneAnalysisCopilotAndTables: React.FC<ZoneAnalysisCopilotAndTablesProps> = ({
  zoneData,
  clientSearch,
  setClientSearch,
  clientPage,
  setClientPage,
  bottomProductsTab,
  setBottomProductsTab
}) => {
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
        <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#e8f0fe', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Sparkles size={20} color="#1a73e8" />
            </div>
            <div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Copiloto de Ventas (Recomendaciones)</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Acciones comerciales detectadas para esta zona</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxHeight: '420px', overflowY: 'auto', paddingRight: '4px' }}>
            {!zoneData.salesRecommendations || zoneData.salesRecommendations.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.85rem' }}>
                No se detectaron alertas o desvíos en esta zona para el período actual. ¡Buen trabajo!
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
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-primary)' }}>{rec.title}</span>
                      <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '2px 8px', borderRadius: '12px', backgroundColor: iconBg, color: iconColor, textTransform: 'uppercase' }}>
                        {rec.type === 'CRITICAL_DROP' ? 'Alerta' : rec.type === 'CROSS_SELLING' ? 'Oportunidad' : 'Stock'}
                      </span>
                    </div>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.4 }}>{rec.description}</p>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-primary)', fontWeight: 500 }}>
                      <strong style={{ color: 'var(--text-secondary)' }}>Sugerencia:</strong> {rec.action}
                    </div>
                    {rec.script && (
                      <div style={{ padding: '12px', borderRadius: '6px', backgroundColor: 'var(--bg-light)', border: '1px solid var(--border-color)', fontSize: '0.8rem', fontStyle: 'italic', color: 'var(--text-secondary)' }}>
                        <span style={{ display: 'block', fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: '4px', textTransform: 'uppercase', fontStyle: 'normal' }}>
                          💬 Bajada para Vendedores:
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

        <div className="card" style={{ padding: '24px', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
            <div style={{ padding: '8px', borderRadius: '8px', backgroundColor: '#e6f4ea', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Package size={20} color="#137333" />
            </div>
            <div>
              <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Rendimiento por Categoría (Rubros)</h4>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Ventas, participación y crecimiento en el período</p>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', maxHeight: '420px', paddingRight: '4px' }}>
            {!zoneData.rubroMetrics || zoneData.rubroMetrics.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.85rem' }}>
                No se registran ventas categorizadas en esta zona.
              </div>
            ) : (
              <div className="table-container" style={{ margin: 0, boxShadow: 'none', border: 'none' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                      <th style={{ padding: '8px 4px', color: 'var(--text-secondary)' }}>Rubro</th>
                      <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'right' }}>Total Ventas</th>
                      <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'center' }}>Share</th>
                      <th style={{ padding: '8px 4px', color: 'var(--text-secondary)', textAlign: 'right' }}>Tendencia</th>
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
                          <td style={{ padding: '10px 4px', textAlign: 'right', fontWeight: 600, color: '#137333' }}>${r.totalSales.toLocaleString()}</td>
                          <td style={{ padding: '10px 4px', textAlign: 'center' }}>
                            <span className="badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.75rem' }}>
                              {r.percentageOfTotal}%
                            </span>
                          </td>
                          <td style={{ padding: '10px 4px', textAlign: 'right' }}>
                            {r.trend === 0 ? (
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>stable</span>
                            ) : (
                              <span style={{ fontSize: '0.75rem', fontWeight: 700, color: isPositive ? '#137333' : 'var(--color-corp-red)', backgroundColor: isPositive ? '#e6f4ea' : '#fdebee', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
                                {isPositive ? `▲ +${r.trend}%` : `▼ ${r.trend}%`}
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
            <h4 style={{ fontSize: '1.1rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Users size={20} color="var(--text-secondary)" /> Clientes con Movimientos (Ventas)
            </h4>
            <div style={{ position: 'relative', width: '280px' }}>
              <input
                type="text"
                placeholder="Buscar cliente, localidad o preventista..."
                value={clientSearch}
                onChange={(e) => { setClientSearch(e.target.value); setClientPage(1); }}
                style={{ padding: '6px 12px 6px 32px', fontSize: '0.85rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-light)', color: 'var(--text-primary)', width: '100%', outline: 'none' }}
              />
              <svg style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line>
              </svg>
            </div>
          </div>

          {(() => {
            const zoneClientsWithMovements = zoneData.clientsWithMovements || [];
            const filteredClients = zoneClientsWithMovements.filter((c: any) =>
              c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
              c.city.toLowerCase().includes(clientSearch.toLowerCase()) ||
              (c.sellerName && c.sellerName.toLowerCase().includes(clientSearch.toLowerCase()))
            );

            if (filteredClients.length === 0) {
              return <p style={{ color: 'var(--text-secondary)', margin: 0 }}>No hay clientes con movimientos registrados para la búsqueda actual.</p>;
            }

            const ITEMS_PER_PAGE = 10;
            const totalPages = Math.max(Math.ceil(filteredClients.length / ITEMS_PER_PAGE), 1);
            const startIndex = (clientPage - 1) * ITEMS_PER_PAGE;
            const paginatedClients = filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE);

            return (
              <>
                <div className="table-container">
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ borderBottom: '2px solid var(--border-color)', textAlign: 'left', fontSize: '0.85rem' }}>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Rank</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Cliente</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Localidad</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>Preventista</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'center' }}>Pedidos</th>
                        <th style={{ padding: '12px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>Total Comprado</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paginatedClients.map((c: any, idx: number) => (
                        <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.9rem' }} className="table-row-hover">
                          <td style={{ padding: '12px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>#{startIndex + idx + 1}</td>
                          <td style={{ padding: '12px 8px', fontWeight: 600 }}>{c.name}</td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-secondary)' }}>{c.city}</td>
                          <td style={{ padding: '12px 8px', color: 'var(--text-primary)' }}>{c.sellerName || 'Sin preventista'}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'center' }}>{c.ordersCount}</td>
                          <td style={{ padding: '12px 8px', textAlign: 'right', fontWeight: 700, color: '#137333' }}>${c.totalSpent.toLocaleString()}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {totalPages > 1 && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '16px', borderTop: '1px solid var(--border-color)', paddingTop: '16px' }}>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      Mostrando {startIndex + 1} a {Math.min(startIndex + ITEMS_PER_PAGE, filteredClients.length)} de {filteredClients.length} clientes con ventas
                    </span>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        onClick={() => setClientPage(prev => Math.max(prev - 1, 1))}
                        disabled={clientPage === 1}
                        style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, backgroundColor: clientPage === 1 ? 'transparent' : 'var(--bg-light)', color: clientPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: clientPage === 1 ? 'not-allowed' : 'pointer' }}
                      >
                        Anterior
                      </button>
                      <button
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
            );
          })()}
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
