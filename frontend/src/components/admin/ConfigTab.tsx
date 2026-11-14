import { useState } from 'react';
import {
  Building2,
  Users,
  FileText,
  Receipt,
  Tag,
} from 'lucide-react';
import { api } from '../../utils/api';
import AfipExportDashboard from '../../pages/AfipExportDashboard';
import ConfigGeneralTab from './config/ConfigGeneralTab';
import UsersRolesTab from './config/UsersRolesTab';
import AuditLogsTab from './config/AuditLogsTab';
import PerceptionsTab from './config/PerceptionsTab';
import PricingRulesTab from './config/PricingRulesTab';

interface ConfigTabProps {
  setErrorMsg: (msg: string | null) => void;
  setSuccessMsg: (msg: string | null) => void;
  initialTab?: string;
}

import { canManageWeeklyPromos } from './config/weeklyPromo.helpers';

export default function ConfigTab({
  setErrorMsg,
  setSuccessMsg,
  initialTab = 'general',
}: ConfigTabProps) {
  const currentUser = api.getCurrentUser();
  const isAdmin = currentUser?.role === 'ADMIN';
  const canManageOffers = canManageWeeklyPromos(currentUser);

  const [configTab, setConfigTab] = useState<string>(() => {
    if (initialTab === 'prices' && canManageOffers) return 'prices';
    if (!isAdmin) return 'arca';
    if (initialTab === 'rrhh') return 'personal';
    if (initialTab === 'reconcile') return 'general';
    if (initialTab === 'prices' && !canManageOffers) return 'general';
    return initialTab;
  });

  const tabs = [
    { id: 'general', label: 'General & Empresa', icon: <Building2 size={15} />, visible: isAdmin },
    { id: 'personal', label: 'Empleados & Roles', icon: <Users size={15} />, visible: isAdmin },
    { id: 'arca', label: 'Cierre Fiscal (ARCA)', icon: <FileText size={15} />, visible: true },
    { id: 'audit', label: 'Auditoría (Logs)', icon: <FileText size={15} />, visible: isAdmin },
    { id: 'percepciones', label: 'Impuestos & Percepciones', icon: <Receipt size={15} />, visible: isAdmin },
    { id: 'prices', label: 'Ofertas Semanales', icon: <Tag size={15} />, visible: canManageOffers },
  ].filter((tab) => tab.visible);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        style={{
          display: 'flex',
          gap: '8px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '8px',
          marginBottom: '12px',
          overflowX: 'auto',
          paddingRight: '4px',
        }}
      >
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className="btn"
            style={{
              backgroundColor: configTab === tab.id ? 'var(--color-primary)' : '#fff',
              color: configTab === tab.id ? '#fff' : 'var(--text-primary)',
              border: configTab === tab.id ? '1px solid var(--color-primary)' : '1px solid var(--border-color)',
              fontWeight: 600,
              fontSize: '0.85rem',
              padding: '8px 16px',
              borderRadius: '6px',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
            }}
            onClick={() => {
              setErrorMsg(null);
              setSuccessMsg(null);
              setConfigTab(tab.id);
            }}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {configTab === 'arca' && <AfipExportDashboard />}
      {isAdmin && configTab === 'general' && (
        <ConfigGeneralTab setErrorMsg={setErrorMsg} setSuccessMsg={setSuccessMsg} />
      )}
      {isAdmin && configTab === 'personal' && (
        <UsersRolesTab setErrorMsg={setErrorMsg} setSuccessMsg={setSuccessMsg} />
      )}
      {isAdmin && configTab === 'audit' && <AuditLogsTab />}
      {isAdmin && configTab === 'percepciones' && (
        <PerceptionsTab setErrorMsg={setErrorMsg} setSuccessMsg={setSuccessMsg} />
      )}
      {canManageOffers && configTab === 'prices' && (
        <PricingRulesTab setErrorMsg={setErrorMsg} setSuccessMsg={setSuccessMsg} />
      )}
    </div>
  );
}
