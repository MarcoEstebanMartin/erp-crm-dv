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
  { value: 'A', label: 'A — 1 Piso (Solo Base / Suelo)' },
  { value: 'A-B', label: 'A-B — 2 Pisos (Base + Medio)' },
  { value: 'A-B-C', label: 'A-B-C — 3 Pisos Estándar' },
  { value: 'A-B-C-D', label: 'A-B-C-D — 4 Pisos Rack Alto' },
  { value: 'A-B-C-D-E-F', label: 'A-B-C-D-E-F — 6 Niveles Completos' },
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
      cell.chamber && cell.chamber !== 'GENERAL'
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
      setSuccessMsg(`Posición ${cell.code} actualizada en PostgreSQL.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo guardar la configuración.');
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
      setSuccessMsg(`Posición ${cell.code} restaurada al plano original.`);
    } catch (err: any) {
      setErrorMsg(err.message || 'No se pudo restaurar la posición.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      style={{
        width: '340px',
        backgroundColor: '#ffffff',
        border: '1.5px solid #0f172a',
        borderRadius: '10px',
        padding: '16px',
        boxShadow: '0 4px 12px rgba(15,23,42,0.06)',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
      }}
    >
      <div style={{ borderBottom: '1px solid var(--border-color)', paddingBottom: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h4 style={{ margin: 0, fontSize: '0.92rem', display: 'flex', alignItems: 'center', gap: '6px', color: '#0f172a', fontWeight: 800 }}>
          <Settings2 size={16} /> Configurar Celda WMS
        </h4>
        <span className="badge" style={{ backgroundColor: '#0f172a', color: '#fff', fontSize: '0.68rem' }}>SOLO ADMIN</span>
      </div>

      {!cell ? (
        <div style={{ padding: '32px 10px', textAlign: 'center', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2.1rem', marginBottom: '8px' }}>🛠️</div>
          <div style={{ fontWeight: 700, fontSize: '0.88rem', color: 'var(--text-primary)' }}>
            Tocá cualquier celda del plano
          </div>
          <p style={{ fontSize: '0.76rem', marginTop: '4px' }}>
            Podés habilitar nuevos slots sobre un pasillo blanco, cambiar la cantidad de pisos o bloquear por mantenimiento.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
          <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '10px 12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <strong style={{ fontSize: '0.96rem', color: '#0f172a' }}>{cell.code}</strong>
              <span className="badge" style={{ fontSize: '0.68rem', backgroundColor: cell.hasOverride ? '#dbeafe' : '#f1f5f9', color: cell.hasOverride ? '#1d4ed8' : '#475569' }}>
                {cell.hasOverride ? 'Personalizado DB' : 'Plano Original'}
              </span>
            </div>
            <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
              Fila {cell.r} • Columna {cell.c} • Stock activo: <strong>{activeUnitsInCell} u.</strong>
              {occupiedLevels.length > 0 && ` (Pisos: ${occupiedLevels.join(', ')})`}
            </div>
          </div>

          {activeUnitsInCell > 0 && (
            <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fcd34d', borderRadius: '7px', padding: '8px 10px', fontSize: '0.74rem', color: '#92400e', display: 'flex', gap: '6px', alignItems: 'flex-start' }}>
              <ShieldAlert size={15} style={{ flexShrink: 0, marginTop: '1px' }} />
              <span>Protección activa: no permite convertir en pasillo ni quitar pisos que tengan mercadería ubicada.</span>
            </div>
          )}

          {errorMsg && <div className="alert alert-danger" style={{ padding: '8px 10px', fontSize: '0.76rem', margin: 0 }}>{errorMsg}</div>}
          {successMsg && <div className="alert alert-success" style={{ padding: '8px 10px', fontSize: '0.76rem', margin: 0 }}>{successMsg}</div>}

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>Función de la Celda</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
              <button
                type="button"
                className={`btn btn-sm ${isStorage ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsStorage(true)}
                style={{ fontSize: '0.76rem', fontWeight: 700, padding: '6px' }}
              >
                📦 Slot Estantería
              </button>
              <button
                type="button"
                className={`btn btn-sm ${!isStorage ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setIsStorage(false)}
                disabled={activeUnitsInCell > 0}
                title={activeUnitsInCell > 0 ? 'Primero liberá las unidades a S/U' : ''}
                style={{ fontSize: '0.76rem', fontWeight: 700, padding: '6px' }}
              >
                🚶 Pasillo Libre
              </button>
            </div>
          </div>

          {isStorage && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Pisos / Niveles Habilitados</label>
                <select className="form-control" value={levels} onChange={(e) => setLevels(e.target.value)} style={{ fontSize: '0.78rem', height: '34px' }}>
                  {LEVEL_PRESET_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>Cámara / Sector</label>
                <select className="form-control" value={chamber} onChange={(e) => setChamber(e.target.value)} style={{ fontSize: '0.78rem', height: '34px' }}>
                  {Object.entries(SECTORS_INFO)
                    .filter(([k]) => k !== 'GENERAL')
                    .map(([k, info]) => (
                      <option key={k} value={k}>{info.icon} {info.label}</option>
                    ))}
                </select>
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.76rem', fontWeight: 600, color: '#334155', backgroundColor: '#f8fafc', padding: '8px 10px', borderRadius: '6px', border: '1px solid #e2e8f0', cursor: 'pointer' }}>
                <input type="checkbox" checked={isBlocked} onChange={(e) => setIsBlocked(e.target.checked)} />
                <span>🔒 Bloquear nuevas cargas (Mantenimiento)</span>
              </label>
            </>
          )}

          <div>
            <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
              {isStorage ? 'Etiqueta / Nota del Slot (Opcional)' : 'Cartel de Referencia en Plano (Opcional)'}
            </label>
            <input
              type="text"
              className="form-control"
              placeholder={isStorage ? 'Ej: Quesos Duros / Picking' : 'Ej: Mesa Control / Acceso'}
              value={label}
              maxLength={50}
              onChange={(e) => setLabel(e.target.value)}
              style={{ fontSize: '0.78rem', height: '34px' }}
            />
          </div>

          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            <button type="submit" className="btn btn-primary" disabled={saving} style={{ flex: 1, fontSize: '0.8rem', fontWeight: 700, padding: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
              <Save size={14} /> {saving ? 'Guardando...' : 'Guardar Posición'}
            </button>
            {cell.hasOverride && (
              <button type="button" className="btn btn-secondary" disabled={saving} onClick={handleReset} title="Restaurar diseño original de Excel" style={{ fontSize: '0.78rem', padding: '8px 10px', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <RotateCcw size={14} /> Original
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  );
};
