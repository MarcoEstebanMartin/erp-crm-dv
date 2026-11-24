import React, { useEffect, useId, useRef, useState } from 'react';
import { Building2, KeyRound, Pencil } from 'lucide-react';
import { api } from '../../../utils/api';
import { type CompanyProfile, formatCompanyPhone, getCompanyProfile } from '../../../utils/companyProfile';
import ChangeOwnPasswordModal from '../../modals/ChangeOwnPasswordModal';
import './configGeneralTab.css';

interface ConfigGeneralTabProps {
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
}

interface EditFieldSpec {
  key: keyof CompanyProfile;
  label: string;
  type?: 'text' | 'email' | 'tel';
  inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode'];
  autoComplete?: string;
  identifier?: boolean;
  numeric?: boolean;
  required?: boolean;
  placeholder?: string;
}

const COMPANY_EDIT_FIELDS: EditFieldSpec[] = [
  { key: 'razonSocial', label: 'Razón social', autoComplete: 'organization', required: true },
  { key: 'nombreFantasia', label: 'Nombre comercial', autoComplete: 'organization', required: true },
  { key: 'cuit', label: 'CUIT', inputMode: 'numeric', identifier: true, required: true, placeholder: '20-00000000-0' },
  { key: 'puntoVenta', label: 'Punto de venta', inputMode: 'numeric', identifier: true, numeric: true, required: true },
  { key: 'direccion', label: 'Dirección', autoComplete: 'street-address' },
  { key: 'telefono', label: 'Teléfono', type: 'tel', autoComplete: 'tel', inputMode: 'tel' },
  { key: 'email', label: 'Email', type: 'email', autoComplete: 'email', identifier: true },
  { key: 'iibb', label: 'IIBB', identifier: true },
  { key: 'inicioActividades', label: 'Inicio de actividades', inputMode: 'numeric', placeholder: 'DD/MM/AAAA' },
];

export default function ConfigGeneralTab({ setErrorMsg, setSuccessMsg }: ConfigGeneralTabProps) {
  const formUid = useId();
  const [company, setCompany] = useState<CompanyProfile>(() => getCompanyProfile());
  const [draft, setDraft] = useState<CompanyProfile>(() => getCompanyProfile());
  const [isEditing, setIsEditing] = useState(false);
  const [savingCompany, setSavingCompany] = useState(false);
  const [ignoreStock, setIgnoreStock] = useState<boolean>(() => Boolean(api.getServerConfig()?.ignoreStock));
  const [savingStock, setSavingStock] = useState(false);
  const [afipMockMode, setAfipMockMode] = useState<boolean>(() => Boolean(api.getServerConfig()?.afipMockMode));
  const [savingAfipMock, setSavingAfipMock] = useState(false);
  const [afipCertStatus, setAfipCertStatus] = useState<any>(() => api.getServerConfig()?.afipCertStatus || null);
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
        setAfipMockMode(Boolean(cfg.afipMockMode));
        if (cfg.afipCertStatus) setAfipCertStatus(cfg.afipCertStatus);
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
      setSuccessMsg('Empresa actualizada.');
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
      setSuccessMsg(next ? 'Facturación sin stock activada.' : 'Control de stock activado.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      setIgnoreStock(!next);
      setErrorMsg(err?.message || 'No se pudo actualizar la regla.');
    } finally {
      setSavingStock(false);
    }
  };

  const handleToggleAfipMock = async () => {
    if (savingAfipMock) return;
    const next = !afipMockMode;
    setAfipMockMode(next);
    setSavingAfipMock(true);
    setErrorMsg(null);
    try {
      await api.updateServerConfig({ afipMockMode: next });
      setSuccessMsg(next ? 'Simulacro ARCA activado.' : 'Simulacro ARCA desactivado.');
      setTimeout(() => setSuccessMsg(null), 2500);
    } catch (err: any) {
      setAfipMockMode(!next);
      setErrorMsg(err?.message || 'No se pudo actualizar el modo simulacro ARCA.');
    } finally {
      setSavingAfipMock(false);
    }
  };

  const operationalRules = [
    {
      key: 'ignore-stock',
      title: 'Facturar sin stock',
      checked: ignoreStock,
      saving: savingStock,
      onToggle: handleToggleIgnoreStock,
      activeColor: '#111827',
    },
    {
      key: 'afip-mock',
      title: 'Simulacro fiscal ARCA',
      checked: afipMockMode,
      saving: savingAfipMock,
      onToggle: handleToggleAfipMock,
      activeColor: '#D97706',
    },
  ];

  const formattedPos = String(company.puntoVenta || 1).padStart(4, '0');
  const certExpiryLabel = (() => {
    if (!afipCertStatus?.configured || !afipCertStatus.validTo) return null;
    const d = new Date(afipCertStatus.validTo);
    if (Number.isNaN(d.getTime())) return null;
    const dateStr = d.toLocaleDateString('es-AR', { timeZone: 'America/Argentina/Buenos_Aires' });
    const days = Number(afipCertStatus.daysRemaining);
    if (afipCertStatus.status === 'EXPIRED') return `Vencido el ${dateStr}`;
    return `Vence ${dateStr} (${days} días)`;
  })();

  const readItems: Array<{ label: string; value: string }> = [
    { label: 'Dirección', value: company.direccion || '—' },
    { label: 'Teléfono', value: formatCompanyPhone(company.telefono) || '—' },
    { label: 'Email', value: company.email || '—' },
    ...(company.iibb ? [{ label: 'IIBB', value: company.iibb }] : []),
    ...(company.inicioActividades ? [{ label: 'Inicio', value: company.inicioActividades }] : []),
    ...(certExpiryLabel ? [{ label: 'Certificado ARCA', value: certExpiryLabel }] : []),
  ];

  return (
    <div className="cfg-general">
      <section className="cfg-surface">
        <div className="cfg-company-head">
          <div className="cfg-company-id">
            <div className="cfg-company-mark" aria-hidden="true">
              <Building2 size={17} strokeWidth={1.75} />
            </div>
            <div>
              <h3 className="cfg-company-title">{company.nombreFantasia}</h3>
              <p className="cfg-company-meta">
                <span className="cfg-company-meta-strong">{company.razonSocial}</span>
                <span className="cfg-dot" aria-hidden="true">·</span>
                <span>CUIT {company.cuit}</span>
                <span className="cfg-dot" aria-hidden="true">·</span>
                <span>PV {formattedPos}</span>
              </p>
            </div>
          </div>

          {!isEditing && (
            <button
              type="button"
              className="cfg-btn-ghost"
              onClick={() => { setDraft(company); setErrorMsg(null); setIsEditing(true); }}
            >
              <Pencil size={13} strokeWidth={1.85} />
              Editar
            </button>
          )}
        </div>

        {!isEditing ? (
          <dl className="cfg-dl">
            {readItems.map((item) => (
              <div key={item.label} className="cfg-dl-item">
                <dt className="cfg-dl-term">{item.label}</dt>
                <dd className="cfg-dl-value">{item.value}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <form onSubmit={handleSaveCompany} className="cfg-form">
            <div className="cfg-form-grid">
              {COMPANY_EDIT_FIELDS.map((field, index) => {
                const inputId = `${formUid}-${String(field.key)}`;
                const isLast = index === COMPANY_EDIT_FIELDS.length - 1;
                return (
                  <div key={field.key} className="cfg-field">
                    <label htmlFor={inputId} className="cfg-field-label">
                      {field.label}
                    </label>
                    <input
                      id={inputId}
                      name={String(field.key)}
                      type={field.type || 'text'}
                      className="cfg-input"
                      required={field.required}
                      placeholder={field.placeholder}
                      inputMode={field.inputMode}
                      autoComplete={field.autoComplete}
                      autoCorrect={field.identifier ? 'off' : undefined}
                      autoCapitalize={field.identifier ? 'none' : undefined}
                      spellCheck={field.identifier ? false : undefined}
                      enterKeyHint={isLast ? 'done' : 'next'}
                      value={String(draft[field.key] ?? '')}
                      onChange={(e) => {
                        const raw = e.target.value;
                        const parsed = field.numeric
                          ? raw.replace(/\D/g, '').slice(0, 5)
                          : raw;
                        setDraft({
                          ...draft,
                          [field.key]: field.numeric
                            ? parsed === ''
                              ? ('' as unknown as number)
                              : Number(parsed)
                            : parsed,
                        });
                      }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="cfg-form-actions">
              <button
                type="button"
                className="cfg-btn-ghost"
                onClick={() => { setDraft(company); setErrorMsg(null); setIsEditing(false); }}
                disabled={savingCompany}
              >
                Cancelar
              </button>
              <button type="submit" className="btn btn-primary" disabled={savingCompany}>
                {savingCompany ? 'Guardando...' : 'Guardar'}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="cfg-surface cfg-switch-list">
        {operationalRules.map((rule) => {
          const switchId = `${formUid}-${rule.key}`;
          return (
            <label
              key={rule.key}
              htmlFor={switchId}
              className="cfg-switch-row"
              data-saving={rule.saving}
            >
              <span className="cfg-switch-title">{rule.title}</span>
              <input
                id={switchId}
                name={rule.key}
                type="checkbox"
                role="switch"
                {...({ switch: '' } as Record<string, string>)}
                checked={rule.checked}
                disabled={rule.saving}
                onChange={rule.onToggle}
                className="cfg-switch-input"
                style={{ '--switch-active': rule.activeColor } as React.CSSProperties}
              />
            </label>
          );
        })}
      </section>

      <div className="cfg-footer-actions">
        <button
          type="button"
          className="cfg-btn-ghost"
          onClick={() => setChangePwdOpen(true)}
        >
          <KeyRound size={13} strokeWidth={1.85} />
          Cambiar Clave
        </button>
      </div>

      <ChangeOwnPasswordModal open={changePwdOpen} onClose={() => setChangePwdOpen(false)} />
    </div>
  );
}
