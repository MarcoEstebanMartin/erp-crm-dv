import React, { lazy } from 'react';
import { Navigate, useParams, useNavigate } from 'react-router-dom';
import { api } from '../../utils/api';

const AdminDashboard = lazy(() => import('../../components/AdminDashboard'));

export interface AdminPagesProps {
  setActiveTab: (tab: string) => void;
}

export const AdminPages: React.FC<AdminPagesProps> = ({ setActiveTab }) => {
  const { tab = 'dashboard' } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const currentUser = api.getCurrentUser();

  if (currentUser?.role && currentUser.role !== 'ADMIN' && currentUser.role !== 'FACTURACION') {
    const fallback = currentUser.role === 'DEPOSITO' ? '/deposito/picking' : '/vendedor/orders';
    return <Navigate to={fallback} replace />;
  }

  const handleTabChange = (newTab: string) => {
    setActiveTab(newTab);
    navigate(`/admin/${newTab}`);
  };

  return <AdminDashboard activeTab={tab} setActiveTab={handleTabChange} />;
};

export default AdminPages;
