import React, { useState } from 'react';
import { Printer, MessageCircle, ChevronDown } from 'lucide-react';
import { DebtorsPrintSheet } from './DebtorsPrintSheet';

interface DebtorsByCityReportViewProps {
  debtorsReport: any[];
  availableCities: string[];
  selectedCities: string[];
  setSelectedCities: (cities: string[]) => void;
  availableSellers: any[];
  selectedSellerFilter: string;
  setSelectedSellerFilter: (s: string) => void;
  selectedBranchFilter: string;
  setSelectedBranchFilter: (b: string) => void;
  setShowResumenModal: (client: any) => void;
  setPaymentModal: (modal: any) => void;
}

export const DebtorsByCityReportView: React.FC<DebtorsByCityReportViewProps> = ({
  debtorsReport, availableCities, selectedCities, setSelectedCities,
  availableSellers, selectedSellerFilter, setSelectedSellerFilter,
  selectedBranchFilter, setSelectedBranchFilter, setShowResumenModal, setPaymentModal,
}) => {
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  const [citySearchQuery, setCitySearchQuery] = useState('');

  const filteredDebtors = debtorsReport.filter((d) => {
    const matchesCity = selectedCities.includes(d.city || 'Sin Localidad');
    const matchesBranch = selectedBranchFilter === 'A' ? d.debtA > 0 : selectedBranchFilter === 'X' ? d.debtX > 0 : true;
    const matchesSeller = selectedSellerFilter !== 'ALL' ? d.sellerId?.toString() === selectedSellerFilter : true;
    return matchesCity && matchesBranch && matchesSeller;
  });

  const totalA = filteredDebtors.reduce((acc, d) => acc + d.debtA, 0);
  const totalX = filteredDebtors.reduce((acc, d) => acc + d.debtX, 0);
  const totalConsolidado = filteredDebtors.reduce((acc, d) => acc + d.outstandingBalance, 0);

  const groups: Record<string, any[]> = {};
  filteredDebtors.forEach((d) => {
    const city = d.city || 'Sin Localidad';
    if (!groups[city]) groups[city] = [];
    groups[city].push(d);
  });

  const selectedSellerObj = availableSellers.find((s) => s.id.toString() === selectedSellerFilter);
  const sellerLabel = selectedSellerFilter === 'ALL'
    ? 'Todos'
    : (selectedSellerObj?.username?.replace('_', ' ').toUpperCase() || selectedSellerFilter);

  return (
    <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <h3 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>Deudores por localidad</h3>
        <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
          <Printer size={16} />
          <span>Imprimir</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '20px', padding: '14px', backgroundColor: '#f8fafc', borderRadius: '8px', border: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 280px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
          <label htmlFor="debtors-cities-btn" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Localidades</label>
          <button
            id="debtors-cities-btn"
            type="button"
            className="input"
            aria-expanded={showCityDropdown}
            onClick={() => setShowCityDropdown(!showCityDropdown)}
            style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#fff', cursor: 'pointer', minHeight: '38px' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
              {selectedCities.length === availableCities.length ? 'Todas' : selectedCities.length === 0 ? 'Ninguna' : `${selectedCities.length} seleccionadas`}
            </span>
            <ChevronDown size={14} color="#64748b" />
          </button>

          {showCityDropdown && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, marginTop: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <search>
                <label htmlFor="debtors-city-search" className="sr-only">Buscar localidad</label>
                <input
                  id="debtors-city-search"
                  type="text"
                  className="input"
                  placeholder="Filtrar localidades"
                  value={citySearchQuery}
                  onChange={(e) => setCitySearchQuery(e.target.value)}
                  style={{ padding: '6px 10px', fontSize: '0.8rem' }}
                  onClick={(e) => e.stopPropagation()}
                  autoCorrect="off"
                  autoCapitalize="none"
                  spellCheck={false}
                />
              </search>
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 1 }} onClick={(e) => { e.stopPropagation(); setSelectedCities(availableCities); }}>Todas</button>
                <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 1 }} onClick={(e) => { e.stopPropagation(); setSelectedCities([]); }}>Ninguna</button>
              </div>
              <div style={{ maxHeight: '200px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {availableCities.filter((c) => c.toLowerCase().includes(citySearchQuery.toLowerCase())).map((city) => {
                  const isChecked = selectedCities.includes(city);
                  return (
                    <label key={city} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.82rem', cursor: 'pointer', padding: '4px 0', userSelect: 'none' }} onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={isChecked} onChange={() => setSelectedCities(isChecked ? selectedCities.filter((c) => c !== city) : [...selectedCities, city])} style={{ width: '14px', height: '14px' }} />
                      <span>{city}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: '1 1 190px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="debtors-seller-filter" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Vendedor</label>
          <select id="debtors-seller-filter" className="input" value={selectedSellerFilter} onChange={(e) => setSelectedSellerFilter(e.target.value)} style={{ padding: '8px 12px' }}>
            <option value="ALL">Todos</option>
            {availableSellers.map((s) => (<option key={s.id} value={s.id.toString()}>{s.username.replace('_', ' ').toUpperCase()}</option>))}
          </select>
        </div>

        <div style={{ flex: '1 1 190px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label htmlFor="debtors-branch-filter" style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Sucursal</label>
          <select id="debtors-branch-filter" className="input" value={selectedBranchFilter} onChange={(e) => setSelectedBranchFilter(e.target.value)} style={{ padding: '8px 12px' }}>
            <option value="ALL">Todas</option>
            <option value="A">Sucursal A</option>
            <option value="X">Sucursal X</option>
          </select>
        </div>
      </div>

      {filteredDebtors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>Sin deudores</div>
      ) : (
        <div>
          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '20px' }}>
            <div className="card stat-card" style={{ padding: '14px 16px' }}>
              <div className="stat-label">Clientes</div>
              <div className="stat-value tabular-nums" style={{ fontSize: '1.35rem', fontWeight: 700 }}>{filteredDebtors.length}</div>
            </div>
            <div className="card stat-card" style={{ padding: '14px 16px' }}>
              <div className="stat-label">Sucursal A</div>
              <div className="stat-value tabular-nums" style={{ color: '#0f172a', fontSize: '1.35rem', fontWeight: 700 }}>${Math.round(totalA).toLocaleString('es-AR')}</div>
            </div>
            <div className="card stat-card" style={{ padding: '14px 16px' }}>
              <div className="stat-label">Sucursal X</div>
              <div className="stat-value tabular-nums" style={{ color: '#334155', fontSize: '1.35rem', fontWeight: 700 }}>${Math.round(totalX).toLocaleString('es-AR')}</div>
            </div>
            <div className="card stat-card" style={{ padding: '14px 16px' }}>
              <div className="stat-label">Total</div>
              <div className="stat-value tabular-nums" style={{ color: 'var(--color-corp-red)', fontSize: '1.35rem', fontWeight: 700 }}>${Math.round(totalConsolidado).toLocaleString('es-AR')}</div>
            </div>
          </div>

          {Object.keys(groups).sort().map((city) => {
            const cityTotal = groups[city].reduce((acc, d) => acc + d.outstandingBalance, 0);
            return (
              <div key={city} style={{ marginBottom: '24px' }}>
                <div style={{ fontSize: '0.9rem', fontWeight: 700, padding: '10px 14px', backgroundColor: '#f8fafc', borderRadius: '6px', marginBottom: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)' }}>
                  <span>{city}</span>
                  <span className="tabular-nums" style={{ fontSize: '0.88rem', color: '#0f172a' }}>${Math.round(cityTotal).toLocaleString('es-AR')}</span>
                </div>
                <div className="table-container table-container--sticky" role="region" aria-label={`Deudores en ${city}`} tabIndex={0} style={{ marginTop: '0' }}>
                  <table style={{ width: '100%' }}>
                    <thead>
                      <tr>
                        <th scope="col" style={{ width: '28%' }}>Cliente</th>
                        <th scope="col" style={{ width: '16%' }}>Ruta</th>
                        <th scope="col" style={{ width: '14%', textAlign: 'right' }}>Suc. A</th>
                        <th scope="col" style={{ width: '14%', textAlign: 'right' }}>Suc. X</th>
                        <th scope="col" style={{ width: '14%', textAlign: 'right' }}>Saldo</th>
                        <th scope="col" style={{ width: '14%', textAlign: 'center' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {groups[city].map((d) => {
                        const encodedMsg = encodeURIComponent(`Estimado/a ${d.name}, le escribimos de Distribuidora DV para recordarle su saldo deudor pendiente de $${Math.round(d.outstandingBalance).toLocaleString('es-AR')}. Muchas gracias.`);
                        const waLink = d.phone ? `https://wa.me/${d.phone.replace(/\D/g, '')}?text=${encodedMsg}` : null;
                        return (
                          <tr key={d.id}>
                            <td>
                              <div style={{ display: 'flex', flexDirection: 'column' }}>
                                <span style={{ fontWeight: 600 }}>{d.name}</span>
                                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{d.address || '-'}</span>
                                {d.hasMultiplePendingInvoices && (
                                  <span className="tabular-nums" style={{ fontSize: '0.72rem', backgroundColor: '#FCE8E6', color: '#C5221F', padding: '2px 8px', borderRadius: '10px', fontWeight: 600, marginTop: '4px', alignSelf: 'flex-start' }}>
                                    {d.pendingInvoicesCount} boletas
                                  </span>
                                )}
                              </div>
                            </td>
                            <td>
                              {d.route ? (
                                <span style={{ padding: '3px 8px', fontSize: '0.74rem', fontWeight: 600, backgroundColor: '#f1f5f9', borderRadius: '4px' }}>{d.route}</span>
                              ) : (
                                <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>-</span>
                              )}
                            </td>
                            <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 500, color: d.debtA > 0 ? '#0f172a' : 'var(--text-secondary)' }}>
                              {d.debtA > 0 ? `$${Math.round(d.debtA).toLocaleString('es-AR')}` : '-'}
                            </td>
                            <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 500, color: d.debtX > 0 ? '#334155' : 'var(--text-secondary)' }}>
                              {d.debtX > 0 ? `$${Math.round(d.debtX).toLocaleString('es-AR')}` : '-'}
                            </td>
                            <td className="tabular-nums" style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-corp-red)' }}>
                              ${Math.round(d.outstandingBalance).toLocaleString('es-AR')}
                            </td>
                            <td>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                                {waLink && (
                                  <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: '6px', color: '#166534' }} aria-label={`WhatsApp a ${d.name}`} title="WhatsApp">
                                    <MessageCircle size={15} />
                                  </a>
                                )}
                                <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }} onClick={() => setShowResumenModal(d)}>Cuenta</button>
                                <button type="button" className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem', color: '#137333' }} onClick={() => setPaymentModal({ open: true, clientId: d.id, clientName: d.name })}>Cobrar</button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <DebtorsPrintSheet
        filteredDebtors={filteredDebtors}
        groups={groups}
        sellerLabel={sellerLabel}
      />
    </div>
  );
};
