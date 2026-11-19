import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Product } from '../../types';
import { SECTORS_INFO } from './depositomapaData';
import { Slot3DInspectorModal } from './Slot3DInspectorModal';
import { WarehouseSlotInspectorSidebar } from './WarehouseSlotInspectorSidebar';
import { WarehouseSlotConfigSidebar } from './WarehouseSlotConfigSidebar';
import { WarehouseUnassignedTray } from './WarehouseUnassignedTray';
import {
  buildSlotStockSummaryMap,
  buildUnassignedTrayEntries,
  formatCompactSlotLevels,
  resolveWarehouseForSector,
  type UnassignedTrayItem,
} from './wmsMapHelpers';
import {
  extractBaseSlotFromLocation,
  mergeWarehouseLayout,
  type MergedDepositSlot,
  type MergedSlotCellData,
  type WarehouseCellOverride,
} from './warehouseLayoutMerger';
import { Clock, Lock, Maximize2, Minimize2, PackagePlus, Search, Settings2, X } from 'lucide-react';
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
  const [sidebarTab, setSidebarTab] = useState<'inspector' | 'tray'>('inspector');
  const [pendingPlaceItem, setPendingPlaceItem] = useState<UnassignedTrayItem | null>(null);

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

  const slotStockMap = useMemo(() => buildSlotStockSummaryMap(products), [products]);
  const unassignedItems = useMemo(() => buildUnassignedTrayEntries(products), [products]);

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
    if (pendingPlaceItem && !cell.isBlocked) {
      setFocusedLevel(null);
      setIs3DModalOpen(true);
    }
  };

  const editCellStockInfo = selectedEditCell ? slotStockMap[selectedEditCell.code] : undefined;

  return (
    <div className={`wms-map-root ${isFullscreen ? 'wms-map-fullscreen' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '14px', width: '100%' }}>
      <div style={{ backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', boxShadow: '0 1px 3px rgba(0,0,0,0.02)' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px', flexWrap: 'wrap' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)' }}>Mapa Depósito</h3>
            <span className="badge badge-success" style={{ fontSize: '0.72rem', padding: '3px 9px', fontVariantNumeric: 'tabular-nums' }}>
              {activeSlotsCount} Slots
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <search aria-label="Buscar slot o producto" style={{ position: 'relative', width: '210px' }}>
            <label htmlFor="wms-map-search" className="visually-hidden">Buscar slot o producto</label>
            <input
              id="wms-map-search"
              type="search"
              className="form-control"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              placeholder="Slot o producto..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: '0.8rem', paddingLeft: '28px', height: '34px' }}
            />
            <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: '9px', top: '10px', color: '#94a3b8' }} />
          </search>

          <div className="btn-group" style={{ display: 'flex', gap: '4px' }}>
            {([
              { id: 'ALL', label: 'Planta' },
              { id: 'D1', label: 'Dep. 1' },
              { id: 'D2', label: 'Dep. 2' },
              { id: 'D3', label: 'Dep. 3' },
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

          <button
            type="button"
            className={`btn ${sidebarTab === 'tray' && !isEditMode ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.78rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '5px' }}
            onClick={() => {
              setIsEditMode(false);
              setSidebarTab((prev) => (prev === 'tray' ? 'inspector' : 'tray'));
            }}
          >
            <PackagePlus size={14} aria-hidden="true" />
            <span>Por Ubicar ({unassignedItems.length})</span>
          </button>

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
                if (next) {
                  setPendingPlaceItem(null);
                  if (selectedSlotCode) setSelectedEditCode(selectedSlotCode);
                }
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

      {pendingPlaceItem && (
        <div role="status" style={{ padding: '10px 16px', backgroundColor: '#eff6ff', border: '1.5px solid #007AFF', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: '#1e3a8a', fontWeight: 700 }}>
            Ubicando [{pendingPlaceItem.product.sku}] {pendingPlaceItem.product.name} ({pendingPlaceItem.units} u.) — Seleccioná un slot libre del mapa
          </span>
          <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.76rem', padding: '4px 10px', borderRadius: '6px' }} onClick={() => setPendingPlaceItem(null)}>
            Cancelar
          </button>
        </div>
      )}

      {focusLocationCode && selectedSlot && (
        <div style={{ padding: '10px 16px', backgroundColor: '#eff6ff', border: '1.5px solid #3b82f6', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', color: '#1e3a8a', fontWeight: 700 }}>
            Ubicación <strong>{focusLocationCode}</strong>
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-primary btn-sm" style={{ fontSize: '0.76rem', fontWeight: 700, padding: '4px 12px', borderRadius: '6px' }} onClick={() => setIs3DModalOpen(true)}>
              Estantería 3D (Nivel {focusedLevel || 'A'})
            </button>
            {onClearFocus && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.76rem', padding: '4px 10px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={onClearFocus} aria-label="Cerrar aviso">
                <X size={13} aria-hidden="true" />
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ padding: '10px 16px', backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '8px', display: 'flex', gap: '8px', fontSize: '0.78rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontWeight: 700, color: 'var(--text-primary)', marginRight: '4px' }}>Sector:</span>
        {Object.entries(SECTORS_INFO).filter(([key]) => key !== 'GENERAL').map(([key, info]) => {
          const isSelected = selectedSector === key;
          return (
            <button
              key={key} type="button" className="btn btn-sm"
              style={{ backgroundColor: isSelected ? info.color : info.bg, color: isSelected ? '#ffffff' : info.color, border: `1.5px solid ${info.border}`, fontWeight: 600, fontSize: '0.76rem', padding: '4px 10px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
              onClick={() => {
                const next = selectedSector === key ? 'ALL' : key;
                setSelectedSector(next);
                if (next !== 'ALL') {
                  setSelectedWarehouse(resolveWarehouseForSector(next));
                }
              }}
            >
              <span aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: isSelected ? '#ffffff' : info.color, display: 'inline-block' }} />
              {info.label}
            </button>
          );
        })}
        {selectedSector !== 'ALL' && (
          <button type="button" className="btn btn-ghost btn-sm" style={{ fontSize: '0.75rem', marginLeft: 'auto', color: 'var(--text-secondary)' }} onClick={() => setSelectedSector('ALL')}>
            Limpiar
          </button>
        )}
      </div>

      <div style={{ display: 'flex', gap: '14px', fontSize: '0.74rem', color: 'var(--text-secondary)', alignItems: 'center', flexWrap: 'wrap', padding: '0 4px' }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#ffffff', border: '1.5px solid #94a3b8' }} /> Vacío</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#ecfdf5', border: '1.5px solid #16a34a' }} /> Ocupado OK</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#fffbeb', border: '1.5px solid #d97706' }} /> Por vencer</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#fef2f2', border: '1.5px solid #E30613' }} /> Vencido</span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}><span style={{ width: '10px', height: '10px', borderRadius: '3px', backgroundColor: '#fee2e2', border: '1.5px dashed #dc2626' }} /> Bloqueado</span>
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
                      const health = stockData?.health || 'EMPTY';
                      const isSelected = isEditMode ? selectedEditCode === slotCode : selectedSlot?.code === slotCode;
                      const isChamberMatch = selectedSector !== 'ALL' && isSlot && cell?.chamber === selectedSector;
                      const isSearchMatch = isSlot ? matchingSlotCodes.has(slotCode) : false;

                      let bg = 'transparent', backgroundImage = 'none', color = '#334155', border = isEditMode ? '1px dashed #e2e8f0' : '1px solid transparent';
                      const chamberMeta = cell?.chamber ? SECTORS_INFO[cell.chamber] : null;
                      if (!isSlot) {
                        color = '#94a3b8';
                        if (cellText && cellText.trim() !== '') { border = '1px solid #cbd5e1'; color = '#0f172a'; bg = '#f8fafc'; }
                      } else if (cell.isBlocked) {
                        bg = '#fee2e2';
                        backgroundImage = 'repeating-linear-gradient(135deg, #fee2e2, #fee2e2 4px, #fecaca 4px, #fecaca 8px)';
                        color = '#991b1b';
                        border = '1.5px dashed #dc2626';
                      } else if (health === 'EXPIRED') {
                        bg = '#fef2f2'; color = '#991b1b'; border = '2px solid #E30613';
                      } else if (health === 'EXPIRING_SOON') {
                        bg = '#fffbeb'; color = '#92400e'; border = '2px solid #d97706';
                      } else if (hasStock) {
                        bg = '#ecfdf5'; color = '#166534'; border = '2px solid #16a34a';
                      } else {
                        bg = '#ffffff';
                        color = chamberMeta && chamberMeta !== SECTORS_INFO.GENERAL ? chamberMeta.color : '#334155';
                        border = chamberMeta && chamberMeta !== SECTORS_INFO.GENERAL ? `1.5px solid ${chamberMeta.border}` : '1.5px solid #cbd5e1';
                      }

                      const finalBorder = isSelected ? '2.5px solid #007AFF' : isSearchMatch ? '2.5px solid #eab308' : isChamberMatch && !hasStock ? '2px solid #0284c7' : border;
                      const finalBg = isSelected ? '#e0f2fe' : isSearchMatch ? '#fef9c3' : isChamberMatch && !hasStock ? '#bae6fd' : bg;

                      return (
                        <td
                          key={cIdx} onClick={() => handleCellClick(cell)}
                          style={{
                            width: '46px', minWidth: '46px', maxWidth: '46px', height: '40px',
                            border: finalBorder,
                            backgroundColor: finalBg,
                            backgroundImage: !isSelected && cell.isBlocked ? backgroundImage : 'none',
                            color: isSelected ? '#007AFF' : color,
                            fontWeight: isSlot || (cellText && cellText.length > 2) ? 'bold' : 'normal',
                            fontSize: !isSlot && cellText && cellText.length > 3 ? '0.58rem' : '0.64rem',
                            padding: '2px', textAlign: 'center', cursor: isSlot || isEditMode ? 'pointer' : 'default', userSelect: 'none',
                            whiteSpace: !isSlot ? 'normal' : 'nowrap', wordBreak: 'break-word', lineHeight: 1.1, overflow: 'hidden', borderRadius: isSlot ? '5px' : '3px',
                          }}
                          title={isSlot ? `Slot ${slotCode} (${cellText})${cell.customLabel ? ` [${cell.customLabel}]` : ''} - ${cell.isBlocked ? 'BLOQUEADO' : hasStock ? `${stockData?.totalStock} u.` : 'Vacío'}` : isEditMode ? `Pasillo ${slotCode} (clic para configurar)` : cellText}
                        >
                          {isSlot ? (
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '1px', lineHeight: 1.05 }}>
                              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '2px' }}>
                                <span>{formatCompactSlotLevels(cellText)}</span>
                                {cell.isBlocked && <Lock size={9} aria-label="Bloqueado" />}
                                {!cell.isBlocked && health === 'EXPIRING_SOON' && <Clock size={9} aria-label="Por vencer" />}
                              </span>
                              {hasStock && (
                                <span className="tabular-nums" style={{ fontSize: '0.62rem', fontWeight: 800 }}>
                                  {stockData?.totalStock}u
                                </span>
                              )}
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
        ) : sidebarTab === 'tray' ? (
          <WarehouseUnassignedTray
            items={unassignedItems}
            selectedItem={pendingPlaceItem}
            onSelectItem={setPendingPlaceItem}
          />
        ) : (
          <WarehouseSlotInspectorSidebar selectedSlot={selectedSlot} products={products} onOpen3DModal={() => setIs3DModalOpen(true)} />
        )}
      </div>

      {selectedSlot && (
        <Slot3DInspectorModal
          isOpen={is3DModalOpen}
          onClose={() => setIs3DModalOpen(false)}
          slot={selectedSlot}
          initialLevel={focusedLevel}
          products={products}
          mergedSlots={mergedSlots}
          prefillLoad={pendingPlaceItem}
          onPrefillConsumed={() => setPendingPlaceItem(null)}
          onStockUpdated={onStockUpdated}
        />
      )}
    </div>
  );
};
