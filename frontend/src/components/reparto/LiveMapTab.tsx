import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from '../../utils/api';
import { OfficialGoogleMap } from '../common/OfficialGoogleMap';
import { LiveMapSidePanel } from './LiveMapSidePanel';
import {
  buildLiveMapScene,
  getTodayArgentinaDateInput,
  type LiveMapEventItem,
  type LiveMapLayers,
  type LiveMapPayload,
  type LiveMapSelection,
} from './liveMap.types';

const AUTO_REFRESH_MS = 60_000;

export default function LiveMapTab() {
  const [date, setDate] = useState<string>(() => getTodayArgentinaDateInput());
  const [data, setData] = useState<LiveMapPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fixingClientId, setFixingClientId] = useState<number | null>(null);
  const [selection, setSelection] = useState<LiveMapSelection>(null);
  const [layers, setLayers] = useState<LiveMapLayers>({
    sellers: true,
    vehicles: true,
    visits: true,
    pending: false,
  });

  const fetchLiveMap = useCallback(async (targetDate: string) => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const payload = (await api.getLogisticsLiveMap(targetDate)) as LiveMapPayload;
      setData(payload);
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al cargar el mapa.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setSelection(null);
    void fetchLiveMap(date);
  }, [date, fetchLiveMap]);

  useEffect(() => {
    if (!data?.isToday) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        void fetchLiveMap(date);
      }
    }, AUTO_REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [data?.isToday, date, fetchLiveMap]);

  const toggleLayer = (key: keyof LiveMapLayers) => {
    setLayers((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const handleFixClientCoords = async (ev: LiveMapEventItem) => {
    if (ev.lat === null || ev.lng === null) return;
    setFixingClientId(ev.clientId);
    setErrorMsg(null);
    try {
      await api.updatePersona(ev.clientId, { latitude: ev.lat, longitude: ev.lng });
      await fetchLiveMap(date);
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo guardar la ubicación del cliente.');
    } finally {
      setFixingClientId(null);
    }
  };

  const scene = useMemo(
    () => buildLiveMapScene({ data, layers, selection }),
    [data, layers, selection],
  );

  const handleSelectMarker = useCallback((markerId: string) => {
    if (markerId.startsWith('seller-')) {
      const id = Number(markerId.slice('seller-'.length));
      if (Number.isFinite(id)) setSelection({ kind: 'seller', id });
    } else if (markerId.startsWith('vehicle-')) {
      const id = Number(markerId.slice('vehicle-'.length));
      if (Number.isFinite(id)) setSelection({ kind: 'vehicle', id });
    }
  }, []);

  const layerChips: Array<{ key: keyof LiveMapLayers; label: string; count?: number }> = [
    { key: 'sellers', label: 'Vendedores', count: data?.summary.activeSellers },
    { key: 'vehicles', label: 'Vehículos', count: data?.summary.activeVehicles },
    { key: 'visits', label: 'Visitas', count: (data?.summary.totalVisits ?? 0) + (data?.summary.totalReceipts ?? 0) },
    { key: 'pending', label: 'Pendientes', count: data?.summary.pendingClientsCount },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '10px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="date"
            aria-label="Fecha del mapa"
            className="input"
            value={date}
            onChange={(e) => setDate(e.target.value || getTodayArgentinaDateInput())}
            style={{ width: '155px', height: '34px', padding: '4px 10px', fontSize: '0.84rem' }}
          />

          <div role="group" aria-label="Capas del mapa" style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {layerChips.map((chip) => {
              const active = layers[chip.key];
              return (
                <button
                  key={chip.key}
                  type="button"
                  aria-pressed={active}
                  onClick={() => toggleLayer(chip.key)}
                  style={{
                    height: '34px',
                    padding: '0 10px',
                    borderRadius: '8px',
                    border: active ? '1px solid #111827' : '1px solid var(--border-color)',
                    backgroundColor: active ? '#111827' : 'var(--bg-card, #fff)',
                    color: active ? '#fff' : 'var(--text-secondary)',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '6px',
                  }}
                >
                  <span>{chip.label}</span>
                  {typeof chip.count === 'number' && (
                    <span className="tabular-nums" style={{ opacity: active ? 0.85 : 0.7 }}>
                      {chip.count}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        <button
          type="button"
          className="btn btn-secondary"
          onClick={() => void fetchLiveMap(date)}
          disabled={loading}
          style={{ height: '34px', padding: '0 12px', fontSize: '0.82rem', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
        >
          <RefreshCw size={14} className={loading ? 'spin-animation' : ''} aria-hidden="true" />
          Actualizar
        </button>
      </div>

      {errorMsg && (
        <div
          role="alert"
          style={{
            padding: '10px 12px',
            borderRadius: '8px',
            border: '1px solid #fecaca',
            backgroundColor: '#fef2f2',
            color: '#991b1b',
            fontSize: '0.84rem',
          }}
        >
          {errorMsg}
        </div>
      )}

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(270px, 310px) 1fr',
          gap: '14px',
          alignItems: 'start',
        }}
      >
        <LiveMapSidePanel
          data={data}
          selection={selection}
          onSelect={setSelection}
          fixingClientId={fixingClientId}
          onFixClientCoords={handleFixClientCoords}
        />

        <div
          style={{
            minHeight: '580px',
            height: '620px',
            borderRadius: '10px',
            overflow: 'hidden',
            border: '1px solid var(--border-color)',
            backgroundColor: 'var(--bg-card, #fff)',
          }}
        >
          <OfficialGoogleMap
            markers={scene.markers}
            showDepot
            showDirections={false}
            showMarkersPolyline={scene.showMarkersPolyline}
            gpsLocation={scene.gpsLocation}
            gpsTrail={scene.gpsTrail}
            fillHeight
            onSelectMarker={handleSelectMarker}
          />
        </div>
      </div>
    </div>
  );
}
