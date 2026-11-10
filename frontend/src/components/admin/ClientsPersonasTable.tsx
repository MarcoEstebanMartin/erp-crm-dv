import React from 'react';
import { Trash2 } from 'lucide-react';
import { getWhatsAppLink } from './clientsHelpers';

interface ClientsPersonasTableProps {
  filteredClients: any[];
  totalClientsCount: number;
  personaRoleFilter: string;
  isLocationFiltered: boolean;
  updatingClientId: number | null;
  onUpdateCtaCte: (client: any, val: number) => void;
  onViewClientProfile: (client: any) => void;
  onViewSellerProfile?: (seller: any) => void;
  onShowResumenModal: (client: any) => void;
  onDeletePersona: (id: number, name: string) => void;
  onResetFilters: () => void;
}

export const ClientsPersonasTable: React.FC<ClientsPersonasTableProps> = ({
  filteredClients, totalClientsCount, personaRoleFilter, isLocationFiltered,
  updatingClientId, onUpdateCtaCte, onViewClientProfile, onViewSellerProfile,
  onShowResumenModal, onDeletePersona, onResetFilters,
}) => {
  return (
    <div className="table-container">
      <table>
        <thead>
          <tr>
            <th>{personaRoleFilter === 'seller' ? 'Vendedor / Nombre' : 'Nombre Comercial / Razón Social'}</th>
            <th>CUIT</th>
            <th>Contacto</th>
            {personaRoleFilter === 'client' && <th style={{ whiteSpace: 'nowrap', minWidth: '110px' }}>Cta Cte</th>}
            {personaRoleFilter !== 'seller' && <th>Saldo C/C</th>}
            {personaRoleFilter === 'seller' && <th>Zonas / Rutas de Preventa</th>}
            {personaRoleFilter === 'client' && <th>Ruta</th>}
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {filteredClients.length === 0 ? (
            <tr>
              <td colSpan={personaRoleFilter === 'client' ? 7 : 6} style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-secondary)' }}>
                No se encontraron personas registradas con los filtros seleccionados.
              </td>
            </tr>
          ) : (
            filteredClients.map((c) => {
              const balance = Number(c.outstandingBalance || 0);
              const balanceText = balance > 0 ? `Saldo Deudor: $${Math.round(balance).toLocaleString('es-AR')}` : balance < 0 ? `A Favor: $${Math.abs(Math.round(balance)).toLocaleString('es-AR')}` : '$0';
              const balanceColor = balance > 0 ? 'var(--color-danger)' : balance < 0 ? 'var(--color-success)' : 'var(--text-secondary)';

              return (
                <tr key={c.id}>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {c.address || 'Sin dirección'} {c.city ? `· ${c.city}` : ''}
                    </div>
                  </td>
                  <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{c.cuit || ''}</td>
                  <td>
                    {c.phone && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span>{c.phone}</span>
                        <a href={getWhatsAppLink(c.phone)} target="_blank" rel="noopener noreferrer" title="Enviar mensaje de WhatsApp" style={{ textDecoration: 'none' }}>💬</a>
                      </div>
                    )}
                    {c.email && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.email}</div>}
                  </td>
                  {personaRoleFilter === 'client' && (
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <select
                          value={Number(c.maxUnpaidInvoices) || 0}
                          onChange={(e) => onUpdateCtaCte(c, Number(e.target.value))}
                          disabled={updatingClientId === c.id}
                          style={{
                            padding: '4px 8px', borderRadius: '6px',
                            border: `1px solid ${Number(c.maxUnpaidInvoices) > 0 ? '#137333' : 'var(--border-color)'}`,
                            backgroundColor: Number(c.maxUnpaidInvoices) > 0 ? '#e6f4ea' : '#f8f9fa',
                            color: Number(c.maxUnpaidInvoices) > 0 ? '#137333' : 'var(--text-secondary)',
                            fontWeight: 600, fontSize: '0.8rem', cursor: 'pointer', outline: 'none', width: '100px',
                          }}
                        >
                          <option value={0}>Sin Cta Cte</option>
                          <option value={0.5}>Med. Boleta</option>
                          <option value={1}>1 Boleta</option>
                          <option value={2}>2 Boletas</option>
                          <option value={3}>3 Boletas</option>
                          <option value={4}>4 Boletas</option>
                          <option value={5}>5 Boletas</option>
                        </select>
                        {updatingClientId === c.id && <span style={{ fontSize: '0.75rem' }}>⏳</span>}
                      </div>
                      {Number(c.maxUnpaidInvoices) > 0 && c.pendingInvoicesCount > 0 && (
                        <div style={{ fontSize: '0.75rem', color: c.pendingInvoicesCount >= Number(c.maxUnpaidInvoices) ? '#C5221F' : '#F29900', fontWeight: 600, marginTop: '4px', display: 'inline-flex', alignItems: 'center', backgroundColor: c.pendingInvoicesCount >= Number(c.maxUnpaidInvoices) ? '#FCE8E6' : '#FEF7E0', padding: '2px 6px', borderRadius: '12px' }}>
                          {c.pendingInvoicesCount === 1 ? '⚠️ Debe 1 boleta' : `⚠️ Debe ${c.pendingInvoicesCount} boletas`}
                        </div>
                      )}
                    </td>
                  )}
                  {personaRoleFilter !== 'seller' && <td style={{ fontWeight: 600, color: balanceColor }}>{balanceText}</td>}
                  {personaRoleFilter === 'seller' && (
                    <td>
                      <span style={{ display: 'inline-block', padding: '4px 10px', fontSize: '0.78rem', fontWeight: 600, backgroundColor: 'rgba(227, 6, 19, 0.08)', color: '#E30613', borderRadius: '6px', textTransform: 'uppercase' }}>
                        📍 {c.saleRoute?.name || c.route || c.city || 'General Villegas y zonas'}
                      </span>
                    </td>
                  )}
                  {personaRoleFilter === 'client' && (
                    <td>
                      {c.saleRoute?.name ? (
                        <span style={{ display: 'inline-block', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px', textTransform: 'uppercase' }}>📍 {c.saleRoute.name}</span>
                      ) : c.route ? (
                        <span style={{ display: 'inline-block', padding: '3px 8px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.03)', color: 'var(--text-secondary)', borderRadius: '4px', textTransform: 'uppercase' }}>🚛 {c.route}</span>
                      ) : (
                        <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Sin Ruta</span>
                      )}
                    </td>
                  )}
                  <td>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      {personaRoleFilter === 'seller' ? (
                        <button className="btn btn-primary" style={{ padding: '6px 12px', fontSize: '0.8rem', backgroundColor: '#0f172a', borderColor: '#0f172a' }} onClick={() => (onViewSellerProfile ? onViewSellerProfile(c) : onViewClientProfile(c))}>
                          Ver Ficha de Vendedor
                        </button>
                      ) : (
                        <>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => onViewClientProfile(c)}>Ver Ficha</button>
                          <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => onShowResumenModal(c)}>Resumen de Cta</button>
                        </>
                      )}
                      <button type="button" className="btn btn-ghost text-danger" style={{ padding: '6px 8px', color: '#e30613' }} title="Eliminar este registro" onClick={() => onDeletePersona(c.id, c.name)}>
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>

      <div style={{ padding: '12px 18px', borderTop: '1px solid var(--border-color)', fontSize: '0.84rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fafafa' }}>
        <span>
          Mostrando <strong>{filteredClients.length.toLocaleString('es-AR')}</strong> {personaRoleFilter === 'client' ? 'clientes' : 'registros'}
          {isLocationFiltered && <span> (de un total de {totalClientsCount.toLocaleString('es-AR')})</span>}
        </span>
        {isLocationFiltered && (
          <button type="button" className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '0.78rem', color: '#166534', fontWeight: 600 }} onClick={onResetFilters}>
            Restablecer filtros
          </button>
        )}
      </div>
    </div>
  );
};
