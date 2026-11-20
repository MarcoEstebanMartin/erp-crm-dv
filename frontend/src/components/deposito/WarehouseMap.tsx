import React, { useState, useMemo, useEffect, useCallback } from 'react';
import type { Product } from '../../types';
import { Slot3DInspectorModal } from './Slot3DInspectorModal';
import { WarehouseMapGrid } from './WarehouseMapGrid';
import { WarehouseSlotInspectorSidebar } from './WarehouseSlotInspectorSidebar';
import { WarehouseSlotConfigSidebar } from './WarehouseSlotConfigSidebar';
import { WarehouseUnassignedTray } from './WarehouseUnassignedTray';
import {
  buildSlotStockSummaryMap,
  buildUnassignedTrayEntries,
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
import { Maximize2, Minimize2, PackagePlus, Search, Settings2, X } from 'lucide-react';
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

  const handleCellDoubleClick = (cell: MergedSlotCellData) => {
    if (isEditMode || !cell.is_storage) return;
    setSelectedSlotCode(cell.code);
    setFocusedLevel(null);
    setIs3DModalOpen(true);
  };

  const editCellStockInfo = selectedEditCell ? slotStockMap[selectedEditCell.code] : undefined;
  const showSectorFilters = selectedWarehouse === 'D1' || selectedWarehouse === 'ALL';

  return (
    <div className={`wms-map-root ${isFullscreen ? 'wms-map-fullscreen' : ''}`} style={{ display: 'flex', flexDirection: 'column', gap: '12px', width: '100%' }}>
      <div
        role="toolbar"
        aria-label="Controles del mapa de depósito"
        style={{
          backgroundColor: '#ffffff',
          border: '1px solid var(--border-color)',
          borderRadius: '10px',
          padding: '12px 16px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>Mapa Depósito</h3>
          <span
            style={{
              fontSize: '0.73rem',
              fontWeight: 600,
              color: '#64748b',
              backgroundColor: '#f1f5f9',
              padding: '2px 8px',
              borderRadius: '999px',
              fontVariantNumeric: 'tabular-nums',
            }}
          >
            {activeSlotsCount} slots
          </span>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          <search aria-label="Buscar slot o producto" style={{ position: 'relative', width: '195px' }}>
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
              style={{ fontSize: '0.8rem', paddingLeft: '28px', height: '32px' }}
            />
            <Search size={14} aria-hidden="true" style={{ position: 'absolute', left: '9px', top: '9px', color: '#94a3b8' }} />
          </search>

          <div role="group" aria-label="Depósitos" style={{ display: 'flex', gap: '3px', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '7px' }}>
            {([
              { id: 'ALL', label: 'Planta' },
              { id: 'D1', label: 'Dep. 1' },
              { id: 'D2', label: 'Dep. 2' },
              { id: 'D3', label: 'Dep. 3' },
            ] as const).map((btn) => {
              const active = selectedWarehouse === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  aria-pressed={active}
                  style={{
                    fontSize: '0.76rem',
                    padding: '4px 10px',
                    borderRadius: '5px',
                    fontWeight: 600,
                    border: 'none',
                    cursor: 'pointer',
                    backgroundColor: active ? '#0f172a' : 'transparent',
                    color: active ? '#ffffff' : '#475569',
                  }}
                  onClick={() => { setSelectedWarehouse(btn.id); setSelectedSector('ALL'); }}
                >
                  {btn.label}
                </button>
              );
            })}
          </div>

          <button
            type="button"
            aria-pressed={sidebarTab === 'tray' && !isEditMode}
            className={`btn ${sidebarTab === 'tray' && !isEditMode ? 'btn-primary' : 'btn-secondary'}`}
            style={{ fontSize: '0.76rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '5px', height: '32px' }}
            onClick={() => {
              setIsEditMode(false);
              setSidebarTab((prev) => (prev === 'tray' ? 'inspector' : 'tray'));
            }}
          >
            <PackagePlus size={14} aria-hidden="true" />
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>Sin ubicar ({unassignedItems.length})</span>
          </button>

          {isAdmin && (
            <button
              type="button"
              aria-pressed={isEditMode}
              className={`btn ${isEditMode ? 'btn-primary' : 'btn-secondary'}`}
              style={{
                fontSize: '0.76rem', padding: '5px 10px', borderRadius: '6px', fontWeight: 600,
                display: 'inline-flex', alignItems: 'center', gap: '5px', height: '32px',
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
              <Settings2 size={14} aria-hidden="true" />
              <span>{isEditMode ? 'Listo' : 'Editar plano'}</span>
            </button>
          )}

          <button
            type="button"
            aria-pressed={isFullscreen}
            aria-label={isFullscreen ? 'Salir de pantalla completa' : 'Expandir mapa'}
            title={isFullscreen ? 'Salir' : 'Expandir'}
            className="btn btn-secondary"
            style={{ padding: '5px 8px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', height: '32px', minInlineSize: '32px' }}
            onClick={() => setIsFullscreen(!isFullscreen)}
          >
            {isFullscreen ? <Minimize2 size={14} aria-hidden="true" /> : <Maximize2 size={14} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {pendingPlaceItem && (
        <div role="status" style={{ padding: '9px 14px', backgroundColor: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: '#1e3a8a', fontWeight: 600 }}>
            Ubicando [{pendingPlaceItem.product.sku}] {pendingPlaceItem.product.name} ({pendingPlaceItem.units} u.) — Elegí un slot libre
          </span>
          <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.74rem', padding: '3px 10px', borderRadius: '6px' }} onClick={() => setPendingPlaceItem(null)}>
            Cancelar
          </button>
        </div>
      )}

      {focusLocationCode && selectedSlot && (
        <div style={{ padding: '9px 14px', backgroundColor: '#eff6ff', border: '1px solid #93c5fd', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', color: '#1e3a8a', fontWeight: 600 }}>
            Ubicación <strong>{focusLocationCode}</strong>
          </span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button type="button" className="btn btn-primary btn-sm" style={{ fontSize: '0.74rem', fontWeight: 600, padding: '4px 10px', borderRadius: '6px' }} onClick={() => setIs3DModalOpen(true)}>
              Abrir nivel {focusedLevel || 'A'}
            </button>
            {onClearFocus && (
              <button type="button" className="btn btn-secondary btn-sm" style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '6px', display: 'inline-flex', alignItems: 'center', gap: '4px' }} onClick={onClearFocus} aria-label="Cerrar aviso">
                <X size={13} aria-hidden="true" />
                Cerrar
              </button>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', width: '100%' }}>
        <WarehouseMapGrid
          matrix={filteredMatrix}
          slotStockMap={slotStockMap}
          matchingSlotCodes={matchingSlotCodes}
          selectedSlotCode={selectedSlot?.code || null}
          selectedEditCode={selectedEditCode}
          selectedSector={selectedSector}
          showSectorFilters={showSectorFilters}
          isEditMode={isEditMode}
          onSelectSector={(next) => {
            setSelectedSector(next);
            if (next !== 'ALL') {
              setSelectedWarehouse(resolveWarehouseForSector(next));
            }
          }}
          onCellClick={handleCellClick}
          onCellDoubleClick={handleCellDoubleClick}
        />

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
