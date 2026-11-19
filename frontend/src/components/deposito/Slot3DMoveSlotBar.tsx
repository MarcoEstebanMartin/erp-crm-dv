import React, { useMemo, useState } from 'react';
import { SECTORS_INFO } from './depositomapaData';
import { extractSlotLevels, type MergedDepositSlot } from './warehouseLayoutMerger';
import type { RackLevel } from './wmsMapHelpers';

interface Slot3DMoveSlotBarProps {
  sourceSlot: MergedDepositSlot;
  occupiedLevels: RackLevel[];
  mergedSlots: MergedDepositSlot[];
  loading: boolean;
  onConfirmMove: (toSlotCode: string) => void;
  onCancel: () => void;
}

export const Slot3DMoveSlotBar: React.FC<Slot3DMoveSlotBarProps> = ({
  sourceSlot,
  occupiedLevels,
  mergedSlots,
  loading,
  onConfirmMove,
  onCancel,
}) => {
  const [targetSlotCode, setTargetSlotCode] = useState('');

  const compatibleGroups = useMemo(() => {
    const required = occupiedLevels.length > 0 ? occupiedLevels : (['A'] as RackLevel[]);
    const grouped = new Map<string, MergedDepositSlot[]>();

    for (const s of mergedSlots) {
      if (s.code === sourceSlot.code || s.isBlocked || s.chamber === 'BANO') continue;
      const supported = new Set(extractSlotLevels(s.nivel));
      if (!required.every((lvl) => supported.has(lvl))) continue;
      const list = grouped.get(s.chamber) || [];
      list.push(s);
      grouped.set(s.chamber, list);
    }

    return Array.from(grouped.entries()).map(([chamber, slots]) => ({
      chamber,
      label: SECTORS_INFO[chamber]?.label || chamber,
      slots: slots.sort((a, b) => a.row - b.row || a.col - b.col),
    }));
  }, [mergedSlots, occupiedLevels, sourceSlot.code]);

  return (
    <div
      style={{
        margin: '12px 18px 0 18px',
        padding: '10px 14px',
        backgroundColor: '#f8fafc',
        border: '1px solid #cbd5e1',
        borderRadius: '8px',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        flexWrap: 'wrap',
      }}
    >
      <label htmlFor="wms-move-slot-dest" style={{ fontSize: '0.8rem', fontWeight: 700, color: '#0f172a', margin: 0 }}>
        Mudar todo {sourceSlot.code} hacia:
      </label>
      <select
        id="wms-move-slot-dest"
        className="select"
        value={targetSlotCode}
        onChange={(e) => setTargetSlotCode(e.target.value)}
        style={{ flex: '1 1 240px', maxWidth: '340px', height: '33px', fontSize: '0.8rem' }}
      >
        <option value="">Seleccionar slot destino compatible...</option>
        {compatibleGroups.map((g) => (
          <optgroup key={g.chamber} label={g.label}>
            {g.slots.map((s) => (
              <option key={s.code} value={s.code}>
                {s.code} ({s.deposito} · Niveles {s.nivel}{s.customLabel ? ` · ${s.customLabel}` : ''})
              </option>
            ))}
          </optgroup>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        disabled={loading || !targetSlotCode}
        onClick={() => targetSlotCode && onConfirmMove(targetSlotCode)}
        style={{ fontSize: '0.78rem', padding: '5px 12px', fontWeight: 700 }}
      >
        Confirmar mudanza
      </button>
      <button
        type="button"
        className="btn btn-secondary btn-sm"
        disabled={loading}
        onClick={onCancel}
        style={{ fontSize: '0.78rem', padding: '5px 10px' }}
      >
        Cancelar
      </button>
    </div>
  );
};
