import React, { useMemo, useState } from 'react';
import { Check, Search, X } from 'lucide-react';
import type { Persona } from '../../types';

interface ClientCandidate {
  id: number;
  name: string;
  city: string | null;
  address: string | null;
}

interface AiClientSelectorProps {
  clients: Persona[];
  draftClientId: number | null;
  clientQuery: string | null;
  clientCandidates: ClientCandidate[];
  onSelectClient: (clientId: number | null) => void;
}

function normalizeText(value: string): string {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export const AiClientSelector: React.FC<AiClientSelectorProps> = ({
  clients,
  draftClientId,
  clientQuery,
  clientCandidates,
  onSelectClient,
}) => {
  const [searchText, setSearchText] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === draftClientId) || null,
    [clients, draftClientId],
  );

  const filteredClients = useMemo(() => {
    const q = normalizeText(searchText);
    if (!q) return clients.slice(0, 12);
    const tokens = q.split(' ').filter(Boolean);
    return clients
      .filter((c) => {
        const haystack = normalizeText(`${c.name} ${c.city || ''} ${c.address || ''}`);
        return tokens.every((t) => haystack.includes(t));
      })
      .slice(0, 20);
  }, [clients, searchText]);

  const showSearch = !selectedClient || isEditing;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
          Cliente {clientQuery && !selectedClient ? `(mencionado: "${clientQuery}")` : ''}
        </span>
        {selectedClient && !isEditing && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '3px 8px', fontSize: '0.74rem' }}
            onClick={() => {
              setSearchText('');
              setIsEditing(true);
            }}
          >
            Cambiar
          </button>
        )}
      </div>

      {selectedClient && !isEditing ? (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
            padding: '8px 10px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: '#f8fafc',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '0.86rem', fontWeight: 700, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {selectedClient.name}
            </div>
            {selectedClient.city && (
              <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                {selectedClient.city}
              </div>
            )}
          </div>
          <Check size={16} color="#16a34a" aria-hidden="true" style={{ flexShrink: 0 }} />
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
          {clientCandidates.length > 0 && (
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {clientCandidates.map((cand) => (
                <button
                  key={cand.id}
                  type="button"
                  className="btn btn-secondary"
                  style={{ padding: '4px 10px', fontSize: '0.76rem' }}
                  onClick={() => {
                    onSelectClient(cand.id);
                    setIsEditing(false);
                    setSearchText('');
                  }}
                >
                  {cand.name}
                </button>
              ))}
            </div>
          )}

          <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
            <Search
              size={15}
              aria-hidden="true"
              style={{ position: 'absolute', left: '10px', color: 'var(--text-secondary)', pointerEvents: 'none' }}
            />
            <input
              id="ai-client-search"
              type="text"
              className="input"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="Buscar cliente..."
              aria-label="Buscar cliente"
              style={{ width: '100%', padding: '8px 32px 8px 32px', fontSize: '0.86rem' }}
            />
            {searchText && (
              <button
                type="button"
                aria-label="Limpiar búsqueda"
                onClick={() => setSearchText('')}
                style={{
                  position: 'absolute',
                  right: '8px',
                  background: 'transparent',
                  border: 'none',
                  padding: '2px',
                  cursor: 'pointer',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>

          {showSearch && (
            <div
              role="listbox"
              aria-label="Clientes coincidentes"
              style={{
                maxHeight: '148px',
                overflowY: 'auto',
                border: '1px solid var(--border-color)',
                borderRadius: '8px',
                backgroundColor: '#fff',
              }}
            >
              <button
                type="button"
                role="option"
                aria-selected={draftClientId === null}
                onClick={() => {
                  onSelectClient(null);
                  setIsEditing(false);
                  setSearchText('');
                }}
                style={{
                  width: '100%',
                  textAlign: 'left',
                  padding: '7px 10px',
                  fontSize: '0.82rem',
                  color: 'var(--text-secondary)',
                  background: draftClientId === null ? '#f8fafc' : 'transparent',
                  border: 'none',
                  borderBottom: '1px solid var(--border-color)',
                  cursor: 'pointer',
                }}
              >
                Elegir cliente después
              </button>
              {filteredClients.length > 0 ? (
                filteredClients.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={draftClientId === c.id}
                    onClick={() => {
                      onSelectClient(c.id);
                      setIsEditing(false);
                      setSearchText('');
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '7px 10px',
                      fontSize: '0.84rem',
                      fontWeight: draftClientId === c.id ? 700 : 500,
                      color: 'var(--text-primary)',
                      background: draftClientId === c.id ? '#f1f5f9' : 'transparent',
                      border: 'none',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</span>
                    {c.city && (
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
                        {c.city}
                      </span>
                    )}
                  </button>
                ))
              ) : (
                <div style={{ padding: '10px', fontSize: '0.8rem', color: 'var(--text-secondary)', textAlign: 'center' }}>
                  Sin coincidencias
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
