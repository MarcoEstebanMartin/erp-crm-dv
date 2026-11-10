import React from 'react';
import type { Product, ProductLot } from '../../types';

interface Slot3DRackIsometricViewProps {
  activeLevel: 'A' | 'B' | 'C';
  setActiveLevel: (level: 'A' | 'B' | 'C') => void;
  supportsLevelB: boolean;
  supportsLevelC: boolean;
  itemsLevelA: { product: Product; lot: ProductLot }[];
  itemsLevelB: { product: Product; lot: ProductLot }[];
  itemsLevelC: { product: Product; lot: ProductLot }[];
}

export const Slot3DRackIsometricView: React.FC<Slot3DRackIsometricViewProps> = ({
  activeLevel,
  setActiveLevel,
  supportsLevelB,
  supportsLevelC,
  itemsLevelA,
  itemsLevelB,
  itemsLevelC,
}) => {
  return (
    <div className="wms-rack-3d-container">
      <div className="wms-rack-3d-header">
        <span
          style={{
            fontSize: '0.78rem',
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.5px',
            color: '#64748b',
          }}
        >
          🏢 Estantería Tridimensional (3 Pisos)
        </span>
        <span
          className="badge"
          style={{ backgroundColor: '#f1f5f9', color: '#475569', fontSize: '0.7rem' }}
        >
          Vista Isométrica 3D
        </span>
      </div>

      <div className="wms-isometric-rack-wrapper">
        {/* PISO 3: NIVEL C (SUPERIOR) */}
        <div
          className={`wms-3d-shelf-level ${!supportsLevelC ? 'disabled' : ''} ${activeLevel === 'C' ? 'selected' : ''}`}
          onClick={() => supportsLevelC && setActiveLevel('C')}
        >
          <div className="wms-3d-shelf-top" />
          <div className="wms-3d-shelf-front">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>PISO 3 - NIVEL C (ALTILLO)</span>
              {supportsLevelC ? (
                <span
                  className="badge"
                  style={{
                    backgroundColor: itemsLevelC.length > 0 ? '#22c55e' : '#94a3b8',
                    color: '#fff',
                    fontSize: '0.65rem',
                  }}
                >
                  {itemsLevelC.length > 0
                    ? `${itemsLevelC.reduce((s, i) => s + i.lot.stock, 0)} u.`
                    : 'LIBRE'}
                </span>
              ) : (
                <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>N/A</span>
              )}
            </div>

            {itemsLevelC.length > 0 ? (
              <div className="wms-3d-items-preview">
                {itemsLevelC.map((item, idx) => (
                  <div key={idx} className="wms-3d-item-pill">
                    📦 {item.product.name} ({item.lot.stock}u)
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.72rem', fontStyle: 'italic', opacity: 0.7, marginTop: '2px' }}>
                {supportsLevelC ? 'Posición superior vacía' : 'Sin piso superior en esta estantería'}
              </div>
            )}
          </div>
        </div>

        {/* PISO 2: NIVEL B (MEDIO) */}
        <div
          className={`wms-3d-shelf-level ${!supportsLevelB ? 'disabled' : ''} ${activeLevel === 'B' ? 'selected' : ''}`}
          onClick={() => supportsLevelB && setActiveLevel('B')}
        >
          <div className="wms-3d-shelf-top" />
          <div className="wms-3d-shelf-front">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>
                PISO 2 - NIVEL B (ESTANTE MEDIO)
              </span>
              {supportsLevelB ? (
                <span
                  className="badge"
                  style={{
                    backgroundColor: itemsLevelB.length > 0 ? '#22c55e' : '#94a3b8',
                    color: '#fff',
                    fontSize: '0.65rem',
                  }}
                >
                  {itemsLevelB.length > 0
                    ? `${itemsLevelB.reduce((s, i) => s + i.lot.stock, 0)} u.`
                    : 'LIBRE'}
                </span>
              ) : (
                <span style={{ fontSize: '0.65rem', opacity: 0.7 }}>N/A</span>
              )}
            </div>

            {itemsLevelB.length > 0 ? (
              <div className="wms-3d-items-preview">
                {itemsLevelB.map((item, idx) => (
                  <div key={idx} className="wms-3d-item-pill">
                    📦 {item.product.name} ({item.lot.stock}u)
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.72rem', fontStyle: 'italic', opacity: 0.7, marginTop: '2px' }}>
                {supportsLevelB ? 'Posición media vacía' : 'Sin piso medio en esta estantería'}
              </div>
            )}
          </div>
        </div>

        {/* PISO 1: NIVEL A (INFERIOR / SUELO) */}
        <div
          className={`wms-3d-shelf-level ${activeLevel === 'A' ? 'selected' : ''}`}
          onClick={() => setActiveLevel('A')}
        >
          <div className="wms-3d-shelf-top" />
          <div className="wms-3d-shelf-front">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800, fontSize: '0.8rem' }}>
                PISO 1 - NIVEL A (BASE / SUELO)
              </span>
              <span
                className="badge"
                style={{
                  backgroundColor: itemsLevelA.length > 0 ? '#22c55e' : '#94a3b8',
                  color: '#fff',
                  fontSize: '0.65rem',
                }}
              >
                {itemsLevelA.length > 0
                  ? `${itemsLevelA.reduce((s, i) => s + i.lot.stock, 0)} u.`
                  : 'LIBRE'}
              </span>
            </div>

            {itemsLevelA.length > 0 ? (
              <div className="wms-3d-items-preview">
                {itemsLevelA.map((item, idx) => (
                  <div key={idx} className="wms-3d-item-pill">
                    📦 {item.product.name} ({item.lot.stock}u)
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: '0.72rem', fontStyle: 'italic', opacity: 0.7, marginTop: '2px' }}>
                Posición inferior vacía
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ fontSize: '0.73rem', color: '#64748b', textAlign: 'center', marginTop: '12px' }}>
        💡 Tocá cualquiera de los 3 pisos en la estantería 3D para inspeccionar o cargar mercadería.
      </div>
    </div>
  );
};
