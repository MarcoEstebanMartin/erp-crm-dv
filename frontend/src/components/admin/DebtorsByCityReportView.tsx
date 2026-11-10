import React, { useState } from 'react';
import { Printer } from 'lucide-react';

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

  return (
    <div className="card" style={{ padding: '24px', marginBottom: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h3 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Resumen de Deudores por Localidad</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.88rem', color: 'var(--text-secondary)' }}>
            Planilla de deudores agrupados por localidad y desglosados por sucursales.
          </p>
        </div>
        <button className="btn btn-primary" onClick={() => window.print()}>
          <Printer size={16} /><span style={{ marginLeft: '6px' }}>Imprimir Planilla</span>
        </button>
      </div>

      <div style={{ display: 'flex', gap: '12px', marginBottom: '24px', padding: '16px', backgroundColor: 'var(--bg-light, #f8f9fa)', borderRadius: '8px', border: '1px solid var(--border-color, #e5e5e7)', flexWrap: 'wrap' }}>
        <div style={{ flex: '2 1 300px', display: 'flex', flexDirection: 'column', gap: '6px', position: 'relative' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrar Localidades (Multi-selección)</label>
          <button
            type="button" className="input" onClick={() => setShowCityDropdown(!showCityDropdown)}
            style={{ textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 12px', backgroundColor: '#fff', cursor: 'pointer', minHeight: '38px', border: '1px solid var(--border-color)' }}
          >
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '220px' }}>
              {selectedCities.length === availableCities.length ? 'Todas las localidades' : selectedCities.length === 0 ? 'Ninguna seleccionada' : `${selectedCities.length} seleccionada(s)`}
            </span>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>▼</span>
          </button>

          {showCityDropdown && (
            <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, backgroundColor: '#fff', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', zIndex: 100, marginTop: '4px', padding: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <input type="text" className="input" placeholder="Buscar localidad..." value={citySearchQuery} onChange={(e) => setCitySearchQuery(e.target.value)} style={{ padding: '6px 10px', fontSize: '0.8rem' }} onClick={(e) => e.stopPropagation()} />
              <div style={{ display: 'flex', gap: '8px', borderBottom: '1px solid var(--border-color)', paddingBottom: '8px' }}>
                <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 1 }} onClick={(e) => { e.stopPropagation(); setSelectedCities(availableCities); }}>Seleccionar todas</button>
                <button type="button" className="btn btn-ghost" style={{ padding: '4px 8px', fontSize: '0.75rem', flex: 1 }} onClick={(e) => { e.stopPropagation(); setSelectedCities([]); }}>Deseleccionar todas</button>
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

        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrar por Vendedor</label>
          <select className="input" value={selectedSellerFilter} onChange={(e) => setSelectedSellerFilter(e.target.value)} style={{ padding: '8px 12px' }}>
            <option value="ALL">Todos los Vendedores</option>
            {availableSellers.map((s) => (<option key={s.id} value={s.id.toString()}>{s.username.replace('_', ' ').toUpperCase()}</option>))}
          </select>
        </div>

        <div style={{ flex: '1 1 200px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
          <label style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Filtrar por Sucursal con Deuda</label>
          <select className="input" value={selectedBranchFilter} onChange={(e) => setSelectedBranchFilter(e.target.value)} style={{ padding: '8px 12px' }}>
            <option value="ALL">Todas las Sucursales</option>
            <option value="A">Sucursal A (Oficial)</option>
            <option value="X">Sucursal X (Interno)</option>
          </select>
        </div>
      </div>

      {filteredDebtors.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px', color: 'var(--text-secondary)' }}>No se encontraron deudores con los filtros seleccionados.</div>
      ) : (
        <div>
          <div className="dashboard-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <div className="card stat-card" style={{ borderLeft: '4px solid var(--text-secondary)', padding: '16px' }}>
              <div className="stat-label">Clientes en Mora</div>
              <div className="stat-value" style={{ fontSize: '1.5rem', fontWeight: 700 }}>{filteredDebtors.length}</div>
            </div>
            <div className="card stat-card" style={{ borderLeft: '4px solid #137333', padding: '16px' }}>
              <div className="stat-label">Deuda Sucursal A (Oficial)</div>
              <div className="stat-value" style={{ color: '#137333', fontSize: '1.5rem', fontWeight: 700 }}>${Math.round(totalA).toLocaleString('es-AR')}</div>
            </div>
            <div className="card stat-card" style={{ borderLeft: '4px solid #3c4043', padding: '16px' }}>
              <div className="stat-label">Deuda Sucursal X (Interno)</div>
              <div className="stat-value" style={{ color: '#3c4043', fontSize: '1.5rem', fontWeight: 700 }}>${Math.round(totalX).toLocaleString('es-AR')}</div>
            </div>
            <div className="card stat-card" style={{ borderLeft: '4px solid var(--color-corp-red)', padding: '16px' }}>
              <div className="stat-label">Total Consolidado</div>
              <div className="stat-value" style={{ color: 'var(--color-corp-red)', fontSize: '1.5rem', fontWeight: 700 }}>${Math.round(totalConsolidado).toLocaleString('es-AR')}</div>
            </div>
          </div>

          {Object.keys(groups).sort().map((city) => (
            <div key={city} style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '0.92rem', fontWeight: 700, padding: '10px 14px', backgroundColor: 'var(--bg-light)', borderLeft: '4px solid var(--color-corp-red)', borderRadius: '0 6px 6px 0', marginBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', border: '1px solid var(--border-color)', borderLeftWidth: '4px' }}>
                <span>📍 Localidad: {city}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Total Localidad: <strong>${Math.round(groups[city].reduce((acc, d) => acc + d.outstandingBalance, 0)).toLocaleString('es-AR')}</strong></span>
              </div>
              <div className="table-container" style={{ marginTop: '0', border: 'none', boxShadow: 'none' }}>
                <table style={{ width: '100%' }}>
                  <thead>
                    <tr>
                      <th style={{ width: '25%' }}>Cliente</th>
                      <th style={{ width: '15%' }}>Ruta</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Suc. A</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Suc. X</th>
                      <th style={{ width: '15%', textAlign: 'right' }}>Saldo Total</th>
                      <th style={{ width: '15%', textAlign: 'center' }}>Acciones</th>
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
                              <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{d.address || 'Sin Dirección'}</span>
                              {d.hasMultiplePendingInvoices && <span style={{ fontSize: '0.72rem', backgroundColor: '#FCE8E6', color: '#C5221F', padding: '2px 8px', borderRadius: '12px', fontWeight: 600, marginTop: '4px', alignSelf: 'flex-start' }}>⚠️ Debe {d.pendingInvoicesCount} boletas</span>}
                            </div>
                          </td>
                          <td>{d.route ? <span style={{ padding: '3px 8px', fontSize: '0.72rem', fontWeight: 600, backgroundColor: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>📍 {d.route}</span> : <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Sin Ruta</span>}</td>
                          <td style={{ textAlign: 'right', fontWeight: 500, color: d.debtA > 0 ? '#137333' : 'var(--text-secondary)' }}>{d.debtA > 0 ? `$${Math.round(d.debtA).toLocaleString('es-AR')}` : '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 500, color: d.debtX > 0 ? '#3c4043' : 'var(--text-secondary)' }}>{d.debtX > 0 ? `$${Math.round(d.debtX).toLocaleString('es-AR')}` : '-'}</td>
                          <td style={{ textAlign: 'right', fontWeight: 700, color: 'var(--color-corp-red)' }}>${Math.round(d.outstandingBalance).toLocaleString('es-AR')}</td>
                          <td>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                              {waLink && <a href={waLink} target="_blank" rel="noopener noreferrer" className="btn btn-ghost" style={{ padding: '6px' }} title="WhatsApp">💬</a>}
                              <button className="btn btn-ghost" style={{ padding: '6px 10px', fontSize: '0.78rem' }} onClick={() => setShowResumenModal(d)}>Resumen</button>
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
      )}
    </div>
  );
};
