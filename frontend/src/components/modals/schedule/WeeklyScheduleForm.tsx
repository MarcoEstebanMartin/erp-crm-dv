import React from 'react';

export interface WeeklyScheduleItem {
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

export interface WeeklyScheduleFormData {
  weekType: string;
  dayOfWeek: string;
  activityType: string;
  sellerName: string;
  location: string;
  description: string;
  sortOrder: number;
}

export const DAYS_OF_WEEK = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO', 'DOMINGO'];

export const WEEK_TYPES = [
  { value: 'SEMANA_1', label: 'Semana 1' },
  { value: 'SEMANA_2', label: 'Semana 2' },
  { value: 'TODAS', label: 'Todas' },
];

export const ACTIVITY_TYPES = [
  { value: 'PREVENTA', label: 'Preventa', color: '#065F46', bg: '#ECFDF5' },
  { value: 'REPARTO', label: 'Reparto', color: '#1E40AF', bg: '#EFF6FF' },
  { value: 'FERIADO', label: 'Feriado', color: '#E30613', bg: '#FEF2F2' },
];

interface WeeklyScheduleFormProps {
  form: WeeklyScheduleFormData;
  setForm: React.Dispatch<React.SetStateAction<WeeklyScheduleFormData>>;
  editingId: number | null;
  loading: boolean;
  onCancel: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export function WeeklyScheduleForm({
  form,
  setForm,
  editingId,
  loading,
  onCancel,
  onSubmit,
}: WeeklyScheduleFormProps) {
  const labelStyle = {
    display: 'block',
    fontSize: '0.78rem',
    fontWeight: 600,
    color: 'var(--text-primary)',
    marginBottom: '6px',
  };

  const handleActivityChange = (newType: string) => {
    if (newType === 'FERIADO') {
      setForm({
        ...form,
        activityType: newType,
        location: 'Feriado',
        sellerName: '',
      });
      return;
    }

    setForm({
      ...form,
      activityType: newType,
      location: form.location === 'Feriado' || form.location === 'No se trabaja (Feriado)' ? '' : form.location,
      sellerName: form.sellerName === 'Sin actividad' ? '' : form.sellerName,
    });
  };

  return (
    <form
      onSubmit={onSubmit}
      style={{
        backgroundColor: 'var(--bg-light, #f9fafb)',
        padding: '18px 20px',
        borderRadius: '8px',
        border: '1px solid var(--border-color)',
      }}
    >
      <div
        style={{
          fontSize: '0.92rem',
          fontWeight: 700,
          marginBottom: '14px',
          color: 'var(--text-primary)',
        }}
      >
        {editingId ? 'Editar entrada' : 'Nueva entrada'}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: '14px',
          marginBottom: '14px',
        }}
      >
        <div>
          <label htmlFor="schedule-week" style={labelStyle}>Semana</label>
          <select
            id="schedule-week"
            name="weekType"
            className="select"
            value={form.weekType}
            onChange={(e) => setForm({ ...form, weekType: e.target.value })}
          >
            {WEEK_TYPES.map((w) => (
              <option key={w.value} value={w.value}>
                {w.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="schedule-day" style={labelStyle}>Día</label>
          <select
            id="schedule-day"
            name="dayOfWeek"
            className="select"
            value={form.dayOfWeek}
            onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })}
          >
            {DAYS_OF_WEEK.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="schedule-activity" style={labelStyle}>Actividad</label>
          <select
            id="schedule-activity"
            name="activityType"
            className="select"
            value={form.activityType}
            onChange={(e) => handleActivityChange(e.target.value)}
          >
            {ACTIVITY_TYPES.map((a) => (
              <option key={a.value} value={a.value}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {form.activityType !== 'FERIADO' && (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px',
            marginBottom: '14px',
          }}
        >
          <div>
            <label htmlFor="schedule-location" style={labelStyle}>Localidad</label>
            <input
              id="schedule-location"
              name="location"
              type="text"
              className="input"
              value={form.location}
              onChange={(e) => setForm({ ...form, location: e.target.value })}
              required
            />
          </div>

          <div>
            <label htmlFor="schedule-seller" style={labelStyle}>Responsable</label>
            <input
              id="schedule-seller"
              name="sellerName"
              type="text"
              className="input"
              value={form.sellerName}
              onChange={(e) => setForm({ ...form, sellerName: e.target.value })}
            />
          </div>
        </div>
      )}

      <div style={{ marginBottom: '16px' }}>
        <label htmlFor="schedule-description" style={labelStyle}>Notas</label>
        <input
          id="schedule-description"
          name="description"
          type="text"
          className="input"
          value={form.description}
          onChange={(e) => setForm({ ...form, description: e.target.value })}
        />
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
        <button type="button" className="btn btn-secondary" onClick={onCancel} disabled={loading}>
          Cancelar
        </button>
        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
