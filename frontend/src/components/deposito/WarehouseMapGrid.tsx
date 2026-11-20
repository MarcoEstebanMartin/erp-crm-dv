import React from 'react';
import { Clock, Lock } from 'lucide-react';
import { SECTORS_INFO } from './depositomapaData';
import type { MergedSlotCellData } from './warehouseLayoutMerger';
import {
  FILTERABLE_SECTOR_KEYS,
  formatCompactSlotLevels,
  type SlotStockSummary,
} from './wmsMapHelpers';

interface WarehouseMapGridProps {
  matrix: MergedSlotCellData[][];
  slotStockMap: Record<string, SlotStockSummary>;
  matchingSlotCodes: Set<string>;
  selectedSlotCode: string | null;
  selectedEditCode: string | null;
  selectedSector: string;
  showSectorFilters: boolean;
  isEditMode: boolean;
  onSelectSector: (sector: string) => void;
  onCellClick: (cell: MergedSlotCellData) => void;
  onCellDoubleClick: (cell: MergedSlotCellData) => void;
}

export const WarehouseMapGrid: React.FC<WarehouseMapGridProps> = ({
  matrix,
  slotStockMap,
  matchingSlotCodes,
  selectedSlotCode,
  selectedEditCode,
  selectedSector,
  showSectorFilters,
  isEditMode,
  onSelectSector,
  onCellClick,
  onCellDoubleClick,
}) => {
  return (
    <div style={{ flex: 1, backgroundColor: '#ffffff', border: '1px solid var(--border-color)', borderRadius: '10px', padding: '12px 14px', overflowX: 'auto', maxWidth: '100%' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: showSectorFilters ? 'space-between' : 'flex-end',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '10px',
          paddingBottom: '10px',
          marginBottom: '10px',
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        {showSectorFilters && (
          <div role="group" aria-label="Filtrar por sector" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', alignItems: 'center' }}>
            {FILTERABLE_SECTOR_KEYS.map((key) => {
              const info = SECTORS_INFO[key];
              if (!info) return null;
              const isSelected = selectedSector === key;
              return (
                <button
                  key={key}
                  type="button"
                  aria-pressed={isSelected}
                  style={{
                    backgroundColor: isSelected ? '#0f172a' : '#ffffff',
                    color: isSelected ? '#ffffff' : '#334155',
                    border: `1px solid ${isSelected ? '#0f172a' : '#e2e8f0'}`,
                    fontWeight: 600,
                    fontSize: '0.74rem',
                    padding: '3px 9px',
                    borderRadius: '6px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                    cursor: 'pointer',
                  }}
                  onClick={() => onSelectSector(selectedSector === key ? 'ALL' : key)}
                >
                  <span aria-hidden="true" style={{ width: '7px', height: '7px', borderRadius: '50%', backgroundColor: info.border, display: 'inline-block' }} />
                  {info.label}
                </button>
              );
            })}
            {selectedSector !== 'ALL' && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                style={{ fontSize: '0.73rem', padding: '2px 7px', color: '#64748b' }}
                onClick={() => onSelectSector('ALL')}
              >
                Limpiar
              </button>
            )}
          </div>
        )}

        <div style={{ display: 'flex', gap: '12px', fontSize: '0.72rem', color: '#64748b', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1' }} /> Vacío</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#f0fdf4', border: '1.5px solid #22c55e' }} /> Ocupado</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#fffbeb', border: '1.5px solid #f59e0b' }} /> Por vencer</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#fef2f2', border: '1.5px solid #E30613' }} /> Vencido</span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}><span style={{ width: '8px', height: '8px', borderRadius: '2px', backgroundColor: '#fef2f2', border: '1.5px dashed #dc2626' }} /> Bloqueado</span>
        </div>
      </div>

      <div style={{ overflowX: 'auto', width: '100%' }}>
        <table style={{ borderCollapse: 'separate', borderSpacing: '3px', width: 'max-content', minWidth: '100%', fontSize: '0.66rem', fontFamily: 'sans-serif' }}>
          <tbody>
            {matrix.map((row, rIdx) => (
              <tr key={rIdx}>
                {row.map((cell, cIdx) => {
                  const isSlot = Boolean(cell?.is_storage);
                  const cellText = cell?.val || '';
                  const slotCode = cell.code;
                  const stockData = isSlot ? slotStockMap[slotCode] : null;
                  const hasStock = Boolean(stockData && stockData.hasStock);
                  const health = stockData?.health || 'EMPTY';
                  const isSelected = isEditMode ? selectedEditCode === slotCode : selectedSlotCode === slotCode;
                  const isSectorFilterActive = selectedSector !== 'ALL';
                  const isChamberMatch = isSectorFilterActive && isSlot && cell?.chamber === selectedSector;
                  const isDimmed = isSectorFilterActive && isSlot && !isChamberMatch && !isSelected;
                  const isSearchMatch = isSlot ? matchingSlotCodes.has(slotCode) : false;

                  let bg = 'transparent';
                  let backgroundImage = 'none';
                  let color = '#64748b';
                  let border = isEditMode ? '1px dashed #e2e8f0' : '1px solid transparent';
                  let borderLeftOverride: string | undefined;

                  const chamberMeta = cell?.chamber ? SECTORS_INFO[cell.chamber] : null;
                  const isDistinctChamber = Boolean(
                    chamberMeta &&
                      cell.chamber !== 'GENERAL' &&
                      cell.chamber !== 'D2_GENERAL' &&
                      cell.chamber !== 'D3_GENERAL',
                  );

                  if (!isSlot) {
                    color = '#94a3b8';
                    if (cellText && cellText.trim() !== '') {
                      border = '1px solid #e2e8f0';
                      color = '#475569';
                      bg = '#f8fafc';
                    }
                  } else if (cell.isBlocked) {
                    bg = '#fef2f2';
                    backgroundImage = 'repeating-linear-gradient(135deg, #fef2f2, #fef2f2 4px, #fee2e2 4px, #fee2e2 8px)';
                    color = '#991b1b';
                    border = '1.5px dashed #dc2626';
                  } else if (health === 'EXPIRED') {
                    bg = '#fef2f2'; color = '#991b1b'; border = '1.5px solid #E30613';
                  } else if (health === 'EXPIRING_SOON') {
                    bg = '#fffbeb'; color = '#92400e'; border = '1.5px solid #f59e0b';
                  } else if (hasStock) {
                    bg = '#f0fdf4'; color = '#166534'; border = '1.5px solid #22c55e';
                  } else {
                    bg = '#ffffff';
                    color = '#94a3b8';
                    border = '1px solid #e2e8f0';
                    if (isDistinctChamber && chamberMeta) {
                      borderLeftOverride = `3px solid ${chamberMeta.border}`;
                    }
                  }

                  const finalBorder = isSelected
                    ? '2px solid #0f172a'
                    : isSearchMatch
                      ? '2px solid #eab308'
                      : isChamberMatch && !hasStock
                        ? '1.5px solid #64748b'
                        : border;
                  const finalBg = isSelected ? '#f1f5f9' : isSearchMatch ? '#fef9c3' : bg;

                  return (
                    <td
                      key={cIdx}
                      onClick={() => onCellClick(cell)}
                      onDoubleClick={() => onCellDoubleClick(cell)}
                      style={{
                        width: '46px', minWidth: '46px', maxWidth: '46px', height: '38px',
                        border: finalBorder,
                        ...(borderLeftOverride && !isSelected && !isSearchMatch ? { borderLeft: borderLeftOverride } : {}),
                        backgroundColor: finalBg,
                        backgroundImage: !isSelected && cell.isBlocked ? backgroundImage : 'none',
                        color: isSelected ? '#0f172a' : isChamberMatch && !hasStock ? '#334155' : color,
                        opacity: isDimmed ? 0.22 : 1,
                        fontWeight: hasStock || isSelected || (!isSlot && cellText.length > 2) ? 700 : 500,
                        fontSize: !isSlot && cellText && cellText.length > 3 ? '0.56rem' : '0.64rem',
                        padding: '2px', textAlign: 'center', cursor: isSlot || isEditMode ? 'pointer' : 'default', userSelect: 'none',
                        whiteSpace: !isSlot ? 'normal' : 'nowrap', wordBreak: 'break-word', lineHeight: 1.1, overflow: 'hidden', borderRadius: isSlot ? '5px' : '3px',
                        transition: 'opacity 120ms ease, background-color 120ms ease',
                      }}
                      title={isSlot ? `${slotCode} (${formatCompactSlotLevels(cellText)})${cell.customLabel ? ` · ${cell.customLabel}` : ''} — ${cell.isBlocked ? 'Bloqueado' : hasStock ? `${stockData?.totalStock} u.` : 'Vacío'}` : isEditMode ? `Pasillo ${slotCode}` : cellText}
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
  );
};
