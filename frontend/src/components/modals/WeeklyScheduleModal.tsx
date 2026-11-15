import React, { useState } from 'react';
import { Edit2, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { api } from '../../utils/api';
import { useConfirm } from '../../context/ConfirmContext';
import { NativeModalDialog } from './NativeModalDialog';
import {
  ACTIVITY_TYPES,
  WeeklyScheduleForm,
  type WeeklyScheduleFormData,
  type WeeklyScheduleItem,
} from './schedule/WeeklyScheduleForm';

interface WeeklyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: WeeklyScheduleItem[];
  currentWeek?: string;
  onRefresh: () => void;
}

const EMPTY_FORM: WeeklyScheduleFormData = {
  weekType: 'SEMANA_1',
  dayOfWeek: 'LUNES',
  activityType: 'PREVENTA',
  sellerName: '',
  location: '',
  description: '',
  sortOrder: 0,
};

const WEEK_FILTERS = [
  { id: 'SEMANA_1', label: 'Semana 1' },
  { id: 'SEMANA_2', label: 'Semana 2' },
  { id: 'ALL', label: 'Todas' },
];

export default function WeeklyScheduleModal({
  isOpen,
  onClose,
  items,
  currentWeek = 'SEMANA_1',
  onRefresh,
}: WeeklyScheduleModalProps) {
  const confirm = useConfirm();
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<string>(
    currentWeek === 'SEMANA_2' ? 'SEMANA_2' : 'SEMANA_1',
  );
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [form, setForm] = useState<WeeklyScheduleFormData>(EMPTY_FORM);

  const filteredItems = items.filter((item) =>
    selectedWeekFilter === 'ALL' ? true : item.weekType === selectedWeekFilter || item.weekType === 'TODAS',
  );

  const handleOpenCreate = () => {
    setForm({ ...EMPTY_FORM, weekType: selectedWeekFilter === 'ALL' ? 'SEMANA_1' : selectedWeekFilter });
    setEditingId(null);
    setIsEditing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleOpenEdit = (item: WeeklyScheduleItem) => {
    setForm({
      weekType: item.weekType,
      dayOfWeek: item.dayOfWeek,
      activityType: item.activityType,
      sellerName: item.sellerName || '',
      location: item.location,
      description: item.description || '',
      sortOrder: item.sortOrder || 0,
    });
    setEditingId(item.id);
    setIsEditing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location.trim()) return setErrorMsg('Ingresá la localidad.');
    setLoading(true);
    setErrorMsg(null);
    try {
      if (editingId) {
        await api.updateWeeklyScheduleItem(editingId, form);
        setSuccessMsg('Entrada actualizada.');
      } else {
        await api.createWeeklyScheduleItem(form);
        setSuccessMsg('Entrada agregada.');
      }
      setIsEditing(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar.');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    const ok = await confirm('¿Eliminar esta entrada del cronograma?', { type: 'danger', confirmText: 'Eliminar' });
    if (!ok) return;
    setLoading(true);
    try {
      await api.deleteWeeklyScheduleItem(id);
      setSuccessMsg('Entrada eliminada.');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar.');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreDefaults = async () => {
    const ok = await confirm('¿Restaurar cronograma predeterminado? Se reemplazarán las entradas actuales.', {
      type: 'warning',
      confirmText: 'Restaurar',
    });
    if (!ok) return;
    setLoading(true);
    try {
      await api.seedWeeklyScheduleDefaults();
      setSuccessMsg('Cronograma restaurado.');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al restaurar.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <NativeModalDialog isOpen={isOpen} onClose={onClose} ariaLabelledBy="weekly-schedule-modal-title" style={{ width: '95vw', maxWidth: '840px', maxHeight: '90vh' }}>
      <div style={{ padding: '16px 22px', borderBottom: '1px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'var(--bg-light, #f9fafb)' }}>
        <h2 id="weekly-schedule-modal-title" style={{ fontSize: '1.05rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
          Cronograma semanal
        </h2>
        <button type="button" aria-label="Cerrar" className="btn btn-ghost" style={{ padding: '4px' }} onClick={onClose}>
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <div style={{ padding: '12px 22px', backgroundColor: 'var(--bg-card, #ffffff)', borderBottom: '1px solid var(--border-color)', display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
        <div style={{ display: 'flex', gap: '4px', backgroundColor: 'var(--bg-light, #f3f4f6)', padding: '3px', borderRadius: '8px' }}>
          {WEEK_FILTERS.map((f) => {
            const active = selectedWeekFilter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                aria-pressed={active}
                onClick={() => setSelectedWeekFilter(f.id)}
                style={{
                  padding: '6px 12px',
                  borderRadius: '6px',
                  border: 'none',
                  fontSize: '0.82rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  backgroundColor: active ? '#ffffff' : 'transparent',
                  color: active ? 'var(--text-primary)' : 'var(--text-secondary)',
                  boxShadow: active ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                }}
              >
                {f.label}
              </button>
            );
          })}
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button type="button" className="btn btn-secondary" onClick={handleRestoreDefaults} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
            <RotateCcw size={14} aria-hidden="true" />
            Restaurar
          </button>
          <button type="button" className="btn btn-primary" onClick={handleOpenCreate} disabled={loading} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.82rem' }}>
            <Plus size={15} aria-hidden="true" />
            Nueva entrada
          </button>
        </div>
      </div>

      {errorMsg && (
        <div role="alert" style={{ margin: '12px 22px 0 22px', padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '6px', color: '#E30613', fontSize: '0.83rem', fontWeight: 600 }}>
          {errorMsg}
        </div>
      )}
      {successMsg && (
        <div role="status" style={{ margin: '12px 22px 0 22px', padding: '10px 14px', backgroundColor: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: '6px', color: '#065F46', fontSize: '0.83rem', fontWeight: 600 }}>
          {successMsg}
        </div>
      )}

      <div style={{ padding: '16px 22px', overflowY: 'auto', flex: 1 }}>
        {isEditing ? (
          <WeeklyScheduleForm form={form} setForm={setForm} editingId={editingId} loading={loading} onCancel={() => setIsEditing(false)} onSubmit={handleSubmit} />
        ) : filteredItems.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-secondary)', fontSize: '0.88rem' }}>Sin entradas</div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ backgroundColor: 'var(--bg-light, #f9fafb)', borderBottom: '1px solid var(--border-color)', textAlign: 'left' }}>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Semana</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Día</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Actividad</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Responsable</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Localidad</th>
                  <th style={{ padding: '10px 12px', fontWeight: 600 }}>Notas</th>
                  <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600 }}></th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const actInfo = ACTIVITY_TYPES.find((a) => a.value === item.activityType) || ACTIVITY_TYPES[0];
                  return (
                    <tr key={item.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                        {item.weekType === 'SEMANA_1' ? 'Semana 1' : item.weekType === 'SEMANA_2' ? 'Semana 2' : 'Todas'}
                      </td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.dayOfWeek}</td>
                      <td style={{ padding: '10px 12px' }}>
                        <span style={{ padding: '3px 8px', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 600, backgroundColor: actInfo.bg, color: actInfo.color }}>
                          {actInfo.label}
                        </span>
                      </td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)' }}>{item.sellerName || '-'}</td>
                      <td style={{ padding: '10px 12px', fontWeight: 600 }}>{item.location}</td>
                      <td style={{ padding: '10px 12px', color: 'var(--text-secondary)', maxWidth: '180px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.description || '-'}
                      </td>
                      <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button type="button" aria-label={`Editar ${item.location}`} onClick={() => handleOpenEdit(item)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', marginRight: '8px', padding: '4px' }}>
                          <Edit2 size={15} aria-hidden="true" />
                        </button>
                        <button type="button" aria-label={`Eliminar ${item.location}`} onClick={() => handleDelete(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#E30613', padding: '4px' }}>
                          <Trash2 size={15} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div style={{ padding: '12px 22px', borderTop: '1px solid var(--border-color)', display: 'flex', justifyContent: 'flex-end', backgroundColor: 'var(--bg-light, #f9fafb)' }}>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Cerrar</button>
      </div>
    </NativeModalDialog>
  );
}
