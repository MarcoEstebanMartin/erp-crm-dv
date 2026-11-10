import React from 'react';
import { Layers } from 'lucide-react';
import type { Product, ProductLot } from '../../types';
import type { DepositSlot } from './depositomapaData';
import { SECTORS_INFO } from './depositomapaData';

interface WarehouseSlotInspectorSidebarProps {
  selectedSlot: DepositSlot | null;
  products: Product[];
  onOpen3DModal: () => void;
}

export const WarehouseSlotInspectorSidebar: React.FC<WarehouseSlotInspectorSidebarProps> = ({
  selectedSlot,
  products,
  onOpen3DModal,
}) => {
  const matchingProducts: { product: Product; lot: ProductLot }[] = [];

  if (selectedSlot) {
    (products || []).forEach((p) => {
      if (p.lots && p.lots.length > 0) {
        p.lots.forEach((l) => {
          if (l.stock > 0 && l.location && l.location.startsWith(selectedSlot.code)) {
            matchingProducts.push({ product: p, lot: l });
          }
        });
      } else if (
        p.stock > 0 &&
        p.defaultLocation &&
        p.defaultLocation.startsWith(selectedSlot.code)
      ) {
        matchingProducts.push({
          product: p,
          lot: {
            id: 0,
            productId: p.id,
            lotNumber: 'S/L',
            expirationDate: new Date().toISOString(),
            stock: p.stock,
            location: selectedSlot.code,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
        });
      }
    });
  }

  return (
    <div
      style={{
        width: '340px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '16px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <h4
        style={{
          margin: 0,
          fontSize: '0.95rem',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '8px',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          color: 'var(--text-primary)',
        }}
      >
        📍 Inspector del Slot Seleccionado
      </h4>

      {selectedSlot ? (
        <div>
          <div
            style={{
              backgroundColor: '#f8fafc',
              border: '1px solid #cbd5e1',
              padding: '12px',
              borderRadius: '8px',
              marginBottom: '12px',
            }}
          >
            <div style={{ fontWeight: 800, fontSize: '1.08rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
              Slot {selectedSlot.code}
            </div>
            <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>
              {selectedSlot.deposito} • {SECTORS_INFO[selectedSlot.chamber]?.label || 'General'}
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              Fila {selectedSlot.row}, Columna {selectedSlot.col}. Configuración:{' '}
              <strong>{selectedSlot.nivel}</strong>.
            </div>
          </div>

          {matchingProducts.length === 0 ? (
            <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>⚪</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
                Slot Vacío / Disponible
              </div>
              <p style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                No hay mercadería asignada en ninguno de sus pisos.
              </p>
            </div>
          ) : (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '14px',
                maxHeight: '220px',
                overflowY: 'auto',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>
                  MERCADERÍA EN STOCK
                </span>
                <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>
                  🟢 OCUPADO
                </span>
              </div>

              {matchingProducts.map(({ product, lot }, idx) => (
                <div
                  key={idx}
                  style={{
                    border: '1px solid var(--border-color)',
                    borderRadius: '6px',
                    padding: '8px 10px',
                    backgroundColor: '#fafafa',
                    fontSize: '0.8rem',
                  }}
                >
                  <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>
                    [{product.sku}] {product.name}
                  </div>
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      color: 'var(--text-secondary)',
                      marginTop: '2px',
                      fontSize: '0.75rem',
                    }}
                  >
                    <span>Lote: {lot.lotNumber}</span>
                    <strong style={{ color: 'var(--color-primary)' }}>{lot.stock} u.</strong>
                  </div>
                  <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                    Ubicación exacta: {lot.location || selectedSlot.code}
                  </div>
                </div>
              ))}
            </div>
          )}

          <button
            type="button"
            className="btn btn-primary"
            style={{
              width: '100%',
              padding: '10px 14px',
              fontSize: '0.86rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0, 122, 255, 0.25)',
            }}
            onClick={onOpen3DModal}
          >
            <Layers size={18} />
            <span>Inspeccionar / Cargar en 3D (3 Pisos)</span>
          </button>
        </div>
      ) : (
        <div style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>👆</div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>
            Seleccioná un Slot del Mapa
          </div>
          <p style={{ fontSize: '0.78rem', marginTop: '4px' }}>
            Hacé clic en cualquier celda para inspeccionar sus 3 pisos en vista tridimensional.
          </p>
        </div>
      )}
    </div>
  );
};
