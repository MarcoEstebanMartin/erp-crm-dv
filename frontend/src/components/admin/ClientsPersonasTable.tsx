import React, { useEffect, useRef } from 'react';
import { Trash2, MessageCircle } from 'lucide-react';
import { getWhatsAppLink } from './clientsHelpers';

interface ClientPersonaRowProps {
  persona: any;
  personaRoleFilter: string;
  isUpdating: boolean;
  onUpdateCtaCte: (client: any, val: number) => void;
  onViewClientProfile: (client: any) => void;
  onViewSellerProfile?: (seller: any) => void;
  onShowResumenModal: (client: any) => void;
  onDeletePersona: (id: number, name: string) => void;
}

const ClientPersonaRow = React.memo<ClientPersonaRowProps>(({
  persona: c, personaRoleFilter, isUpdating, onUpdateCtaCte,
  onViewClientProfile, onShowResumenModal, onDeletePersona,
}) => {
  const balance = Number(c.outstandingBalance || 0);
  const absFormatted = Math.abs(Math.round(balance)).toLocaleString('es-AR');
  const balanceText = balance > 0 ? `$${absFormatted}` : balance < 0 ? `+$${absFormatted}` : '$0';
  const balanceColor = balance > 0 ? 'var(--color-danger)' : balance < 0 ? 'var(--color-success)' : 'var(--text-secondary)';
  const pendingCount = Number(c.pendingInvoicesCount || 0);
  const maxInvoices = Number(c.maxUnpaidInvoices || 0);
  const subtitleParts = [c.address?.trim(), c.city && c.city !== 'Otros' ? c.city.trim() : ''].filter(Boolean);
  const sellerRouteLabel = c.saleRoute?.name || c.route || '';

  return (
    <tr>
      <td>
        <div style={{ fontWeight: 600 }}>{c.name}</div>
        {personaRoleFilter === 'seller' ? (
          subtitleParts.length > 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {subtitleParts.join(' · ')}
            </div>
          )
        ) : (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            {c.address || '-'}{c.city ? ` · ${c.city}` : ''}
          </div>
        )}
      </td>
      {personaRoleFilter !== 'seller' && (
        <td className="tabular-nums" style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{c.cuit || ''}</td>
      )}
      <td>
        {c.phone || c.email ? (
          <>
            {c.phone && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span className="tabular-nums">{c.phone}</span>
                <a
                  href={getWhatsAppLink(c.phone)}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`WhatsApp a ${c.name}`}
                  title="WhatsApp"
                  style={{ color: '#166534', display: 'inline-flex', alignItems: 'center' }}
                >
                  <MessageCircle size={15} />
                </a>
              </div>
            )}
            {c.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.email}</div>}
          </>
        ) : (
          personaRoleFilter === 'seller' && <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
        )}
      </td>
      {personaRoleFilter === 'client' && (
        <td style={{ whiteSpace: 'nowrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <select
              aria-label={`Límite Cta Cte para ${c.name}`}
              value={Math.min(maxInvoices, 2)}
              onChange={(e) => onUpdateCtaCte(c, Number(e.target.value))}
              disabled={isUpdating}
              style={{
                padding: '4px 8px', borderRadius: '6px',
                border: `1px solid ${maxInvoices > 0 ? '#137333' : 'var(--border-color)'}`,
                backgroundColor: maxInvoices > 0 ? '#e6f4ea' : '#f8f9fa',
                color: maxInvoices > 0 ? '#137333' : 'var(--text-secondary)',
                fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', outline: 'none', width: '118px',
              }}
            >
              <option value={0}>Sin Cta Cte</option>
              <option value={0.5}>1/2 Boleta</option>
              <option value={1}>1 Boleta</option>
              <option value={2}>2 Boletas</option>
            </select>
            {isUpdating && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>...</span>}
          </div>
          {maxInvoices > 0 && pendingCount > 0 && (
            <div
              className="tabular-nums"
              style={{
                fontSize: '0.74rem',
                color: pendingCount >= maxInvoices ? '#C5221F' : '#92400e',
                fontWeight: 600,
                marginTop: '4px',
                display: 'inline-flex',
                backgroundColor: pendingCount >= maxInvoices ? '#FCE8E6' : '#FEF3C7',
                padding: '2px 7px',
                borderRadius: '10px',
              }}
            >
              {pendingCount} {pendingCount === 1 ? 'boleta' : 'boletas'}
            </div>
          )}
        </td>
      )}
      {personaRoleFilter !== 'seller' && (
        <td className="tabular-nums" style={{ fontWeight: 600, color: balanceColor, textAlign: 'right', whiteSpace: 'nowrap' }}>
          {balanceText}
        </td>
      )}
      {personaRoleFilter === 'seller' && (
        <td>
          {sellerRouteLabel ? (
            <span style={{ display: 'inline-block', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#334155', borderRadius: '6px', textTransform: 'uppercase' }}>
              {sellerRouteLabel}
            </span>
          ) : (
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>—</span>
          )}
        </td>
      )}
      {personaRoleFilter === 'client' && (
        <td>
          {c.saleRoute?.name ? (
            <span style={{ display: 'inline-block', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f1f5f9', color: '#334155', borderRadius: '4px', textTransform: 'uppercase' }}>
              {c.saleRoute.name}
            </span>
          ) : c.route ? (
            <span style={{ display: 'inline-block', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: '#f8fafc', color: 'var(--text-secondary)', borderRadius: '4px', textTransform: 'uppercase' }}>
              {c.route}
            </span>
          ) : (
            <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>-</span>
          )}
        </td>
      )}
      <td>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
          {personaRoleFilter === 'seller' ? (
            <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => onViewClientProfile(c)}>
              Ficha
            </button>
          ) : (
            <>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => onViewClientProfile(c)}>
                Ficha
              </button>
              <button type="button" className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => onShowResumenModal(c)}>
                Cuenta
              </button>
            </>
          )}
          <button
            type="button"
            className="btn btn-ghost text-danger"
            style={{ padding: '6px 8px', color: '#e30613' }}
            aria-label={`Eliminar a ${c.name}`}
            title="Eliminar"
            onClick={() => onDeletePersona(c.id, c.name)}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
});

ClientPersonaRow.displayName = 'ClientPersonaRow';

interface ClientsPersonasTableProps {
  visibleClients: any[];
  filteredCount: number;
  totalClientsCount: number;
  personaRoleFilter: string;
  isLocationFiltered: boolean;
  updatingClientId: number | null;
  hasMoreRows: boolean;
  onLoadMore: () => void;
  onShowAll: () => void;
  onUpdateCtaCte: (client: any, val: number) => void;
  onViewClientProfile: (client: any) => void;
  onViewSellerProfile?: (seller: any) => void;
  onShowResumenModal: (client: any) => void;
  onDeletePersona: (id: number, name: string) => void;
  onResetFilters: () => void;
}

export const ClientsPersonasTable: React.FC<ClientsPersonasTableProps> = ({
  visibleClients, filteredCount, totalClientsCount, personaRoleFilter, isLocationFiltered,
  updatingClientId, hasMoreRows, onLoadMore, onShowAll, onUpdateCtaCte,
  onViewClientProfile, onViewSellerProfile, onShowResumenModal, onDeletePersona, onResetFilters,
}) => {
  const loadMoreSentinelRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const node = loadMoreSentinelRef.current;
    if (!node || !hasMoreRows || typeof IntersectionObserver === 'undefined') return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          onLoadMore();
        }
      },
      { rootMargin: '320px 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, [hasMoreRows, onLoadMore]);

  return (
    <div
      className="table-container table-container--sticky"
      role="region"
      aria-label="Listado de personas"
      tabIndex={0}
      style={{ contain: 'style' }}
    >
      <table>
        <thead>
          <tr>
            <th scope="col">{personaRoleFilter === 'seller' ? 'Vendedor' : 'Nombre'}</th>
            {personaRoleFilter !== 'seller' && <th scope="col">CUIT</th>}
            <th scope="col">Contacto</th>
            {personaRoleFilter === 'client' && <th scope="col" style={{ whiteSpace: 'nowrap', minWidth: '110px' }}>Cta Cte</th>}
            {personaRoleFilter !== 'seller' && <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>}
            {personaRoleFilter === 'seller' && <th scope="col">Rutas</th>}
            {personaRoleFilter === 'client' && <th scope="col">Ruta</th>}
            <th scope="col">Acciones</th>
          </tr>
        </thead>
        <tbody>
          {visibleClients.length === 0 ? (
            <tr>
              <td colSpan={personaRoleFilter === 'client' ? 7 : personaRoleFilter === 'seller' ? 4 : 6} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
                Sin resultados
              </td>
            </tr>
          ) : (
            visibleClients.map((c) => (
              <ClientPersonaRow
                key={c.id}
                persona={c}
                personaRoleFilter={personaRoleFilter}
                isUpdating={updatingClientId === c.id}
                onUpdateCtaCte={onUpdateCtaCte}
                onViewClientProfile={onViewClientProfile}
                onViewSellerProfile={onViewSellerProfile}
                onShowResumenModal={onShowResumenModal}
                onDeletePersona={onDeletePersona}
              />
            ))
          )}
        </tbody>
      </table>

      <div
        ref={loadMoreSentinelRef}
        style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)', fontSize: '0.84rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', flexWrap: 'wrap', backgroundColor: '#fafafa' }}
      >
        <span className="tabular-nums">
          {hasMoreRows ? (
            <>
              <strong>{visibleClients.length.toLocaleString('es-AR')}</strong> de <strong>{filteredCount.toLocaleString('es-AR')}</strong>
            </>
          ) : (
            <>
              <strong>{filteredCount.toLocaleString('es-AR')}</strong>{' '}
              {isLocationFiltered ? `de ${totalClientsCount.toLocaleString('es-AR')}` : personaRoleFilter === 'client' ? 'clientes' : 'registros'}
            </>
          )}
        </span>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {hasMoreRows && (
            <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.78rem' }} onClick={onShowAll}>
              Mostrar todos ({filteredCount.toLocaleString('es-AR')})
            </button>
          )}
          {isLocationFiltered && (
            <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.78rem', color: '#334155', fontWeight: 600 }} onClick={onResetFilters}>
              Limpiar filtros
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
