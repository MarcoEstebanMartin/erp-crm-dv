import React, { useEffect, useRef, useState } from 'react';
import { Key, Pencil } from 'lucide-react';
import { api } from '../../../utils/api';
import { type CompanyProfile, formatCompanyPhone, getCompanyProfile } from '../../../utils/companyProfile';
import ChangeOwnPasswordModal from '../../modals/ChangeOwnPasswordModal';

interface ConfigGeneralTabProps {
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

interface EditFieldSpec {
  key: keyof CompanyProfile;
  label: string;
  type?: 'text' | 'email' | 'number';
  required?: boolean;
  placeholder?: string;
}

const COMPANY_EDIT_FIELDS: EditFieldSpec[] = [
  { key: 'razonSocial', label: 'Razón Social', required: true },
  { key: 'nombreFantasia', label: 'Nombre de Fantasía', required: true },
  { key: 'cuit', label: 'CUIT del Emisor', required: true, placeholder: '20-16316505-9' },
  { key: 'puntoVenta', label: 'Punto de Venta ARCA', type: 'number', required: true },
  { key: 'direccion', label: 'Dirección Comercial' },
  { key: 'telefono', label: 'Teléfono de Contacto' },
  { key: 'email', label: 'Email de Contacto', type: 'email' },
  { key: 'iibb', label: 'Ingresos Brutos (opcional)', placeholder: 'Opcional para Factura A/B' },
  { key: 'inicioActividades', label: 'Inicio de Actividades (opcional)', placeholder: 'Ej: 01/10/1996' },
];

const s = {
  card: {
    backgroundColor: '#FFFFFF',
    border: '1px solid var(--border-color)',
    borderRadius: '10px',
    padding: '24px',
  } as React.CSSProperties,
  sectionTag: {
    fontSize: '0.7rem',
    fontWeight: 600,
    letterSpacing: '0.07em',
    textTransform: 'uppercase',
    color: '#6B7280',
  } as React.CSSProperties,
  fieldLabel: {
    display: 'block',
    fontSize: '0.75rem',
    fontWeight: 500,
    color: '#6B7280',
    marginBottom: '4px',
  } as React.CSSProperties,
  readValue: {
    fontSize: '0.88rem',
    fontWeight: 500,
    color: '#111827',
    wordBreak: 'break-word',
  } as React.CSSProperties,
  dividerTop: {
    marginTop: '18px',
    paddingTop: '18px',
    borderTop: '1px solid #F3F4F6',
  } as React.CSSProperties,
};

export default function ConfigGeneralTab({ setErrorMsg, setSuccessMsg }: ConfigGeneralTabProps) {
  const currentUser = api.getCurrentUser();
  const [company, setCompany] = useState<CompanyProfile>(() => getCompanyProfile());
  const [draft, setDraft] = useState<CompanyProfile>(() => getCompanyProfile());
  const [isEditing, setIsEditing] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [ignoreStock, setIgnoreStock] = useState<boolean>(() => Boolean(api.getServerConfig()?.ignoreStock));
  const [savingStock, setSavingStock] = useState(false);
  const [changePwdOpen, setChangePwdOpen] = useState(false);
  const isEditingRef = useRef(false);
  isEditingRef.current = isEditing;

  useEffect(() => {
    let active = true;
    api
      .fetchServerConfig()
      .then((cfg) => {
        if (!active || !cfg) return;
        const normalized = getCompanyProfile();
        setCompany(normalized);
        if (!isEditingRef.current) setDraft(normalized);
        setIgnoreStock(Boolean(cfg.ignoreStock));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const handleSaveCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingCompany(true);
    setErrorMsg(null);
    try {
      await api.updateServerConfig({
        company: { ...draft, puntoVenta: Number(draft.puntoVenta) || 1 },
      });
      const updated = getCompanyProfile();
      setCompany(updated);
      setDraft(updated);
      setIsEditing(false);
      setSuccessMsg('Datos oficiales de la empresa actualizados.');
      setTimeout(() => setSuccessMsg(null), 3000);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al guardar los datos de la empresa.');
    } finally {
      setSavingCompany(false);
    }
  };

  const handleToggleIgnoreStock = async () => {
    if (savingStock) return;
    const next = !ignoreStock;
    setIgnoreStock(next);
    setSavingStock(true);
    setErrorMsg(null);
    try {
      await api.updateServerConfig({ ignoreStockCheck: next });
      setSuccessMsg(next ? 'Facturación sin stock físico habilitada.' : 'Control estricto de stock físico activado.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      setIgnoreStock(!next);
      setErrorMsg(err?.message || 'No se pudo actualizar la regla operativa.');
    } finally {
      setSavingStock(false);
    }
  };

  const formattedPos = String(company.puntoVenta || 1).padStart(4, '0');
  const readItems: Array<{ label: string; value: string }> = [
    { label: 'Domicilio Comercial', value: company.direccion || 'Sin especificar' },
    { label: 'Teléfono / WhatsApp', value: formatCompanyPhone(company.telefono) || 'Sin especificar' },
    { label: 'Correo Electrónico', value: company.email || 'Sin especificar' },
    ...(company.iibb ? [{ label: 'Ingresos Brutos (IIBB)', value: company.iibb }] : []),
    ...(company.inicioActividades ? [{ label: 'Inicio de Actividades', value: company.inicioActividades }] : []),
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      <section style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={s.sectionTag}>Identidad Fiscal y Comercial</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap', marginTop: '6px' }}>
              <h3 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827', letterSpacing: '-0.02em' }}>
                {company.nombreFantasia}
              </h3>
              <span
                style={{
                  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  color: '#374151',
                  backgroundColor: '#F3F4F6',
                  border: '1px solid #E5E7EB',
                  borderRadius: '9999px',
                  padding: '2px 10px',
                }}
              >
                CUIT {company.cuit}
              </span>
            </div>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#4B5563' }}>
              Razón Social: <strong style={{ color: '#111827', fontWeight: 600 }}>{company.razonSocial}</strong>
              {' · '}Punto de Venta {formattedPos}
            </p>
          </div>

          {!isEditing && (
            <button
              type="button"
              onClick={() => { setDraft(company); setErrorMsg(null); setIsEditing(true); }}
              className="btn btn-secondary"
              style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px' }}
            >
              <Pencil size={13} />
              Editar
            </button>
          )}
        </div>

        {!isEditing ? (
          <>
            <div style={{ ...s.dividerTop, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))', gap: '16px 24px' }}>
              {readItems.map((item) => (
                <div key={item.label}>
                  <span style={s.fieldLabel}>{item.label}</span>
                  <div style={s.readValue}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: '16px', paddingTop: '12px', borderTop: '1px solid #F3F4F6', fontSize: '0.78rem', color: '#6B7280' }}>
              Encabezado oficial sincronizado en comprobantes, remitos, tickets y resúmenes de cuenta.
            </div>
          </>
        ) : (
          <form onSubmit={handleSaveCompany} style={s.dividerTop}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: '14px 16px' }}>
              {COMPANY_EDIT_FIELDS.map((field) => (
                <div key={field.key}>
                  <label style={s.fieldLabel}>{field.label}</label>
                  <input
                    type={field.type || 'text'}
                    className="input"
                    required={field.required}
                    placeholder={field.placeholder}
                    min={field.type === 'number' ? 1 : undefined}
                    max={field.type === 'number' ? 99999 : undefined}
                    value={String(draft[field.key] ?? '')}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        [field.key]:
                          field.type === 'number'
                            ? e.target.value === ''
                              ? ('' as unknown as number)
                              : Number(e.target.value)
                            : e.target.value,
                      })
                    }
                  />
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '18px' }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => { setDraft(company); setErrorMsg(null); setIsEditing(false); }}
                disabled={savingCompany}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingCompany}>
                {savingCompany ? 'Guardando...' : 'Guardar cambios'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section style={s.card}>
        <div style={{ ...s.sectionTag, marginBottom: '12px' }}>Reglas Operativas</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>
              Permitir facturación sin stock físico
            </div>
            <div style={{ fontSize: '0.81rem', color: '#6B7280', marginTop: '2px' }}>
              Habilita ventas y emisión de comprobantes cuando el inventario disponible sea cero o negativo.
            </div>
          </div>

          <button
            type="button"
            role="switch"
            aria-checked={ignoreStock}
            aria-label="Permitir facturación sin stock físico"
            disabled={savingStock}
            onClick={handleToggleIgnoreStock}
            style={{
              width: '40px',
              height: '22px',
              padding: 0,
              border: 'none',
              borderRadius: '9999px',
              backgroundColor: ignoreStock ? '#10B981' : '#E5E7EB',
              position: 'relative',
              cursor: savingStock ? 'wait' : 'pointer',
              transition: 'background-color 0.2s ease',
              flexShrink: 0,
            }}
          >
            <span
              style={{
                display: 'block',
                width: '18px',
                height: '18px',
                borderRadius: '50%',
                backgroundColor: '#FFFFFF',
                boxShadow: '0 1px 2px rgba(0, 0, 0, 0.18)',
                position: 'absolute',
                top: '2px',
                left: ignoreStock ? '20px' : '2px',
                transition: 'left 0.2s ease',
              }}
            />
          </button>
        </div>
      </section>

      <section style={s.card}>
        <div style={{ ...s.sectionTag, marginBottom: '12px' }}>Seguridad de la Cuenta</div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: '0.9rem', fontWeight: 600, color: '#111827' }}>
              Contraseña de acceso{currentUser?.username ? ` (${currentUser.username})` : ''}
            </div>
            <div style={{ fontSize: '0.81rem', color: '#6B7280', marginTop: '2px' }}>
              Actualizá tu clave personal. Las sesiones abiertas en otros dispositivos se cerrarán automáticamente.
            </div>
          </div>

          <button
            type="button"
            onClick={() => setChangePwdOpen(true)}
            className="btn btn-secondary"
            style={{ padding: '6px 12px', fontSize: '0.8rem', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}
          >
            <Key size={13} />
            Cambiar clave
          </button>
        </div>
      </section>

      <ChangeOwnPasswordModal open={changePwdOpen} onClose={() => setChangePwdOpen(false)} />
    </div>
  );
}
