import React, { useEffect, useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { api } from '../../../utils/api';

interface UnassignedRouteClientsPanelProps {
  routes: any[];
  onAssigned: () => void;
}

export const UnassignedRouteClientsPanel: React.FC<UnassignedRouteClientsPanelProps> = ({ routes, onAssigned }) => {
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [assigningId, setAssigningId] = useState<number | null>(null);
  const [targetRouteByClient, setTargetRouteByClient] = useState<Record<number, number>>({});

  const loadUnassigned = async () => {
    setLoading(true);
    try {
      const data = await api.getUnassignedRouteClients();
      setClients(data.clients || []);
    } catch {
      setClients([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUnassigned();
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((c) =>
      `${c.name || ''} ${c.city || ''} ${c.address || ''}`.toLowerCase().includes(q),
    );
  }, [clients, search]);

  const handleAssign = async (clientId: number) => {
    const routeId = targetRouteByClient[clientId] || routes[0]?.id;
    if (!routeId) return;
    setAssigningId(clientId);
    try {
      await api.addClientToRoute(routeId, clientId);
      setClients((prev) => prev.filter((c) => c.id !== clientId));
      onAssigned();
    } finally {
      setAssigningId(null);
    }
  };

  return (
    <div style={{ border: '1px solid var(--border-color)', borderRadius: '8px', backgroundColor: '#fff', padding: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>Clientes sin ruta ({clients.length})</span>
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', minWidth: '220px', flex: '0 1 320px' }}>
          <Search size={15} style={{ position: 'absolute', left: '10px', color: 'var(--text-muted)', pointerEvents: 'none' }} />
          <input
            type="search"
            className="input"
            placeholder="Filtrar por nombre o ciudad..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{ padding: '7px 30px', fontSize: '0.84rem' }}
          />
          {search && (
            <button type="button" onClick={() => setSearch('')} style={{ position: 'absolute', right: '6px', background: 'transparent', border: 'none', boxShadow: 'none', padding: '4px', color: 'var(--text-muted)' }}>
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {loading ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Cargando...</div>
      ) : filtered.length === 0 ? (
        <div style={{ padding: '20px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>Sin clientes pendientes</div>
      ) : (
        <div style={{ maxHeight: '360px', overflowY: 'auto', border: '1px solid var(--border-color)', borderRadius: '6px' }}>
          {filtered.slice(0, 100).map((c, idx) => (
            <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', padding: '8px 12px', borderBottom: idx < Math.min(filtered.length, 100) - 1 ? '1px solid #f1f5f9' : 'none', flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0, flex: '1 1 200px' }}>
                <div style={{ fontWeight: 600, fontSize: '0.86rem' }}>{c.name}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {[c.address, c.city].filter(Boolean).join(' · ') || 'Sin dirección'}
                </div>
              </div>
              {routes.length > 0 && (
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <select
                    className="select"
                    value={targetRouteByClient[c.id] || routes[0]?.id || ''}
                    onChange={(e) => setTargetRouteByClient((prev) => ({ ...prev, [c.id]: Number(e.target.value) }))}
                    style={{ height: '32px', padding: '4px 8px', fontSize: '0.78rem', maxWidth: '190px' }}
                  >
                    {routes.map((r) => (
                      <option key={r.id} value={r.id}>{r.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="btn btn-primary"
                    disabled={assigningId === c.id}
                    onClick={() => handleAssign(c.id)}
                    style={{ padding: '5px 10px', fontSize: '0.76rem' }}
                  >
                    {assigningId === c.id ? '...' : 'Asignar'}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
