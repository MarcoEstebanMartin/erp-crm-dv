import React from 'react';
import { Calendar, RefreshCw, Settings } from 'lucide-react';

interface HomeWeeklyScheduleRibbonProps {
  currentWeek: string;
  todayName: string;
  activeDayScheduleItems: any[];
  allItems: any[];
  showFullWeek: boolean;
  onToggleCurrentWeek: () => void;
  onToggleFullWeek: () => void;
  onOpenScheduleModal: () => void;
}

const WEEK_DAYS = ['LUNES', 'MARTES', 'MIERCOLES', 'JUEVES', 'VIERNES', 'SABADO'];

export function HomeWeeklyScheduleRibbon({
  currentWeek,
  todayName,
  activeDayScheduleItems,
  allItems,
  showFullWeek,
  onToggleCurrentWeek,
  onToggleFullWeek,
  onOpenScheduleModal,
}: HomeWeeklyScheduleRibbonProps) {
  const formattedToday = todayName.charAt(0) + todayName.slice(1).toLowerCase();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div
        style={{
          flex: 1,
          padding: '16px 20px',
          backgroundColor: 'var(--bg-card, #ffffff)',
          borderRadius: '10px',
          border: '1px solid var(--border-color, #e5e5e7)',
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          fontSize: '0.83rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
          <Calendar size={15} style={{ color: 'var(--text-secondary)', flexShrink: 0 }} aria-hidden="true" />

          <button
            type="button"
            onClick={onToggleCurrentWeek}
            aria-label="Alternar semana activa"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '12px',
              fontSize: '0.74rem',
              fontWeight: 700,
              backgroundColor: 'var(--bg-light, #f5f5f7)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-color, #d1d5db)',
              cursor: 'pointer',
            }}
          >
            <span>{currentWeek === 'SEMANA_1' ? 'Semana 1' : 'Semana 2'}</span>
            <RefreshCw size={10} style={{ opacity: 0.7 }} aria-hidden="true" />
          </button>

          <span style={{ color: 'var(--text-secondary)' }}>·</span>
          <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>Hoy ({formattedToday}):</span>

          {activeDayScheduleItems.length === 0 ? (
            <span style={{ color: 'var(--text-secondary)' }}>Sin actividad</span>
          ) : activeDayScheduleItems.some((item: any) => item.activityType === 'FERIADO') ? (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                color: '#E30613',
                fontWeight: 700,
                backgroundColor: '#FEF2F2',
                padding: '2px 8px',
                borderRadius: '6px',
                border: '1px solid #FECACA',
              }}
            >
              Feriado
            </span>
          ) : (
            activeDayScheduleItems.map((item: any, idx: number) => {
              const isPreventa = item.activityType === 'PREVENTA';
              return (
                <React.Fragment key={item.id}>
                  {idx > 0 && <span style={{ color: 'var(--border-color)' }}>·</span>}
                  <span
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: 'var(--text-primary)',
                      fontWeight: 500,
                    }}
                  >
                    <span
                      style={{
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: isPreventa ? '#10B981' : '#3B82F6',
                        display: 'inline-block',
                      }}
                    />
                    <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                      {isPreventa ? (item.sellerName ? `${item.sellerName}:` : 'Preventa:') : 'Reparto:'}
                    </span>
                    <strong>{item.location}</strong>
                  </span>
                </React.Fragment>
              );
            })
          )}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <button
            type="button"
            aria-expanded={showFullWeek}
            onClick={onToggleFullWeek}
            style={{
              background: 'none',
              border: 'none',
              color: showFullWeek ? 'var(--text-primary)' : 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              padding: 0,
            }}
          >
            Semana
          </button>
          <span style={{ color: 'var(--border-color)' }}>|</span>
          <button
            type="button"
            onClick={onOpenScheduleModal}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
              padding: 0,
            }}
          >
            <Settings size={13} aria-hidden="true" />
            Editar
          </button>
        </div>
      </div>

      {showFullWeek && (
        <div
          style={{
            marginTop: '8px',
            padding: '12px',
            backgroundColor: 'var(--bg-light, #f9fafb)',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
            gap: '8px',
          }}
        >
          {WEEK_DAYS.map((day) => {
            const isToday = day === todayName;
            const dayItems = allItems.filter(
              (item) => (item.weekType === currentWeek || item.weekType === 'TODAS') && item.dayOfWeek === day,
            );
            const feriado = dayItems.find((i) => i.activityType === 'FERIADO');
            const preventa = dayItems.find((i) => i.activityType === 'PREVENTA' || i.activityType === 'AMBOS');
            const reparto = dayItems.find((i) => i.activityType === 'REPARTO' || i.activityType === 'AMBOS');

            return (
              <div
                key={day}
                style={{
                  padding: '8px 10px',
                  borderRadius: '6px',
                  backgroundColor: isToday ? 'var(--bg-card, #ffffff)' : 'transparent',
                  border: isToday ? '1px solid var(--border-color)' : '1px solid transparent',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                    {day.substring(0, 3)}
                  </span>
                  {isToday && <span style={{ fontSize: '0.62rem', fontWeight: 700, color: 'var(--text-secondary)' }}>HOY</span>}
                </div>

                <div style={{ fontSize: '0.73rem', display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {feriado ? (
                    <span style={{ color: '#E30613', fontWeight: 600 }}>Feriado</span>
                  ) : (
                    <>
                      {preventa && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-primary)' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#10B981', flexShrink: 0 }} />
                          <span>{preventa.location}</span>
                        </span>
                      )}
                      {reparto && (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', color: 'var(--text-secondary)' }}>
                          <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#3B82F6', flexShrink: 0 }} />
                          <span>{reparto.location}</span>
                        </span>
                      )}
                      {!preventa && !reparto && <span style={{ color: 'var(--text-secondary)' }}>-</span>}
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
