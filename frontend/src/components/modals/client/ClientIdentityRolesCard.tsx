import React, { useState } from 'react';
import { MessageCircle, X } from 'lucide-react';

interface ClientIdentityRolesCardProps {
  data: any;
  onChangeData: (patch: Record<string, any>) => void;
  isSearchingAfip: boolean;
  onFetchAfipData: () => void;
  onBlurCuitInput: () => void;
  cuitInputRef: React.RefObject<HTMLInputElement | null>;
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '0.78rem',
  fontWeight: 600,
  marginBottom: '5px',
  display: 'block',
  color: 'var(--text-secondary)',
};

const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  height: '38px',
  fontSize: '0.9rem',
};

const getWhatsAppLink = (phone: string) => {
  const cleanPhone = phone.replace(/\D/g, '');
  if (!cleanPhone) return '';
  const formatted = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
  return `https://wa.me/${formatted}`;
};

export const ClientIdentityRolesCard: React.FC<ClientIdentityRolesCardProps> = ({
  data,
  onChangeData,
  isSearchingAfip,
  onFetchAfipData,
  onBlurCuitInput,
  cuitInputRef,
}) => {
  const [tagDraft, setTagDraft] = useState('');
  const cleanDigitsLen = (data.cuit || '').replace(/\D/g, '').length;
  const canTriggerSearch = !isSearchingAfip && cleanDigitsLen >= 7;
  const whatsappUrl = data.phone ? getWhatsAppLink(data.phone) : '';
  const tags: string[] = Array.isArray(data.trustTags) ? data.trustTags : [];

  const handleAddTag = () => {
    const clean = tagDraft.trim();
    if (!clean) return;
    const next = Array.from(new Set([...tags, clean])).slice(0, 5);
    onChangeData({ trustTags: next, pendingTagDraft: '' });
    setTagDraft('');
  };

  const handleRemoveTag = (tagToRemove: string) => {
    onChangeData({ trustTags: tags.filter((t) => t !== tagToRemove) });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px', minInlineSize: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: data.isClient ? '1.35fr 0.85fr' : '1fr', gap: '12px' }}>
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
              style={{ ...INPUT_STYLE, paddingRight: '84px' }}
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
                fontSize: '0.74rem',
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

        {Boolean(data.isClient) && (
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
              style={{ ...INPUT_STYLE, fontWeight: 700, letterSpacing: '1px' }}
            />
          </div>
        )}
      </div>

      <div className="form-group" style={{ marginBottom: 0 }}>
        <label htmlFor="client-name" style={LABEL_STYLE}>Nombre *</label>
        <input
          id="client-name"
          type="text"
          className="input input-uppercase"
          placeholder="Nombre o razón social"
          value={data.name || ''}
          onChange={(e) => onChangeData({ name: e.target.value })}
          autoCapitalize="characters"
          required
          style={INPUT_STYLE}
        />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '0.9fr 1.1fr', gap: '12px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="client-phone" style={LABEL_STYLE}>Teléfono</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              id="client-phone"
              type="text"
              className="input"
              placeholder="Teléfono"
              value={data.phone || ''}
              onChange={(e) => onChangeData({ phone: e.target.value })}
              style={{ ...INPUT_STYLE, paddingRight: whatsappUrl ? '34px' : undefined }}
            />
            {whatsappUrl && (
              <a
                href={whatsappUrl}
                target="_blank"
                rel="noopener noreferrer"
                aria-label="WhatsApp"
                title="WhatsApp"
                style={{
                  position: 'absolute',
                  right: '9px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#166534',
                  display: 'inline-flex',
                }}
              >
                <MessageCircle size={15} />
              </a>
            )}
          </div>
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
            style={INPUT_STYLE}
          />
        </div>
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={LABEL_STYLE}>Roles</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
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
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    fontSize: '0.8rem',
                    cursor: 'pointer',
                    padding: '6px 9px',
                    border: `1px solid ${checked ? '#cbd5e1' : 'var(--border-color)'}`,
                    borderRadius: '6px',
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

            <label
              htmlFor="client-active"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '0.8rem',
                cursor: 'pointer',
                padding: '6px 9px',
                borderRadius: '6px',
                backgroundColor: data.isActive !== false ? 'rgba(16, 185, 129, 0.08)' : '#ffffff',
                border: `1px solid ${data.isActive !== false ? 'rgba(16, 185, 129, 0.3)' : 'var(--border-color)'}`,
                color: data.isActive !== false ? '#137333' : 'var(--text-secondary)',
                whiteSpace: 'nowrap',
              }}
            >
              <input
                id="client-active"
                type="checkbox"
                checked={data.isActive !== false}
                onChange={(e) => onChangeData({ isActive: e.target.checked })}
              />
              <span style={{ fontWeight: 600 }}>Activo</span>
            </label>
          </div>
        </fieldset>

        {Boolean(data.isSeller) && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <label htmlFor="client-hire-date" style={{ ...LABEL_STYLE, marginBottom: 0, whiteSpace: 'nowrap' }}>
              Fecha de ingreso
            </label>
            <input
              id="client-hire-date"
              type="date"
              className="input"
              value={data.hireDate ? String(data.hireDate).slice(0, 10) : ''}
              onChange={(e) => onChangeData({ hireDate: e.target.value || null })}
              style={{ width: 'auto', height: '36px', fontSize: '0.85rem' }}
            />
          </div>
        )}
      </div>

      <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: '14px' }}>
        <div className="form-group" style={{ marginBottom: 0 }}>
          <label htmlFor="client-tag" style={LABEL_STYLE}>Etiqueta</label>
          <div style={{ position: 'relative', width: '100%' }}>
            <input
              id="client-tag"
              type="text"
              className="input"
              placeholder="Escribir etiqueta"
              maxLength={60}
              value={tagDraft}
              onChange={(e) => {
                setTagDraft(e.target.value);
                onChangeData({ pendingTagDraft: e.target.value });
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddTag();
                }
              }}
              style={{ ...INPUT_STYLE, paddingRight: '80px' }}
            />
            <button
              type="button"
              onClick={handleAddTag}
              disabled={!tagDraft.trim() || tags.length >= 5}
              style={{
                position: 'absolute',
                right: '4px',
                top: '4px',
                bottom: '4px',
                backgroundColor: tagDraft.trim() && tags.length < 5 ? '#111827' : '#f1f5f9',
                color: tagDraft.trim() && tags.length < 5 ? '#ffffff' : '#64748b',
                border: tagDraft.trim() && tags.length < 5 ? '1px solid #111827' : '1px solid #cbd5e1',
                borderRadius: '5px',
                padding: '0 10px',
                fontSize: '0.74rem',
                fontWeight: 600,
                cursor: tagDraft.trim() && tags.length < 5 ? 'pointer' : 'not-allowed',
                display: 'inline-flex',
                alignItems: 'center',
              }}
            >
              Agregar
            </button>
          </div>

          {tags.length > 0 && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '8px' }}>
              {tags.map((tag) => (
                <span
                  key={tag}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    padding: '3px 9px',
                    borderRadius: '999px',
                    backgroundColor: '#f1f5f9',
                    border: '1px solid #cbd5e1',
                    color: '#1e293b',
                    fontSize: '0.78rem',
                    fontWeight: 600,
                  }}
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    aria-label={`Quitar etiqueta ${tag}`}
                    onClick={() => handleRemoveTag(tag)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      padding: 0,
                      display: 'inline-flex',
                      alignItems: 'center',
                      color: '#64748b',
                      cursor: 'pointer',
                    }}
                  >
                    <X size={12} />
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
