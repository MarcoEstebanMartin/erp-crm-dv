import React from 'react';

export interface BultosData {
  frio: number;
  secos: number;
  tabla: number;
  cajasCerradas: number;
}

interface BultosCloseModalProps {
  isOpen: boolean;
  bultosData: BultosData;
  setBultosData: React.Dispatch<React.SetStateAction<BultosData>>;
  loading: boolean;
  onClose: () => void;
  onConfirm: () => void;
}

export const BultosCloseModal: React.FC<BultosCloseModalProps> = ({
  isOpen,
  bultosData,
  setBultosData,
  loading,
  onClose,
  onConfirm,
}) => {
  if (!isOpen) return null;

  const totalBultos =
    Number(bultosData.frio) +
    Number(bultosData.secos) +
    Number(bultosData.tabla) +
    Number(bultosData.cajasCerradas);

  return (
    <div className="modal-overlay">
      <div className="modal-content" style={{ maxWidth: '450px' }}>
        <div className="modal-header">
          <h3>Confirmación de Bultos Físicos</h3>
          <button className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
            ✕
          </button>
        </div>

        <div style={{ padding: '10px 0 20px 0' }}>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginBottom: '16px' }}>
            Ingresá la cantidad de paquetes, bandejas o bultos armados para pegar las etiquetas de reparto:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              {
                key: 'frio' as const,
                icon: '❄️',
                title: 'Bandejas de Frío (Lácteos sueltos)',
                desc: 'Productos sueltos de heladera',
              },
              {
                key: 'secos' as const,
                icon: '📥',
                title: 'Bandejas de Secos (Mercadería suelta)',
                desc: 'Paquetes o latas sueltas',
              },
              {
                key: 'tabla' as const,
                icon: '🍾',
                title: 'Bebidas / Tabla (Atados/Bolsones)',
                desc: 'Packs grandes o bolsas pesadas',
              },
              {
                key: 'cajasCerradas' as const,
                icon: '📦',
                title: 'Cajas Cerradas (Bultos cerrados)',
                desc: 'Cajas originales de fábrica',
              },
            ].map((item) => (
              <div
                key={item.key}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '8px 12px',
                  backgroundColor: 'var(--bg-secondary)',
                  borderRadius: '6px',
                  border: '1px solid var(--border-color)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span style={{ fontSize: '1.2rem' }}>{item.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.85rem' }}>{item.title}</div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {item.desc}
                    </span>
                  </div>
                </div>
                <input
                  type="number"
                  className="input"
                  style={{ width: '70px', textAlign: 'center', fontWeight: 'bold' }}
                  min={0}
                  value={bultosData[item.key] || ''}
                  onChange={(e) =>
                    setBultosData({
                      ...bultosData,
                      [item.key]: Math.max(0, Number(e.target.value)),
                    })
                  }
                  placeholder="0"
                />
              </div>
            ))}
          </div>

          <div
            style={{
              marginTop: '20px',
              borderTop: '1px solid var(--border-color)',
              paddingTop: '16px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span style={{ fontWeight: 600, fontSize: '1rem' }}>Total Bultos:</span>
            <span
              style={{
                fontSize: '1.4rem',
                fontWeight: 800,
                backgroundColor: 'rgba(227, 6, 19, 0.08)',
                color: 'var(--accent-color)',
                padding: '2px 14px',
                borderRadius: '20px',
                border: '1px solid rgba(227, 6, 19, 0.1)',
              }}
            >
              {totalBultos}
            </span>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn btn-secondary" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="button"
            className="btn btn-primary"
            onClick={onConfirm}
            disabled={loading || totalBultos <= 0}
          >
            {loading ? 'Finalizando...' : 'Confirmar y Generar Etiquetas 🖨️'}
          </button>
        </div>
      </div>
    </div>
  );
};
