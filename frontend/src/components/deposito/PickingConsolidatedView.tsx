import React from 'react';
import type { Order } from '../../types';
import { getProductLocation } from './depositoHelpers';

interface PickingConsolidatedViewProps {
  selectedOrdersList: Order[];
  consolidatedItems: any[];
  consolidatedZone: string;
  setConsolidatedZone: (z: string) => void;
  consolidatedCheckedItems: Record<number, boolean>;
  setConsolidatedCheckedItems: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  onBack: () => void;
}

export const PickingConsolidatedView: React.FC<PickingConsolidatedViewProps> = ({
  selectedOrdersList,
  consolidatedItems,
  consolidatedZone,
  setConsolidatedZone,
  consolidatedCheckedItems,
  setConsolidatedCheckedItems,
  onBack,
}) => {
  const filteredConsolidated = consolidatedItems.filter(
    (item) =>
      consolidatedZone === 'ALL' ||
      (item.product?.pickingZone || item.product?.rubro?.pickingZone || 'CAJAS') ===
        consolidatedZone,
  );

  return (
    <div className="card">
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '10px',
        }}
        className="no-print"
      >
        <div>
          <h3 style={{ margin: 0 }}>Planilla de Picking Consolidada</h3>
          <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
            Sumatoria de {selectedOrdersList.length} pedidos seleccionados.
          </p>
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
            🖨️ Imprimir Planilla A4
          </button>
          <button type="button" className="btn btn-secondary" onClick={onBack}>
            Volver al Listado
          </button>
        </div>
      </div>

      <div
        className="no-print"
        style={{
          backgroundColor: 'var(--bg-secondary)',
          padding: '12px 16px',
          borderRadius: 'var(--radius-sm)',
          border: '1px solid var(--border-color)',
          marginBottom: '20px',
          fontSize: '0.85rem',
        }}
      >
        <div style={{ marginBottom: '6px' }}>
          <strong>Pedidos incluidos:</strong> {selectedOrdersList.map((o) => `#${o.id}`).join(', ')}
        </div>
        <div>
          <strong>Rutas de despacho:</strong>{' '}
          {Array.from(
            new Set(selectedOrdersList.map((o) => o.persona?.route || 'RETIRO EN DEPÓSITO')),
          ).join(', ')}
        </div>
      </div>

      <div
        className="no-print"
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '16px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '12px',
          flexWrap: 'wrap',
        }}
      >
        {[
          { id: 'ALL', label: '🌐 Todo Consolidado', color: '#1e293b' },
          { id: 'FRIO', label: '❄️ Sector Frío', color: '#007AFF' },
          { id: 'TABLA', label: '🍾 Sector Tabla/Bebidas', color: '#FF9500' },
          { id: 'CAJAS', label: '📦 Sector Secos/Cajas', color: '#8E8E93' },
        ].map((zone) => {
          const count =
            zone.id === 'ALL'
              ? consolidatedItems.length
              : consolidatedItems.filter(
                  (i) =>
                    (i.product?.pickingZone || i.product?.rubro?.pickingZone || 'CAJAS') ===
                    zone.id,
                ).length;
          return (
            <button
              key={zone.id}
              type="button"
              className="btn"
              style={{
                padding: '6px 14px',
                fontSize: '0.85rem',
                borderRadius: '20px',
                backgroundColor:
                  consolidatedZone === zone.id ? zone.color : 'var(--bg-secondary)',
                color: consolidatedZone === zone.id ? '#fff' : 'var(--text-primary)',
                border:
                  consolidatedZone === zone.id
                    ? `1px solid ${zone.color}`
                    : '1px solid var(--border-color)',
                fontWeight: 600,
              }}
              onClick={() => setConsolidatedZone(zone.id)}
            >
              {zone.label} ({count})
            </button>
          );
        })}
      </div>

      <div
        className="table-container no-print"
        style={{ border: '1px solid var(--border-color)', borderRadius: 'var(--radius-sm)' }}
      >
        <table>
          <thead>
            <tr>
              <th style={{ width: '40px', textAlign: 'center' }}>✓</th>
              <th style={{ width: '120px' }}>Ubicación</th>
              <th>Artículo / SKU</th>
              <th style={{ width: '120px' }}>Sector</th>
              <th style={{ width: '100px', textAlign: 'right' }}>Cant. Total</th>
              <th>Desglose por Pedido</th>
            </tr>
          </thead>
          <tbody>
            {filteredConsolidated.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '24px 0' }}>
                  No hay artículos en este sector.
                </td>
              </tr>
            ) : (
              filteredConsolidated.map((item, idx) => {
                const isChecked = !!consolidatedCheckedItems[item.product.id];
                const location = getProductLocation(item.product);
                const itemZone = item.product?.rubro?.pickingZone || 'CAJAS';

                let badgeStyle: React.CSSProperties = {
                  backgroundColor: 'rgba(142, 142, 147, 0.08)',
                  color: '#8E8E93',
                  border: '1px solid rgba(142, 142, 147, 0.15)',
                };
                if (itemZone === 'FRIO') {
                  badgeStyle = {
                    backgroundColor: 'rgba(0, 122, 255, 0.08)',
                    color: '#007AFF',
                    border: '1px solid rgba(0, 122, 255, 0.15)',
                  };
                } else if (itemZone === 'TABLA') {
                  badgeStyle = {
                    backgroundColor: 'rgba(255, 149, 0, 0.08)',
                    color: '#FF9500',
                    border: '1px solid rgba(255, 149, 0, 0.15)',
                  };
                }

                return (
                  <tr
                    key={idx}
                    style={{
                      backgroundColor: isChecked ? 'rgba(52, 199, 89, 0.02)' : 'transparent',
                      opacity: isChecked ? 0.7 : 1,
                      borderBottom: '1px solid var(--border-color)',
                    }}
                  >
                    <td style={{ textAlign: 'center', verticalAlign: 'middle' }}>
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() =>
                          setConsolidatedCheckedItems((prev) => ({
                            ...prev,
                            [item.product.id]: !prev[item.product.id],
                          }))
                        }
                      />
                    </td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <span
                        style={{
                          fontSize: '0.82rem',
                          fontWeight: 700,
                          backgroundColor:
                            location !== 'S/U' ? '#FFFBEB' : 'var(--bg-secondary)',
                          color: location !== 'S/U' ? '#B06000' : 'var(--text-secondary)',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          border:
                            location !== 'S/U'
                              ? '1px solid #FFE0B2'
                              : '1px solid var(--border-color)',
                          fontFamily: 'monospace',
                        }}
                      >
                        📍 {location}
                      </span>
                    </td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <div
                        style={{
                          fontWeight: 600,
                          fontSize: '0.9rem',
                          textDecoration: isChecked ? 'line-through' : 'none',
                        }}
                      >
                        {item.product.name}
                      </div>
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          fontFamily: 'monospace',
                        }}
                      >
                        SKU: {item.product.sku}
                      </div>
                    </td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <span
                        style={{
                          padding: '2px 6px',
                          borderRadius: '4px',
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          textTransform: 'uppercase',
                          ...badgeStyle,
                        }}
                      >
                        {itemZone}
                      </span>
                    </td>
                    <td
                      style={{
                        textAlign: 'right',
                        fontWeight: 800,
                        fontSize: '1.05rem',
                        verticalAlign: 'middle',
                        paddingRight: '12px',
                      }}
                    >
                      {item.totalQuantity} u.
                    </td>
                    <td style={{ verticalAlign: 'middle' }}>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        {item.orderDetails.map((det: any, dIdx: number) => (
                          <span
                            key={dIdx}
                            style={{
                              fontSize: '0.72rem',
                              fontWeight: 600,
                              backgroundColor: 'var(--bg-secondary)',
                              border: '1px solid var(--border-color)',
                              color: 'var(--text-primary)',
                              padding: '2px 6px',
                              borderRadius: '4px',
                            }}
                            title={`Cliente: ${det.clientName} | Ruta: ${det.route}`}
                          >
                            Pedido #{det.orderId}: <strong>{det.quantity} u.</strong>
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
