import React from 'react';
import type { Order } from '../../types';
import { getProductLocation } from './depositoHelpers';
import { extractCleanLotNumber, formatCleanExpirationDate } from '../stock/lotLabel';

interface DepositoPrintLayoutsProps {
  labelsToPrint: any[];
  showConsolidatedView: boolean;
  selectedOrdersList: Order[];
  consolidatedItems: any[];
}

export const DepositoPrintLayouts: React.FC<DepositoPrintLayoutsProps> = ({
  labelsToPrint,
  showConsolidatedView,
  selectedOrdersList,
  consolidatedItems,
}) => {
  return (
    <>
      {labelsToPrint.length > 0 && (
        <div className="print-only-layout" style={{ display: 'none' }}>
          {labelsToPrint.map((label, idx) => {
            if (label.isLotLabel) {
              return (
                <div
                  key={idx}
                  className="label-card"
                  style={{
                    width: '80mm',
                    height: '80mm',
                    border: '2px solid #000',
                    padding: '16px',
                    margin: '0 auto 20px auto',
                    boxSizing: 'border-box',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between',
                    fontFamily: 'monospace',
                    fontSize: '11px',
                    backgroundColor: '#fff',
                    color: '#000',
                    pageBreakAfter: 'always',
                  }}
                >
                  <div>
                    <div style={{ borderBottom: '1px solid #000', paddingBottom: '6px', marginBottom: '8px', textAlign: 'center' }}>
                      <span style={{ fontSize: '13px', fontWeight: 'bold' }}>CONTROL DE LOTE - WMS</span>
                    </div>
                    <div style={{ marginBottom: '8px' }}>
                      <strong>ARTÍCULO:</strong>
                      <div style={{ fontSize: '12px', fontWeight: 'bold', marginTop: '2px' }}>{label.productName}</div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <strong>SKU:</strong>
                        <div style={{ fontWeight: 'bold', fontSize: '11px', fontFamily: 'monospace' }}>{label.sku}</div>
                      </div>
                      <div>
                        <strong>UBICACIÓN:</strong>
                        <div style={{ fontWeight: 'bold', fontSize: '11px' }}>{label.location || 'S/U'}</div>
                      </div>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '8px', marginBottom: '8px' }}>
                      <div>
                        <strong>LOTE:</strong>
                        <div style={{ fontWeight: 'bold', fontSize: '13px', fontFamily: 'monospace', color: '#000' }}>{extractCleanLotNumber(label.lotNumber)}</div>
                      </div>
                      <div>
                        <strong>EXPIRA / VENCE:</strong>
                        <div style={{ fontWeight: 'bold' }}>{formatCleanExpirationDate(label.expirationDate)}</div>
                      </div>
                    </div>
                  </div>
                  <div style={{ borderTop: '2px dashed #000', paddingTop: '10px', marginTop: '6px', textAlign: 'center' }}>
                    <div style={{ letterSpacing: '3px', fontSize: '14px', fontWeight: 'bold', fontFamily: 'monospace', marginBottom: '4px' }}>
                      ||||| | || ||||| | |||
                    </div>
                    <span style={{ fontSize: '9px', color: '#666' }}>
                      {label.sku}-{extractCleanLotNumber(label.lotNumber)}
                    </span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={idx}
                className="label-card"
                style={{
                  width: '80mm',
                  height: '80mm',
                  border: '2px solid #000',
                  padding: '16px',
                  margin: '0 auto 20px auto',
                  boxSizing: 'border-box',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  fontFamily: 'monospace',
                  fontSize: '11px',
                  backgroundColor: '#fff',
                  color: '#000',
                  pageBreakAfter: 'always',
                }}
              >
                <div>
                  <div style={{ borderBottom: '1px solid #000', paddingBottom: '6px', marginBottom: '8px', textAlign: 'center' }}>
                    <span style={{ fontSize: '14px', fontWeight: 'bold' }}>ARMADO DE PEDIDOS</span>
                  </div>
                  <div style={{ marginBottom: '6px' }}>
                    <strong>CLIENTE:</strong>
                    <div style={{ fontSize: '13px', fontWeight: 'bold', marginTop: '2px' }}>{label.client}</div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
                    <div>
                      <strong>RUTA:</strong>
                      <div style={{ fontWeight: 'bold' }}>{label.route}</div>
                    </div>
                    <div>
                      <strong>ORDEN RUTA:</strong>
                      <div style={{ fontWeight: 'bold', fontSize: '12px' }}>{label.sequence}</div>
                    </div>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '6px' }}>
                    <div>
                      <strong>PEDIDO:</strong>
                      <div style={{ fontWeight: 'bold' }}>#{label.orderId}</div>
                    </div>
                    <div>
                      <strong>FECHA:</strong>
                      <div>{new Date().toLocaleDateString('es-AR')}</div>
                    </div>
                  </div>
                </div>
                <div style={{ borderTop: '2px dashed #000', paddingTop: '10px', marginTop: '10px' }}>
                  <div style={{ fontSize: '12px', fontWeight: 'bold', textAlign: 'center', backgroundColor: '#e2e8f0', padding: '4px', borderRadius: '4px', border: '1px solid #000', marginBottom: '6px' }}>
                    {label.zone}
                  </div>
                  <div style={{ fontSize: '16px', fontWeight: 'bold', textAlign: 'center' }}>
                    BULTO: {label.index} de {label.total}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showConsolidatedView && (
        <div className="print-consolidated-sheet" style={{ display: 'none' }}>
          <div style={{ textAlign: 'center', marginBottom: '20px', borderBottom: '2px solid #000', paddingBottom: '10px' }}>
            <h2 style={{ margin: 0, textTransform: 'uppercase', fontSize: '16px', letterSpacing: '0.05em' }}>
              Planilla de Picking Consolidada
            </h2>
            <div style={{ fontSize: '11px', marginTop: '6px' }}>
              <strong>Fecha Emisión:</strong> {new Date().toLocaleDateString('es-AR')} |{' '}
              <strong>Total Pedidos:</strong> {selectedOrdersList.length} (
              {selectedOrdersList.map((o) => `#${o.id}`).join(', ')})
            </div>
            <div style={{ fontSize: '11px', marginTop: '3px' }}>
              <strong>Rutas de Despacho:</strong>{' '}
              {Array.from(
                new Set(selectedOrdersList.map((o) => o.persona?.route || 'RETIRO EN DEPÓSITO')),
              ).join(', ')}
            </div>
          </div>

          {['FRIO', 'TABLA', 'CAJAS'].map((zone) => {
            const zoneItems = consolidatedItems.filter(
              (i) => (i.product?.pickingZone || i.product?.rubro?.pickingZone || 'CAJAS') === zone,
            );
            if (zoneItems.length === 0) return null;
            const zoneName =
              zone === 'FRIO'
                ? '❄️ SECTOR FRÍO'
                : zone === 'TABLA'
                  ? '🍾 SECTOR TABLA/BEBIDAS'
                  : '📦 SECTOR SECOS/CAJAS';

            return (
              <div key={zone} style={{ marginBottom: '20px', pageBreakInside: 'avoid' }}>
                <h3 style={{ borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}>
                  {zoneName} ({zoneItems.length} artículos)
                </h3>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                  <thead>
                    <tr>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '25px', textAlign: 'center' }}>[ ]</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '90px', textAlign: 'left' }}>Ubicación</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '90px', textAlign: 'left' }}>SKU</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Artículo</th>
                      <th style={{ border: '1px solid #000', padding: '4px', width: '70px', textAlign: 'right' }}>Cant.</th>
                      <th style={{ border: '1px solid #000', padding: '4px', textAlign: 'left' }}>Detalle de Pedidos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {zoneItems.map((item, idx) => (
                      <tr key={idx}>
                        <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'center', fontWeight: 'bold', fontSize: '12px' }}>☐</td>
                        <td style={{ border: '1px solid #000', padding: '4px', fontFamily: 'monospace', fontWeight: 'bold' }}>
                          {getProductLocation(item.product)}
                        </td>
                        <td style={{ border: '1px solid #000', padding: '4px', fontFamily: 'monospace' }}>{item.product.sku}</td>
                        <td style={{ border: '1px solid #000', padding: '4px' }}>{item.product.name}</td>
                        <td style={{ border: '1px solid #000', padding: '4px', textAlign: 'right', fontWeight: 'bold', fontSize: '11px' }}>
                          {item.totalQuantity} u.
                        </td>
                        <td style={{ border: '1px solid #000', padding: '4px', fontSize: '9px', color: '#444' }}>
                          {item.orderDetails.map((det: any) => `#${det.orderId}(${det.quantity}u)`).join(' | ')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            );
          })}
        </div>
      )}

      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          body.printing-labels > * { display: none !important; }
          body.printing-labels .print-only-layout { display: block !important; position: absolute; left: 0; top: 0; width: 100% !important; }
          body.printing-labels .label-card { page-break-after: always; box-shadow: none !important; border: 2px solid #000 !important; }
          body.printing-consolidated > * { display: none !important; }
          body.printing-consolidated .print-consolidated-sheet { display: block !important; position: absolute; left: 0; top: 0; width: 100% !important; background: #fff !important; color: #000 !important; }
        }
      `,
        }}
      />
    </>
  );
};
