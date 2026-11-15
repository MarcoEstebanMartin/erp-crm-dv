import { X } from 'lucide-react';
import { NativeModalDialog } from '../modals/NativeModalDialog';

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
    <NativeModalDialog
      isOpen={true}
      onClose={onClose}
      ariaLabelledBy="bultos-close-title"
      style={{ maxWidth: '450px', width: '94vw', padding: '24px' }}
    >
      <div>
        <div className="modal-header">
          <h3 id="bultos-close-title" style={{ margin: 0 }}>Confirmar Bultos</h3>
          <button type="button" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose} aria-label="Cerrar">
            <X size={18} aria-hidden="true" />
          </button>
        </div>

        <div style={{ padding: '16px 0 20px 0' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { key: 'frio' as const, title: 'Bandejas Frío' },
              { key: 'secos' as const, title: 'Bandejas Secos' },
              { key: 'tabla' as const, title: 'Bebidas / Tabla' },
              { key: 'cajasCerradas' as const, title: 'Cajas Cerradas' },
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
                <label htmlFor={`bultos-${item.key}`} style={{ fontWeight: 600, fontSize: '0.85rem', margin: 0 }}>
                  {item.title}
                </label>
                <input
                  id={`bultos-${item.key}`}
                  type="number"
                  className="input tabular-nums"
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
            <span style={{ fontWeight: 600, fontSize: '1rem' }}>Total Bultos</span>
            <span
              className="tabular-nums"
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
            {loading ? 'Finalizando...' : 'Confirmar e Imprimir'}
          </button>
        </div>
      </div>
    </NativeModalDialog>
  );
};
