import React from 'react';

interface ClientIdentityRolesCardProps {
  data: any;
  onChangeData: (patch: Record<string, any>) => void;
  isSearchingAfip: boolean;
  onFetchAfipData: () => void;
  onBlurCuitInput: () => void;
  cuitInputRef: React.RefObject<HTMLInputElement | null>;
}

const CARD_STYLE: React.CSSProperties = {
  border: '1px solid var(--border-color)',
  borderRadius: 'var(--radius-md)',
  padding: '20px',
  backgroundColor: 'rgba(249, 250, 251, 0.35)',
  boxShadow: 'var(--shadow-sm)',
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  margin: '0 0 16px 0',
  fontSize: '0.88rem',
  fontWeight: 700,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '10px',
};

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.82rem',
  fontWeight: 600,
  marginBottom: '6px',
  display: 'block',
  color: 'var(--text-primary)',
};

export const ClientIdentityRolesCard: React.FC<ClientIdentityRolesCardProps> = ({
  data,
  onChangeData,
  isSearchingAfip,
  onFetchAfipData,
  onBlurCuitInput,
  cuitInputRef,
}) => {
  const cleanDigitsLen = (data.cuit || '').replace(/\D/g, '').length;
  const canTriggerSearch = !isSearchingAfip && cleanDigitsLen >= 7;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={CARD_STYLE}>
        <h4 style={SECTION_TITLE_STYLE}>📋 Identificación Básica</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 0.85fr', gap: '16px', marginBottom: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={LABEL_STYLE}>
              DNI o CUIT <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(autocompleta datos)</span>
            </label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                ref={cuitInputRef}
                type="text"
                className="input"
                placeholder="Ingresá DNI o CUIT y presioná Enter"
                value={data.cuit || ''}
                onChange={(e) => onChangeData({ cuit: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onFetchAfipData();
                  }
                }}
                onBlur={onBlurCuitInput}
                style={{ width: '100%', height: '40px', paddingRight: '90px', fontSize: '0.92rem' }}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onFetchAfipData}
                disabled={!canTriggerSearch}
                title="Consultar Razón Social, CUIT, Dirección Fiscal y Localidad en ARCA"
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '4px',
                  bottom: '4px',
                  backgroundColor: canTriggerSearch ? '#111827' : '#f1f5f9',
                  color: canTriggerSearch ? '#ffffff' : '#64748b',
                  border: canTriggerSearch ? '1px solid #111827' : '1px solid #cbd5e1',
                  borderRadius: '5px',
                  padding: '0 11px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: canTriggerSearch ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap',
                  opacity: isSearchingAfip ? 0.75 : 1,
                  transition: 'all 0.15s ease',
                }}
              >
                {isSearchingAfip ? 'Buscando...' : '⚡ ARCA'}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={LABEL_STYLE}>🔑 PIN Acceso Tienda Web</label>
            <input
              type="text"
              className="input"
              placeholder="ej: 4819"
              value={data.webPin || ''}
              onChange={(e) => onChangeData({ webPin: e.target.value })}
              maxLength={8}
              style={{ width: '100%', height: '40px', fontWeight: 700, letterSpacing: '1px', fontSize: '0.92rem' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={LABEL_STYLE}>Nombre Comercial / Razón Social *</label>
          <input
            type="text"
            className="input"
            placeholder="Se autocompleta por DNI/CUIT o ingresalo manualmente"
            value={data.name || ''}
            onChange={(e) => onChangeData({ name: e.target.value })}
            required
            style={{ width: '100%', height: '40px', fontSize: '0.92rem' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: '16px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={LABEL_STYLE}>Teléfono de Contacto</label>
            <input
              type="text"
              className="input"
              placeholder="ej: 3388-456789"
              value={data.phone || ''}
              onChange={(e) => onChangeData({ phone: e.target.value })}
              style={{ width: '100%', height: '40px', fontSize: '0.92rem' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label style={LABEL_STYLE}>Correo Electrónico</label>
            <input
              type="email"
              className="input"
              placeholder="ej: contacto@cliente.com.ar"
              value={data.email || ''}
              onChange={(e) => onChangeData({ email: e.target.value })}
              style={{ width: '100%', height: '40px', fontSize: '0.92rem' }}
            />
          </div>
        </div>
      </div>

      <div style={CARD_STYLE}>
        <h4 style={SECTION_TITLE_STYLE}>👥 Roles y Estado en Sistema</h4>

        <div className="form-group" style={{ marginBottom: '16px' }}>
          <label style={LABEL_STYLE}>Roles Asignados a la Persona</label>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {[
              { key: 'isClient', label: 'Cliente' },
              { key: 'isProvider', label: 'Proveedor' },
              { key: 'isSeller', label: 'Vendedor' },
              { key: 'isCommissionAgent', label: 'Comisionista' },
            ].map((roleItem) => {
              const checked = Boolean(data[roleItem.key]);
              return (
                <label
                  key={roleItem.key}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '0.88rem',
                    cursor: 'pointer',
                    padding: '10px 12px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: checked ? 'rgba(17, 24, 39, 0.04)' : '#ffffff',
                    transition: 'var(--transition-fast)',
                    whiteSpace: 'nowrap',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => onChangeData({ [roleItem.key]: e.target.checked })}
                  />
                  <span style={{ fontWeight: checked ? 600 : 400 }}>{roleItem.label}</span>
                </label>
              );
            })}
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.88rem',
              cursor: 'pointer',
              padding: '10px 14px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: data.isActive !== false ? 'rgba(16, 185, 129, 0.06)' : '#ffffff',
              borderColor: data.isActive !== false ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)',
              transition: 'var(--transition-fast)',
            }}
          >
            <input
              type="checkbox"
              checked={data.isActive !== false}
              onChange={(e) => onChangeData({ isActive: e.target.checked })}
            />
            <span style={{ fontWeight: data.isActive !== false ? 600 : 400 }}>
              Activo
            </span>
          </label>
        </div>
      </div>
    </div>
  );
};
