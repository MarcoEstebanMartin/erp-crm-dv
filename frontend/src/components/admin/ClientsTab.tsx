import React, { useState, useEffect, useMemo, useDeferredValue, useCallback, useRef, lazy, Suspense, type KeyboardEvent } from 'react';
import { api } from '../../utils/api';
import { UserPlus, MapPin } from 'lucide-react';
import SaleRoutesDashboard from '../SaleRoutesDashboard';
import {
  INITIAL_CLIENTS_BATCH, CLIENTS_BATCH_STEP, PERSONA_ROLE_TABS,
  buildEmptyPersonaDraft, computeClientLocationAndRouteCounts, filterClientsInMemory,
} from './clientsHelpers';
import { DebtorsByCityReportView } from './DebtorsByCityReportView';
import { useConfirm } from '../../context/ConfirmContext';
import { ClientsPersonasTable } from './ClientsPersonasTable';
import ClientsGpsMapModal from '../modals/ClientsGpsMapModal';

const ComprasDashboard = lazy(() => import('../ComprasDashboard'));
const EmployeesTab = lazy(() => import('./employees/EmployeesTab'));

interface ClientsTabProps {
  setActiveTab: (tab: string) => void;
  clients?: any[];
  setClients?: React.Dispatch<React.SetStateAction<any[]>>;
  availableSellers?: any[];
  availableSaleRoutes?: any[];
  setClientModal: (modal: any) => void;
  setShowResumenModal: (client: any) => void;
  setPaymentModal: (modal: any) => void;
  handleViewClientProfile: (client: any) => void;
  handleViewSellerProfile?: (seller: any) => void;
  clientsVersion?: number;
  onProvidersChanged?: () => void;
}

export default function ClientsTab({
  clients: parentClients = [], setClients: setParentClients, availableSellers = [], availableSaleRoutes = [],
  setClientModal, setShowResumenModal, setPaymentModal, handleViewClientProfile, handleViewSellerProfile,
  clientsVersion, onProvidersChanged,
}: ClientsTabProps) {
  const isAdmin = api.getCurrentUser()?.role === 'ADMIN';
  const visibleRoleTabs = useMemo(() => PERSONA_ROLE_TABS.filter((tab) => !('adminOnly' in tab && tab.adminOnly) || isAdmin), [isAdmin]);
  const [personaRoleFilter, setPersonaRoleFilter] = useState<string>('client');
  const [showInactive, setShowInactive] = useState<boolean>(false);
  const [rolePersonas, setRolePersonas] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('ALL');
  const [selectedRouteFilter, setSelectedRouteFilter] = useState<string>('ALL');
  const [selectedClientSellerFilter, setSelectedClientSellerFilter] = useState<string>('ALL');
  const [visibleCount, setVisibleCount] = useState<number>(INITIAL_CLIENTS_BATCH);
  const [isGpsMapOpen, setIsGpsMapOpen] = useState(false);

  const [debtorsReport, setDebtorsReport] = useState<any[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('ALL');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [updatingClientId, setUpdatingClientId] = useState<number | null>(null);
  const [errorMsg, setErrorMsg] = useState<string>('');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const confirm = useConfirm();

  useEffect(() => {
    if (personaRoleFilter === 'client' || personaRoleFilter === 'sale_routes' || personaRoleFilter === 'providers' || personaRoleFilter === 'employees') return;
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
          const data = await api.getPersonas(personaRoleFilter);
          if (!isCurrent) return;
          setRolePersonas(data || []);
        }
      } catch (err) {
        if (isCurrent) console.error('Error loading clients tab data:', err);
      }
    };
    void loadTabContent();
    return () => { isCurrent = false; };
  }, [personaRoleFilter, clientsVersion]);

  useEffect(() => {
    setSelectedCityFilter('ALL');
    setSelectedRouteFilter('ALL');
    setSelectedClientSellerFilter('ALL');
  }, [personaRoleFilter, showInactive]);

  useEffect(() => {
    setVisibleCount(INITIAL_CLIENTS_BATCH);
  }, [personaRoleFilter, showInactive, selectedCityFilter, selectedRouteFilter, selectedClientSellerFilter, deferredSearchQuery]);

  const activePersonas = personaRoleFilter === 'client' ? parentClients : rolePersonas;

  const { cityCounts, cityOptions, visibleCityNormSet, routeCounts, sellerCounts } = useMemo(
    () => computeClientLocationAndRouteCounts(activePersonas, personaRoleFilter, showInactive, availableSaleRoutes),
    [activePersonas, personaRoleFilter, showInactive, availableSaleRoutes],
  );

  const filteredClients = useMemo(
    () =>
      filterClientsInMemory(activePersonas, {
        personaRoleFilter,
        showInactive,
        selectedCityFilter,
        selectedRouteFilter,
        selectedSellerFilter: selectedClientSellerFilter,
        searchQuery: deferredSearchQuery,
        availableSaleRoutes,
        visibleCityNormSet,
      }),
    [activePersonas, personaRoleFilter, showInactive, selectedCityFilter, selectedRouteFilter, selectedClientSellerFilter, deferredSearchQuery, availableSaleRoutes, visibleCityNormSet],
  );

  const hasMoreRows = visibleCount < filteredClients.length;
  const visibleClients = useMemo(
    () => filteredClients.slice(0, visibleCount),
    [filteredClients, visibleCount],
  );

  const isLocationFiltered = selectedCityFilter !== 'ALL' || selectedRouteFilter !== 'ALL' || selectedClientSellerFilter !== 'ALL' || searchQuery.trim() !== '';

  const updateActiveList = useCallback(
    (updater: (prev: any[]) => any[]) => {
      if (personaRoleFilter === 'client') setParentClients?.(updater);
      else setRolePersonas(updater);
    },
    [personaRoleFilter, setParentClients],
  );

  const handleDeletePersona = useCallback(async (personaId: number, name: string) => {
    if (!(await confirm(`¿Eliminar a "${name}"?`, { type: 'danger', confirmText: 'Eliminar' }))) return;
    try {
      await api.deletePersona(personaId);
      updateActiveList((prev) => prev.filter((c) => c.id !== personaId));
    } catch (err: any) { setErrorMsg(err.message || 'Error al eliminar el registro.'); }
  }, [confirm, updateActiveList]);

  const handleUpdateCtaCte = useCallback(async (client: any, newValue: number) => {
    try {
      setUpdatingClientId(client.id);
      await api.updatePersona(client.id, { ...client, maxUnpaidInvoices: newValue });
      updateActiveList((prev) => prev.map((c) => (c.id === client.id ? { ...c, maxUnpaidInvoices: newValue } : c)));
    } catch { setErrorMsg('Error al actualizar límite de Cta Cte.'); } finally { setUpdatingClientId(null); }
  }, [updateActiveList]);

  const handleLoadMore = useCallback(() => setVisibleCount((prev) => Math.min(prev + CLIENTS_BATCH_STEP, filteredClients.length)), [filteredClients.length]);
  const handleShowAll = useCallback(() => setVisibleCount(filteredClients.length), [filteredClients.length]);
  const handleResetFilters = useCallback(() => {
    setSelectedCityFilter('ALL'); setSelectedRouteFilter('ALL'); setSelectedClientSellerFilter('ALL'); setSearchQuery('');
  }, []);

  const selectRoleTab = useCallback((tabId: string, idx?: number) => {
    setPersonaRoleFilter(tabId);
    setRolePersonas([]);
    setSelectedCityFilter('ALL');
    setErrorMsg('');
    if (idx !== undefined) tabRefs.current[idx]?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, []);

  const handleTabKeyDown = useCallback((e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % visibleRoleTabs.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + visibleRoleTabs.length) % visibleRoleTabs.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = visibleRoleTabs.length - 1;
    else return;
    e.preventDefault();
    selectRoleTab(visibleRoleTabs[nextIdx].id, nextIdx);
    tabRefs.current[nextIdx]?.focus();
  }, [selectRoleTab, visibleRoleTabs]);

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px', borderBottom: '1px solid var(--border-color)' }}>
        <div className="linear-tablist" role="tablist" aria-label="Vistas de personas" style={{ borderBottom: 'none' }}>
          {visibleRoleTabs.map((tab, idx) => {
            const isSelected = personaRoleFilter === tab.id;
            return (
              <button
                key={tab.id} ref={(el) => { tabRefs.current[idx] = el; }} id={`personas-tab-${tab.id}`}
                type="button" role="tab" aria-selected={isSelected} tabIndex={isSelected ? 0 : -1} className="linear-tab"
                onClick={() => selectRoleTab(tab.id, idx)} onKeyDown={(e) => handleTabKeyDown(e, idx)}
              >
                {tab.label}
              </button>
            );
          })}
        </div>

        {personaRoleFilter === 'client' && (
          <button type="button" className="btn btn-secondary" style={{ padding: '6px 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, marginBottom: '4px' }} onClick={() => setIsGpsMapOpen(true)}>
            <MapPin size={15} />
            <span>Mapa GPS ({filteredClients.length})</span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div role="alert" style={{ padding: '10px 14px', marginBottom: '14px', backgroundColor: '#fef2f2', border: '1px solid #fecaca', borderRadius: '6px', color: '#991b1b', fontSize: '0.84rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>{errorMsg}</span>
          <button type="button" className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '0.78rem' }} onClick={() => setErrorMsg('')}>Cerrar</button>
        </div>
      )}

      <div role="tabpanel" aria-labelledby={`personas-tab-${personaRoleFilter}`}>
        {personaRoleFilter === 'providers' ? (
          <Suspense fallback={null}>
            <ComprasDashboard initialSubTab="proveedores" refreshKey={clientsVersion} onProvidersChanged={onProvidersChanged} />
          </Suspense>
        ) : personaRoleFilter === 'employees' && isAdmin ? (
          <Suspense fallback={null}>
            <EmployeesTab />
          </Suspense>
        ) : personaRoleFilter === 'debtors_by_city' ? (
          <DebtorsByCityReportView
            debtorsReport={debtorsReport} availableCities={availableCities} selectedCities={selectedCities} setSelectedCities={setSelectedCities}
            availableSellers={availableSellers} selectedSellerFilter={selectedSellerFilter} setSelectedSellerFilter={setSelectedSellerFilter}
            selectedBranchFilter={selectedBranchFilter} setSelectedBranchFilter={setSelectedBranchFilter}
            setShowResumenModal={setShowResumenModal} setPaymentModal={setPaymentModal}
          />
        ) : personaRoleFilter === 'sale_routes' ? (
          <SaleRoutesDashboard />
        ) : (
          <>
            <div className="actions-bar" style={{ display: 'flex', gap: '10px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'flex-start' }}>
              <search className="search-input-wrapper" style={{ flex: '1 1 220px', maxWidth: '340px', minWidth: '200px' }}>
                <label htmlFor="clients-search" className="sr-only">Buscar</label>
                <input id="clients-search" type="text" className="input" placeholder="Buscar..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} autoCorrect="off" autoCapitalize="none" spellCheck={false} />
              </search>

              <select aria-label="Filtrar por localidad" className="select" value={selectedCityFilter} onChange={(e) => setSelectedCityFilter(e.target.value)} style={{ width: 'auto', minWidth: '170px', height: '38px' }}>
                <option value="ALL">Localidades ({cityCounts.ALL || 0})</option>
                {cityOptions.map((city) => (<option key={city} value={city}>{city} ({cityCounts[city] || 0})</option>))}
                {(cityCounts.OTRAS || 0) > 0 && <option value="OTRAS">OTRAS ({cityCounts.OTRAS})</option>}
              </select>

              {personaRoleFilter === 'client' && (
                <select aria-label="Filtrar por ruta" className="select" value={selectedRouteFilter} onChange={(e) => setSelectedRouteFilter(e.target.value)} style={{ width: 'auto', minWidth: '170px', height: '38px' }}>
                  <option value="ALL">Rutas ({routeCounts.ALL || 0})</option>
                  {availableSaleRoutes.map((route) => (<option key={route.id} value={route.id}>{route.name} ({routeCounts[route.id] || 0})</option>))}
                  <option value="SIN_RUTA">Sin ruta ({routeCounts.SIN_RUTA || 0})</option>
                </select>
              )}

              {personaRoleFilter === 'client' && (
                <select aria-label="Filtrar por vendedor" className="select" value={selectedClientSellerFilter} onChange={(e) => setSelectedClientSellerFilter(e.target.value)} style={{ width: 'auto', minWidth: '170px', height: '38px' }}>
                  <option value="ALL">Vendedores ({sellerCounts.ALL || 0})</option>
                  {availableSellers.map((seller) => (<option key={seller.id} value={seller.id}>{(seller.username || seller.name || '').replace(/_/g, ' ').toUpperCase()} ({sellerCounts[seller.id] || 0})</option>))}
                  <option value="SIN_VENDEDOR">SIN VENDEDOR ({sellerCounts.SIN_VENDEDOR || 0})</option>
                </select>
              )}

              <div className="tabular-nums" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '0 12px', height: '38px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '6px', fontSize: '0.84rem', whiteSpace: 'nowrap' }}>
                <span style={{ color: '#64748b', fontWeight: 500 }}>{isLocationFiltered ? 'Filtrados' : 'Total'}</span>
                <span style={{ fontWeight: 700, fontSize: '0.95rem', color: '#0f172a' }}>{filteredClients.length.toLocaleString('es-AR')}</span>
              </div>

              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '12px', marginLeft: 'auto' }}>
                {personaRoleFilter === 'client' && (
                  <label htmlFor="clients-show-inactive" style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '6px', whiteSpace: 'nowrap' }}>
                    <input id="clients-show-inactive" type="checkbox" checked={showInactive} onChange={(e) => setShowInactive(e.target.checked)} style={{ width: '16px', height: '16px', cursor: 'pointer' }} />
                    <span>Inactivos</span>
                  </label>
                )}

                <button type="button" className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} onClick={() => setClientModal({ open: true, mode: 'create', data: buildEmptyPersonaDraft(personaRoleFilter, showInactive) })}>
                  <UserPlus size={16} />
                  <span>Nuevo {personaRoleFilter === 'client' ? 'cliente' : personaRoleFilter === 'provider' ? 'proveedor' : personaRoleFilter === 'seller' ? 'vendedor' : 'comisionista'}</span>
                </button>
              </div>
            </div>

            <ClientsPersonasTable
              visibleClients={visibleClients} filteredCount={filteredClients.length} totalClientsCount={activePersonas.length}
              personaRoleFilter={personaRoleFilter} isLocationFiltered={isLocationFiltered} updatingClientId={updatingClientId}
              hasMoreRows={hasMoreRows} onLoadMore={handleLoadMore} onShowAll={handleShowAll} onUpdateCtaCte={handleUpdateCtaCte}
              onViewClientProfile={handleViewClientProfile} onViewSellerProfile={handleViewSellerProfile}
              onShowResumenModal={setShowResumenModal} onDeletePersona={handleDeletePersona} onResetFilters={handleResetFilters}
            />
          </>
        )}
      </div>

      <ClientsGpsMapModal
        isOpen={isGpsMapOpen} clients={filteredClients} activeFilterLabel={selectedCityFilter !== 'ALL' ? selectedCityFilter : 'Clientes'}
        onClose={() => setIsGpsMapOpen(false)} onSelectClient={(client) => { setIsGpsMapOpen(false); handleViewClientProfile(client); }}
      />
    </div>
  );
}
