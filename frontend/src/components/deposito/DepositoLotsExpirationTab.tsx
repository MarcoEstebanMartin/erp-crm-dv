import React from 'react';
import { Printer, RefreshCw } from 'lucide-react';
import type { ProductLot } from '../../types';
import { renderLocationTag } from './depositoHelpers';
import type { StockAdjustModalState } from './DepositoStockAdjustModal';

interface DepositoLotsExpirationTabProps {
  expiringLots: ProductLot[];
  allProducts: any[];
  onRefresh: () => void;
  setStockModal: React.Dispatch<React.SetStateAction<StockAdjustModalState>>;
  onPrintLabels: (labels: any[]) => void;
}

export const DepositoLotsExpirationTab: React.FC<DepositoLotsExpirationTabProps> = ({
  expiringLots,
  allProducts,
  onRefresh,
  setStockModal,
  onPrintLabels,
}) => {
  const allLotsList: { product: any; lot: any }[] = [];
  allProducts.forEach((prod) => {
    (prod.lots || []).forEach((lot: any) => {
      allLotsList.push({ product: prod, lot });
    });
  });

  allLotsList.sort(
    (a, b) => new Date(a.lot.expirationDate).getTime() - new Date(b.lot.expirationDate).getTime(),
  );

  return (
    <div>
      {expiringLots.length > 0 && (
        <div
          className="card"
          style={{
            backgroundColor: '#FFF2F2',
            border: '1px solid #FFD1D1',
            borderRadius: '8px',
            padding: '16px',
            marginBottom: '20px',
          }}
        >
          <h4
            style={{
              margin: '0 0 8px 0',
              color: '#C0392B',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
            }}
          >
            ⚠️ Alerta: Lotes Vencidos o Próximos a Vencer (Menos de 30 días)
          </h4>
          <div
            style={{
              maxHeight: '150px',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '8px',
            }}
          >
            {expiringLots.map((lot) => {
              const daysLeft = Math.ceil(
                (new Date(lot.expirationDate).getTime() - new Date().getTime()) /
                  (1000 * 3600 * 24),
              );
              const isExpired = daysLeft <= 0;
              return (
                <div
                  key={lot.id}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    fontSize: '0.85rem',
                    padding: '6px 10px',
                    backgroundColor: '#fff',
                    borderRadius: '4px',
                    borderLeft: isExpired ? '4px solid #C0392B' : '4px solid #F39C12',
                  }}
                >
                  <div>
                    <strong>{lot.product?.name}</strong>{' '}
                    <span style={{ color: 'var(--text-secondary)' }}>(SKU: {lot.product?.sku})</span>
                    <div style={{ fontSize: '0.75rem', marginTop: '2px' }}>
                      Lote:{' '}
                      <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                        {lot.lotNumber}
                      </span>{' '}
                      | Vence: {new Date(lot.expirationDate).toLocaleDateString('es-AR')}
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span
                      style={{
                        fontWeight: 'bold',
                        color: isExpired ? '#C0392B' : '#E67E22',
                        backgroundColor: isExpired ? '#FDEDEC' : '#FEF9E7',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        fontSize: '0.75rem',
                        display: 'inline-block',
                      }}
                    >
                      {isExpired ? 'VENCIDO' : `Vence en ${daysLeft} días`}
                    </span>
                    <span style={{ fontWeight: 600, marginLeft: '12px' }}>
                      Stock: {lot.stock} u.
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '16px',
            flexWrap: 'wrap',
            gap: '10px',
          }}
        >
          <div>
            <h3 style={{ margin: 0 }}>Control General de Lotes</h3>
            <p style={{ margin: '4px 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Visualizá el vencimiento y la ubicación física de todos los lotes con stock en el sistema.
            </p>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                const activeLots: any[] = [];
                allProducts.forEach((prod) => {
                  (prod.lots || []).forEach((lot: any) => {
                    if (lot.stock > 0) {
                      activeLots.push({
                        isLotLabel: true,
                        productName: prod.name,
                        sku: prod.sku,
                        lotNumber: lot.lotNumber,
                        expirationDate: lot.expirationDate,
                        location: lot.location,
                      });
                    }
                  });
                });
                if (activeLots.length === 0) {
                  alert('No hay lotes con stock para imprimir etiquetas.');
                  return;
                }
                onPrintLabels(activeLots);
              }}
            >
              <Printer size={16} />
              <span>Imprimir Todas las Etiquetas</span>
            </button>
            <button className="btn btn-secondary" onClick={onRefresh}>
              <RefreshCw size={16} />
            </button>
          </div>
        </div>

        <div className="table-container">
          <table>
            <thead>
              <tr>
                <th>SKU</th>
                <th>Artículo</th>
                <th>Lote</th>
                <th>Fecha Vencimiento</th>
                <th>Estado Vence</th>
                <th>Ubicación</th>
                <th style={{ textAlign: 'right' }}>Stock Lote</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {allLotsList.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '24px 0' }}>
                    No hay lotes registrados.
                  </td>
                </tr>
              ) : (
                allLotsList.map((entry, idx) => {
                  const { product, lot } = entry;
                  const daysLeft = Math.ceil(
                    (new Date(lot.expirationDate).getTime() - new Date().getTime()) /
                      (1000 * 3600 * 24),
                  );

                  let badgeColor = 'expiry-normal';
                  let statusText = 'Saludable';
                  if (daysLeft <= 0) {
                    badgeColor = 'expiry-critical';
                    statusText = 'Vencido';
                  } else if (daysLeft <= 30) {
                    badgeColor = 'expiry-critical';
                    statusText = `Vence en ${daysLeft} d.`;
                  } else if (daysLeft <= 60) {
                    badgeColor = 'expiry-warning';
                    statusText = `Vence en ${daysLeft} d.`;
                  }

                  return (
                    <tr key={idx}>
                      <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>{product.sku}</td>
                      <td style={{ fontWeight: 500 }}>{product.name}</td>
                      <td style={{ fontFamily: 'monospace', fontWeight: 700 }}>{lot.lotNumber}</td>
                      <td>
                        {new Date(lot.expirationDate).toLocaleDateString('es-AR', {
                          timeZone: 'UTC',
                        })}
                      </td>
                      <td>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '6px',
                            fontWeight: 500,
                          }}
                        >
                          <span className={`expiry-dot ${badgeColor}`} />
                          {statusText}
                        </span>
                      </td>
                      <td>{renderLocationTag(lot.location)}</td>
                      <td style={{ fontWeight: 700, textAlign: 'right' }}>{lot.stock} u.</td>
                      <td>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() =>
                              setStockModal({
                                open: true,
                                product,
                                quantityChange: 0,
                                reason: 'Ajuste de stock desde panel de vencimientos',
                                lotNumber: lot.lotNumber,
                                isNewLot: false,
                                expirationDate: lot.expirationDate,
                                location: lot.location || 'S/U',
                              })
                            }
                          >
                            Ajustar
                          </button>
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '4px 8px', fontSize: '0.75rem' }}
                            onClick={() =>
                              onPrintLabels([
                                {
                                  isLotLabel: true,
                                  productName: product.name,
                                  sku: product.sku,
                                  lotNumber: lot.lotNumber,
                                  expirationDate: lot.expirationDate,
                                  location: lot.location,
                                },
                              ])
                            }
                          >
                            <Printer size={12} />
                          </button>
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
    </div>
  );
};
