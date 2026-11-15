import { useRef, useState, type KeyboardEvent } from 'react';
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

  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const tabs = [
    { id: 'general', label: 'Empresa', icon: <Building2 size={15} />, visible: isAdmin },
    { id: 'personal', label: 'Usuarios', icon: <Users size={15} />, visible: isAdmin },
    { id: 'arca', label: 'ARCA / IVA', icon: <FileText size={15} />, visible: true },
    { id: 'audit', label: 'Auditoría', icon: <FileText size={15} />, visible: isAdmin },
    { id: 'percepciones', label: 'Percepciones', icon: <Receipt size={15} />, visible: isAdmin },
    { id: 'prices', label: 'Ofertas', icon: <Tag size={15} />, visible: canManageOffers },
  ].filter((tab) => tab.visible);

  const activeTabId = tabs.some((tab) => tab.id === configTab)
    ? configTab
    : (tabs[0]?.id ?? 'arca');

  const selectTab = (tabId: string) => {
    setErrorMsg(null);
    setSuccessMsg(null);
    setConfigTab(tabId);
  };

  const handleTabKeyDown = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    if (tabs.length === 0) return;
    let nextIndex: number | null = null;
    if (event.key === 'ArrowRight') nextIndex = (index + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (index - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;

    if (nextIndex === null) return;
    event.preventDefault();
    const target = tabs[nextIndex];
    selectTab(target.id);
    tabRefs.current[nextIndex]?.focus();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <div
        role="tablist"
        aria-label="Configuración"
        className="linear-tablist"
        style={{ overflowX: 'auto', marginBottom: '4px' }}
      >
        {tabs.map((tab, index) => {
          const isSelected = activeTabId === tab.id;
          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[index] = el;
              }}
              id={`config-tab-${tab.id}`}
              type="button"
              role="tab"
              aria-selected={isSelected}
              tabIndex={isSelected ? 0 : -1}
              className="linear-tab"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
              onClick={() => selectTab(tab.id)}
              onKeyDown={(event) => handleTabKeyDown(event, index)}
            >
              {tab.icon}
              {tab.label}
            </button>
          );
        })}
      </div>

      <div role="tabpanel" aria-labelledby={`config-tab-${activeTabId}`}>
        {activeTabId === 'arca' && <AfipExportDashboard />}
        {isAdmin && activeTabId === 'general' && (
          <ConfigGeneralTab setErrorMsg={setErrorMsg} setSuccessMsg={setSuccessMsg} />
        )}
        {isAdmin && activeTabId === 'personal' && (
          <UsersRolesTab setErrorMsg={setErrorMsg} setSuccessMsg={setSuccessMsg} />
        )}
        {isAdmin && activeTabId === 'audit' && <AuditLogsTab />}
        {isAdmin && activeTabId === 'percepciones' && (
          <PerceptionsTab setErrorMsg={setErrorMsg} setSuccessMsg={setSuccessMsg} />
        )}
        {canManageOffers && activeTabId === 'prices' && (
          <PricingRulesTab setErrorMsg={setErrorMsg} setSuccessMsg={setSuccessMsg} />
        )}
      </div>
    </div>
  );
}
