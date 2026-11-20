import { useState, lazy, Suspense, useRef, type KeyboardEvent } from 'react';
import { Truck, Layers, Fuel, MapPin } from 'lucide-react';

const LiveMapTab = lazy(() => import('./reparto/LiveMapTab'));
const RepartoDashboard = lazy(() => import('./RepartoDashboard'));
const FleetDashboard = lazy(() => import('./FleetDashboard'));
const FuelControlDashboard = lazy(() => import('./FuelControlDashboard'));

type LogisticaSubTab = 'mapa' | 'reparto' | 'flota' | 'combustible';

const TABS: Array<{ id: LogisticaSubTab; label: string; Icon: typeof Truck }> = [
  { id: 'reparto', label: 'Hojas de Reparto', Icon: Truck },
  { id: 'flota', label: 'Flota', Icon: Layers },
  { id: 'mapa', label: 'Mapa', Icon: MapPin },
  { id: 'combustible', label: 'Combustible', Icon: Fuel },
];

const MiniSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '30vh', gap: '8px' }}>
    <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>Cargando...</span>
  </div>
);

export default function LogisticaDashboard() {
  const [subTab, setSubTab] = useState<LogisticaSubTab>('reparto');
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);

  const handleTabKeyDown = (e: KeyboardEvent<HTMLButtonElement>, idx: number) => {
    let nextIdx = idx;
    if (e.key === 'ArrowRight') nextIdx = (idx + 1) % TABS.length;
    else if (e.key === 'ArrowLeft') nextIdx = (idx - 1 + TABS.length) % TABS.length;
    else if (e.key === 'Home') nextIdx = 0;
    else if (e.key === 'End') nextIdx = TABS.length - 1;
    else return;
    e.preventDefault();
    setSubTab(TABS[nextIdx].id);
    tabRefs.current[nextIdx]?.focus();
  };

  return (
    <div className="logistica-dashboard-container" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', borderBottom: '1px solid var(--border-color)', backgroundColor: 'var(--bg-card, #fff)', padding: '16px 24px 12px 24px', marginBottom: '20px', gap: '12px' }}>
        <h1 style={{ fontSize: '1.4rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
          Logística y Flota
        </h1>

        <div role="tablist" aria-label="Secciones de Logística" className="linear-tablist">
          {TABS.map((tab, idx) => {
            const isActive = subTab === tab.id;
            const Icon = tab.Icon;
            return (
              <button
                key={tab.id}
                ref={(el) => { tabRefs.current[idx] = el; }}
                id={`logistica-tab-${tab.id}`}
                type="button"
                role="tab"
                aria-selected={isActive}
                tabIndex={isActive ? 0 : -1}
                className="linear-tab"
                onClick={() => setSubTab(tab.id)}
                onKeyDown={(e) => handleTabKeyDown(e, idx)}
                style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <Icon size={15} aria-hidden="true" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div role="tabpanel" aria-labelledby={`logistica-tab-${subTab}`} style={{ padding: '0 24px 24px 24px', flex: 1 }}>
        <Suspense fallback={<MiniSpinner />}>
          {subTab === 'mapa' && <LiveMapTab />}
          {subTab === 'reparto' && <RepartoDashboard />}
          {subTab === 'flota' && <FleetDashboard />}
          {subTab === 'combustible' && <FuelControlDashboard />}
        </Suspense>
      </div>
    </div>
  );
}
