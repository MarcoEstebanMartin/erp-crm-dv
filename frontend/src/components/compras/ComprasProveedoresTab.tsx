import { useDeferredValue, useMemo, useState, type FC } from 'react';
import { Edit, MessageCircle, Search, Trash2, UserPlus } from 'lucide-react';
import {
  computeProviderPayableSummary,
  formatCentsArs,
  formatCuitDisplay,
  getWhatsAppLink,
  matchesProviderSearchQuery,
  tokenizePhoneticClientQuery,
} from './providersHelpers';

export interface ComprasProveedoresTabProps {
  isAdmin: boolean;
  providers: any[];
  providerSearch: string;
  setProviderSearch: (v: string) => void;
  onOpenCreateProvider: () => void;
  onOpenAccountSummary: (p: any) => void;
  onOpenEditProvider: (p: any) => void;
  onDeleteProvider: (id: number, name: string) => void;
}

export const ComprasProveedoresTab: FC<ComprasProveedoresTabProps> = ({
  isAdmin,
  providers,
  providerSearch,
  setProviderSearch,
  onOpenCreateProvider,
  onOpenAccountSummary,
  onOpenEditProvider,
  onDeleteProvider,
}) => {
  const [showInactive, setShowInactive] = useState(false);
  const deferredSearch = useDeferredValue(providerSearch);

  const filteredProviders = useMemo(() => {
    const tokens = tokenizePhoneticClientQuery(deferredSearch);
    const hasSearch = tokens.tokens.length > 0 || tokens.digitTokens.length > 0;
    return (providers || []).filter((p) => {
      const isActive = p.isActive !== false;
      if (!showInactive && !isActive) return false;
      if (showInactive && isActive) return false;
      return !hasSearch || matchesProviderSearchQuery(p, tokens);
    });
  }, [providers, showInactive, deferredSearch]);

  const isFiltered = providerSearch.trim().length > 0 || showInactive;

  return (
    <div className="card">
      <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '16px' }}>
        <search
          aria-label="Buscar proveedores"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: '1 1 240px',
            maxWidth: '340px',
            backgroundColor: '#fff',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '0 10px',
            height: '38px',
          }}
        >
          <label htmlFor="compras-prov-search" className="visually-hidden">
            Buscar proveedor
          </label>
          <Search size={15} color="var(--text-muted)" aria-hidden="true" />
          <input
            id="compras-prov-search"
            type="search"
            placeholder="Razón social, CUIT o rubro..."
            value={providerSearch}
            onChange={(e) => setProviderSearch(e.target.value)}
            autoCorrect="off"
            autoCapitalize="none"
            spellCheck={false}
            style={{ border: 'none', outline: 'none', fontSize: '0.84rem', width: '100%', background: 'transparent' }}
          />
        </search>

        <div
          className="tabular-nums"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '0 12px',
            height: '38px',
            backgroundColor: '#f8fafc',
            border: '1px solid #e2e8f0',
            borderRadius: '6px',
            fontSize: '0.82rem',
            whiteSpace: 'nowrap',
          }}
        >
          <span style={{ color: '#64748b', fontWeight: 500 }}>{isFiltered ? 'Filtrados' : 'Total'}</span>
          <span style={{ fontWeight: 700, fontSize: '0.92rem', color: '#0f172a' }}>
            {filteredProviders.length.toLocaleString('es-AR')}
          </span>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
          <label
            htmlFor="compras-prov-inactive"
            style={{
              fontSize: '0.82rem',
              color: 'var(--text-secondary)',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              whiteSpace: 'nowrap',
            }}
          >
            <input
              id="compras-prov-inactive"
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              style={{ width: '15px', height: '15px', cursor: 'pointer' }}
            />
            <span>Inactivos</span>
          </label>

          <button type="button" className="btn btn-primary" style={{ height: '38px', whiteSpace: 'nowrap' }} onClick={onOpenCreateProvider}>
            <UserPlus size={15} aria-hidden="true" />
            <span>Nuevo proveedor</span>
          </button>
        </div>
      </div>

      <div className="table-container table-container--sticky" role="region" aria-label="Padrón de proveedores" tabIndex={0}>
        <table>
          <thead>
            <tr>
              <th scope="col">Proveedor</th>
              <th scope="col">Rubro</th>
              <th scope="col">Contacto</th>
              <th scope="col" style={{ textAlign: 'right' }}>Saldo</th>
              <th scope="col" style={{ textAlign: 'right', width: '160px' }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filteredProviders.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '28px', color: 'var(--text-secondary)' }}>
                  Sin proveedores encontrados.
                </td>
              </tr>
            ) : (
              filteredProviders.map((p) => {
                const cuitDisplay = formatCuitDisplay(p.cuit);
                const metaParts = [cuitDisplay ? `CUIT ${cuitDisplay}` : null, p.city || null, p.address || null].filter(Boolean);
                const summary = computeProviderPayableSummary(p);
                const contacts = Array.isArray(p.contacts) ? p.contacts : [];
                const firstContact = contacts[0];
                const waUrl = firstContact?.phone ? getWhatsAppLink(firstContact.phone) : p.phone ? getWhatsAppLink(p.phone) : '';

                return (
                  <tr key={p.id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          onClick={() => onOpenAccountSummary(p)}
                          style={{
                            background: 'none',
                            border: 'none',
                            padding: 0,
                            margin: 0,
                            fontWeight: 600,
                            fontSize: '0.88rem',
                            color: 'var(--text-primary)',
                            cursor: 'pointer',
                            textAlign: 'left',
                          }}
                        >
                          {p.name}
                        </button>
                        {p.isActive === false && (
                          <span style={{ fontSize: '0.7rem', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', backgroundColor: '#f1f5f9', color: '#64748b' }}>
                            Inactivo
                          </span>
                        )}
                      </div>
                      {metaParts.length > 0 && (
                        <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                          {metaParts.join(' · ')}
                        </div>
                      )}
                    </td>

                    <td>
                      {p.rubro || summary.productsCount > 0 ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          {p.rubro && (
                            <span style={{ backgroundColor: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: '6px', fontSize: '0.75rem', fontWeight: 500, border: '1px solid #e2e8f0' }}>
                              {p.rubro}
                            </span>
                          )}
                          {summary.productsCount > 0 && (
                            <span className="tabular-nums" style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                              {summary.productsCount} prod.
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    <td>
                      {firstContact ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '0.78rem' }}>
                          <strong>{firstContact.name}</strong>
                          {firstContact.phone && <span className="tabular-nums" style={{ color: 'var(--text-secondary)' }}>{firstContact.phone}</span>}
                          {waUrl && (
                            <a href={waUrl} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${firstContact.name}`} style={{ color: '#059669', display: 'inline-flex', alignItems: 'center' }}>
                              <MessageCircle size={13} aria-hidden="true" />
                            </a>
                          )}
                          {contacts.length > 1 && <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>+{contacts.length - 1}</span>}
                        </div>
                      ) : p.phone || p.email ? (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', fontSize: '0.78rem' }}>
                          {p.phone && (
                            <span className="tabular-nums" style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-primary)' }}>
                              <span>{p.phone}</span>
                              {waUrl && (
                                <a href={waUrl} target="_blank" rel="noopener noreferrer" aria-label={`WhatsApp a ${p.name}`} style={{ color: '#059669', display: 'inline-flex', alignItems: 'center' }}>
                                  <MessageCircle size={13} aria-hidden="true" />
                                </a>
                              )}
                            </span>
                          )}
                          {p.email && <span style={{ fontSize: '0.73rem', color: 'var(--text-secondary)' }}>{p.email}</span>}
                        </div>
                      ) : (
                        <span style={{ color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>

                    <td className="tabular-nums" style={{ textAlign: 'right' }}>
                      {summary.payableCents > 0 ? (
                        <div>
                          <div style={{ fontWeight: 700, fontSize: '0.86rem', color: summary.overdueInvoicesCount > 0 ? '#E30613' : '#0f172a' }}>
                            {formatCentsArs(summary.payableCents)}
                          </div>
                          {summary.pendingInvoicesCount > 0 && (
                            <div style={{ fontSize: '0.71rem', color: summary.overdueInvoicesCount > 0 ? '#E30613' : 'var(--text-secondary)' }}>
                              {summary.pendingInvoicesCount} pend.
                            </div>
                          )}
                        </div>
                      ) : summary.favorCents > 0 ? (
                        <span style={{ fontWeight: 600, fontSize: '0.82rem', color: '#059669' }}>
                          A favor {formatCentsArs(summary.favorCents)}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>$0</span>
                      )}
                    </td>

                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center', justifyContent: 'flex-end' }}>
                        <button type="button" className="btn btn-secondary" style={{ padding: '4px 10px', fontSize: '0.76rem' }} onClick={() => onOpenAccountSummary(p)}>
                          Cuenta
                        </button>
                        <button type="button" className="btn btn-secondary" style={{ padding: '5px 7px' }} onClick={() => onOpenEditProvider(p)} aria-label={`Editar ${p.name}`} title="Editar">
                          <Edit size={13} aria-hidden="true" />
                        </button>
                        {isAdmin && (
                          <button type="button" className="btn btn-secondary" style={{ padding: '5px 7px', color: 'var(--color-danger)' }} onClick={() => onDeleteProvider(p.id, p.name)} aria-label={`Eliminar ${p.name}`} title="Eliminar">
                            <Trash2 size={13} aria-hidden="true" />
                          </button>
                        )}
                      </div>
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
