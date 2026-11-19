import React from 'react';
import type { Product, ProductLot } from '../../types';
import { evaluateLotDateHealth, type RackLevel } from './wmsMapHelpers';

interface Slot3DRackIsometricViewProps {
  supportedLevels: RackLevel[];
  activeLevel: RackLevel;
  setActiveLevel: (level: RackLevel) => void;
  itemsByLevel: Record<RackLevel, { product: Product; lot: ProductLot }[]>;
}

const LEVEL_TITLES: Record<RackLevel, string> = {
  A: 'BASE / SUELO',
  B: 'NIVEL MEDIO',
  C: 'NIVEL ALTO',
  D: 'CUARTO NIVEL',
  E: 'QUINTO NIVEL',
  F: 'NIVEL SUPERIOR',
};

export const Slot3DRackIsometricView: React.FC<Slot3DRackIsometricViewProps> = ({
  supportedLevels,
  activeLevel,
  setActiveLevel,
  itemsByLevel,
}) => {
  const levelsDesc = [...supportedLevels].reverse();
  const isCompact = supportedLevels.length >= 4;

  return (
    <div className="wms-rack-3d-container">
      <div className="wms-rack-3d-header">
        <span style={{ fontSize: '0.78rem', fontWeight: 700, color: '#64748b' }}>
          Estantería ({supportedLevels.length} {supportedLevels.length === 1 ? 'Nivel' : 'Niveles'})
        </span>
        <span
          className="badge"
          style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.7rem' }}
        >
          Vista Isométrica 3D
        </span>
      </div>

      <div
        className="wms-isometric-rack-wrapper"
        style={{ gap: isCompact ? '8px' : '14px', padding: isCompact ? '4px 0' : '10px 0' }}
      >
        {levelsDesc.map((lvl, idx) => {
          const floorNumber = supportedLevels.length - idx;
          const items = itemsByLevel[lvl] || [];
          const totalUnits = items.reduce((s, i) => s + Number(i.lot.stock || 0), 0);
          const hasExpired = items.some((i) => evaluateLotDateHealth(i.lot.expirationDate) === 'EXPIRED');
          const hasExpiringSoon = items.some(
            (i) => evaluateLotDateHealth(i.lot.expirationDate) === 'EXPIRING_SOON',
          );
          const badgeBg =
            items.length === 0
              ? '#94a3b8'
              : hasExpired
                ? '#E30613'
                : hasExpiringSoon
                  ? '#d97706'
                  : '#16a34a';

          return (
            <div
              key={lvl}
              className={`wms-3d-shelf-level ${activeLevel === lvl ? 'selected' : ''}`}
              onClick={() => setActiveLevel(lvl)}
            >
              <div className="wms-3d-shelf-top" style={{ height: isCompact ? '6px' : '8px' }} />
              <div
                className="wms-3d-shelf-front"
                style={{ padding: isCompact ? '6px 10px' : '10px 12px' }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontWeight: 800, fontSize: isCompact ? '0.74rem' : '0.8rem' }}>
                    PISO {floorNumber} - NIVEL {lvl} ({LEVEL_TITLES[lvl]})
                  </span>
                  <span
                    className="badge tabular-nums"
                    style={{ backgroundColor: badgeBg, color: '#fff', fontSize: '0.65rem' }}
                  >
                    {items.length > 0 ? `${totalUnits} u.` : 'LIBRE'}
                  </span>
                </div>

                {items.length > 0 ? (
                  <div className="wms-3d-items-preview">
                    {items.map((item, iIdx) => (
                      <div key={iIdx} className="wms-3d-item-pill">
                        {item.product.name} ({item.lot.stock}u)
                      </div>
                    ))}
                  </div>
                ) : (
                  <div
                    style={{
                      fontSize: '0.71rem',
                      fontStyle: 'italic',
                      opacity: 0.7,
                      marginTop: '2px',
                    }}
                  >
                    Posición vacía
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
