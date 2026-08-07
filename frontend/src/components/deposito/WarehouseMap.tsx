import React, { useState, useMemo } from 'react';
import type { Product, ProductLot } from '../../types';
import { DEPOSITO_MATRIX, DEPOSITO_SLOTS, SECTORS_INFO } from './depositomapaData';
import type { DepositSlot, SlotCellData } from './depositomapaData';

import { Slot3DInspectorModal } from './Slot3DInspectorModal';
import { Maximize2, Minimize2, Search, RefreshCw, Box, Layers, ShieldCheck, CheckCircle2, ChevronRight } from 'lucide-react';

interface WarehouseMapProps {
  products: Product[];
  onStockUpdated: () => void;
}

export const WarehouseMap: React.FC<WarehouseMapProps> = ({ products, onStockUpdated }) => {
  const [selectedWarehouse, setSelectedWarehouse] = useState<'ALL' | 'D1' | 'D2' | 'D3'>('D1');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [selectedSlot, setSelectedSlot] = useState<DepositSlot | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  
  // Modal de Inspección 3D por Niveles (3 Pisos)
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Mapear stock ocupado por cada código de slot (ej: D1-R06-C07)
  const slotStockMap = useMemo(() => {
    const map: Record<string, { totalStock: number; itemsCount: number; hasStock: boolean }> = {};

    (products || []).forEach(p => {
      if (p.lots && p.lots.length > 0) {
        p.lots.forEach(l => {
          if (l.stock > 0 && l.location) {
            // Extraer el código base del slot (ej: D1-R06-C07 desde D1-R06-C07-A)
            const baseSlotCode = l.location.split('-').slice(0, 3).join('-');
            if (!map[baseSlotCode]) {
              map[baseSlotCode] = { totalStock: 0, itemsCount: 0, hasStock: true };
            }
            map[baseSlotCode].totalStock += l.stock;
            map[baseSlotCode].itemsCount += 1;
          }
        });
      } else if (p.stock > 0 && p.defaultLocation) {
        const baseSlotCode = p.defaultLocation.split('-').slice(0, 3).join('-');
        if (!map[baseSlotCode]) {
          map[baseSlotCode] = { totalStock: 0, itemsCount: 0, hasStock: true };
        }
        map[baseSlotCode].totalStock += p.stock;
        map[baseSlotCode].itemsCount += 1;
      }
    });


    return map;
  }, [products]);

  // Filtrar filas según el depósito seleccionado
  const filteredMatrix = useMemo(() => {
    if (selectedWarehouse === 'D1') return DEPOSITO_MATRIX.slice(0, 10);
    if (selectedWarehouse === 'D2') return DEPOSITO_MATRIX.slice(10, 24);
    if (selectedWarehouse === 'D3') return DEPOSITO_MATRIX.slice(24, 35);
    return DEPOSITO_MATRIX;
  }, [selectedWarehouse]);

  // Buscar slot por código o producto en el mapa
  const matchingSlotCodes = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const query = searchQuery.toLowerCase().trim();
    const matches = new Set<string>();

    DEPOSITO_SLOTS.forEach(s => {
      if (s.code.toLowerCase().includes(query) || s.nivel.toLowerCase().includes(query)) {
        matches.add(s.code);
      }
    });

    (products || []).forEach(p => {
      if (p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)) {
        if (p.lots) {
          p.lots.forEach(l => {
            if (l.location) {
              const base = l.location.split('-').slice(0, 3).join('-');
              matches.add(base);
            }
          });
        }
      }
    });


    return matches;
  }, [searchQuery, products]);

  // Manejar clic en una celda: Selecciona el slot para inspección en el panel lateral
  const handleCellClick = (cell: SlotCellData) => {
    if (!cell.is_storage) return;
    const targetCode = `${cell.dep_id}-R${cell.r.toString().padStart(2, '0')}-C${cell.c.toString().padStart(2, '0')}`;
    const foundSlot = DEPOSITO_SLOTS.find(s => s.code === targetCode) ||
                      DEPOSITO_SLOTS.find(s => s.dep_id === cell.dep_id && s.row === cell.r && s.col === cell.c);
    if (foundSlot) {
      setSelectedSlot(foundSlot);
    }
  };

  return (
    <div className={`wms-map-root ${isFullscreen ? 'wms-map-fullscreen' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      
      {/* 1. HEADER DE CONTROL PRINCIPAL */}
      <div style={{
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '14px 18px',
        display: 'flex',
        justify: 'space-between',
        alignItems: 'center',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>
              🗺️ Plano Gráfico Interactivo del Depósito
            </h3>
            <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '3px 9px' }}>
              210 Slots Fiel a depositomapa.xlsx
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            Hacé clic en cualquier celda para abrir el inspector 3D de los 3 pisos (Niveles A, B, C) y cargar mercadería.
          </p>
        </div>

        {/* Buscador y Controles */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Buscador de Slots / Productos */}
          <div style={{ position: 'relative', width: '220px' }}>
            <input
              type="text"
              className="form-control"
              placeholder="Buscar Slot o Producto..."
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.8rem', paddingLeft: '28px', height: '34px' }}
            />
            <Search size={14} style={{ position: 'absolute', left: '9px', top: '10px', color: '#94a3b8' }} />
          </div>

          {/* Selector de Depósitos */}
          <div className="btn-group" style={{ display: 'flex', gap: '4px' }}>
            <button
              type="button"
              className={`btn ${selectedWarehouse === 'ALL' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.78rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600 }}
              onClick={() => { setSelectedWarehouse('ALL'); setSelectedSector('ALL'); }}
            >
              🌐 Planta Completa
            </button>
            <button
              type="button"
              className={`btn ${selectedWarehouse === 'D1' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.78rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600 }}
              onClick={() => { setSelectedWarehouse('D1'); setSelectedSector('ALL'); }}
            >
              🏢 Depósito 1
            </button>
            <button
              type="button"
              className={`btn ${selectedWarehouse === 'D2' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.78rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600 }}
              onClick={() => { setSelectedWarehouse('D2'); setSelectedSector('ALL'); }}
            >
              🏢 Depósito 2
            </button>
            <button
              type="button"
              className={`btn ${selectedWarehouse === 'D3' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ fontSize: '0.78rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600 }}
              onClick={() => { setSelectedWarehouse('D3'); setSelectedSector('ALL'); }}
            >
              🏢 Depósito 3
            </button>
          </div>

          {/* Botón Pantalla Completa */}
          <button
            type="button"
            className="btn btn-secondary"
            style={{ fontSize: '0.78rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }}
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? 'Salir Pantalla Completa' : 'Pantalla Completa'}</span>
          </button>
        </div>
      </div>

      {/* 2. FILTRADO RÁPIDO POR CÁMARAS Y SECTORES */}
      <div style={{
        padding: '10px 16px',
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: '8px',
        display: 'flex',
        gap: '8px',
        fontSize: '0.78rem',
        flexWrap: 'wrap',
        alignItems: 'center'
      }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: '4px' }}>Filtrar Cámara / Sector:</span>

        {Object.entries(SECTORS_INFO).filter(([key]) => key !== 'GENERAL').map(([key, info]) => {
          const isSelected = selectedSector === key;
          return (
            <button
              key={key}
              type="button"
              className="btn btn-sm"
              style={{
                backgroundColor: isSelected ? info.color : info.bg,
                color: isSelected ? '#ffffff' : info.color,
                border: `1.5px solid ${info.border}`,
                fontWeight: 600,
                fontSize: '0.76rem',
                padding: '4px 10px',
                borderRadius: '6px',
                transition: 'all 0.15s ease'
              }}
              onClick={() => {
                setSelectedSector(selectedSector === key ? 'ALL' : key);
                if (selectedWarehouse === 'ALL') setSelectedWarehouse('D1');
              }}
            >
              {info.icon} {info.label}
            </button>
          );
        })}

        {selectedSector !== 'ALL' && (
          <button
            type="button"
            className="btn btn-ghost btn-sm"
            style={{ fontSize: '0.75rem', marginLeft: 'auto', color: 'var(--text-secondary)' }}
            onClick={() => setSelectedSector('ALL')}
          >
            🔄 Limpiar Selección
          </button>
        )}
      </div>

      {/* 3. VISTA PRINCIPAL: MAPA 2D GRILLA + PANEL LATERAL INSPECTOR */}
      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%' }}>
        
        {/* GRILLA 2D INTERACTIVA */}
        <div style={{
          flex: 1,
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '14px',
          overflowX: 'auto',
          maxWidth: '100%',
          boxShadow: '0 1px 3px rgba(0,0,0,0.02)'
        }}>
          <div style={{
            display: 'block',
            width: '100%',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '8px',
            padding: '8px',
            overflowX: 'auto'
          }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: '2px', width: '100%', tableLayout: 'fixed', fontSize: '0.66rem', fontFamily: 'sans-serif' }}>
              <tbody>
                {filteredMatrix.map((row, rIdx) => (
                  <tr key={rIdx}>
                    {row.map((cell, cIdx) => {
                      const isSlot = Boolean(cell?.is_storage);
                      const cellText = cell?.val || '';
                      const slotCode = isSlot && cell ? `${cell.dep_id}-R${cell.r.toString().padStart(2, '0')}-C${cell.c.toString().padStart(2, '0')}` : null;
                      
                      const stockData = slotCode ? slotStockMap[slotCode] : null;
                      const hasStock = Boolean(stockData && stockData.hasStock);
                      const isSelected = selectedSlot && slotCode && selectedSlot.code === slotCode;
                      const isChamberMatch = selectedSector !== 'ALL' && cell?.chamber === selectedSector;
                      const isSearchMatch = slotCode ? matchingSlotCodes.has(slotCode) : false;

                      let bg = (cell?.fill && cell.fill.toUpperCase() !== '#000000' && cell.fill.toUpperCase() !== '#000') ? cell.fill : '#ffffff';
                      let color = '#334155';
                      let border = '1px solid #e2e8f0';

                      const chamberMeta = cell?.chamber ? SECTORS_INFO[cell.chamber] : null;
                      if (chamberMeta && chamberMeta !== SECTORS_INFO.GENERAL) {
                        bg = chamberMeta.bg;
                        color = chamberMeta.color;
                        border = `1.5px solid ${chamberMeta.border}`;
                      }

                      if (!isSlot) {
                        if (cellText && cellText.trim() !== '') {
                          border = '1px solid #cbd5e1';
                          color = '#0f172a';
                        } else if (!chamberMeta || chamberMeta === SECTORS_INFO.GENERAL) {
                          bg = '#fafafa';
                          border = '1px solid #f3f4f6';
                        }
                      }

                      if (isSlot) {
                        if (cellText === 'A') { bg = '#ffffff'; color = '#334155'; border = '1px solid #94a3b8'; }
                        else if (cellText === 'A-B') { bg = '#fef3c7'; color = '#92400e'; border = '1.5px solid #f59e0b'; }
                        else if (cellText === 'A-B-C') { bg = '#dbeafe'; color = '#1e40af'; border = '1.5px solid #3b82f6'; }
                        else if (cellText === 'A-B-C-D-E-F') { bg = '#dcfce7'; color = '#166534'; border = '2px solid #22c55e'; }
                      }

                      return (
                        <td
                          key={cIdx}
                          onClick={() => cell && handleCellClick(cell)}
                          style={{
                            border: isSelected 
                              ? '2.5px solid #007AFF' 
                              : isSearchMatch 
                              ? '2.5px solid #eab308'
                              : isChamberMatch 
                              ? '2.5px solid #0284c7' 
                              : hasStock 
                              ? '2px solid #22c55e' 
                              : border,
                            backgroundColor: isSelected 
                              ? '#e0f2fe' 
                              : isSearchMatch 
                              ? '#fef9c3'
                              : isChamberMatch 
                              ? '#bae6fd' 
                              : hasStock 
                              ? '#dcfce7' 
                              : bg,
                            color: isSelected ? '#007AFF' : isChamberMatch ? '#0369a1' : hasStock ? '#15803d' : color,
                            fontWeight: isSlot || (cellText && cellText.length > 2) ? 'bold' : 'normal',
                            fontSize: !isSlot && (cellText && cellText.length > 3) ? '0.6rem' : '0.66rem',
                            padding: '1px 2px',
                            textAlign: 'center',
                            height: '32px',
                            cursor: isSlot ? 'pointer' : 'default',
                            userSelect: 'none',
                            whiteSpace: !isSlot ? 'normal' : 'nowrap',
                            wordBreak: 'break-word',
                            lineHeight: 1.1,
                            overflow: 'hidden',
                            borderRadius: isSlot ? '4px' : '1px',
                            transition: 'all 0.1s ease'
                          }}
                          title={isSlot && slotCode ? `Slot ${slotCode} (${cellText}) - ${hasStock ? `${stockData?.totalStock} u.` : 'Vacío'}` : cellText}
                        >
                          {isSlot ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                              <span>{cellText}</span>
                              {hasStock && <span style={{ color: '#22c55e', fontSize: '0.6rem' }}>🟢</span>}
                            </div>
                          ) : (
                            cellText
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* PANEL LATERAL DE INSPECCIÓN Y RESUMEN */}
        <div style={{
          width: '340px',
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '16px',
          boxShadow: '0 1px 3px rgba(0,0,0,0.03)',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px'
        }}>
          <h4 style={{
            margin: 0,
            fontSize: '0.95rem',
            borderBottom: '1px solid var(--border-color)',
            paddingBottom: '8px',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            color: 'var(--text-primary)'
          }}>
            📍 Inspector del Slot Seleccionado
          </h4>

          {selectedSlot ? (
            <div>
              {/* Card Resumen del Slot */}
              <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', padding: '12px', borderRadius: '8px', marginBottom: '12px' }}>
                <div style={{ fontWeight: 800, fontSize: '1.08rem', color: 'var(--text-primary)', marginBottom: '2px' }}>
                  Slot {selectedSlot.code}
                </div>
                <div style={{ fontSize: '0.84rem', fontWeight: 700, color: '#2563eb', marginBottom: '4px' }}>
                  {selectedSlot.deposito} • {SECTORS_INFO[selectedSlot.chamber]?.label || 'General'}
                </div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
                  Fila {selectedSlot.row}, Columna {selectedSlot.col}. Configuración: <strong>{selectedSlot.nivel}</strong>.
                </div>
              </div>

              {/* Detalle de Mercadería y Botón 3D */}
              {(() => {
                const stockInfo = slotStockMap[selectedSlot.code];
                const matchingProducts: { product: Product; lot: ProductLot }[] = [];

                (products || []).forEach(p => {
                  if (p.lots && p.lots.length > 0) {
                    p.lots.forEach(l => {
                      if (l.stock > 0 && l.location && l.location.startsWith(selectedSlot.code)) {
                        matchingProducts.push({ product: p, lot: l });
                      }
                    });
                  } else if (p.stock > 0 && p.defaultLocation && p.defaultLocation.startsWith(selectedSlot.code)) {
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
                        updatedAt: new Date().toISOString()
                      }
                    });
                  }
                });


                return (
                  <div>
                    {matchingProducts.length === 0 ? (
                      <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
                        <div style={{ fontSize: '2.2rem', marginBottom: '6px' }}>⚪</div>
                        <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Slot Vacío / Disponible</div>
                        <p style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                          No hay mercadería asignada en ninguno de sus pisos.
                        </p>
                      </div>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '14px', maxHeight: '220px', overflowY: 'auto' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '0.76rem', fontWeight: 700, color: 'var(--text-secondary)' }}>MERCADERÍA EN STOCK</span>
                          <span className="badge badge-success" style={{ fontSize: '0.7rem' }}>🟢 OCUPADO</span>
                        </div>

                        {matchingProducts.map(({ product, lot }, idx) => (
                          <div key={idx} style={{ border: '1px solid var(--border-color)', borderRadius: '6px', padding: '8px 10px', backgroundColor: '#fafafa', fontSize: '0.8rem' }}>
                            <div style={{ fontWeight: 700, color: 'var(--text-primary)' }}>[{product.sku}] {product.name}</div>
                            <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--text-secondary)', marginTop: '2px', fontSize: '0.75rem' }}>
                              <span>Lote: {lot.lotNumber}</span>
                              <strong style={{ color: 'var(--color-primary)' }}>{lot.stock} u.</strong>
                            </div>
                            <div style={{ fontSize: '0.72rem', color: '#64748b', marginTop: '2px' }}>
                              Ubicación exact: {lot.location || selectedSlot.code}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* BOTÓN PRINCIPAL: ABRIR INSPECTOR 3D POR PISOS */}
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
                        boxShadow: '0 2px 8px rgba(0, 122, 255, 0.25)'
                      }}
                      onClick={() => setIs3DModalOpen(true)}
                    >
                      <Layers size={18} />
                      <span>Inspeccionar / Cargar en 3D (3 Pisos)</span>
                    </button>
                  </div>
                );
              })()}
            </div>
          ) : (
            <div style={{ padding: '40px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
              <div style={{ fontSize: '2.4rem', marginBottom: '8px' }}>👆</div>
              <div style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-primary)' }}>Seleccioná un Slot del Mapa</div>
              <p style={{ fontSize: '0.78rem', marginTop: '4px' }}>
                Hacé clic en cualquier celda para inspeccionar sus 3 pisos en vista tridimensional.
              </p>
            </div>
          )}

        </div>

      </div>

      {/* MODAL DE INSPECCIÓN 3D ISOMÉTRICA DE LOS 3 PISOS (A, B, C) */}
      {selectedSlot && (
        <Slot3DInspectorModal
          isOpen={is3DModalOpen}
          onClose={() => setIs3DModalOpen(false)}
          slot={selectedSlot}
          products={products}
          onStockUpdated={() => {
            onStockUpdated();
          }}
        />
      )}

    </div>
  );
};
