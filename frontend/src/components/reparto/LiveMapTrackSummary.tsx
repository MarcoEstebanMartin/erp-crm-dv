import { Clock, Flag, Navigation } from 'lucide-react';
import {
  formatDurationCompactEs,
  formatEventTimeEs,
  type GpsTrackAnalysis,
} from './liveMap.types';

interface LiveMapTrackSummaryProps {
  track?: GpsTrackAnalysis;
  showTimeline?: boolean;
}

export function LiveMapTrackSummary({ track, showTimeline = true }: LiveMapTrackSummaryProps) {
  if (!track || track.pointCount === 0) {
    return null;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: '6px',
        }}
      >
        <div
          style={{
            padding: '6px 8px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
          }}
        >
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Distancia</div>
          <div className="tabular-nums" style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {track.totalDistanceKm.toFixed(1).replace('.', ',')} km
          </div>
        </div>

        <div
          style={{
            padding: '6px 8px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
          }}
        >
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Movimiento</div>
          <div className="tabular-nums" style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatDurationCompactEs(track.movingDurationSec)}
          </div>
        </div>

        <div
          style={{
            padding: '6px 8px',
            borderRadius: '8px',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-subtle, #f8fafc)',
          }}
        >
          <div style={{ fontSize: '0.68rem', color: 'var(--text-secondary)' }}>Detenido</div>
          <div className="tabular-nums" style={{ fontSize: '0.84rem', fontWeight: 700, color: 'var(--text-primary)' }}>
            {formatDurationCompactEs(track.stoppedDurationSec)}
          </div>
        </div>
      </div>

      {showTimeline && (
        <ol
          style={{
            listStyle: 'none',
            margin: 0,
            padding: 0,
            display: 'flex',
            flexDirection: 'column',
            gap: '6px',
          }}
        >
          {track.startedAt && (
            <li
              style={{
                padding: '6px 9px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: '#059669' }}>
                <Navigation size={12} aria-hidden="true" />
                Inicio
              </span>
              <span className="tabular-nums" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                {formatEventTimeEs(track.startedAt)}
              </span>
            </li>
          )}

          {track.stops.length === 0 ? (
            <li style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', padding: '6px 4px' }}>
              Sin paradas mayores a 3 min
            </li>
          ) : (
            track.stops.map((stop) => (
              <li
                key={`stop-${stop.stopNumber}`}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  border: '1px solid var(--border-color)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '3px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                    <span
                      className="tabular-nums"
                      style={{
                        width: '18px',
                        height: '18px',
                        borderRadius: '999px',
                        backgroundColor: '#111827',
                        color: '#fff',
                        fontSize: '0.7rem',
                        fontWeight: 700,
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {stop.stopNumber}
                    </span>
                    <span className="tabular-nums" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                      {formatEventTimeEs(stop.arrivedAt)}–{formatEventTimeEs(stop.departedAt)}
                    </span>
                  </span>
                  <span
                    className="tabular-nums"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '3px',
                      fontSize: '0.74rem',
                      fontWeight: 700,
                      color: 'var(--text-primary)',
                    }}
                  >
                    <Clock size={11} aria-hidden="true" />
                    {stop.durationLabel}
                  </span>
                </div>

                <div style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-primary)' }}>
                  {stop.nearestClient ? stop.nearestClient.name : 'Parada en ruta'}
                </div>

                {stop.nearestClient?.address && (
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)' }}>
                    {stop.nearestClient.address}
                  </div>
                )}
              </li>
            ))
          )}

          {track.endedAt && track.endedAt !== track.startedAt && (
            <li
              style={{
                padding: '6px 9px',
                borderRadius: '8px',
                border: '1px solid var(--border-color)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                fontSize: '0.78rem',
              }}
            >
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontWeight: 600, color: 'var(--text-primary)' }}>
                <Flag size={12} aria-hidden="true" />
                Última señal
              </span>
              <span className="tabular-nums" style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>
                {formatEventTimeEs(track.endedAt)}
              </span>
            </li>
          )}
        </ol>
      )}
    </div>
  );
}
