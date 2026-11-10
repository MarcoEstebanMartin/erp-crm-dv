import React, { useState, useMemo } from 'react';
import type { Product } from '../../types';
import { DEPOSITO_MATRIX, DEPOSITO_SLOTS, SECTORS_INFO } from './depositomapaData';
import type { DepositSlot, SlotCellData } from './depositomapaData';
import { Slot3DInspectorModal } from './Slot3DInspectorModal';
import { WarehouseSlotInspectorSidebar } from './WarehouseSlotInspectorSidebar';
import { Maximize2, Minimize2, Search } from 'lucide-react';

interface WarehouseMapProps {
  products: Product[];
  onStockUpdated: () => void;
}

export const WarehouseMap: React.FC<WarehouseMapProps> = ({ products, onStockUpdated }) => {
  const [selectedWarehouse, setSelectedWarehouse] = useState<'ALL' | 'D1' | 'D2' | 'D3'>('D1');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [selectedSlot, setSelectedSlot] = useState<DepositSlot | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const slotStockMap = useMemo(() => {
    const map: Record<string, { totalStock: number; itemsCount: number; hasStock: boolean }> = {};
    (products || []).forEach((p) => {
      if (p.lots && p.lots.length > 0) {
        p.lots.forEach((l) => {
          if (l.stock > 0 && l.location) {
            const baseSlotCode = l.location.split('-').slice(0, 3).join('-');
            if (!map[baseSlotCode]) map[baseSlotCode] = { totalStock: 0, itemsCount: 0, hasStock: true };
            map[baseSlotCode].totalStock += l.stock;
            map[baseSlotCode].itemsCount += 1;
          }
        });
      } else if (p.stock > 0 && p.defaultLocation) {
        const baseSlotCode = p.defaultLocation.split('-').slice(0, 3).join('-');
        if (!map[baseSlotCode]) map[baseSlotCode] = { totalStock: 0, itemsCount: 0, hasStock: true };
        map[baseSlotCode].totalStock += p.stock;
        map[baseSlotCode].itemsCount += 1;
      }
    });
    return map;
  }, [products]);

  const filteredMatrix = useMemo(() => {
    if (selectedWarehouse === 'D1') return DEPOSITO_MATRIX.slice(0, 7);
    if (selectedWarehouse === 'D2') return DEPOSITO_MATRIX.slice(8, 21);
    if (selectedWarehouse === 'D3') return DEPOSITO_MATRIX.slice(22, 32);
    return DEPOSITO_MATRIX;
  }, [selectedWarehouse]);

  const matchingSlotCodes = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const query = searchQuery.toLowerCase().trim();
    const matches = new Set<string>();
    DEPOSITO_SLOTS.forEach((s) => {
      if (s.code.toLowerCase().includes(query) || s.nivel.toLowerCase().includes(query)) matches.add(s.code);
    });
    (products || []).forEach((p) => {
      if (p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)) {
        (p.lots || []).forEach((l) => { if (l.location) matches.add(l.location.split('-').slice(0, 3).join('-')); });
      }
    });
    return matches;
  }, [searchQuery, products]);

  const handleCellClick = (cell: SlotCellData) => {
    if (!cell.is_storage) return;
    const targetCode = `${cell.dep_id}-R${cell.r.toString().padStart(2, '0')}-C${cell.c.toString().padStart(2, '0')}`;
    const foundSlot = DEPOSITO_SLOTS.find((s) => s.code === targetCode) || DEPOSITO_SLOTS.find((s) => s.dep_id === cell.dep_id && s.row === cell.r && s.col === cell.c);
    if (foundSlot) setSelectedSlot(foundSlot);
  };

  return (
    <div className={`wms-map-root ${isFullscreen ? 'wms-map-fullscreen' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>🗺️ Plano Gráfico Interactivo del Depósito</h3>
            <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '3px 9px' }}>210 Slots Fiel a depositomapa.xlsx</span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>Hacé clic en cualquier celda para abrir el inspector 3D de los 3 pisos (Niveles A, B, C) y cargar mercadería.</p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '220px' }}>
            <input type="text" className="form-control" placeholder="Buscar Slot o Producto..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ fontSize: '0.8rem', paddingLeft: '28px', height: '34px' }} />
            <Search size={14} style={{ position: 'absolute', left: '9px', top: '10px', color: '#94a3b8' }} />
          </div>

          <div className="btn-group" style={{ display: 'flex', gap: '4px' }}>
            {([
              { id: 'ALL', label: '🌐 Planta Completa' },
              { id: 'D1', label: '🏢 Depósito 1' },
              { id: 'D2', label: '🏢 Depósito 2' },
              { id: 'D3', label: '🏢 Depósito 3' },
            ] as const).map((btn) => (
              <button
                key={btn.id} type="button" className={`btn ${selectedWarehouse === btn.id ? 'btn-primary' : 'btn-secondary'}`}
                style={{ fontSize: '0.78rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600 }}
                onClick={() => { setSelectedWarehouse(btn.id); setSelectedSector('ALL'); }}
              >
                {btn.label}
              </button>
            ))}
          </div>

          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? 'Salir Pantalla Completa' : 'Pantalla Completa'}</span>
          </button>
        </div>
      </div>

      <div style={{ padding: '10px 16px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', gap: '8px', fontSize: '0.78rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: '4px' }}>Filtrar Cámara / Sector:</span>
        {Object.entries(SECTORS_INFO).filter(([key]) => key !== 'GENERAL').map(([key, info]) => {
          const isSelected = selectedSector === key;
          return (
            <button
              key={key} type="button" className="btn btn-sm"
              style={{ backgroundColor: isSelected ? info.color : info.bg, color: isSelected ? '#ffffff' : info.color, border: `1.5px solid ${info.border}`, fontWeight: 600, fontSize: '0.76rem', padding: '4px 10px', borderRadius: '6px' }}
              onClick={() => { setSelectedSector(selectedSector === key ? 'ALL' : key); if (selectedWarehouse === 'ALL') setSelectedWarehouse('D1'); }}
            >
              {info.icon} {info.label}
            </button>
          );
        })}
        {selectedSector !== 'ALL' && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', marginLeft: 'auto', color: 'var(--text-secondary)' }} onClick={() => setSelectedSector('ALL')}>
            🔄 Limpiar Selección
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '16px', alignItems: 'flex-start', width: '100%' }}>
        <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px', overflowX: 'auto', maxWidth: '100%', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'block', width: '100%', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '8px', overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'separate', borderSpacing: '3px', width: 'max-content', minWidth: '100%', fontSize: '0.66rem', fontFamily: 'sans-serif' }}>
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
                      const isChamberMatch = selectedSector !== 'ALL' && isSlot && cell?.chamber === selectedSector;
                      const isSearchMatch = slotCode ? matchingSlotCodes.has(slotCode) : false;

                      let bg = 'transparent', color = '#334155', border = '1px solid transparent';
                      const chamberMeta = cell?.chamber ? SECTORS_INFO[cell.chamber] : null;
                      if (!isSlot) {
                        color = '#94a3b8';
                        if (cellText && cellText.trim() !== '') { border = '1px solid #cbd5e1'; color = '#0f172a'; bg = '#f8fafc'; }
                      } else {
                        bg = cell?.fill && cell.fill.toUpperCase() !== '#000000' && cell.fill.toUpperCase() !== '#000' ? cell.fill : '#ffffff';
                        border = '1px solid #cbd5e1';
                        if (chamberMeta && chamberMeta !== SECTORS_INFO.GENERAL) { bg = chamberMeta.bg; color = chamberMeta.color; border = `1.5px solid ${chamberMeta.border}`; }
                        if (cell?.fill && cell.fill.toUpperCase() !== '#FFFFFF' && cell.fill.toUpperCase() !== '#000000') { bg = cell.fill; border = '1px solid rgba(0,0,0,0.18)'; color = '#0f172a'; }
                        else if (cellText === 'A') { bg = '#ffffff'; color = '#334155'; border = '1px solid #94a3b8'; }
                        else if (cellText === 'A-B') { bg = '#fef3c7'; color = '#92400e'; border = '1.5px solid #f59e0b'; }
                        else if (cellText === 'A-B-C') { bg = '#dbeafe'; color = '#1e40af'; border = '1.5px solid #3b82f6'; }
                        else if (cellText === 'A-B-C-D-E-F') { bg = '#dcfce7'; color = '#166534'; border = '2px solid #22c55e'; }
                      }

                      return (
                        <td
                          key={cIdx} onClick={() => cell && handleCellClick(cell)}
                          style={{
                            width: '36px', minWidth: '36px', maxWidth: '36px', height: '34px',
                            border: isSelected ? '2.5px solid #007AFF' : isSearchMatch ? '2.5px solid #eab308' : isChamberMatch ? '2.5px solid #0284c7' : hasStock ? '2px solid #22c55e' : border,
                            backgroundColor: isSelected ? '#e0f2fe' : isSearchMatch ? '#fef9c3' : isChamberMatch ? '#bae6fd' : hasStock ? '#dcfce7' : bg,
                            color: isSelected ? '#007AFF' : isChamberMatch ? '#0369a1' : hasStock ? '#15803d' : color,
                            fontWeight: isSlot || (cellText && cellText.length > 2) ? 'bold' : 'normal',
                            fontSize: !isSlot && cellText && cellText.length > 3 ? '0.6rem' : '0.66rem',
                            padding: '1px 2px', textAlign: 'center', cursor: isSlot ? 'pointer' : 'default', userSelect: 'none',
                            whiteSpace: !isSlot ? 'normal' : 'nowrap', wordBreak: 'break-word', lineHeight: 1.1, overflow: 'hidden', borderRadius: isSlot ? '5px' : '3px',
                          }}
                          title={isSlot && slotCode ? `Slot ${slotCode} (${cellText}) - ${hasStock ? `${stockData?.totalStock} u.` : 'Vacío'}` : cellText}
                        >
                          {isSlot ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                              <span>{cellText}</span>
                              {hasStock && <span style={{ color: '#22c55e', fontSize: '0.6rem' }}>🟢</span>}
                            </div>
                          ) : cellText}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <WarehouseSlotInspectorSidebar selectedSlot={selectedSlot} products={products} onOpen3DModal={() => setIs3DModalOpen(true)} />
      </div>

      {selectedSlot && (
        <Slot3DInspectorModal isOpen={is3DModalOpen} onClose={() => setIs3DModalOpen(false)} slot={selectedSlot} products={products} onStockUpdated={onStockUpdated} />
      )}
    </div>
  );
};
