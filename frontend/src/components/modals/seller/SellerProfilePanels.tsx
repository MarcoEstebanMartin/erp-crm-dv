import React from 'react';

export interface SellerProfileData {
  seller: {
    id: number;
    personaId: number | null;
    userId: number | null;
    name: string;
    cuit: string;
    phone: string;
    email: string;
    city: string;
    address: string;
    userAccount: string | null;
    isActive: boolean;
  };
  metrics: {
    assignedClientsCount: number;
    activeClientsCount: number;
    coveragePercentage: number;
    totalSalesMonth: number;
    totalOrdersMonth: number;
    averageTicket: number;
  };
  salesEvolution: { period: string; sales: number; orders: number }[];
  topClients: { id: number; name: string; city: string; totalSpent: number; ordersCount: number }[];
  routes: { id: number; name: string; dayOfWeek: string | null; clientsCount: number }[];
  clients: {
    id: number;
    name: string;
    tradeName?: string | null;
    city?: string | null;
    address?: string | null;
    phone?: string | null;
    route?: string | null;
    cuit?: string | null;
    outstandingBalance?: number | string | null;
    saleRoute?: { name: string; dayOfWeek?: string | null } | null;
  }[];
}

interface SellerProfilePanelsProps {
  activeTab: 'stats' | 'routes' | 'clients';
  data: SellerProfileData;
  clientSearch: string;
  setClientSearch: (val: string) => void;
}

export const SellerProfilePanels: React.FC<SellerProfilePanelsProps> = ({
  activeTab,
  data,
  clientSearch,
  setClientSearch,
}) => {
  if (activeTab === 'stats') {
    const maxSales = Math.max(...data.salesEvolution.map((m) => m.sales), 1);

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '18px' }}>
        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', backgroundColor: '#fafafa' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Evolución (6 meses)
          </h4>
          {data.salesEvolution.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', padding: '20px 0' }}>Sin datos</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {data.salesEvolution.map((item, idx) => {
                const widthPct = Math.round((item.sales / maxSales) * 100);
                const isLatest = idx === data.salesEvolution.length - 1;
                return (
                  <div key={item.period} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div className="tabular-nums" style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                      <span style={{ fontWeight: isLatest ? 700 : 500, color: '#0f172a' }}>{item.period}</span>
                      <span style={{ color: '#334155', fontWeight: 600 }}>
                        ${Math.round(item.sales).toLocaleString('es-AR')} · {item.orders} ped.
                      </span>
                    </div>
                    <div style={{ height: '7px', backgroundColor: '#e2e8f0', borderRadius: '4px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${widthPct}%`, backgroundColor: isLatest ? '#0f172a' : '#64748b', borderRadius: '4px' }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '16px', backgroundColor: '#fafafa' }}>
          <h4 style={{ margin: '0 0 14px 0', fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase' }}>
            Principales clientes
          </h4>
          {data.topClients.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.84rem', padding: '20px 0' }}>Sin ventas registradas</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {data.topClients.map((client, idx) => (
                <div key={client.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 12px', backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem', color: '#0f172a' }}>
                      <span className="tabular-nums" style={{ color: '#64748b', marginRight: '6px' }}>#{idx + 1}</span>
                      {client.name}
                    </div>
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                      {client.city && client.city !== 'S/D' ? client.city : '-'}
                    </div>
                  </div>
                  <div className="tabular-nums" style={{ textAlign: 'right' }}>
                    <div style={{ fontWeight: 700, fontSize: '0.88rem', color: '#0f172a' }}>
                      ${Math.round(client.totalSpent).toLocaleString('es-AR')}
                    </div>
                    <div style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>{client.ordersCount} pedidos</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (activeTab === 'routes') {
    if (data.routes.length === 0) {
      return <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)' }}>Sin rutas asignadas</div>;
    }

    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '12px' }}>
        {data.routes.map((route) => (
          <div key={route.id} style={{ border: '1px solid var(--border-color)', borderRadius: '8px', padding: '14px', backgroundColor: '#fafafa', display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>{route.name}</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
              <span>{route.dayOfWeek || '-'}</span>
              <span className="tabular-nums" style={{ fontWeight: 600 }}>{route.clientsCount} clientes</span>
            </div>
          </div>
        ))}
      </div>
    );
  }

  const term = clientSearch.trim().toLowerCase();
  const filteredClients = data.clients.filter((c) => {
    if (!term) return true;
    return (
      c.name.toLowerCase().includes(term) ||
      (c.city || '').toLowerCase().includes(term) ||
      (c.cuit || '').toLowerCase().includes(term)
    );
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <search>
        <label htmlFor="seller-clients-search" className="sr-only">Buscar cliente</label>
        <input
          id="seller-clients-search"
          type="text"
          className="input"
          placeholder="Buscar cliente, CUIT o localidad"
          value={clientSearch}
          onChange={(e) => setClientSearch(e.target.value)}
          autoCorrect="off"
          autoCapitalize="none"
          spellCheck={false}
          style={{ width: '100%' }}
        />
      </search>

      <div className="table-container table-container--sticky" role="region" aria-label="Clientes asignados" tabIndex={0} style={{ maxHeight: '340px' }}>
        <table>
          <thead>
            <tr>
              <th scope="col">Cliente</th>
              <th scope="col">Localidad</th>
              <th scope="col">Ruta</th>
              <th scope="col">Teléfono</th>
              <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>
            </tr>
          </thead>
          <tbody>
            {filteredClients.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>Sin clientes</td>
              </tr>
            ) : (
              filteredClients.map((client) => {
                const bal = Number(client.outstandingBalance || 0);
                return (
                  <tr key={client.id}>
                    <td>
                      <div style={{ fontWeight: 600 }}>{client.name}</div>
                      {client.address && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{client.address}</div>}
                    </td>
                    <td>{client.city || '-'}</td>
                    <td>{client.saleRoute?.name || client.route || '-'}</td>
                    <td className="tabular-nums">{client.phone || '-'}</td>
                    <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 600, color: bal > 0 ? 'var(--color-danger)' : 'inherit' }}>
                      ${Math.round(bal).toLocaleString('es-AR')}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
