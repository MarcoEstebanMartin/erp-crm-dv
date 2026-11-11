import React, { Fragment } from 'react';
import {
  cleanCategoryName,
  formatPriceListArs,
  type CategoryGroup,
  type PriceListProduct,
} from './priceListHelpers';

interface PriceListTableRendererProps {
  groupedData: CategoryGroup[];
  targetType: 'client' | 'staff';
  listDate: string;
  fontScaleConfig: any;
  getProductPrice: (p: PriceListProduct) => number;
  isPrintMode?: boolean;
}

export const PriceListTableRenderer: React.FC<PriceListTableRendererProps> = ({
  groupedData,
  targetType,
  listDate,
  fontScaleConfig,
  getProductPrice,
  isPrintMode = false,
}) => {
  const tableClass = isPrintMode ? 'price-list-print-table' : 'price-list-view-table';
  const colSpan = targetType === 'staff' ? 3 : 2;

  return (
    <div>
      {!isPrintMode && (
        <style>{`
          .price-list-view-table { width: 100%; border-collapse: collapse; font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif; }
          .price-list-view-table td { padding: ${fontScaleConfig.viewPadding}; font-size: ${fontScaleConfig.viewSize}; border-bottom: 1px solid #e5e5e7; color: #000; }
          .price-list-view-table tr.category-spacer td { border-bottom: none; padding: 5px 0; background: transparent; }
          .price-list-view-table td.category-header { background-color: #ededf2; font-weight: 800; font-size: ${fontScaleConfig.viewHeaderSize}; border-top: 1px solid #d1d1d6; border-bottom: 1.5px solid #1c1c1e; padding: 7px 8px 5px 8px; text-transform: uppercase; letter-spacing: 0.03em; color: #111; }
          @media print {
            .price-list-print-table { width: 100% !important; border-collapse: collapse !important; font-family: 'Plus Jakarta Sans', 'Inter', system-ui, sans-serif !important; }
            .price-list-print-table tr { page-break-inside: avoid !important; }
            .price-list-print-table td { padding: ${fontScaleConfig.printPadding} !important; font-size: ${fontScaleConfig.printSize} !important; border-bottom: 1px solid #e5e5e7 !important; color: #000000 !important; }
            .price-list-print-table tr.category-spacer td { border-bottom: none !important; padding: 4px 0 !important; background: transparent !important; }
            .price-list-print-table td.category-header { background-color: #e8e8ed !important; font-weight: 900 !important; font-size: ${fontScaleConfig.printHeaderSize} !important; border-top: 1px solid #bbb !important; border-bottom: 1.5px solid #000 !important; padding: 6px 8px 4px 8px !important; text-transform: uppercase !important; letter-spacing: 0.03em !important; print-color-adjust: exact !important; -webkit-print-color-adjust: exact !important; }
          }
        `}</style>
      )}

      <div style={{ borderBottom: isPrintMode ? '2.5px solid #000' : '2px solid #1c1c1e', paddingBottom: isPrintMode ? '8px' : '10px', marginBottom: isPrintMode ? '16px' : '18px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: isPrintMode ? '1.4rem' : '1.25rem', fontWeight: isPrintMode ? 900 : 800, margin: 0, textTransform: 'uppercase', letterSpacing: '-0.02em', color: '#000' }}>
            LISTA GENERAL DON VENANCIO
          </h1>
          <p style={{ fontSize: isPrintMode ? '0.78rem' : '0.73rem', fontWeight: isPrintMode ? 700 : 600, color: isPrintMode ? '#333' : '#555', margin: '3px 0 0 0', letterSpacing: '0.02em' }}>
            {targetType === 'client' ? 'TODOS LOS PRODUCTOS PRECIO FINAL' : 'PRECIOS CON Y SIN IVA'}
          </p>
        </div>
        <div style={{ fontSize: isPrintMode ? '0.95rem' : '0.85rem', fontWeight: isPrintMode ? 800 : 700, color: '#000' }}>{listDate}</div>
      </div>

      <table className={tableClass}>
        {!isPrintMode && (
          <thead>
            <tr style={{ borderBottom: '2px solid #1c1c1e', fontSize: fontScaleConfig.viewHeaderSize, fontWeight: 800 }}>
              <th style={{ textAlign: 'left', padding: '4px 6px', color: '#1c1c1e' }}>Producto</th>
              {targetType === 'staff' && <th style={{ textAlign: 'right', padding: '4px 6px', width: '92px', color: '#1c1c1e' }}>Sin IVA</th>}
              <th style={{ textAlign: 'right', padding: '4px 6px', width: '96px', color: '#1c1c1e' }}>Precio Final</th>
            </tr>
          </thead>
        )}
        <tbody>
          {isPrintMode && (
            <tr style={{ borderBottom: '2.5px solid #000', fontSize: fontScaleConfig.printHeaderSize, pageBreakInside: 'avoid', pageBreakAfter: 'avoid' }}>
              <td style={{ textAlign: 'left', fontWeight: 'bold', padding: '4px 6px' }}>Producto</td>
              {targetType === 'staff' && <td style={{ textAlign: 'right', fontWeight: 'bold', width: '100px', padding: '4px 6px' }}>Sin IVA</td>}
              <td style={{ textAlign: 'right', fontWeight: 'bold', width: '100px', padding: '4px 6px' }}>Precio Final</td>
            </tr>
          )}

          {groupedData.map((cat, idx) => {
            if (!cat) return null;
            return (
              <Fragment key={cat.key}>
                {idx > 0 && (
                  <tr className="category-spacer">
                    <td colSpan={colSpan} />
                  </tr>
                )}
                <tr style={isPrintMode ? { pageBreakInside: 'avoid', pageBreakAfter: 'avoid' } : undefined}>
                  <td colSpan={colSpan} className="category-header">{cleanCategoryName(cat.name)}</td>
                </tr>

                {cat.directProducts.map((p) => {
                  const finalPrice = getProductPrice(p);
                  return (
                    <tr key={p.sku || p.id}>
                      <td>{p.name}</td>
                      {targetType === 'staff' && <td style={{ width: '92px', textAlign: 'right', fontFamily: 'monospace', color: '#555' }}>{formatPriceListArs(finalPrice / 1.21)}</td>}
                      <td style={{ width: '96px', textAlign: 'right', fontWeight: 700, fontFamily: 'monospace' }}>{formatPriceListArs(finalPrice)}</td>
                    </tr>
                  );
                })}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};
