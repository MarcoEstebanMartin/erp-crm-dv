import { useState, useEffect, useMemo } from 'react';
import { api } from '../../utils/api';
import { UserPlus, MapPin } from 'lucide-react';
import SaleRoutesDashboard from '../SaleRoutesDashboard';
import { OFFICIAL_CITIES, normalizeString } from './clientsHelpers';
import { DebtorsByCityReportView } from './DebtorsByCityReportView';
import { ClientsPersonasTable } from './ClientsPersonasTable';
import ClientsGpsMapModal from '../modals/ClientsGpsMapModal';

interface ClientsTabProps {
  setActiveTab: (tab: string) => void;
  setClientModal: (modal: any) => void;
  setShowResumenModal: (client: any) => void;
  setPaymentModal: (modal: any) => void;
  handleViewClientProfile: (client: any) => void;
  handleViewSellerProfile?: (seller: any) => void;
  clientsVersion?: number;
}

export default function ClientsTab({
  setClientModal,
  setShowResumenModal,
  setPaymentModal,
  handleViewClientProfile,
  handleViewSellerProfile,
  clientsVersion,
}: ClientsTabProps) {
  const [personaRoleFilter, setPersonaRoleFilter] = useState<string>('client');
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [clients, setClients] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('ALL');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>('ALL');
  const [isGpsMapOpen, setIsGpsMapOpen] = useState(false);

  const [debtorsReport, setDebtorsReport] = useState<any[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('ALL');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [availableSellers, setAvailableSellers] = useState<any[]>([]);
  const [availableSaleRoutes, setAvailableSaleRoutes] = useState<any[]>([]);
  const [updatingClientId, setUpdatingClientId] = useState<number | null>(null);

  useEffect(() => {
    let isCurrent = true;
    const loadTabContent = async () => {
      try {
        if (personaRoleFilter === 'debtors_by_city') {
          const report = await api.getDebtorsReport();
          if (!isCurrent) return;
          setDebtorsReport(report.debtors || []);
          const sortedCities = ([...(report.availableCities || [])] as string[]).sort();
          setAvailableCities(sortedCities);
          setSelectedCities(sortedCities);
        } else {
          const data = await api.getPersonas(personaRoleFilter, searchQuery);
          if (!isCurrent) return;
          setClients(data || []);
        }
      } catch (err) {
        if (isCurrent) console.error('Error loading clients tab data:', err);
      }
    };
    loadTabContent();
    return () => { isCurrent = false; };
  }, [personaRoleFilter, searchQuery, clientsVersion]);

  useEffect(() => {
    Promise.all([api.getSellersList(), api.getSaleRoutes()])
      .then(([sellers, routesRes]) => {
        setAvailableSellers(sellers || []);
        setAvailableSaleRoutes(routesRes.routes || []);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    setSelectedCityFilter('ALL');
    setSelectedRouteFilter('ALL');
  }, [personaRoleFilter]);

  const filteredClients = useMemo(() => {
    return clients.filter((c: any) => {
      if (personaRoleFilter === 'client') {
        if (!showInactive && c.isActive === false) return false;
        if (showInactive && c.isActive !== false) return false;
      }
      if (selectedCityFilter !== 'ALL') {
        const normCity = normalizeString(c.city);
        const normSelected = normalizeString(selectedCityFilter);
        if (selectedCityFilter === 'OTRAS') {
          const isOfficial = OFFICIAL_CITIES.map((o) => normalizeString(o)).includes(normCity);
          if (c.city && isOfficial) return false;
        } else if (normCity !== normSelected) return false;
      }
      if (personaRoleFilter === 'client' && selectedRouteFilter !== 'ALL') {
        if (selectedRouteFilter === 'SIN_RUTA') {
          if (c.saleRouteId || (c.route && c.route.trim() !== '')) return false;
        } else {
          const matchedRoute = availableSaleRoutes.find((r) => String(r.id) === String(selectedRouteFilter));
          const targetName = matchedRoute?.name?.trim().toUpperCase();
          const clientRoute = (c.route || '').trim().toUpperCase();
          const matchesId = Number(c.saleRouteId) === Number(selectedRouteFilter);
          const matchesName = Boolean(targetName && clientRoute && (clientRoute === targetName || clientRoute.includes(targetName)));
          if (!matchesId && !matchesName) return false;
        }
      }
      return true;
    });
  }, [clients, personaRoleFilter, showInactive, selectedCityFilter, selectedRouteFilter, availableSaleRoutes]);

  const cityCounts = useMemo(() => {
    const counts: Record<string, number> = { ALL: 0, OTRAS: 0 };
    const officialNormMap = new Map(OFFICIAL_CITIES.map((c) => [normalizeString(c), c]));
    const baseList = clients.filter((c: any) => (personaRoleFilter !== 'client' ? true : !showInactive ? c.isActive !== false : c.isActive === false));
    counts.ALL = baseList.length;
    baseList.forEach((c: any) => {
      const norm = normalizeString(c.city);
      const official = norm ? officialNormMap.get(norm) : null;
      if (official) counts[official] = (counts[official] || 0) + 1;
      else counts.OTRAS = (counts.OTRAS || 0) + 1;
    });
    return counts;
  }, [clients, personaRoleFilter, showInactive]);

  const routeCounts = useMemo(() => {
    const counts: Record<string | number, number> = { ALL: 0, SIN_RUTA: 0 };
    const baseList = clients.filter((c: any) => (personaRoleFilter !== 'client' ? true : !showInactive ? c.isActive !== false : c.isActive === false));
    counts.ALL = baseList.length;
    baseList.forEach((c: any) => {
      if (!c.saleRouteId && (!c.route || c.route.trim() === '')) { counts.SIN_RUTA = (counts.SIN_RUTA || 0) + 1; return; }
      let matched = false;
      for (const route of availableSaleRoutes) {
        const targetName = route.name?.trim().toUpperCase();
        const clientRoute = (c.route || '').trim().toUpperCase();
        if (Number(c.saleRouteId) === Number(route.id) || Boolean(targetName && clientRoute && (clientRoute === targetName || clientRoute.includes(targetName)))) {
          counts[route.id] = (counts[route.id] || 0) + 1;
          matched = true;
          break;
        }
      }
      if (!matched) counts.SIN_RUTA = (counts.SIN_RUTA || 0) + 1;
    });
    return counts;
  }, [clients, personaRoleFilter, showInactive, availableSaleRoutes]);

  const isLocationFiltered = selectedCityFilter !== 'ALL' || selectedRouteFilter !== 'ALL' || searchQuery.trim() !== '';

  const handleDeletePersona = async (personaId: number, name: string) => {
    if (!window.confirm(`¿Estás seguro de que deseas eliminar a "${name}"?`)) return;
    try {
      await api.deletePersona(personaId);
      setClients((prev) => prev.filter((c) => c.id !== personaId));
    } catch (err: any) { alert(err.message || 'Error al eliminar el registro.'); }
  };

  const handleUpdateCtaCte = async (client: any, newValue: number) => {
    try {
      setUpdatingClientId(client.id);
      await api.updatePersona(client.id, { ...client, maxUnpaidInvoices: newValue });
      setClients((prev) => prev.map((c) => (c.id === client.id ? { ...c, maxUnpaidInvoices: newValue } : c)));
    } catch { alert('Error al actualizar límite de Cta Cte.'); } finally { setUpdatingClientId(null); }
  };

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {[
            { id: 'client', label: 'Clientes' },
            { id: 'seller', label: 'Vendedores' },
            { id: 'commission_agent', label: 'Comisionistas' },
            { id: 'debtors_by_city', label: '📊 Deudores por Ruta' },
            { id: 'sale_routes', label: 'Rutas de Preventa' },
          ].map((tab) => (
            <button
              key={tab.id}
              className={`btn ${personaRoleFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
              style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: '20px' }}
              onClick={() => { setPersonaRoleFilter(tab.id); setClients([]); setSelectedCityFilter('ALL'); }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {personaRoleFilter === 'client' && (
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '6px 14px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600 }}
            onClick={() => setIsGpsMapOpen(true)}
          >
            <MapPin size={15} color="#E30613" />
            <span>Mapa GPS Interactivo ({filteredClients.length})</span>
          </button>
        )}
      </div>

      {personaRoleFilter === 'debtors_by_city' ? (
        <DebtorsByCityReportView
          debtorsReport={debtorsReport}
          availableCities={availableCities}
          selectedCities={selectedCities}
          setSelectedCities={setSelectedCities}
          availableSellers={availableSellers}
          selectedSellerFilter={selectedSellerFilter}
          setSelectedSellerFilter={setSelectedSellerFilter}
          selectedBranchFilter={selectedBranchFilter}
          setSelectedBranchFilter={setSelectedBranchFilter}
          setShowResumenModal={setShowResumenModal}
          setPaymentModal={setPaymentModal}
        />
      ) : personaRoleFilter === 'sale_routes' ? (
        <SaleRoutesDashboard />
      ) : (
        <>
          <div className="actions-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div className="search-input-wrapper" style={{ flex: 1, minWidth: '240px' }}>
              <input type="text" className="input" placeholder="Buscar fonético por nombre, CUIT, localidad..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} />
            </div>

            <select className="select" value={selectedCityFilter} onChange={(e) => setSelectedCityFilter(e.target.value)} style={{ minWidth: '190px', height: '38px' }}>
              <option value="ALL">Todas las Localidades ({cityCounts.ALL || 0})</option>
              {OFFICIAL_CITIES.map((city) => (<option key={city} value={city}>{city} ({cityCounts[city] || 0})</option>))}
              <option value="OTRAS">Otras ({cityCounts.OTRAS || 0})</option>
            </select>

            {personaRoleFilter === 'client' && (
              <select className="select" value={selectedRouteFilter} onChange={(e) => setSelectedRouteFilter(e.target.value)} style={{ minWidth: '190px', height: '38px' }}>
                <option value="ALL">Todas las Rutas ({routeCounts.ALL || 0})</option>
                {availableSaleRoutes.map((route) => (<option key={route.id} value={route.id}>{route.name} ({routeCounts[route.id] || 0})</option>))}
                <option value="SIN_RUTA">Sin Ruta ({routeCounts.SIN_RUTA || 0})</option>
              </select>
            )}

            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 14px', height: '38px', backgroundColor: isLocationFiltered ? '#f0fdf4' : '#f8fafc', border: isLocationFiltered ? '1px solid #bbf7d0' : '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
              <span style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isLocationFiltered ? '#16a34a' : '#94a3b8', display: 'inline-block' }} />
              <span style={{ color: isLocationFiltered ? '#15803d' : '#64748b', fontWeight: 500 }}>{isLocationFiltered ? 'Filtrados:' : 'Total:'}</span>
              <span style={{ fontWeight: 700, fontSize: '0.98rem', color: isLocationFiltered ? '#166534' : '#0f172a' }}>{filteredClients.length.toLocaleString('es-AR')}</span>
            </div>

            {personaRoleFilter === 'client' && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginLeft: 'auto', marginRight: '12px' }}>
                <label style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <input type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                  Ver Inactivos
                </label>
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={() =>
                setClientModal({
                  open: true, mode: 'create',
                  data: {
                    id: 0, name: '', cuit: '', address: '', city: '', phone: '', email: '', creditLimit: 0, maxUnpaidInvoices: 0,
                    priceList: 'A', discount: 0, isClient: personaRoleFilter === 'client', isProvider: personaRoleFilter === 'provider',
                    isSeller: personaRoleFilter === 'seller', isCommissionAgent: personaRoleFilter === 'commission_agent',
                    route: '', saleRouteId: null, sellerId: null, isActive: !showInactive,
                  },
                })
              }
            >
              <UserPlus size={16} />
              <span>Registrar {personaRoleFilter === 'client' ? 'Cliente' : personaRoleFilter === 'provider' ? 'Proveedor' : personaRoleFilter === 'seller' ? 'Vendedor' : 'Comisionista'}</span>
            </button>
          </div>

          <ClientsPersonasTable
            filteredClients={filteredClients}
            totalClientsCount={clients.length}
            personaRoleFilter={personaRoleFilter}
            isLocationFiltered={isLocationFiltered}
            updatingClientId={updatingClientId}
            onUpdateCtaCte={handleUpdateCtaCte}
            onViewClientProfile={handleViewClientProfile}
            onViewSellerProfile={handleViewSellerProfile}
            onShowResumenModal={setShowResumenModal}
            onDeletePersona={handleDeletePersona}
            onResetFilters={() => { setSelectedCityFilter('ALL'); setSelectedRouteFilter('ALL'); setSearchQuery(''); }}
          />
        </>
      )}

      <ClientsGpsMapModal
        isOpen={isGpsMapOpen}
        clients={filteredClients}
        activeFilterLabel={selectedCityFilter !== 'ALL' ? selectedCityFilter : 'Padrón General'}
        onClose={() => setIsGpsMapOpen(false)}
        onSelectClient={(client) => { setIsGpsMapOpen(false); handleViewClientProfile(client); }}
      />
    </div>
  );
}
