import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { formatIntegerARS } from '../../../utils/currency';
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
        <label
          htmlFor="direct-invoice-client-search"
          style={{ fontWeight: 600, fontSize: '0.8rem', color: 'var(--text-secondary)' }}
        >
          Cliente
        </label>
        <div style={{ position: 'relative' }}>
          <input
            id="direct-invoice-client-search"
            ref={clientSearchInputRef}
            type="text"
            className="input"
            placeholder="Buscar por nombre o CUIT..."
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
                      backgroundColor: isActive ? '#F3F4F6' : 'inherit',
                      cursor: 'pointer',
                      padding: '8px 12px',
                      fontSize: '0.85rem',
                      borderBottom: '1px solid #f0f0f0'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{c.name}</div>
                    <div className="tabular-nums" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                      CUIT: {c.cuit || 'S/D'} | Saldo CC:{' '}
                      {cBalance < 0
                        ? `${formatIntegerARS(Math.abs(cBalance))} (A Favor)`
                        : formatIntegerARS(cBalance)}{' '}
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
              style={{ backgroundColor: '#F3F4F6', color: '#111827', border: '1px solid #E5E7EB', fontWeight: 600, padding: '2px 6px', borderRadius: '4px' }}
            >
              {getClientPriceListLabel(selectedDirectClient.priceList)}
            </span>
          </div>
          <div>
            <strong>Cta. Cte.:</strong>{' '}
            <span
              className="tabular-nums"
              style={{
                fontWeight: 700,
                color:
                  Number(selectedDirectClient.creditLimit || 0) > 0 ||
                  Number(selectedDirectClient.paymentTermDays || 0) > 0
                    ? '#111827'
                    : '#6B7280'
              }}
            >
              {Number(selectedDirectClient.creditLimit || 0) > 0 ||
              Number(selectedDirectClient.paymentTermDays || 0) > 0
                ? Number(selectedDirectClient.creditLimit || 0) > 0
                  ? `Límite ${formatIntegerARS(selectedDirectClient.creditLimit)}`
                  : 'Habilitada'
                : 'Solo contado'}
            </span>
          </div>
          <div>
            <strong>Saldo:</strong>{' '}
            <span
              className="tabular-nums"
              style={{
                color: balance > 0 ? '#E30613' : '#111827',
                fontWeight: 700
              }}
            >
              {balance < 0
                ? `${formatIntegerARS(Math.abs(balance))} a favor`
                : formatIntegerARS(balance)}
            </span>
          </div>
          <div>
            <strong>Pendientes:</strong>{' '}
            <span
              className="tabular-nums"
              style={{
                fontWeight: 700,
                color: pendingCount > 0 ? (isLimitReached ? '#E30613' : '#111827') : '#374151'
              }}
            >
              {pendingCount}
              {maxUnpaid > 0 ? ` / ${maxUnpaid}` : ''}
            </span>
          </div>

          {isLimitReached && (
            <div
              role="alert"
              style={{
                gridColumn: 'span 2',
                backgroundColor: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: '4px',
                padding: '6px 10px',
                color: '#E30613',
                fontWeight: 600,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                marginTop: '2px'
              }}
            >
              <AlertTriangle size={14} aria-hidden="true" />
              Límite alcanzado ({pendingCount}/{maxUnpaid})
            </div>
          )}

          {balance > 0 && !isLimitReached && (
            <div
              role="alert"
              style={{
                gridColumn: 'span 2',
                color: '#E30613',
                fontWeight: 600,
                fontSize: '0.78rem',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                marginTop: '2px'
              }}
            >
              <AlertTriangle size={14} aria-hidden="true" />
              Saldo pendiente
            </div>
          )}
        </div>
      ) : null}
    </>
  );
}
