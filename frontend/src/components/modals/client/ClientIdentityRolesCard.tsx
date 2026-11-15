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
  padding: '18px',
  backgroundColor: '#fafafa',
};

const SECTION_TITLE_STYLE: React.CSSProperties = {
  margin: '0 0 14px 0',
  fontSize: '0.84rem',
  fontWeight: 700,
  color: 'var(--text-secondary)',
  textTransform: 'uppercase',
  letterSpacing: '0.04em',
  borderBottom: '1px solid var(--border-color)',
  paddingBottom: '8px',
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
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <div style={CARD_STYLE}>
        <h4 style={SECTION_TITLE_STYLE}>Datos</h4>

        <div style={{ display: 'grid', gridTemplateColumns: '1.35fr 0.85fr', gap: '14px', marginBottom: '14px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="client-cuit" style={LABEL_STYLE}>DNI o CUIT</label>
            <div style={{ position: 'relative', width: '100%' }}>
              <input
                id="client-cuit"
                ref={cuitInputRef}
                type="text"
                className="input"
                placeholder="DNI o CUIT"
                value={data.cuit || ''}
                onChange={(e) => onChangeData({ cuit: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    onFetchAfipData();
                  }
                }}
                onBlur={onBlurCuitInput}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                style={{ width: '100%', height: '38px', paddingRight: '86px', fontSize: '0.9rem' }}
              />
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={onFetchAfipData}
                disabled={!canTriggerSearch}
                title="Consultar en ARCA"
                style={{
                  position: 'absolute',
                  right: '4px',
                  top: '4px',
                  bottom: '4px',
                  backgroundColor: canTriggerSearch ? '#111827' : '#f1f5f9',
                  color: canTriggerSearch ? '#ffffff' : '#64748b',
                  border: canTriggerSearch ? '1px solid #111827' : '1px solid #cbd5e1',
                  borderRadius: '5px',
                  padding: '0 10px',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  cursor: canTriggerSearch ? 'pointer' : 'not-allowed',
                  display: 'inline-flex',
                  alignItems: 'center',
                  whiteSpace: 'nowrap',
                  opacity: isSearchingAfip ? 0.75 : 1,
                }}
              >
                {isSearchingAfip ? 'Buscando...' : 'ARCA'}
              </button>
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="client-web-pin" style={LABEL_STYLE}>PIN Tienda</label>
            <input
              id="client-web-pin"
              type="text"
              className="input"
              placeholder="4 dígitos"
              value={data.webPin || ''}
              onChange={(e) => onChangeData({ webPin: e.target.value })}
              maxLength={8}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{ width: '100%', height: '38px', fontWeight: 700, letterSpacing: '1px', fontSize: '0.9rem' }}
            />
          </div>
        </div>

        <div className="form-group" style={{ marginBottom: '14px' }}>
          <label htmlFor="client-name" style={LABEL_STYLE}>Nombre *</label>
          <input
            id="client-name"
            type="text"
            className="input"
            placeholder="Nombre o razón social"
            value={data.name || ''}
            onChange={(e) => onChangeData({ name: e.target.value })}
            required
            style={{ width: '100%', height: '38px', fontSize: '0.9rem' }}
          />
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '0.85fr 1.15fr', gap: '14px' }}>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="client-phone" style={LABEL_STYLE}>Teléfono</label>
            <input
              id="client-phone"
              type="text"
              className="input"
              placeholder="Teléfono"
              value={data.phone || ''}
              onChange={(e) => onChangeData({ phone: e.target.value })}
              style={{ width: '100%', height: '38px', fontSize: '0.9rem' }}
            />
          </div>
          <div className="form-group" style={{ marginBottom: 0 }}>
            <label htmlFor="client-email" style={LABEL_STYLE}>Email</label>
            <input
              id="client-email"
              type="email"
              className="input"
              placeholder="correo@dominio.com"
              value={data.email || ''}
              onChange={(e) => onChangeData({ email: e.target.value })}
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              style={{ width: '100%', height: '38px', fontSize: '0.9rem' }}
            />
          </div>
        </div>
      </div>

      <div style={CARD_STYLE}>
        <h4 style={SECTION_TITLE_STYLE}>Roles</h4>

        <fieldset style={{ border: 'none', padding: 0, margin: '0 0 14px 0' }}>
          <legend className="sr-only">Roles asignados</legend>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
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
                    gap: '7px',
                    fontSize: '0.84rem',
                    cursor: 'pointer',
                    padding: '8px 10px',
                    border: '1px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    backgroundColor: checked ? '#f1f5f9' : '#ffffff',
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
        </fieldset>

        <div className="form-group" style={{ marginBottom: 0 }}>
          <label
            htmlFor="client-active"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              fontSize: '0.84rem',
              cursor: 'pointer',
              padding: '8px 12px',
              border: '1px solid var(--border-color)',
              borderRadius: 'var(--radius-sm)',
              backgroundColor: data.isActive !== false ? 'rgba(16, 185, 129, 0.06)' : '#ffffff',
              borderColor: data.isActive !== false ? 'rgba(16, 185, 129, 0.25)' : 'var(--border-color)',
            }}
          >
            <input
              id="client-active"
              type="checkbox"
              checked={data.isActive !== false}
              onChange={(e) => onChangeData({ isActive: e.target.checked })}
            />
            <span style={{ fontWeight: data.isActive !== false ? 600 : 400 }}>Activo</span>
          </label>
        </div>
      </div>
    </div>
  );
};
