import React, { lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const DepositoDashboard = lazy(() => import('../../components/DepositoDashboard'));

export interface DepositoPagesProps {
  setActiveTab: (tab: string) => void;
}

export const DepositoPages: React.FC<DepositoPagesProps> = ({ setActiveTab }) => {
  const { tab = 'deposito' } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    const target = newTab === 'products' ? 'stock' : newTab;
    navigate(`/deposito/${target}`);
  };

  const activeTabMapped = tab === 'stock' ? 'products' : tab;

  return <DepositoDashboard activeTab={activeTabMapped} setActiveTab={handleTabChange} />;
};

export default DepositoPages;
