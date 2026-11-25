import React, { lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const DepositoDashboard = lazy(() => import('../../components/DepositoDashboard'));
const RepartoDashboard = lazy(() => import('../../components/RepartoDashboard'));
const FieldCollectionPage = lazy(() =>
  import('../../components/field-receipts/FieldCollectionPage').then((m) => ({
    default: m.FieldCollectionPage,
  })),
);

export type DepositoAppTab = 'pedidos' | 'stock' | 'mapa' | 'reparto' | 'cobrar';

export function normalizeDepositoTab(
  rawTab: string | undefined,
  canDeliver: boolean,
): DepositoAppTab {
  const normalized = (rawTab || '').trim().toLowerCase();
  if (normalized === 'stock' || normalized === 'products') return 'stock';
  if (normalized === 'mapa' || normalized === 'wms-map') return 'mapa';
  if (normalized === 'reparto' || normalized === 'logistica') {
    return canDeliver ? 'reparto' : 'pedidos';
  }
  if (normalized === 'cobrar' || normalized === 'field-receipts') {
    return canDeliver ? 'cobrar' : 'pedidos';
  }
  return 'pedidos';
}

export interface DepositoPagesProps {
  setActiveTab: (tab: string) => void;
  canDeliver?: boolean;
}

export const DepositoPages: React.FC<DepositoPagesProps> = ({
  setActiveTab,
  canDeliver = false,
}) => {
  const { tab } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const currentTab = normalizeDepositoTab(tab, canDeliver);

  const handleTabChange = (newTab: string) => {
    const target = normalizeDepositoTab(newTab, canDeliver);
    setActiveTab(target);
    navigate(`/deposito/${target}`);
  };

  if (currentTab === 'reparto') {
    return <RepartoDashboard />;
  }

  if (currentTab === 'cobrar') {
    return <FieldCollectionPage />;
  }

  return (
    <DepositoDashboard
      activeTab={currentTab}
      setActiveTab={handleTabChange}
      appMode
    />
  );
};

export default DepositoPages;
