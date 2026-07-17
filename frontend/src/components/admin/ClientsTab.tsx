import React, { useState, useEffect, useMemo } from 'react';
import { api } from '../../utils/api';
import { UserPlus, Printer, Search } from 'lucide-react';
import SaleRoutesDashboard from '../SaleRoutesDashboard';

interface ClientsTabProps {
  setActiveTab: (tab: string) => void;
  setClientModal: (modal: any) => void;
  setShowResumenModal: (client: any) => void;
  setPaymentModal: (modal: any) => void;
  handleViewClientProfile: (client: any) => void;
  clientsVersion?: number;
}

const OFFICIAL_CITIES = [
  "GENERAL VILLEGAS",
  "EMILIO V. BUNGE",
  "BANDERALÓ",
  "BERNARDO LARROUDÉ",
  "PIEDRITAS",
  "CORONEL CHARLONE",
  "BUCHARDO",
  "TRES ALGARROBOS",
  "CARLOS TEJEDOR",
  "FLORENTINO AMEGHINO",
  "BLAQUIER",
  "RIVADAVIA",
  "FORTÍN OLAVARRÍA",
  "INTENDENTE ALVEAR",
  "RUFINO",
  "CEBALLOS",
  "REALICÓ",
  "VILLA SAUZE",
  "SANSINENA",
  "SANTA ELEODORA",
  "SANTA REGINA",
  "VILLA SABOYA",
  "CAÑADA SECA",
  "CABA"
];

const normalizeString = (str: string | null | undefined): string => {
  if (!str) return '';
  return str
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
};

export default function ClientsTab({
  setActiveTab,
  setClientModal,
  setShowResumenModal,
  setPaymentModal,
  handleViewClientProfile,
  clientsVersion
}: ClientsTabProps) {
  // Local tab state
  const [personaRoleFilter, setPersonaRoleFilter] = useState<string>('client');
  const [clients, setClients] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCityFilter, setSelectedCityFilter] = useState<string>('ALL');

  // Debtors report state
  const [debtorsReport, setDebtorsReport] = useState<any[]>([]);
  const [availableCities, setAvailableCities] = useState<string[]>([]);
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [showCityDropdown, setShowCityDropdown] = useState<boolean>(false);
  const [citySearchQuery, setCitySearchQuery] = useState<string>('');
  const [selectedSellerFilter, setSelectedSellerFilter] = useState<string>('ALL');
  const [selectedBranchFilter, setSelectedBranchFilter] = useState<string>('ALL');
  const [availableSellers, setAvailableSellers] = useState<any[]>([]);
  const [availableSaleRoutes, setAvailableSaleRoutes] = useState<any[]>([]);

  // Load clients or debtors report
  const loadTabContent = async () => {
    setLoading(true);
    try {
      if (personaRoleFilter === 'debtors_by_city') {
        const report = await api.getDebtorsReport();
        setDebtorsReport(report.debtors || []);
        const cities = [...(report.availableCities || [])] as string[];
        const sortedCities = cities.sort();
        setAvailableCities(sortedCities);
        setSelectedCities(sortedCities);
      } else {
        const roleParam = personaRoleFilter === 'client_inactive' ? 'client' : personaRoleFilter;
        const data = await api.getPersonas(roleParam, searchQuery);
        setClients(data || []);
      }
    } catch (err) {
      console.error('Error loading clients tab data:', err);
    } finally {
      setLoading(false);
    }
  };

  // Fetch lists for sellers/routes
  useEffect(() => {
    const fetchMetadata = async () => {
      try {
        const sellers = await api.getSellersList();
        setAvailableSellers(sellers || []);
        const routesRes = await api.getSaleRoutes();
        setAvailableSaleRoutes(routesRes.routes || []);
      } catch (e) {
        console.error('Error fetching presale data:', e);
      }
    };
    fetchMetadata();
  }, []);

  useEffect(() => {
    loadTabContent();
  }, [personaRoleFilter, searchQuery, clientsVersion]);

  const getWhatsAppLink = (phone: string) => {
    const cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone) return '';
    const formatted = cleanPhone.startsWith('54') ? cleanPhone : `549${cleanPhone}`;
    return `https://wa.me/${formatted}`;
  };

  const handlePrintDebtorsReport = () => {
    window.print();
  };

  return (
    <div>
      {/* Filtros de roles */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
        {[
          { id: 'client', label: 'Clientes' },
          { id: 'client_inactive', label: 'Clientes Inactivos' },
          { id: 'seller', label: 'Vendedores' },
          { id: 'commission_agent', label: 'Comisionistas' },
          { id: 'debtors_by_city', label: '📊 Deudores por Ruta' },
          { id: 'sale_routes', label: 'Rutas de Preventa' }
        ].map((tab) => (
          <button
            key={tab.id}
            className={`btn ${personaRoleFilter === tab.id ? 'btn-primary' : 'btn-secondary'}`}
            style={{ padding: '6px 14px', fontSize: '0.82rem', borderRadius: '20px' }}
            onClick={() => { 
              setPersonaRoleFilter(tab.id); 
              setClients([]); 
              setSelectedCityFilter('ALL'); 
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {personaRoleFilter === 'debtors_by_city' ? (
        <div>
          {/* Reporte de Deudores por Localidad */}
          <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
              <div>
                <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Resumen de Deudores por Localidad</h3>
                <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
                  Planilla de deudores agrupados por localidad y desglosados por sucursales.
                </p>
              </div>
              <button className="btn btn-primary" onClick={handlePrintDebtorsReport}>
                <Printer size={16} />
                <span style={{ marginLeft: '6px' }}>Imprimir Planilla</span>
              </button>
            </div>

            {/* Filtros de Localidad (Multi-select) y Sucursal */}
            <div style={{ 
              display: 'flex', 
              gap: '12px', 
              marginBottom: '24px', 
              padding: '16px', 
              backgroundColor: 'var(--bg-light, #f8f9fa)', 
              borderRadius: '8px', 
              border: '1px solid var(--border-color, #e5e5e7)',
              flexWrap: 'wrap'
            }}>
              {/* Multi-select Dropdown de Localidades */}
              <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrar Localidades (Multi-selección)</label>
                <button 
                  type="button"
                  className="input" 
                  onClick={() => setShowCityDropdown(!showCityDropdown)}
                  style={{ 
                    textAlign: 'left', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    padding: '8px 12px',
                    backgroundColor: '#fff',
                    cursor: 'pointer',
                    minHeight: '38px',
                    border: '1px solid var(--border-color, #e5e5e7)'
                  }}
                >
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
                    {selectedCities.length === availableCities.length 
                      ? 'Todas las localidades' 
                      : selectedCities.length === 0 
                        ? 'Ninguna seleccionada' 
                        : `${selectedCities.length} seleccionada(s)`}
                  </span>
                  <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>▼</span>
                </button>

                {showCityDropdown && (
                  <div style={{ 
                    position: 'absolute', 
                    top: '100%', 
                    left: 0, 
                    right: 0, 
                    backgroundColor: '#fff', 
                    border: '1px solid var(--border-color, #e5e5e7)', 
                    borderRadius: '8px', 
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)', 
                    zIndex: 100, 
                    marginTop: '4px',
                    padding: '12px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '8px'
                  }}>
                    <input 
                      type="text" 
                      className="input" 
                      placeholder="Buscar localidad..." 
                      value={citySearchQuery} 
                      onChange={(e) => setCitySearchQuery(e.target.value)}
                      style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                      onClick={(e) => e.stopPropagation()}
                    />

                    <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color, #e5e5e7)', paddingBottom: '8px' }}>
                      <button 
                        type="button"
                        className="btn btn-ghost" 
                        style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 1 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCities(availableCities);
                        }}
                      >
                        Seleccionar todas
                      </button>
                      <button 
                        type="button"
                        className="btn btn-ghost" 
                        style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 1 }}
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelectedCities([]);
                        }}
                      >
                        Deseleccionar todas
                      </button>
                    </div>

                    <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {availableCities
                        .filter(c => c.toLowerCase().includes(citySearchQuery.toLowerCase()))
                        .map(city => {
                          const isChecked = selectedCities.includes(city);
                          return (
                            <label 
                              key={city} 
                              style={{ 
                                display: 'flex', 
                                alignItems: 'center', 
                                gap: '8px', 
                                fontSize: '0.82rem', 
                                cursor: 'pointer',
                                padding: '4px 0',
                                userSelect: 'none'
                              }}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input 
                                type="checkbox" 
                                checked={isChecked}
                                onChange={() => {
                                  if (isChecked) {
                                    setSelectedCities(selectedCities.filter(c => c !== city));
                                  } else {
                                    setSelectedCities([...selectedCities, city]);
                                  }
                                }}
                                style={{ width: '14px', height: '14px' }}
                              />
                              <span>{city}</span>
                            </label>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrar por Vendedor</label>
                <select 
                  className="input" 
                  value={selectedSellerFilter} 
                  onChange={(e) => setSelectedSellerFilter(e.target.value)}
                  style={{ padding: '8px 12px' }}
                >
                  <option value="ALL">Todos los Vendedores</option>
                  {availableSellers.map(s => (
                    <option key={s.id} value={s.id.toString()}>{s.username.replace('_', ' ').toUpperCase()}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrar por Sucursal con Deuda</label>
                <select 
                  className="input" 
                  value={selectedBranchFilter} 
                  onChange={(e) => setSelectedBranchFilter(e.target.value)}
                  style={{ padding: '8px 12px' }}
                >
                  <option value="ALL">Todas las Sucursales</option>
                  <option value="A">Sucursal A (Oficial)</option>
                  <option value="X">Sucursal X (Interno)</option>
                </select>
              </div>
            </div>

            {(() => {
              const filteredDebtors = debtorsReport.filter(d => {
                const matchesCity = selectedCities.includes(d.city || 'Sin Localidad');
                let matchesBranch = true;
                if (selectedBranchFilter === 'A') {
                  matchesBranch = d.debtA > 0;
                } else if (selectedBranchFilter === 'X') {
                  matchesBranch = d.debtX > 0;
                }
                let matchesSeller = true;
                if (selectedSellerFilter !== 'ALL') {
                  matchesSeller = d.sellerId?.toString() === selectedSellerFilter;
                }
                return matchesCity && matchesBranch && matchesSeller;
              });

              const totalA = filteredDebtors.reduce((acc, d) => acc + d.debtA, 0);
              const totalX = filteredDebtors.reduce((acc, d) => acc + d.debtX, 0);
              const totalConsolidado = filteredDebtors.reduce((acc, d) => acc + d.outstandingBalance, 0);

              if (filteredDebtors.length === 0) {
                return <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No se encontraron deudores con los filtros seleccionados.</div>;
              }

              const groups: { [key: string]: typeof debtorsReport } = {};
              filteredDebtors.forEach(d => {
                const city = d.city || 'Sin Localidad';
                if (!groups[city]) groups[city] = [];
                groups[city].push(d);
              });

              return (
                <div>
                  <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
                    <div className="card stat-card" style={{ borderLeft: '4px solid var(--text-secondary, #606060)', padding: '16px' }}>
                      <div className="stat-label">Clientes en Mora</div>
                      <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 700 }}>{filteredDebtors.length}</div>
                      <div className="stat-desc" style={{ fontSize: '0.78rem' }}>Con saldo deudor activo</div>
                    </div>
                    <div className="card stat-card" style={{ borderLeft: '4px solid #137333', padding: '16px' }}>
                      <div className="stat-label">Deuda Sucursal A (Oficial)</div>
                      <div className="stat-value" style={{ color: '#137333', fontSize: '1.5rem', fontWeight: 700 }}>${totalA.toLocaleString('es-AR')}</div>
                      <div className="stat-desc" style={{ fontSize: '0.78rem' }}>Total facturado oficial</div>
                    </div>
                    <div className="card stat-card" style={{ borderLeft: '4px solid #3c4043', padding: '16px' }}>
                      <div className="stat-label">Deuda Sucursal X (Interno)</div>
                      <div className="stat-value" style={{ color: '#3c4043', fontSize: '1.5rem', fontWeight: 700 }}>${totalX.toLocaleString('es-AR')}</div>
                      <div className="stat-desc" style={{ fontSize: '0.78rem' }}>Total presupuestos internos</div>
                    </div>
                    <div className="card stat-card" style={{ borderLeft: '4px solid #E30613', padding: '16px' }}>
                      <div className="stat-label">Total Consolidado</div>
                      <div className="stat-value" style={{ color: '#E30613', fontSize: '1.5rem', fontWeight: 700 }}>${totalConsolidado.toLocaleString('es-AR')}</div>
                      <div className="stat-desc" style={{ fontSize: '0.78rem' }}>Saldo total a cobrar</div>
                    </div>
                  </div>

                  {Object.keys(groups).sort().map(city => (
                    <div key={city} style={{ marginBottom: '28px' }}>
                      <div style={{ 
                        fontSize: '0.92rem', 
                        fontWeight: 700, 
                        padding: '10px 14px', 
                        backgroundColor: 'var(--bg-light, #f8f9fa)', 
                        borderLeft: '4px solid var(--accent-color, #E30613)',
                        borderRadius: '0 6px 6px 0',
                        marginBottom: '12px',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        border: '1px solid var(--border-color, #e5e5e7)',
                        borderLeftWidth: '4px'
                      }}>
                        <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>📍 Localidad: {city}</span>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                          Total Localidad: <strong>${groups[city].reduce((acc, d) => acc + d.outstandingBalance, 0).toLocaleString('es-AR')}</strong>
                        </span>
                      </div>
                      <div className="table-container" style={{ marginTop: '0', border: 'none', boxShadow: 'none' }}>
                        <table style={{ width: '100%' }}>
                          <thead>
                            <tr>
                              <th style={{ width: '25%' }}>Cliente</th>
                              <th style={{ width: '15%' }}>Ruta de Reparto</th>
                              <th style={{ width: '15%', textAlign: 'right' }}>Suc. A (Oficial)</th>
                              <th style={{ width: '15%', textAlign: 'right' }}>Suc. X (Interno)</th>
                              <th style={{ width: '15%', textAlign: 'right' }}>Saldo Total</th>
                              <th style={{ width: '15%', textAlign: 'center' }}>Acciones</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groups[city].map(d => {
                              const encodedMsg = encodeURIComponent(
                                `Estimado/a ${d.name}, le escribimos de Distribuidora DV para recordarle su saldo deudor pendiente de $${d.outstandingBalance.toLocaleString('es-AR')}. (Sucursal A: $${d.debtA.toLocaleString('es-AR')}, Sucursal X: $${d.debtX.toLocaleString('es-AR')}). Muchas gracias.`
                              );
                              const waLink = d.phone ? `https://wa.me/${d.phone.replace(/\D/g, '')}?text=${encodedMsg}` : null;

                              return (
                                <tr key={d.id}>
                                  <td>
                                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                                      <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{d.name}</span>
                                      <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
                                        {d.address || 'Sin Dirección'}
                                      </span>
                                      {d.hasMultiplePendingInvoices && (
                                        <span style={{ 
                                          display: 'inline-flex', 
                                          alignItems: 'center', 
                                          alignSelf: 'flex-start',
                                          gap: '4px', 
                                          fontSize: '0.72rem', 
                                          backgroundColor: '#FCE8E6', 
                                          color: '#C5221F', 
                                          padding: '2px 8px', 
                                          borderRadius: '12px', 
                                          fontWeight: 600, 
                                          marginTop: '4px' 
                                        }}>
                                          ⚠️ Debe {d.pendingInvoicesCount} boletas
                                        </span>
                                      )}
                                    </div>
                                  </td>
                                  <td>
                                    {d.route ? (
                                      <span style={{ 
                                        display: 'inline-block', 
                                        padding: '3px 8px', 
                                        fontSize: '0.72rem', 
                                        fontWeight: 600, 
                                        backgroundColor: 'rgba(0,0,0,0.05)', 
                                        color: 'var(--text-primary)', 
                                        borderRadius: '4px',
                                        textTransform: 'uppercase'
                                      }}>
                                        📍 {d.route}
                                      </span>
                                    ) : (
                                      <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Sin Ruta</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 500, color: d.debtA > 0 ? '#137333' : 'var(--text-secondary)' }}>
                                    {d.debtA > 0 ? `$${Math.round(d.debtA).toLocaleString('es-AR')}` : '-'}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 500, color: d.debtX > 0 ? '#3c4043' : 'var(--text-secondary)' }}>
                                    {d.debtX > 0 ? `$${Math.round(d.debtX).toLocaleString('es-AR')}` : '-'}
                                  </td>
                                  <td style={{ textAlign: 'right', fontWeight: 700, color: '#E30613' }}>
                                    ${Math.round(d.outstandingBalance).toLocaleString('es-AR')}
                                  </td>
                                  <td>
                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                                      {waLink && (
                                        <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: '6px', borderRadius: '4px' }} title="Escribir por WhatsApp">
                                          <svg viewBox="0 0 24 24" width="16" height="16" fill="#25D366">
                                            <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                                          </svg>
                                        </a>
                                      )}
                                      <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }} onClick={() => setShowResumenModal(d)}>Resumen de cuenta</button>
                                      <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#137333' }} onClick={() => setPaymentModal({ open: true, clientId: d.id, clientName: d.name })}>Cobrar</button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>
              );
            })()}
          </div>
        </div>
      ) : personaRoleFilter === 'sale_routes' ? (
        <SaleRoutesDashboard />
      ) : (
        <>
          <div className="actions-bar" style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
            <div className="search-input-wrapper" style={{ flex: 1, minWidth: '240px', position: 'relative' }}>
              <input
                type="text"
                className="input"
                placeholder="Buscar por nombre, CUIT, localidad..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <select
              className="select"
              value={selectedCityFilter}
              onChange={(e) => setSelectedCityFilter(e.target.value)}
              style={{ minWidth: '180px', height: '38px' }}
            >
              <option value="ALL">Todas las Localidades</option>
              {OFFICIAL_CITIES.map((city) => (
                <option key={city} value={city}>{city}</option>
              ))}
              <option value="OTRAS">Otras</option>
            </select>

            <button className="btn btn-primary" onClick={() => setClientModal({ 
              open: true, 
              mode: 'create', 
              data: { 
                id: 0, 
                name: '', 
                cuit: '', 
                address: '', 
                city: '',
                phone: '', 
                email: '', 
                creditLimit: 0, 
                priceList: 'A', 
                discount: 0,
                isClient: ['client', 'client_inactive'].includes(personaRoleFilter),
                isProvider: personaRoleFilter === 'provider',
                isSeller: personaRoleFilter === 'seller',
                isCommissionAgent: personaRoleFilter === 'commission_agent',
                route: '',
                saleRouteId: null,
                sellerId: null,
                isActive: personaRoleFilter !== 'client_inactive'
              } 
            })}>
              <UserPlus size={16} />
              <span>Registrar {['client', 'client_inactive'].includes(personaRoleFilter) ? 'Cliente' : personaRoleFilter === 'provider' ? 'Proveedor' : personaRoleFilter === 'seller' ? 'Vendedor' : 'Comisionista'}</span>
            </button>
          </div>

          <div className="table-container">
            <table>
              <thead>
                <tr>
                  <th>Nombre Comercial / Razón Social</th>
                  <th>CUIT</th>
                  <th>Contacto</th>
                  <th>Saldo C/C</th>
                  {['client', 'client_inactive'].includes(personaRoleFilter) && <th>Ruta</th>}
                  <th>Acción</th>
                </tr>
              </thead>
              <tbody>
                {(() => {
                  const filteredClients = clients.filter((c: any) => {
                    if (personaRoleFilter === 'client' && c.isActive === false) return false;
                    if (personaRoleFilter === 'client_inactive' && c.isActive !== false) return false;

                    if (selectedCityFilter === 'ALL') return true;
                    const normCity = normalizeString(c.city);
                    const normSelectedFilter = normalizeString(selectedCityFilter);
                    if (selectedCityFilter === 'OTRAS') {
                      return !c.city || !OFFICIAL_CITIES.map(o => normalizeString(o)).includes(normCity);
                    }
                    return normCity === normSelectedFilter;
                  });

                  if (filteredClients.length === 0) {
                    return (
                      <tr>
                        <td colSpan={['client', 'client_inactive'].includes(personaRoleFilter) ? 6 : 5} style={{ textAlign: 'center', padding: '24px 0' }}>
                          No se encontraron personas registradas.
                        </td>
                      </tr>
                    );
                  }

                  return filteredClients.map((c) => {
                    const balance = Number(c.outstandingBalance || 0);
                    let balanceText = '';
                    let balanceColor = 'var(--text-secondary)';
                    
                    if (balance > 0) {
                      balanceText = `Saldo Deudor: $${balance.toLocaleString()}`;
                      balanceColor = 'var(--color-danger)';
                    } else if (balance < 0) {
                      balanceText = `A Favor: $${Math.abs(balance).toLocaleString()}`;
                      balanceColor = 'var(--color-success)';
                    } else {
                      balanceText = '$0';
                    }

                    return (
                      <tr key={c.id}>
                        <td>
                          <div style={{ fontWeight: 600 }}>{c.name}</div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                            <span>{c.address || 'Sin dirección'}</span>
                          </div>
                        </td>
                        <td style={{ fontFamily: 'monospace', whiteSpace: 'nowrap' }}>{c.cuit || ''}</td>
                        <td>
                          {c.phone && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <span>{c.phone}</span>
                              <a 
                                href={getWhatsAppLink(c.phone)} 
                                target="_blank" 
                                rel="noopener noreferrer"
                                title="Enviar mensaje de WhatsApp"
                                style={{ display: 'inline-flex', alignItems: 'center' }}
                              >
                                <svg viewBox="0 0 24 24" width="14" height="14" fill="#25D366">
                                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.513 2.262 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.863-9.755.002-2.61-1.01-5.063-2.85-6.908-1.839-1.844-4.286-2.86-6.903-2.861-5.441 0-9.863 4.37-9.866 9.756-.001 1.748.469 3.456 1.36 5.01L1.932 20.17l4.715-1.016zM17.47 15.3c-.3-.15-1.775-.875-2.05-1.05-.275-.1-.475-.15-.675.15-.2.3-.775 1.05-.95 1.25-.175.2-.35.225-.65.075-.3-.15-1.263-.465-2.403-1.485-.888-.795-1.487-1.77-1.663-2.07-.176-.3-.019-.462.13-.61.135-.133.3-.35.45-.525.15-.175.2-.3.3-.5.1-.2.05-.375-.025-.525-.075-.15-.675-1.625-.925-2.225-.244-.589-.491-.51-.675-.52-.175-.01-.375-.01-.575-.01-.2 0-.525.075-.8 1.05-.275.975-1.05 2.1-1.275 2.55-.225.45-.05.875.1 1.05.887 1.02 2.222 1.944 3.9 2.52.27.093.536.14.79.165.37.037.706.024.97-.015.295-.044.875-.36 1 .71.125.35.125.65.063.8-.062.15-.325.29-1 .15z"/>
                                </svg>
                              </a>
                            </div>
                          )}
                          {c.email && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{c.email}</div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600, color: balanceColor }}>{balanceText}</td>
                        {['client', 'client_inactive'].includes(personaRoleFilter) && (
                          <td style={{ fontWeight: 500 }}>
                            {c.saleRoute?.name ? (
                              <span style={{ 
                                display: 'inline-block', 
                                padding: '3px 8px', 
                                fontSize: '0.75rem', 
                                fontWeight: 600, 
                                backgroundColor: 'rgba(0,0,0,0.05)', 
                                color: 'var(--text-primary)', 
                                borderRadius: '4px',
                                textTransform: 'uppercase'
                              }}>
                                📍 {c.saleRoute.name}
                              </span>
                            ) : c.route ? (
                              <span style={{ 
                                display: 'inline-block', 
                                padding: '3px 8px', 
                                fontSize: '0.75rem', 
                                fontWeight: 600, 
                                backgroundColor: 'rgba(0,0,0,0.03)', 
                                color: 'var(--text-secondary)', 
                                borderRadius: '4px',
                                textTransform: 'uppercase'
                              }}>
                                🚛 {c.route}
                              </span>
                            ) : (
                              <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Sin Ruta</span>
                            )}
                          </td>
                        )}
                        <td>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => handleViewClientProfile(c)}>
                              Ver Ficha
                            </button>
                            <button className="btn btn-secondary" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => setShowResumenModal(c)}>
                              Resumen de Cta
                            </button>

                            <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={() => setClientModal({ 
                              open: true, 
                              mode: 'edit', 
                              data: { 
                                id: c.id, 
                                name: c.name, 
                                cuit: c.cuit || '', 
                                address: c.address || '', 
                                city: c.city || '',
                                phone: c.phone || '', 
                                email: c.email || '', 
                                creditLimit: c.creditLimit ? Number(c.creditLimit) : 0, 
                                priceList: c.priceList || 'A', 
                                discount: c.discount ? Number(c.discount) : 0,
                                isClient: !!c.isClient,
                                isProvider: !!c.isProvider,
                                isSeller: !!c.isSeller,
                                isCommissionAgent: !!c.isCommissionAgent,
                                route: c.route || '',
                                saleRouteId: c.saleRouteId || null,
                                sellerId: c.sellerId || null,
                                isActive: c.isActive !== false
                              } 
                            })}>
                              Editar
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  });
                })()}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
