import React, { useState } from 'react';
import { CheckSquare } from 'lucide-react';

interface FinanzasTransferenciasTabProps {
  transfers: any[];
  onOpenReconcile: () => void;
}

type StatusFilter = 'all' | 'pending' | 'verified';

export const FinanzasTransferenciasTab: React.FC<FinanzasTransferenciasTabProps> = ({
  transfers,
  onOpenReconcile,
}) => {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

  const pendingCount = transfers.filter((t) => !t.verified).length;
  const filtered = transfers.filter((t) => {
    if (statusFilter === 'pending' && t.verified) return false;
    if (statusFilter === 'verified' && !t.verified) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const client = String(t.persona?.name || '').toLowerCase();
      const bank = String(t.bankAccount?.name || '').toLowerCase();
      return client.includes(q) || bank.includes(q);
    }
    return true;
  });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <input
            type="search"
            aria-label="Buscar transferencia"
            className="input"
            placeholder="Buscar cliente o cuenta..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ width: '240px', height: '34px', fontSize: '0.82rem' }}
          />
          {([
            { id: 'all', label: `Todas (${transfers.length})` },
            { id: 'pending', label: `Pendientes (${pendingCount})` },
            { id: 'verified', label: `Conciliadas (${transfers.length - pendingCount})` },
          ] as Array<{ id: StatusFilter; label: string }>).map((btn) => (
            <button
              key={btn.id}
              type="button"
              className={statusFilter === btn.id ? 'btn btn-secondary' : 'btn btn-ghost'}
              style={{ fontSize: '0.78rem', padding: '5px 10px', fontWeight: statusFilter === btn.id ? 600 : 400 }}
              onClick={() => setStatusFilter(btn.id)}
            >
              {btn.label}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-secondary"
          style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem', padding: '6px 12px' }}
          onClick={onOpenReconcile}
        >
          <CheckSquare size={14} aria-hidden="true" /> Conciliar
        </button>
      </div>

      <div className="table-container table-container--sticky" role="region" aria-label="Transferencias del período" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Fecha / Hora</th>
              <th scope="col">Cliente</th>
              <th scope="col">Cuenta</th>
              <th scope="col">Estado</th>
              <th scope="col" style={{ textAlign: 'right' }}>Monto</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '24px', color: 'var(--text-secondary)' }}>
                  Sin transferencias
                </td>
              </tr>
            ) : (
              filtered.map((t: any) => (
                <tr key={t.id}>
                  <td style={{ fontSize: '0.82rem' }}>
                    {new Date(t.createdAt).toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                  </td>
                  <td style={{ fontWeight: 600 }}>{t.persona?.name || 'Varios'}</td>
                  <td style={{ color: 'var(--text-secondary)', fontSize: '0.84rem' }}>{t.bankAccount?.name || 'Sin cuenta'}</td>
                  <td>
                    <span
                      style={{
                        fontSize: '0.72rem',
                        fontWeight: 600,
                        padding: '2px 8px',
                        borderRadius: '999px',
                        backgroundColor: t.verified ? '#dcfce7' : '#fef3c7',
                        color: t.verified ? '#15803d' : '#b45309',
                      }}
                    >
                      {t.verified ? 'Conciliada' : 'Pendiente'}
                    </span>
                  </td>
                  <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, fontFamily: 'monospace', color: '#0f766e' }}>
                    +${Math.round(Number(t.amount)).toLocaleString('es-AR')}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
