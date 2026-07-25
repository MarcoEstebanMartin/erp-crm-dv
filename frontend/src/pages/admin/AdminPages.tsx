import React, { lazy } from 'react';
import { useParams, useNavigate } from 'react-router-dom';

const AdminDashboard = lazy(() => import('../../components/AdminDashboard'));

export interface AdminPagesProps {
  setActiveTab: (tab: string) => void;
}

export const AdminPages: React.FC<AdminPagesProps> = ({ setActiveTab }) => {
  const { tab = 'dashboard' } = useParams<{ tab?: string }>();
  const navigate = useNavigate();

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    navigate(`/admin/${newTab}`);
  };

  return <AdminDashboard activeTab={tab} setActiveTab={handleTabChange} />;
};

export default AdminPages;
