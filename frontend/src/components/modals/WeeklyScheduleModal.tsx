import React, { useState } from 'react';
import { api } from '../../utils/api';
import { X, Plus, Trash2, Edit2, RotateCcw, Calendar, MapPin, User, Check, AlertCircle, RefreshCw } from 'lucide-react';

interface WeeklyScheduleItem {
  id: number;
  weekType: string;
  dayOfWeek: string;
  activityType: string;
  sellerId?: number | null;
  sellerName?: string | null;
  location: string;
  description?: string | null;
  sortOrder?: number;
}

interface WeeklyScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  items: WeeklyScheduleItem[];
  currentWeek: string;
  onRefresh: () => void;
}

const DAYS_OF_WEEK = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];
const WEEK_TYPES = [
  { value: 'SEMANA_1', label: 'Semana 1' },
  { value: 'SEMANA_2', label: 'Semana 2' },
  { value: 'TODAS', label: 'Todas las Semanas' }
];

const ACTIVITY_TYPES = [
  { value: 'PREVENTA', label: 'Preventa (Ventas en calle)', color: '#10B981', bg: '#ECFDF5' },
  { value: 'REPARTO', label: 'Reparto (Entrega de pedidos)', color: '#3B82F6', bg: '#EFF6FF' },
  { value: 'FERIADO', label: '🎉 Feriado (No se trabaja)', color: '#EF4444', bg: '#FEF2F2' }
];

export default function WeeklyScheduleModal({
  isOpen,
  onClose,
  items,
  currentWeek,
  onRefresh
}: WeeklyScheduleModalProps) {
  const [selectedWeekFilter, setSelectedWeekFilter] = useState<string>('SEMANA_1');
  const [isEditing, setIsEditing] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const [form, setForm] = useState({
    weekType: 'SEMANA_1',
    dayOfWeek: 'LUNES',
    activityType: 'PREVENTA',
    sellerName: '',
    location: '',
    description: '',
    sortOrder: 0
  });

  if (!isOpen) return null;

  const filteredItems = items.filter(item => {
    if (selectedWeekFilter === 'ALL') return true;
    return item.weekType === selectedWeekFilter || item.weekType === 'TODAS';
  });

  const handleOpenCreate = () => {
    setForm({
      weekType: selectedWeekFilter === 'ALL' ? 'SEMANA_1' : selectedWeekFilter,
      dayOfWeek: 'LUNES',
      activityType: 'PREVENTA',
      sellerName: 'Fabián',
      location: '',
      description: '',
      sortOrder: 0
    });
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
      sortOrder: item.sortOrder || 0
    });
    setEditingId(item.id);
    setIsEditing(true);
    setErrorMsg(null);
    setSuccessMsg(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.location.trim()) {
      setErrorMsg('Debe ingresar el pueblo / localidad.');
      return;
    }

    setLoading(true);
    setErrorMsg(null);
    try {
      if (editingId) {
        await api.updateWeeklyScheduleItem(editingId, form);
        setSuccessMsg('¡Entrada actualizada con éxito!');
      } else {
        await api.createWeeklyScheduleItem(form);
        setSuccessMsg('¡Entrada agregada al cronograma!');
      }
      setIsEditing(false);
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al guardar el cronograma');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!window.confirm('¿Está seguro de eliminar esta entrada del cronograma?')) return;
    setLoading(true);
    try {
      await api.deleteWeeklyScheduleItem(id);
      setSuccessMsg('Entrada eliminada.');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al eliminar');
    } finally {
      setLoading(false);
    }
  };

  const handleRestoreDefaults = async () => {
    if (!window.confirm('¿Desea restaurar el cronograma predeterminado para América, Villegas, Tejedor, etc.? Esto reemplazará las entradas actuales.')) return;
    setLoading(true);
    try {
      await api.seedWeeklyScheduleDefaults();
      setSuccessMsg('¡Cronograma restablecido a los datos predeterminados!');
      onRefresh();
    } catch (err: any) {
      setErrorMsg(err.message || 'Error al restaurar cronograma por defecto');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(0, 0, 0, 0.45)',
      backdropFilter: 'blur(4px)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      zIndex: 1000,
      padding: '20px'
    }}>
      <div style={{
        backgroundColor: '#ffffff',
        borderRadius: '14px',
        width: '100%',
        maxWidth: '850px',
        maxHeight: '90vh',
        boxShadow: '0 20px 40px rgba(0,0,0,0.15)',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        border: '1px solid #E5E7EB'
      }}>
        {/* Modal Header */}
        <div style={{
          padding: '20px 24px',
          borderBottom: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FAF9F8'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              borderRadius: '10px',
              backgroundColor: 'rgba(227, 6, 19, 0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-corp-red, #E30613)'
            }}>
              <Calendar size={22} />
            </div>
            <div>
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0, color: '#111827' }}>
                Configuración del Cronograma Semanal
              </h2>
              <p style={{ fontSize: '0.82rem', margin: '2px 0 0 0', color: '#6B7280' }}>
                Gestionar pueblos y preventa/reparto por día de la semana (Semana 1 y Semana 2)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: '#6B7280',
              padding: '6px',
              borderRadius: '6px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Action / Filter Bar */}
        <div style={{
          padding: '16px 24px',
          backgroundColor: '#ffffff',
          borderBottom: '1px solid #F3F4F6',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px'
        }}>
          {/* Week Filter Tabs */}
          <div style={{ display: 'flex', gap: '6px', backgroundColor: '#F3F4F6', padding: '4px', borderRadius: '8px' }}>
            <button
              onClick={() => setSelectedWeekFilter('SEMANA_1')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.83rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: selectedWeekFilter === 'SEMANA_1' ? '#ffffff' : 'transparent',
                color: selectedWeekFilter === 'SEMANA_1' ? 'var(--color-corp-red, #E30613)' : '#4B5563',
                boxShadow: selectedWeekFilter === 'SEMANA_1' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Semana 1
            </button>
            <button
              onClick={() => setSelectedWeekFilter('SEMANA_2')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.83rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: selectedWeekFilter === 'SEMANA_2' ? '#ffffff' : 'transparent',
                color: selectedWeekFilter === 'SEMANA_2' ? 'var(--color-corp-red, #E30613)' : '#4B5563',
                boxShadow: selectedWeekFilter === 'SEMANA_2' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Semana 2
            </button>
            <button
              onClick={() => setSelectedWeekFilter('ALL')}
              style={{
                padding: '6px 14px',
                borderRadius: '6px',
                border: 'none',
                fontSize: '0.83rem',
                fontWeight: 600,
                cursor: 'pointer',
                backgroundColor: selectedWeekFilter === 'ALL' ? '#ffffff' : 'transparent',
                color: selectedWeekFilter === 'ALL' ? '#111827' : '#4B5563',
                boxShadow: selectedWeekFilter === 'ALL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                transition: 'all 0.15s ease'
              }}
            >
              Ver Todas
            </button>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleRestoreDefaults}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                backgroundColor: '#ffffff',
                border: '1px solid #D1D5DB',
                borderRadius: '8px',
                fontSize: '0.83rem',
                fontWeight: 500,
                color: '#374151',
                cursor: 'pointer'
              }}
              title="Cargar cronograma estándar de Villegas/América/Tejedor"
            >
              <RotateCcw size={15} />
              Valores por Defecto
            </button>
            <button
              onClick={handleOpenCreate}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                backgroundColor: 'var(--color-corp-red, #E30613)',
                border: 'none',
                borderRadius: '8px',
                fontSize: '0.83rem',
                fontWeight: 600,
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 2px 4px rgba(227, 6, 19, 0.2)'
              }}
            >
              <Plus size={16} />
              Agregar Entrada
            </button>
          </div>
        </div>

        {/* Notifications */}
        {errorMsg && (
          <div style={{ margin: '12px 24px 0 24px', padding: '10px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', color: '#991B1B', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={16} />
            {errorMsg}
          </div>
        )}
        {successMsg && (
          <div style={{ margin: '12px 24px 0 24px', padding: '10px 14px', backgroundColor: '#ECFDF5', border: '1px solid #6EE7B7', borderRadius: '8px', color: '#065F46', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Check size={16} />
            {successMsg}
          </div>
        )}

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {isEditing ? (
            /* Formulario Agregar / Editar */
            <form onSubmit={handleSubmit} style={{ backgroundColor: '#FAF9F8', padding: '20px', borderRadius: '10px', border: '1px solid #E5E7EB' }}>
              <div style={{ fontSize: '0.95rem', fontWeight: 700, marginBottom: '16px', color: '#111827', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span>{editingId ? 'Editar Entrada de Cronograma' : 'Nueva Entrada de Cronograma'}</span>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{ background: 'none', border: 'none', color: '#6B7280', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Semana
                  </label>
                  <select
                    value={form.weekType}
                    onChange={(e) => setForm({ ...form, weekType: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                  >
                    {WEEK_TYPES.map(w => (
                      <option key={w.value} value={w.value}>{w.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Día de la Semana
                  </label>
                  <select
                    value={form.dayOfWeek}
                    onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                  >
                    {DAYS_OF_WEEK.map(d => (
                      <option key={d} value={d}>{d}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                    Tipo de Operación
                  </label>
                  <select
                    value={form.activityType}
                    onChange={(e) => {
                      const newType = e.target.value;
                      if (newType === 'FERIADO') {
                        setForm({
                          ...form,
                          activityType: newType,
                          location: 'No se trabaja (Feriado)',
                          sellerName: 'Sin actividad',
                          description: 'Feriado Nacional - Sin preventa ni reparto'
                        });
                      } else {
                        setForm({
                          ...form,
                          activityType: newType,
                          location: form.location === 'No se trabaja (Feriado)' ? '' : form.location,
                          sellerName: form.sellerName === 'Sin actividad' ? 'Fabián' : form.sellerName
                        });
                      }
                    }}
                    style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                  >
                    {ACTIVITY_TYPES.map(a => (
                      <option key={a.value} value={a.value}>{a.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              {form.activityType === 'FERIADO' ? (
                <div style={{ padding: '12px 14px', backgroundColor: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: '8px', marginBottom: '16px', color: '#991B1B', fontSize: '0.83rem', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>🎉 <strong>Feriado / Día No Laborable:</strong> Ese día se indicará que <em>No se trabaja (Sin preventa ni reparto)</em> en la agenda.</span>
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', marginBottom: '16px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Pueblo / Localidad / Zona *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. América, General Villegas, Banderaló"
                      value={form.location}
                      onChange={(e) => setForm({ ...form, location: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                      required
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                      Responsable / Vendedor
                    </label>
                    <input
                      type="text"
                      placeholder="Ej. Fabián, Reparto General"
                      value={form.sellerName}
                      onChange={(e) => setForm({ ...form, sellerName: e.target.value })}
                      style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                    />
                  </div>
                </div>
              )}

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '0.78rem', fontWeight: 600, color: '#374151', marginBottom: '6px' }}>
                  Detalles u Observaciones del Día
                </label>
                <input
                  type="text"
                  placeholder="Ej. Preventa presencial en almacenes y autoservicios"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', borderRadius: '6px', border: '1px solid #D1D5DB', fontSize: '0.85rem' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  style={{ padding: '8px 16px', borderRadius: '6px', border: '1px solid #D1D5DB', backgroundColor: '#ffffff', fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  style={{ padding: '8px 20px', borderRadius: '6px', border: 'none', backgroundColor: 'var(--color-corp-red, #E30613)', color: '#ffffff', fontWeight: 600, fontSize: '0.85rem', cursor: 'pointer' }}
                >
                  {loading ? 'Guardando...' : editingId ? 'Guardar Cambios' : 'Crear Entrada'}
                </button>
              </div>
            </form>
          ) : (
            /* Tabla de Entradas */
            <div>
              {filteredItems.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '40px 20px', color: '#6B7280' }}>
                  <Calendar size={36} style={{ marginBottom: '10px', opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: '0.95rem', fontWeight: 500 }}>No hay entradas registradas para esta semana.</p>
                  <p style={{ fontSize: '0.8rem', marginTop: '4px' }}>Haz clic en "Agregar Entrada" o "Valores por Defecto" para cargar el cronograma.</p>
                </div>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
                    <thead>
                      <tr style={{ backgroundColor: '#F9FAFB', borderBottom: '1px solid #E5E7EB', textAlign: 'left' }}>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: '#374151' }}>Semana</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: '#374151' }}>Día</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: '#374151' }}>Tipo</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: '#374151' }}>Responsable</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: '#374151' }}>Pueblo / Localidad</th>
                        <th style={{ padding: '10px 12px', fontWeight: 600, color: '#374151' }}>Detalle</th>
                        <th style={{ padding: '10px 12px', textAlign: 'right', fontWeight: 600, color: '#374151' }}>Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredItems.map(item => {
                        const actInfo = ACTIVITY_TYPES.find(a => a.value === item.activityType) || ACTIVITY_TYPES[0];
                        return (
                          <tr key={item.id} style={{ borderBottom: '1px solid #F3F4F6' }}>
                            <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: item.weekType === 'SEMANA_1' ? '#FEF2F2' : '#EFF6FF',
                                color: item.weekType === 'SEMANA_1' ? '#991B1B' : '#1E40AF'
                              }}>
                                {item.weekType === 'SEMANA_1' ? 'Semana 1' : item.weekType === 'SEMANA_2' ? 'Semana 2' : 'Todas'}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', fontWeight: 600, color: '#111827' }}>
                              {item.dayOfWeek}
                            </td>
                            <td style={{ padding: '10px 12px' }}>
                              <span style={{
                                padding: '3px 8px',
                                borderRadius: '4px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                backgroundColor: actInfo.bg,
                                color: actInfo.color
                              }}>
                                {actInfo.label.split(' ')[0]}
                              </span>
                            </td>
                            <td style={{ padding: '10px 12px', color: '#374151', fontWeight: 500 }}>
                              {item.sellerName || '-'}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#111827', fontWeight: 600 }}>
                              {item.location}
                            </td>
                            <td style={{ padding: '10px 12px', color: '#6B7280', fontSize: '0.8rem', maxWidth: '200px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {item.description || '-'}
                            </td>
                            <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap' }}>
                              <button
                                onClick={() => handleOpenEdit(item)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#3B82F6', marginRight: '8px' }}
                                title="Editar"
                              >
                                <Edit2 size={16} />
                              </button>
                              <button
                                onClick={() => handleDelete(item.id)}
                                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#EF4444' }}
                                title="Eliminar"
                              >
                                <Trash2 size={16} />
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
          )}
        </div>

        {/* Modal Footer */}
        <div style={{
          padding: '14px 24px',
          borderTop: '1px solid #E5E7EB',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: '#FAF9F8'
        }}>
          <span style={{ fontSize: '0.8rem', color: '#6B7280' }}>
            Semana activa actual en el sistema: <strong>{currentWeek === 'SEMANA_1' ? 'Semana 1' : 'Semana 2'}</strong>
          </span>
          <button
            onClick={onClose}
            style={{
              padding: '8px 18px',
              borderRadius: '6px',
              border: '1px solid #D1D5DB',
              backgroundColor: '#ffffff',
              fontSize: '0.83rem',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
