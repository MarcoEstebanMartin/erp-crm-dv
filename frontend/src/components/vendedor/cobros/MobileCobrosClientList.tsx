import React from 'react';
import { FileText, RefreshCw } from 'lucide-react';
import { formatIntegerARS } from '../../../utils/currency';

export interface MobileCobrosPersona {
  id: number;
  name: string;
  address: string;
  city: string;
  outstandingBalance: number;
  phone: string | null;
}

interface MobileCobrosClientListProps {
  personas: MobileCobrosPersona[];
  selectedCityFilters: string[];
  setSelectedCityFilters?: (filters: string[]) => void;
  uniqueCities: string[];
  cleanCityName?: (city: string | null | undefined) => string;
  loading: boolean;
  onSync: () => void;
  onSelectPersona: (persona: MobileCobrosPersona) => void;
}

export const MobileCobrosClientList: React.FC<MobileCobrosClientListProps> = ({
  personas, selectedCityFilters, setSelectedCityFilters, uniqueCities, cleanCityName, loading, onSync, onSelectPersona,
}) => {
  const filteredPersonas = personas.filter((p) => {
    if (selectedCityFilters.length === 0) return true;
    const cleanCity = cleanCityName ? cleanCityName(p.city) : (p.city || '').toUpperCase().trim();
    return selectedCityFilters.includes(cleanCity);
  });

  return (
    <div style={{ maxWidth: '600px', margin: '0 auto', padding: '16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px', marginTop: '8px' }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>Cobranzas</h2>
        <button type="button" onClick={onSync} disabled={loading} style={{ backgroundColor: '#FFFFFF', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', color: 'var(--text-secondary)', padding: '6px 12px', borderRadius: '8px', fontSize: '0.82rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', cursor: loading ? 'not-allowed' : 'pointer' }}>
          <RefreshCw size={14} className={loading ? 'spin-animation' : ''} aria-hidden="true" />
          <span>Sincronizar</span>
        </button>
      </div>

      {uniqueCities.length > 0 && setSelectedCityFilters && (
        <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', padding: '4px 2px 14px 2px', WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
          <button type="button" onClick={() => setSelectedCityFilters([])} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', borderColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : 'var(--border-color)', backgroundColor: selectedCityFilters.length === 0 ? 'var(--text-primary)' : '#FFFFFF', color: selectedCityFilters.length === 0 ? '#FFFFFF' : 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
            Todas
          </button>
          {uniqueCities.map((city) => {
            const isActive = selectedCityFilters.includes(city);
            return (
              <button key={city} type="button" onClick={() => setSelectedCityFilters(isActive ? selectedCityFilters.filter((c) => c !== city) : [...selectedCityFilters, city])} style={{ padding: '6px 14px', borderRadius: '20px', fontSize: '0.8rem', fontWeight: 600, border: '1px solid', borderColor: isActive ? 'var(--color-corp-red)' : 'var(--border-color)', backgroundColor: isActive ? 'rgba(227, 6, 19, 0.08)' : '#FFFFFF', color: isActive ? 'var(--color-corp-red)' : 'var(--text-secondary)', whiteSpace: 'nowrap', cursor: 'pointer' }}>
                {city}
              </button>
            );
          })}
        </div>
      )}

      {filteredPersonas.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', backgroundColor: '#FFFFFF', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)' }}>
          <FileText size={36} style={{ color: 'var(--text-muted)', marginBottom: '10px' }} aria-hidden="true" />
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', margin: 0 }}>Sin saldos pendientes</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {filteredPersonas.map((p) => (
            <button key={p.id} type="button" onClick={() => onSelectPersona(p)} style={{ width: '100%', textAlign: 'left', backgroundColor: '#FFFFFF', padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', boxShadow: 'var(--shadow-sm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <div style={{ fontSize: '0.98rem', fontWeight: 700, color: 'var(--text-primary)' }}>{p.name}</div>
                {p.city && (<span style={{ fontSize: '0.74rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{p.city}</span>)}
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.68rem', fontWeight: 700, color: 'var(--text-muted)', display: 'block', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Saldo</span>
                {p.outstandingBalance < 0 ? (
                  <span className="tabular-nums" style={{ fontSize: '0.85rem', fontWeight: 700, color: '#059669', backgroundColor: '#ECFDF5', padding: '3px 8px', borderRadius: '6px', border: '1px solid #A7F3D0', display: 'inline-block' }}>
                    {formatIntegerARS(Math.abs(p.outstandingBalance))} (A favor)
                  </span>
                ) : (
                  <span className="tabular-nums" style={{ fontSize: '0.9rem', fontWeight: 700, color: '#DC2626', backgroundColor: '#FEF2F2', padding: '3px 8px', borderRadius: '6px', border: '1px solid #FCA5A5', display: 'inline-block' }}>
                    {formatIntegerARS(p.outstandingBalance)}
                  </span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
