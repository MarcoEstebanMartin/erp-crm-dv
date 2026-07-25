import React, { lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const VendedorDashboard = lazy(() => import('../../components/VendedorDashboard'));

export interface VendedorPagesProps {
  setActiveTab: (tab: string) => void;
}

export const VendedorPages: React.FC<VendedorPagesProps> = ({ setActiveTab }) => {
  const { tab = 'orders' } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    navigate(`/vendedor/${newTab}`);
  };

  return <VendedorDashboard activeTab={tab} setActiveTab={handleTabChange} />;
};

export default VendedorPages;
