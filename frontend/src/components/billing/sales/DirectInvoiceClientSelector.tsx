import React from 'react';
import { getClientPriceListLabel } from './salesBilling.helpers';

interface DirectInvoiceClientSelectorProps {
  clientSearchInputRef: React.RefObject<HTMLInputElement | null>;
  clientSearchQuery: string;
  setClientSearchQuery: (q: string) => void;
  showClientDropdown: boolean;
  setShowClientDropdown: (show: boolean) => void;
  activeClientSuggestionIdx: number;
  setActiveClientSuggestionIdx: React.Dispatch<React.SetStateAction<number>>;
  filteredClients: any[];
  selectedDirectClient: any;
  handleSelectClient: (client: any) => void;
}

export function DirectInvoiceClientSelector({
  clientSearchInputRef,
  clientSearchQuery,
  setClientSearchQuery,
  showClientDropdown,
  setShowClientDropdown,
  activeClientSuggestionIdx,
  setActiveClientSuggestionIdx,
  filteredClients,
  selectedDirectClient,
  handleSelectClient
}: DirectInvoiceClientSelectorProps) {
  const maxUnpaid = Number(selectedDirectClient?.maxUnpaidInvoices || 0);
  const pendingCount = selectedDirectClient?.pendingInvoicesCount || 0;
  const isLimitReached = maxUnpaid > 0 && pendingCount >= maxUnpaid;
  const balance = Number(selectedDirectClient?.outstandingBalance || 0);

  return (
    <>
      <div className="form-group" style={{ margin: 0, position: 'relative' }}>
        <label style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
          Cliente (Nombre o CUIT)
        </label>
        <div style={{ position: 'relative' }}>
          <input
            ref={clientSearchInputRef}
            type="text"
            className="input"
            placeholder="Escribí para buscar cliente por nombre o CUIT..."
            value={clientSearchQuery}
            onChange={(e) => {
              setClientSearchQuery(e.target.value);
              setShowClientDropdown(true);
            }}
            onFocus={() => setShowClientDropdown(true)}
            onBlur={() => setTimeout(() => setShowClientDropdown(false), 250)}
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault();
                setShowClientDropdown(true);
                setActiveClientSuggestionIdx((prev) =>
                  filteredClients.length > 0 ? (prev + 1) % filteredClients.length : 0
                );
              } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setShowClientDropdown(true);
                setActiveClientSuggestionIdx((prev) =>
                  filteredClients.length > 0
                    ? (prev - 1 + filteredClients.length) % filteredClients.length
                    : 0
                );
              } else if (e.key === 'Enter') {
                if (showClientDropdown && filteredClients.length > 0) {
                  e.preventDefault();
                  handleSelectClient(filteredClients[activeClientSuggestionIdx]);
                }
              }
            }}
            style={{ fontSize: '0.9rem' }}
          />
          {showClientDropdown && filteredClients.length > 0 && (
            <div
              className="suggestions-list"
              style={{
                position: 'absolute',
                zIndex: 100,
                width: '100%',
                maxHeight: '200px',
                overflowY: 'auto',
                backgroundColor: '#fff',
                border: '1px solid var(--border-color)',
                borderRadius: '4px',
                boxShadow: 'var(--shadow-md)'
              }}
            >
              {filteredClients.map((c, idx) => {
                const isActive = idx === activeClientSuggestionIdx;
                const cBalance = Number(c.outstandingBalance || 0);
                return (
                  <div
                    key={c.id}
                    className={`suggestion-item ${isActive ? 'active' : ''}`}
                    onMouseDown={() => handleSelectClient(c)}
                    onMouseEnter={() => setActiveClientSuggestionIdx(idx)}
                    style={{
                      backgroundColor: isActive ? '#e8f0fe' : 'inherit',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      CUIT: {c.cuit || 'S/D'} | Saldo CC:{' '}
                      {cBalance < 0
                        ? `$${Math.abs(cBalance).toLocaleString()} (A Favor)`
                        : `$${cBalance.toLocaleString()}`}{' '}
                      | Lista: {c.priceList || 'A'}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {selectedDirectClient ? (
        <div
          style={{
            backgroundColor: 'var(--bg-app)',
            border: '1px solid var(--border-color)',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '0.825rem',
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '8px 16px'
          }}
        >
          <div><strong>Dirección:</strong> {selectedDirectClient.address || 'S/D'}</div>
          <div><strong>CUIT/DNI:</strong> {selectedDirectClient.cuit || 'S/D'}</div>
          <div>
            <strong>Lista de Precios:</strong>{' '}
            <span
              className="badge"
              style={{ backgroundColor: '#e8f0fe', color: '#1a73e8', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}
            >
              {getClientPriceListLabel(selectedDirectClient.priceList)}
            </span>
          </div>
          <div>
            <strong>Tiene Cta. Corriente:</strong>{' '}
            <span
              style={{
                fontWeight: 700,
                color:
                  Number(selectedDirectClient.creditLimit || 0) > 0 ||
                  Number(selectedDirectClient.paymentTermDays || 0) > 0
                    ? '#059669'
                    : '#64748b'
              }}
            >
              {Number(selectedDirectClient.creditLimit || 0) > 0 ||
              Number(selectedDirectClient.paymentTermDays || 0) > 0
                ? `SÍ ${Number(selectedDirectClient.creditLimit || 0) > 0 ? `(Límite: $${Number(selectedDirectClient.creditLimit).toLocaleString()})` : ''}`
                : 'NO (Solo Contado)'}
            </span>
          </div>
          <div>
            <strong>Saldo Cuenta Corriente:</strong>{' '}
            <span
              style={{
                color: balance > 0 ? 'var(--color-danger)' : balance < 0 ? 'var(--color-success)' : 'inherit',
                fontWeight: 700
              }}
            >
              {balance < 0
                ? `$${Math.abs(balance).toLocaleString()} (A Favor)`
                : `$${balance.toLocaleString()}`}
            </span>
          </div>
          <div>
            <strong>Boletas Pendientes:</strong>{' '}
            <span
              style={{
                fontWeight: 700,
                color: pendingCount > 0 ? (isLimitReached ? 'var(--color-danger)' : '#d97706') : '#059669'
              }}
            >
              {pendingCount}
              {maxUnpaid > 0
                ? ` de ${maxUnpaid} máx. permitida${maxUnpaid > 1 ? 's' : ''}`
                : ' (Sin límite)'}
            </span>
          </div>

          {isLimitReached && (
            <div
              style={{
                gridColumn: 'span 2',
                backgroundColor: '#fef2f2',
                border: '1px solid #fca5a5',
                borderRadius: '4px',
                padding: '6px 10px',
                color: '#991b1b',
                fontWeight: 600,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '2px'
              }}
            >
              ⚠️ Límite de boletas alcanzado: El cliente debe {pendingCount} de {maxUnpaid} boletas permitidas.
            </div>
          )}

          {balance > 0 && !isLimitReached && (
            <div
              style={{
                gridColumn: 'span 2',
                color: 'var(--color-danger)',
                fontWeight: 600,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '2px'
              }}
            >
              ⚠️ Regla Boleta contra Boleta: El cliente tiene saldo pendiente.
            </div>
          )}
        </div>
      ) : (
        <div
          style={{
            backgroundColor: '#fbfbe4',
            border: '1px dashed #e6c64c',
            borderRadius: '6px',
            padding: '12px',
            fontSize: '0.825rem',
            color: '#856404',
            textAlign: 'center'
          }}
        >
          Debe buscar y seleccionar un cliente para habilitar la carga de productos.
        </div>
      )}
    </>
  );
}
