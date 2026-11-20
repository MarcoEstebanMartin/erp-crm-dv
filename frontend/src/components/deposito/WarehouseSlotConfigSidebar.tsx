import React, { useEffect, useState } from 'react';
import { RotateCcw, Save, ShieldAlert, Settings2 } from 'lucide-react';
import { SECTORS_INFO } from './depositomapaData';
import type { MergedSlotCellData } from './warehouseLayoutMerger';
import { api } from '../../utils/api';

interface WarehouseSlotConfigSidebarProps {
  cell: MergedSlotCellData | null;
  activeUnitsInCell: number;
  occupiedLevels: string[];
  originalBlueprint?: { isStorage: boolean; levels: string };
  onSaved: () => Promise<void> | void;
}

const LEVEL_PRESET_OPTIONS = [
  { value: 'A', label: '1 nivel (A)' },
  { value: 'A-B', label: '2 niveles (A–B)' },
  { value: 'A-B-C', label: '3 niveles (A–C)' },
  { value: 'A-B-C-D', label: '4 niveles (A–D)' },
  { value: 'A-B-C-D-E-F', label: '6 niveles (A–F)' },
];

export const WarehouseSlotConfigSidebar: React.FC<WarehouseSlotConfigSidebarProps> = ({
  cell,
  activeUnitsInCell,
  occupiedLevels,
  originalBlueprint,
  onSaved,
}) => {
  const [isStorage, setIsStorage] = useState(true);
  const [levels, setLevels] = useState('A-B-C');
  const [chamber, setChamber] = useState('ESTANTERIA');
  const [label, setLabel] = useState('');
  const [isBlocked, setIsBlocked] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!cell) return;
    setIsStorage(Boolean(cell.is_storage));
    setLevels(cell.is_storage && cell.val ? cell.val : 'A-B-C');
    setChamber(
      cell.chamber && cell.chamber !== 'GENERAL' && cell.chamber !== 'BANO'
        ? cell.chamber
        : cell.dep_id === 'D2'
          ? 'D2_GENERAL'
          : cell.dep_id === 'D3'
            ? 'D3_GENERAL'
            : 'ESTANTERIA',
    );
    setLabel(cell.customLabel ?? (!cell.is_storage ? cell.val || '' : ''));
    setIsBlocked(Boolean(cell.isBlocked));
    setErrorMsg(null);
    setSuccessMsg(null);
  }, [cell]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cell) return;
    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.upsertWarehouseCell({
        depId: cell.dep_id as 'D1' | 'D2' | 'D3',
        row: cell.r,
        col: cell.c,
        isStorage,
        levels: isStorage ? levels : 'A',
        chamber: isStorage ? chamber : 'GENERAL',
        label: label.trim() || null,
        isBlocked: isStorage ? isBlocked : false,
      });
      await onSaved();
      setSuccessMsg(`${cell.code} guardada.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo guardar.');
    } finally {
      setSaving(false);
    }
  };

  const handleReset = async () => {
    if (!cell) return;
    try {
      setSaving(true);
      setErrorMsg(null);
      setSuccessMsg(null);
      await api.resetWarehouseCell(cell.code, originalBlueprint);
      await onSaved();
      setSuccessMsg(`${cell.code} restaurada.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo restaurar.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        width: '320px',
        flexShrink: 0,
        backgroundColor: '#ffffff',
        border: '1px solid var(--border-color)',
        borderRadius: '10px',
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '0.94rem', display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--text-primary)', fontWeight: 700 }}>
          <Settings2 size={15} aria-hidden="true" /> Editar celda
        </h4>
      </div>

      {!cell ? (
        <div style={{ padding: '24px 10px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
          Elegí una celda del mapa
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.95rem', color: '#0f172a' }}>{cell.code}</strong>
              {cell.hasOverride && (
                <span className="badge" style={{ fontSize: '0.68rem', backgroundColor: '#f1f5f9', color: '#475569' }}>
                  Editada
                </span>
              )}
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
              Stock: <strong>{activeUnitsInCell} u.</strong>
              {occupiedLevels.length > 0 && ` · Pisos ${occupiedLevels.join(', ')}`}
            </div>
          </div>

          {activeUnitsInCell > 0 && (
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '7px', padding: '8px 10px', fontSize: '0.74rem', color: '#92400e', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <ShieldAlert size={14} aria-hidden="true" style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>Tiene stock: no permite pasar a pasillo ni quitar pisos ocupados.</span>
            </div>
          )}

          {errorMsg && <div role="alert" className="alert alert-danger" style={{ padding: '8px 10px', fontSize: '0.76rem', margin: 0 }}>{errorMsg}</div>}
          {successMsg && <div role="status" className="alert alert-success" style={{ padding: '8px 10px', fontSize: '0.76rem', margin: 0 }}>{successMsg}</div>}

          <div>
            <label style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: '5px' }}>Tipo</label>
            <div role="group" aria-label="Tipo de celda" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                aria-pressed={isStorage}
                className={`btn btn-sm ${isStorage ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsStorage(true)}
                style={{ fontSize: '0.76rem', fontWeight: 600, padding: '6px' }}
              >
                Slot
              </button>
              <button
                type="button"
                aria-pressed={!isStorage}
                className={`btn btn-sm ${!isStorage ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsStorage(false)}
                disabled={activeUnitsInCell > 0}
                title={activeUnitsInCell > 0 ? 'Primero liberá las unidades a S/U' : ''}
                style={{ fontSize: '0.76rem', fontWeight: 600, padding: '6px' }}
              >
                Pasillo
              </button>
            </div>
          </div>

          {isStorage && (
            <>
              <div>
                <label htmlFor="wms-cfg-levels" style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Niveles</label>
                <select id="wms-cfg-levels" className="form-control" value={levels} onChange={(e) => setLevels(e.target.value)} style={{ fontSize: '0.78rem', height: '33px' }}>
                  {LEVEL_PRESET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="wms-cfg-chamber" style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>Sector</label>
                <select id="wms-cfg-chamber" className="form-control" value={chamber} onChange={(e) => setChamber(e.target.value)} style={{ fontSize: '0.78rem', height: '33px' }}>
                  {Object.entries(SECTORS_INFO)
                    .filter(([k]) => k !== 'GENERAL')
                    .map(([k, info]) => (
                      <option key={k} value={k}>{info.label}</option>
                    ))}
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', fontWeight: 600, color: '#334155', backgroundColor: '#f8fafc', padding: '7px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                <input type="checkbox" checked={isBlocked} onChange={(e) => setIsBlocked(e.target.checked)} />
                <span>Bloquear cargas</span>
              </label>
            </>
          )}

          <div>
            <label htmlFor="wms-cfg-label" style={{ display: 'block', fontSize: '0.74rem', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              {isStorage ? 'Etiqueta' : 'Referencia'}
            </label>
            <input
              id="wms-cfg-label"
              type="text"
              className="form-control"
              placeholder={isStorage ? 'Etiqueta' : 'Referencia'}
              value={label}
              maxLength={50}
              onChange={(e) => setLabel(e.target.value)}
              style={{ fontSize: '0.78rem', height: '33px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, fontSize: '0.8rem', fontWeight: 600, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Save size={14} aria-hidden="true" /> {saving ? 'Guardando...' : 'Guardar'}
            </button>
            {cell.hasOverride && (
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={handleReset} title="Restaurar plano original" style={{ fontSize: '0.78rem', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RotateCcw size={14} aria-hidden="true" /> Restaurar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
