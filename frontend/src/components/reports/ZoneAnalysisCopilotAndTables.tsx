import type { Dispatch, FC, SetStateAction } from 'react';
import { Package, Search, Users } from 'lucide-react';
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
  setBottomProductsTab,
}) => {
  const zoneClientsWithMovements = zoneData.clientsWithMovements || [];
  const filteredClients = zoneClientsWithMovements.filter(
    (c: any) =>
      c.name.toLowerCase().includes(clientSearch.toLowerCase()) ||
      c.city.toLowerCase().includes(clientSearch.toLowerCase()) ||
      (c.sellerName && c.sellerName.toLowerCase().includes(clientSearch.toLowerCase())),
  );
  const ITEMS_PER_PAGE = 10;
  const totalPages = Math.max(Math.ceil(filteredClients.length / ITEMS_PER_PAGE), 1);
  const startIndex = (clientPage - 1) * ITEMS_PER_PAGE;
  const paginatedClients = filteredClients.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div className="card" style={{ padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', gap: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Package size={16} color="#137333" aria-hidden="true" />
          <h4 style={{ fontSize: '0.98rem', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>Ventas por rubro</h4>
        </div>

        <div style={{ overflowY: 'auto', maxHeight: '320px' }}>
          {!zoneData.rubroMetrics || zoneData.rubroMetrics.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-light)', borderRadius: '8px', border: '1px dashed var(--border-color)', fontSize: '0.84rem' }}>
              Sin ventas por rubro en esta zona.
            </div>
          ) : (
            <div className="table-container" role="region" aria-label="Rendimiento por rubro" tabIndex={0} style={{ margin: 0, boxShadow: 'none', border: 'none' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontSize: '0.78rem' }}>
                    <th scope="col" style={{ padding: '8px 6px', color: 'var(--text-secondary)' }}>Rubro</th>
                    <th scope="col" style={{ padding: '8px 6px', color: 'var(--text-secondary)', textAlign: 'right' }}>Ventas</th>
                    <th scope="col" style={{ padding: '8px 6px', color: 'var(--text-secondary)', textAlign: 'center' }}>%</th>
                    <th scope="col" style={{ padding: '8px 6px', color: 'var(--text-secondary)', textAlign: 'right' }}>Tendencia</th>
                  </tr>
                </thead>
                <tbody>
                  {zoneData.rubroMetrics.map((r: any, idx: number) => {
                    const isPositive = r.trend > 0;
                    return (
                      <tr key={idx} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.84rem' }}>
                        <td style={{ padding: '9px 6px', fontWeight: 600 }}>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                            <span>{r.name}</span>
                            {r.topProducts && r.topProducts.length > 0 && (
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
                                Top: {r.topProducts[0]?.name}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="tabular-nums" style={{ padding: '9px 6px', textAlign: 'right', fontWeight: 600, color: '#137333' }}>${r.totalSales.toLocaleString('es-AR')}</td>
                        <td className="tabular-nums" style={{ padding: '9px 6px', textAlign: 'center' }}>
                          <span className="badge" style={{ backgroundColor: 'var(--bg-light)', color: 'var(--text-primary)', fontWeight: 600, fontSize: '0.75rem' }}>
                            {r.percentageOfTotal}%
                          </span>
                        </td>
                        <td className="tabular-nums" style={{ padding: '9px 6px', textAlign: 'right' }}>
                          {r.trend === 0 ? (
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 600 }}>0%</span>
                          ) : (
                            <span style={{ fontSize: '0.75rem', fontWeight: 600, color: isPositive ? '#137333' : 'var(--color-corp-red)', backgroundColor: isPositive ? '#e6f4ea' : '#fdebee', padding: '2px 6px', borderRadius: '4px', display: 'inline-block' }}>
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

      <div className="card" style={{ padding: '20px', borderRadius: '10px', border: '1px solid var(--border-color)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', flexWrap: 'wrap', gap: '12px' }}>
          <h4 style={{ fontSize: '0.98rem', fontWeight: 600, margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Users size={16} color="var(--text-secondary)" aria-hidden="true" /> Clientes con ventas
          </h4>
          <search aria-label="Buscar clientes con movimientos" style={{ position: 'relative', width: '260px' }}>
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
              style={{ padding: '6px 12px 6px 32px', fontSize: '0.84rem', borderRadius: '6px', border: '1px solid var(--border-color)', backgroundColor: 'var(--bg-light)', color: 'var(--text-primary)', width: '100%', outline: 'none' }}
            />
            <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-secondary)', pointerEvents: 'none' }} />
          </search>
        </div>

        {filteredClients.length === 0 ? (
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>Sin clientes con movimientos.</div>
        ) : (
          <>
            <div className="table-container" role="region" aria-label="Clientes con ventas" tabIndex={0}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', textAlign: 'left', fontSize: '0.8rem' }}>
                    <th scope="col" style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>#</th>
                    <th scope="col" style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>Cliente</th>
                    <th scope="col" style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>Localidad</th>
                    <th scope="col" style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>Vendedor</th>
                    <th scope="col" style={{ padding: '10px 8px', color: 'var(--text-secondary)', textAlign: 'center' }}>Pedidos</th>
                    <th scope="col" style={{ padding: '10px 8px', color: 'var(--text-secondary)', textAlign: 'right' }}>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedClients.map((c: any, idx: number) => (
                    <tr key={c.id} style={{ borderBottom: '1px solid var(--border-color)', fontSize: '0.86rem' }} className="table-row-hover">
                      <td className="tabular-nums" style={{ padding: '10px 8px', fontWeight: 600, color: 'var(--text-secondary)' }}>{startIndex + idx + 1}</td>
                      <td style={{ padding: '10px 8px', fontWeight: 600 }}>{c.name}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-secondary)' }}>{c.city}</td>
                      <td style={{ padding: '10px 8px', color: 'var(--text-primary)' }}>{c.sellerName || 'Sin vendedor'}</td>
                      <td className="tabular-nums" style={{ padding: '10px 8px', textAlign: 'center' }}>{c.ordersCount}</td>
                      <td className="tabular-nums" style={{ padding: '10px 8px', textAlign: 'right', fontWeight: 700, color: '#137333' }}>${c.totalSpent.toLocaleString('es-AR')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '14px', borderTop: '1px solid var(--border-color)', paddingTop: '12px' }}>
                <span className="tabular-nums" style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                  {startIndex + 1}–{Math.min(startIndex + ITEMS_PER_PAGE, filteredClients.length)} de {filteredClients.length}
                </span>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => setClientPage((prev) => Math.max(prev - 1, 1))}
                    disabled={clientPage === 1}
                    style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 600, backgroundColor: clientPage === 1 ? 'transparent' : 'var(--bg-light)', color: clientPage === 1 ? 'var(--text-secondary)' : 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '6px', cursor: clientPage === 1 ? 'not-allowed' : 'pointer' }}
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    onClick={() => setClientPage((prev) => Math.min(prev + 1, totalPages))}
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
  );
};
