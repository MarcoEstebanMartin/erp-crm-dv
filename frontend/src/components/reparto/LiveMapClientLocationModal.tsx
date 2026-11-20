import { useEffect, useRef, useState } from 'react';
import { MapPin, Search, Trash2, X } from 'lucide-react';
import { api } from '../../utils/api';
import { geocodeAddressWithGoogle } from '../../utils/googleMapsLoader';
import { OfficialGoogleMap } from '../common/OfficialGoogleMap';
import { detectRealCity, getCityBaseCoords } from './repartoGeoHelpers';
import type { LiveMapEventItem } from './liveMap.types';

interface LiveMapClientLocationModalProps {
  event: LiveMapEventItem | null;
  onClose: () => void;
  onSaved: () => Promise<void>;
}

function hasValidCoords(lat: number | null | undefined, lng: number | null | undefined): boolean {
  return (
    typeof lat === 'number' &&
    typeof lng === 'number' &&
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat !== 0 &&
    lng !== 0
  );
}

export function buildClientAddressQuery(address: string | null, city: string | null): string {
  const realCity = detectRealCity({ address, city });
  return [address, realCity, 'Buenos Aires, Argentina']
    .map((part) => (typeof part === 'string' ? part.trim() : ''))
    .filter(Boolean)
    .join(', ');
}

export function LiveMapClientLocationModal({
  event,
  onClose,
  onSaved,
}: LiveMapClientLocationModalProps) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (event) {
      setErrorMsg(null);
      if (hasValidCoords(event.clientLat, event.clientLng)) {
        setCoords({ lat: event.clientLat as number, lng: event.clientLng as number });
      } else {
        setCoords(null);
      }
      if (!dialog.open) {
        dialog.showModal();
      }
    } else if (dialog.open) {
      dialog.close();
    }
  }, [event]);

  if (!event) {
    return <dialog ref={dialogRef} className="app-native-dialog" aria-hidden="true" />;
  }

  const fallbackCenter = getCityBaseCoords({
    address: event.clientAddress,
    city: event.clientCity,
  });
  const pinLat = coords ? coords.lat : fallbackCenter.lat;
  const pinLng = coords ? coords.lng : fallbackCenter.lng;
  const clientHadCoords = hasValidCoords(event.clientLat, event.clientLng);
  const addressLine = [event.clientAddress, event.clientCity].filter(Boolean).join(' · ');

  const handleGeocode = async () => {
    if (geocoding || saving) return;
    setErrorMsg(null);
    const query = buildClientAddressQuery(event.clientAddress, event.clientCity);
    if (!query) {
      setErrorMsg('El cliente no tiene dirección cargada.');
      return;
    }

    setGeocoding(true);
    try {
      const res = await geocodeAddressWithGoogle(query);
      if (!res) {
        setErrorMsg('No se encontró la dirección en Google Maps.');
        return;
      }
      setCoords({ lat: res.lat, lng: res.lng });
    } catch (err: any) {
      setErrorMsg(err?.message || 'Error al buscar dirección.');
    } finally {
      setGeocoding(false);
    }
  };

  const handleClearGps = async () => {
    if (saving) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await api.updatePersona(event.clientId, { latitude: null, longitude: null });
      await onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo quitar la ubicación.');
    } finally {
      setSaving(false);
    }
  };

  const handleSave = async () => {
    if (saving || !coords) return;
    setSaving(true);
    setErrorMsg(null);
    try {
      await api.updatePersona(event.clientId, {
        latitude: coords.lat,
        longitude: coords.lng,
      });
      await onSaved();
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'No se pudo guardar la ubicación.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className="app-native-dialog"
      aria-labelledby="live-map-client-loc-title"
      closedby="any"
      onClose={() => {
        if (dialogRef.current) dialogRef.current.returnValue = '';
        onClose();
      }}
      style={{ width: 'min(94vw, 640px)' }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '14px 16px',
          borderBottom: '1px solid var(--border-color)',
        }}
      >
        <div style={{ minWidth: 0 }}>
          <h2
            id="live-map-client-loc-title"
            style={{
              margin: 0,
              fontSize: '0.96rem',
              fontWeight: 700,
              color: 'var(--text-primary)',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            {event.clientName}
          </h2>
          {addressLine && (
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginTop: '2px' }}>
              {addressLine}
            </div>
          )}
        </div>

        <button
          type="button"
          className="btn btn-ghost"
          aria-label="Cerrar"
          onClick={onClose}
          style={{ padding: '4px', flexShrink: 0 }}
        >
          <X size={16} aria-hidden="true" />
        </button>
      </div>

      <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: '8px',
          }}
        >
          <span
            className="tabular-nums"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '0.78rem',
              fontWeight: 600,
              color: coords ? '#15803d' : 'var(--text-secondary)',
            }}
          >
            <MapPin size={14} aria-hidden="true" />
            {coords
              ? `${coords.lat.toFixed(5)}, ${coords.lng.toFixed(5)}`
              : 'Sin GPS guardado'}
          </span>

          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={geocoding || saving}
              onClick={() => void handleGeocode()}
              style={{
                padding: '5px 10px',
                fontSize: '0.78rem',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
            >
              <Search size={13} aria-hidden="true" />
              {geocoding ? 'Buscando...' : 'Buscar dirección'}
            </button>

            {clientHadCoords && (
              <button
                type="button"
                className="btn btn-secondary"
                disabled={saving}
                onClick={() => void handleClearGps()}
                style={{
                  padding: '5px 10px',
                  fontSize: '0.78rem',
                  color: '#E30613',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '5px',
                }}
              >
                <Trash2 size={13} aria-hidden="true" />
                Quitar GPS
              </button>
            )}
          </div>
        </div>

        {errorMsg && (
          <div
            role="alert"
            style={{
              padding: '8px 10px',
              borderRadius: '6px',
              border: '1px solid #fecaca',
              backgroundColor: '#fef2f2',
              color: '#991b1b',
              fontSize: '0.78rem',
            }}
          >
            {errorMsg}
          </div>
        )}

        <OfficialGoogleMap
          heightPx={360}
          showDepot={false}
          showDirections={false}
          singlePin={{
            lat: pinLat,
            lng: pinLng,
            onChange: (lat, lng) => {
              setErrorMsg(null);
              setCoords({ lat, lng });
            },
          }}
        />
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: '8px',
          padding: '12px 16px',
          borderTop: '1px solid var(--border-color)',
        }}
      >
        <button
          type="button"
          className="btn btn-secondary"
          disabled={saving}
          onClick={onClose}
          style={{ padding: '6px 12px', fontSize: '0.82rem' }}
        >
          Cancelar
        </button>
        <button
          type="button"
          className="btn btn-primary"
          disabled={saving || !coords}
          onClick={() => void handleSave()}
          style={{ padding: '6px 14px', fontSize: '0.82rem' }}
        >
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </dialog>
  );
}
