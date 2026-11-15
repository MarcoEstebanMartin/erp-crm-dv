import { useEffect, useRef, type Dispatch, type FC, type SetStateAction } from 'react';
import { ChevronDown, RefreshCw } from 'lucide-react';

interface ZoneAnalysisFiltersBarProps {
  cities: string[];
  selectedCities: string[];
  setSelectedCities: Dispatch<SetStateAction<string[]>>;
  citiesDropdownOpen: boolean;
  setCitiesDropdownOpen: (val: boolean) => void;
  sellers: any[];
  selectedSeller: string;
  setSelectedSeller: (val: string) => void;
  zoneDatePreset: string;
  setZoneDatePreset: (val: string) => void;
  zoneStartDate: string;
  setZoneStartDate: (val: string) => void;
  zoneEndDate: string;
  setZoneEndDate: (val: string) => void;
  setHoveredWeekIdx: (val: number | null) => void;
  loadZoneData: () => void;
  zoneLoading: boolean;
}

export const ZoneAnalysisFiltersBar: FC<ZoneAnalysisFiltersBarProps> = ({
  cities,
  selectedCities,
  setSelectedCities,
  citiesDropdownOpen,
  setCitiesDropdownOpen,
  sellers,
  selectedSeller,
  setSelectedSeller,
  zoneDatePreset,
  setZoneDatePreset,
  zoneStartDate,
  setZoneStartDate,
  zoneEndDate,
  setZoneEndDate,
  setHoveredWeekIdx,
  loadZoneData,
  zoneLoading
}) => {
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!citiesDropdownOpen) return;
    const handleOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCitiesDropdownOpen(false);
      }
    };
    const handleEsc = (e: globalThis.KeyboardEvent) => {
      if (e.key === 'Escape') setCitiesDropdownOpen(false);
    };
    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('keydown', handleEsc);
    };
  }, [citiesDropdownOpen, setCitiesDropdownOpen]);

  return (
    <search aria-label="Filtros de zona">
      <div className="card" style={{ padding: '20px', borderRadius: '12px' }}>
        <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
          <div ref={dropdownRef} style={{ flex: 1, minWidth: '180px', position: 'relative' }}>
            <label htmlFor="zone-filter-cities-btn" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Localidad</label>
            <button
              id="zone-filter-cities-btn"
              type="button"
              aria-expanded={citiesDropdownOpen}
              aria-haspopup="true"
              onClick={() => setCitiesDropdownOpen(!citiesDropdownOpen)}
              className="select"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', cursor: 'pointer', outline: 'none', textAlign: 'left', backgroundColor: 'var(--bg-card)', padding: '10px 16px' }}
            >
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90%' }}>
                {selectedCities.length === 0 ? 'Todas' : selectedCities.length === 1 ? selectedCities[0] : `${selectedCities.length} localidades`}
              </span>
              <ChevronDown size={14} color="var(--text-secondary)" aria-hidden="true" />
            </button>

            {citiesDropdownOpen && (
              <div style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1000, width: '100%', minWidth: '220px', backgroundColor: 'var(--card-bg, #fff)', border: '1px solid var(--border-color)', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.1)', marginTop: '4px', padding: '8px 0', maxHeight: '260px', overflowY: 'auto' }}>
                <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '6px', marginBottom: '6px', padding: '0 12px 6px 12px' }}>
                  <button
                    type="button"
                    onClick={() => { setSelectedCities([]); setCitiesDropdownOpen(false); setHoveredWeekIdx(null); }}
                    style={{ fontSize: '0.75rem', color: '#1a73e8', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 600, padding: 0 }}
                  >
                    Todas
                  </button>
                </div>

                {cities.map(c => (
                  <label
                    key={c}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', cursor: 'pointer', fontSize: '0.85rem', color: 'var(--text-primary)' }}
                    onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'var(--bg-light)'}
                    onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                  >
                    <input
                      type="checkbox"
                      checked={selectedCities.includes(c)}
                      onChange={() => {
                        setSelectedCities(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c]);
                        setHoveredWeekIdx(null);
                      }}
                      style={{ cursor: 'pointer' }}
                    />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            )}
          </div>

          <div style={{ flex: 1, minWidth: '180px' }}>
            <label htmlFor="zone-filter-seller" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Vendedor</label>
            <select id="zone-filter-seller" className="select" value={selectedSeller} onChange={e => { setSelectedSeller(e.target.value); setHoveredWeekIdx(null); }}>
              <option value="">Todos</option>
              {sellers.map(s => <option key={s.id} value={s.id}>{s.username.replace('_', ' ')}</option>)}
            </select>
          </div>

          <div style={{ flex: 1, minWidth: '180px' }}>
            <label htmlFor="zone-filter-period" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Período</label>
            <select id="zone-filter-period" className="select" value={zoneDatePreset} onChange={e => { setZoneDatePreset(e.target.value); setHoveredWeekIdx(null); }}>
              <option value="all">Histórico</option>
              <option value="this_week">Últimos 7 días</option>
              <option value="last_30_days">Últimos 30 días</option>
              <option value="this_month">Este mes</option>
              <option value="last_month">Mes anterior</option>
              <option value="custom">Personalizado</option>
            </select>
          </div>

          {zoneDatePreset === 'custom' && (
            <>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="zone-filter-start" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Desde</label>
                <input id="zone-filter-start" type="date" className="input tabular-nums" value={zoneStartDate} onChange={e => { setZoneStartDate(e.target.value); setHoveredWeekIdx(null); }} style={{ padding: '10px 12px' }} />
              </div>
              <div style={{ flex: 1, minWidth: '130px' }}>
                <label htmlFor="zone-filter-end" style={{ display: 'block', fontSize: '0.85rem', fontWeight: 600, marginBottom: '8px', color: 'var(--text-secondary)' }}>Hasta</label>
                <input id="zone-filter-end" type="date" className="input tabular-nums" value={zoneEndDate} onChange={e => { setZoneEndDate(e.target.value); setHoveredWeekIdx(null); }} style={{ padding: '10px 12px' }} />
              </div>
            </>
          )}

          <div style={{ display: 'flex', alignItems: 'flex-end', height: '100%' }}>
            <button type="button" aria-label="Actualizar" className="btn btn-secondary" onClick={loadZoneData} disabled={zoneLoading} style={{ height: '40px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <RefreshCw size={18} className={zoneLoading ? 'spin' : ''} aria-hidden="true" />
            </button>
          </div>
        </div>
      </div>
    </search>
  );
};
