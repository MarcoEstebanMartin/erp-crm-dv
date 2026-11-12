import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Product } from '../../types';
import { SECTORS_INFO } from './depositomapaData';
import { Slot3DInspectorModal } from './Slot3DInspectorModal';
import { WarehouseSlotInspectorSidebar } from './WarehouseSlotInspectorSidebar';
import { WarehouseSlotConfigSidebar } from './WarehouseSlotConfigSidebar';
import {
  extractBaseSlotFromLocation,
  mergeWarehouseLayout,
  type MergedDepositSlot,
  type MergedSlotCellData,
  type WarehouseCellOverride,
} from './warehouseLayoutMerger';
import { Maximize2, Minimize2, Search, Settings2 } from 'lucide-react';
import { api } from '../../utils/api';

interface WarehouseMapProps {
  products: Product[];
  onStockUpdated: () => void;
  focusLocationCode?: string | null;
  onClearFocus?: () => void;
}

export const WarehouseMap: React.FC<WarehouseMapProps> = ({
  products,
  onStockUpdated,
  focusLocationCode,
  onClearFocus,
}) => {
  const isAdmin = api.getCurrentUser()?.role === 'ADMIN';
  const [selectedWarehouse, setSelectedWarehouse] = useState<'ALL' | 'D1' | 'D2' | 'D3'>('D1');
  const [selectedSector, setSelectedSector] = useState<string>('ALL');
  const [selectedSlotCode, setSelectedSlotCode] = useState<string | null>(null);
  const [selectedEditCode, setSelectedEditCode] = useState<string | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);
  const [customCells, setCustomCells] = useState<WarehouseCellOverride[]>([]);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [is3DModalOpen, setIs3DModalOpen] = useState(false);
  const [focusedLevel, setFocusedLevel] = useState<'A' | 'B' | 'C' | 'D' | 'E' | 'F' | null>(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const loadCustomCells = useCallback(async () => {
    try {
      const cells = await api.getWarehouseCells();
      if (Array.isArray(cells)) setCustomCells(cells);
    } catch {
      // Fallback limpio al plano base si no hay overrides
    }
  }, []);

  useEffect(() => {
    loadCustomCells();
  }, [loadCustomCells]);

  useEffect(() => {
    if (!focusLocationCode) return;
    const baseCode = extractBaseSlotFromLocation(focusLocationCode);
    if (!baseCode) return;
    const upper = focusLocationCode.trim().toUpperCase();
    const parts = upper.split('-');
    const lvl = parts[3] && /^[A-F]$/.test(parts[3]) ? (parts[3] as 'A' | 'B' | 'C' | 'D' | 'E' | 'F') : 'A';
    if (baseCode.startsWith('D2-')) setSelectedWarehouse('D2');
    else if (baseCode.startsWith('D3-')) setSelectedWarehouse('D3');
    else setSelectedWarehouse('D1');
    setSelectedSector('ALL');
    setIsEditMode(false);
    setSelectedSlotCode(baseCode);
    setFocusedLevel(lvl);
  }, [focusLocationCode]);

  const { mergedMatrix, mergedSlots, originalCellByCode, activeSlotsCount } = useMemo(
    () => mergeWarehouseLayout(customCells),
    [customCells],
  );

  const selectedSlot: MergedDepositSlot | null = useMemo(
    () => (selectedSlotCode ? mergedSlots.find((s) => s.code === selectedSlotCode) || null : null),
    [mergedSlots, selectedSlotCode],
  );

  const selectedEditCell: MergedSlotCellData | null = useMemo(() => {
    if (!selectedEditCode) return null;
    for (const row of mergedMatrix) {
      const found = row.find((c) => c.code === selectedEditCode);
      if (found) return found;
    }
    return null;
  }, [mergedMatrix, selectedEditCode]);

  const slotStockMap = useMemo(() => {
    const map: Record<string, { totalStock: number; itemsCount: number; hasStock: boolean; levels: Set<string> }> = {};
    (products || []).forEach((p) => {
      if (p.lots && p.lots.length > 0) {
        p.lots.forEach((l) => {
          const baseCode = extractBaseSlotFromLocation(l.location);
          if (l.stock > 0 && baseCode) {
            if (!map[baseCode]) map[baseCode] = { totalStock: 0, itemsCount: 0, hasStock: true, levels: new Set() };
            map[baseCode].totalStock += l.stock;
            map[baseCode].itemsCount += 1;
            const parts = (l.location || '').toUpperCase().split('-');
            map[baseCode].levels.add(parts[3] || 'A');
          }
        });
      } else {
        const baseCode = extractBaseSlotFromLocation(p.defaultLocation);
        if (p.stock > 0 && baseCode) {
          if (!map[baseCode]) map[baseCode] = { totalStock: 0, itemsCount: 0, hasStock: true, levels: new Set(['A']) };
          map[baseCode].totalStock += p.stock;
          map[baseCode].itemsCount += 1;
        }
      }
    });
    return map;
  }, [products]);

  const filteredMatrix = useMemo(() => {
    if (selectedWarehouse === 'D1') return mergedMatrix.slice(0, 7);
    if (selectedWarehouse === 'D2') return mergedMatrix.slice(8, 21);
    if (selectedWarehouse === 'D3') return mergedMatrix.slice(22, 32);
    return mergedMatrix;
  }, [mergedMatrix, selectedWarehouse]);

  const matchingSlotCodes = useMemo(() => {
    if (!searchQuery.trim()) return new Set<string>();
    const query = searchQuery.toLowerCase().trim();
    const matches = new Set<string>();
    mergedSlots.forEach((s) => {
      if (s.code.toLowerCase().includes(query) || s.nivel.toLowerCase().includes(query) || (s.customLabel && s.customLabel.toLowerCase().includes(query))) {
        matches.add(s.code);
      }
    });
    (products || []).forEach((p) => {
      if (p.name.toLowerCase().includes(query) || p.sku.toLowerCase().includes(query)) {
        (p.lots || []).forEach((l) => {
          const baseCode = extractBaseSlotFromLocation(l.location);
          if (l.stock > 0 && baseCode) matches.add(baseCode);
        });
      }
    });
    return matches;
  }, [searchQuery, products, mergedSlots]);

  const handleCellClick = (cell: MergedSlotCellData) => {
    if (isEditMode && isAdmin) {
      setSelectedEditCode(cell.code);
      return;
    }
    if (!cell.is_storage) return;
    setSelectedSlotCode(cell.code);
  };

  const editCellStockInfo = selectedEditCell ? slotStockMap[selectedEditCell.code] : undefined;

  return (
    <div className={`wms-map-root ${isFullscreen ? 'wms-map-fullscreen' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>🗺️ Plano Gráfico Interactivo del Depósito</h3>
            <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '3px 9px' }}>
              {activeSlotsCount} Slots Activos {customCells.length > 0 ? `(${customCells.length} personalizados)` : ''}
            </span>
          </div>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: 0 }}>
            {isEditMode
              ? 'Modo Configuración ADMIN activo: tocá cualquier celda (slot o pasillo) para editar sus pisos, sector o bloqueo.'
              : 'Tocá cualquier estantería para abrir el inspector 3D y ubicar mercadería sin alterar el stock contable.'}
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', width: '210px' }}>
            <input type="text" className="form-control" placeholder="Buscar Slot o Producto..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} style={{ fontSize: '0.8rem', paddingLeft: '28px', height: '34px' }} />
            <Search size={14} style={{ position: 'absolute', left: '9px', top: '10px', color: '#94a3b8' }} />
          </div>

          <div className="btn-group" style={{ display: 'flex', gap: '4px' }}>
            {([
              { id: 'ALL', label: '🌐 Planta' },
              { id: 'D1', label: '🏢 Dep. 1' },
              { id: 'D2', label: '🏢 Dep. 2' },
              { id: 'D3', label: '🏢 Dep. 3' },
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

          {isAdmin && (
            <button
              type="button"
              className={`btn ${isEditMode ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '0.78rem', padding: '5px 11px', borderRadius: '6px', fontWeight: 700,
                display: 'flex', alignItems: 'center', gap: '5px',
                ...(isEditMode ? { backgroundColor: '#0f172a', borderColor: '#0f172a', color: '#fff' } : {}),
              }}
              onClick={() => {
                const next = !isEditMode;
                setIsEditMode(next);
                if (next && selectedSlotCode) setSelectedEditCode(selectedSlotCode);
              }}
            >
              <Settings2 size={14} />
              <span>{isEditMode ? 'Finalizar Edición' : 'Configurar Slots'}</span>
            </button>
          )}

          <button type="button" className="btn btn-secondary" style={{ fontSize: '0.78rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '4px' }} onClick={() => setIsFullscreen(!isFullscreen)}>
            {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
            <span>{isFullscreen ? 'Salir' : 'Expandir'}</span>
          </button>
        </div>
      </div>

      {focusLocationCode && selectedSlot && (
        <div style={{ padding: '10px 16px', backgroundColor: '#eff6ff', border: '1.5px solid #3b82f6', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: '#1e3a8a', fontWeight: 700 }}>
            🎯 Mostrando ubicación <strong>{focusLocationCode}</strong> seleccionada desde la tabla de Stock.
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-primary btn-sm" style={{ fontSize: '0.76rem', fontWeight: 700, padding: '4px 12px', borderRadius: '6px' }} onClick={() => setIs3DModalOpen(true)}>
              📦 Abrir Estantería 3D (Nivel {focusedLevel || 'A'})
            </button>
            {onClearFocus && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.76rem', padding: '4px 10px', borderRadius: '6px' }} onClick={onClearFocus}>
                ✕ Cerrar aviso
              </button>
            )}
          </div>
        </div>
      )}

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
                      const slotCode = cell.code;
                      const stockData = isSlot ? slotStockMap[slotCode] : null;
                      const hasStock = Boolean(stockData && stockData.hasStock);
                      const isSelected = isEditMode ? selectedEditCode === slotCode : selectedSlot?.code === slotCode;
                      const isChamberMatch = selectedSector !== 'ALL' && isSlot && cell?.chamber === selectedSector;
                      const isSearchMatch = isSlot ? matchingSlotCodes.has(slotCode) : false;

                      let bg = 'transparent', color = '#334155', border = isEditMode ? '1px dashed #e2e8f0' : '1px solid transparent';
                      const chamberMeta = cell?.chamber ? SECTORS_INFO[cell.chamber] : null;
                      if (!isSlot) {
                        color = '#94a3b8';
                        if (cellText && cellText.trim() !== '') { border = '1px solid #cbd5e1'; color = '#0f172a'; bg = '#f8fafc'; }
                      } else if (cell.isBlocked) {
                        bg = '#fee2e2'; color = '#991b1b'; border = '1.5px dashed #ef4444';
                      } else {
                        bg = cell?.fill && cell.fill.toUpperCase() !== '#000000' && cell.fill.toUpperCase() !== '#000' ? cell.fill : '#ffffff';
                        border = '1px solid #cbd5e1';
                        if (chamberMeta && chamberMeta !== SECTORS_INFO.GENERAL) { bg = chamberMeta.bg; color = chamberMeta.color; border = `1.5px solid ${chamberMeta.border}`; }
                        if (cell?.fill && cell.fill.toUpperCase() !== '#FFFFFF' && cell.fill.toUpperCase() !== '#000000') { bg = cell.fill; border = '1px solid rgba(0,0,0,0.18)'; color = '#0f172a'; }
                        else if (cellText === 'A') { bg = '#ffffff'; color = '#334155'; border = '1px solid #94a3b8'; }
                        else if (cellText === 'A-B') { bg = '#fef3c7'; color = '#92400e'; border = '1.5px solid #f59e0b'; }
                        else if (cellText === 'A-B-C') { bg = '#dbeafe'; color = '#1e40af'; border = '1.5px solid #3b82f6'; }
                        else if (cellText === 'A-B-C-D' || cellText === 'A-B-C-D-E-F') { bg = '#dcfce7'; color = '#166534'; border = '2px solid #22c55e'; }
                      }

                      return (
                        <td
                          key={cIdx} onClick={() => handleCellClick(cell)}
                          style={{
                            width: '36px', minWidth: '36px', maxWidth: '36px', height: '34px',
                            border: isSelected ? '2.5px solid #007AFF' : isSearchMatch ? '2.5px solid #eab308' : isChamberMatch ? '2.5px solid #0284c7' : hasStock && !cell.isBlocked ? '2px solid #22c55e' : border,
                            backgroundColor: isSelected ? '#e0f2fe' : isSearchMatch ? '#fef9c3' : isChamberMatch ? '#bae6fd' : hasStock && !cell.isBlocked ? '#dcfce7' : bg,
                            color: isSelected ? '#007AFF' : isChamberMatch ? '#0369a1' : hasStock && !cell.isBlocked ? '#15803d' : color,
                            fontWeight: isSlot || (cellText && cellText.length > 2) ? 'bold' : 'normal',
                            fontSize: !isSlot && cellText && cellText.length > 3 ? '0.6rem' : '0.64rem',
                            padding: '1px 2px', textAlign: 'center', cursor: isSlot || isEditMode ? 'pointer' : 'default', userSelect: 'none',
                            whiteSpace: !isSlot ? 'normal' : 'nowrap', wordBreak: 'break-word', lineHeight: 1.1, overflow: 'hidden', borderRadius: isSlot ? '5px' : '3px',
                          }}
                          title={isSlot ? `Slot ${slotCode} (${cellText})${cell.customLabel ? ` [${cell.customLabel}]` : ''} - ${cell.isBlocked ? 'BLOQUEADO' : hasStock ? `${stockData?.totalStock} u.` : 'Vacío'}` : isEditMode ? `Pasillo ${slotCode} (clic para configurar)` : cellText}
                        >
                          {isSlot ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '1px' }}>
                              <span>{cellText}</span>
                              {cell.isBlocked ? <span style={{ fontSize: '0.58rem' }}>🔒</span> : hasStock ? <span style={{ color: '#22c55e', fontSize: '0.58rem' }}>🟢</span> : null}
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

        {isEditMode && isAdmin ? (
          <WarehouseSlotConfigSidebar
            cell={selectedEditCell}
            activeUnitsInCell={editCellStockInfo?.totalStock || 0}
            occupiedLevels={editCellStockInfo ? Array.from(editCellStockInfo.levels) : []}
            originalBlueprint={selectedEditCell ? originalCellByCode[selectedEditCell.code] : undefined}
            onSaved={loadCustomCells}
          />
        ) : (
          <WarehouseSlotInspectorSidebar selectedSlot={selectedSlot} products={products} onOpen3DModal={() => setIs3DModalOpen(true)} />
        )}
      </div>

      {selectedSlot && (
        <Slot3DInspectorModal isOpen={is3DModalOpen} onClose={() => setIs3DModalOpen(false)} slot={selectedSlot} initialLevel={focusedLevel} products={products} onStockUpdated={onStockUpdated} />
      )}
    </div>
  );
};
