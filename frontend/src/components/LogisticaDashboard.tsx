import { useState, lazy, Suspense } from 'react';
import { Truck, Layers, Fuel } from 'lucide-react';

const RepartoDashboard = lazy(() => import('./RepartoDashboard'));
const FleetDashboard = lazy(() => import('./FleetDashboard'));
const FuelControlDashboard = lazy(() => import('./FuelControlDashboard'));

const MiniSpinner = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '30vh', gap: '8px' }}>
    <div style={{
      width: '20px',
      height: '20px',
      borderRadius: '50%',
      border: '2px solid rgba(var(--color-corp-red-rgb), 0.1)',
      borderTopColor: 'var(--color-corp-red)',
      animation: 'spin 0.8s linear infinite'
    }} />
    <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Cargando sección...</span>
    <style>{`
      @keyframes spin {
        to { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

export default function LogisticaDashboard() {
  const [subTab, setSubTab] = useState<'reparto' | 'flota' | 'combustible'>('reparto');

  const tabs = [
    { id: 'reparto', label: 'Hojas de Reparto', icon: <Truck size={16} /> },
    { id: 'flota', label: 'Flota de Vehículos', icon: <Layers size={16} /> },
    { id: 'combustible', label: 'Control de Combustible', icon: <Fuel size={16} /> }
  ] as const;

  return (
    <div className="logistica-dashboard-container" style={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
      {/* Cabecera y Tabs Horizontales Premium */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        borderBottom: '1px solid var(--border-color)', 
        backgroundColor: 'var(--bg-card, #fff)',
        padding: '16px 24px 0 24px',
        marginBottom: '20px'
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
          <div>
            <h1 style={{ fontSize: '1.45rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0 }}>
              Logística y Flota
            </h1>
            <p style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', margin: '4px 0 0 0' }}>
              Gestione las entregas, la flota propia de vehículos, consumos, vencimientos y preventas territoriales.
            </p>
          </div>
        </div>

        {/* Barra de Tabs horizontales */}
        <div style={{ display: 'flex', gap: '8px' }}>
          {tabs.map((tab) => {
            const isActive = subTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setSubTab(tab.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 16px',
                  border: 'none',
                  borderBottom: isActive ? '2px solid var(--color-corp-red)' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                  fontWeight: isActive ? 600 : 500,
                  fontSize: '0.86rem',
                  cursor: 'pointer',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  outline: 'none',
                  opacity: isActive ? 1 : 0.75
                }}
                onMouseEnter={(e) => {
                  if (!isActive) e.currentTarget.style.opacity = '1';
                }}
                onMouseLeave={(e) => {
                  if (!isActive) e.currentTarget.style.opacity = '0.75';
                }}
              >
                {tab.icon}
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Contenido con carga diferida */}
      <div style={{ padding: '0 24px 24px 24px', flex: 1 }}>
        <Suspense fallback={<MiniSpinner />}>
          {subTab === 'reparto' && <RepartoDashboard />}
          {subTab === 'flota' && <FleetDashboard />}
          {subTab === 'combustible' && <FuelControlDashboard />}
        </Suspense>
      </div>
    </div>
  );
}
