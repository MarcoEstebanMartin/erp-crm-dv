import React, { useState } from 'react';
import { MapPin, Search, X } from 'lucide-react';
import { OfficialGoogleMap } from '../../common/OfficialGoogleMap';
import { geocodeAddressWithGoogle } from '../../../utils/googleMapsLoader';
import { detectRealCity, getCityBaseCoords } from '../../reparto/repartoGeoHelpers';

interface ClientGpsPickerSectionProps {
  data: any;
  onChangeData: (patch: Record<string, any>) => void;
}

export const ClientGpsPickerSection: React.FC<ClientGpsPickerSectionProps> = ({
  data,
  onChangeData,
}) => {
  const [showMap, setShowMap] = useState(false);
  const [isGeocoding, setIsGeocoding] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);

  const parsedLat = Number(data?.latitude);
  const parsedLng = Number(data?.longitude);
  const hasCoords =
    data?.latitude !== null &&
    data?.latitude !== undefined &&
    data?.latitude !== '' &&
    data?.longitude !== null &&
    data?.longitude !== undefined &&
    data?.longitude !== '' &&
    Number.isFinite(parsedLat) &&
    Number.isFinite(parsedLng) &&
    parsedLat !== 0 &&
    parsedLng !== 0;

  const fallbackCenter = getCityBaseCoords(data);
  const activeLat = hasCoords ? parsedLat : fallbackCenter.lat;
  const activeLng = hasCoords ? parsedLng : fallbackCenter.lng;

  const handleGeocodeAddress = async () => {
    if (isGeocoding) return;
    setLookupError(null);
    const cityName = detectRealCity(data);
    const queryParts = [data?.address, data?.barrio, cityName, 'Buenos Aires, Argentina']
      .map((s) => (typeof s === 'string' ? s.trim() : ''))
      .filter(Boolean);

    if (queryParts.length === 0) {
      setLookupError('Ingresá una dirección o localidad.');
      return;
    }

    setIsGeocoding(true);
    try {
      const res = await geocodeAddressWithGoogle(queryParts.join(', '));
      if (!res) {
        setLookupError('No se encontró la dirección en Google Maps.');
        return;
      }
      onChangeData({ latitude: res.lat, longitude: res.lng });
      setShowMap(true);
    } catch (err: any) {
      setLookupError(err?.message || 'Error al buscar ubicación.');
    } finally {
      setIsGeocoding(false);
    }
  };

  return (
    <div style={{ marginTop: '14px', paddingTop: '12px', borderTop: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '8px' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: hasCoords ? '#15803d' : 'var(--text-secondary)', fontWeight: 600 }}>
          <MapPin size={14} aria-hidden="true" />
          <span className="tabular-nums">
            {hasCoords
              ? `GPS exacto (${parsedLat.toFixed(5)}, ${parsedLng.toFixed(5)})`
              : 'Sin coordenadas GPS'}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            onClick={() => {
              setLookupError(null);
              setShowMap((prev) => !prev);
            }}
          >
            <MapPin size={13} aria-hidden="true" />
            <span>{showMap ? 'Ocultar mapa' : 'Ubicar en mapa'}</span>
          </button>

          <button
            type="button"
            className="btn btn-secondary"
            style={{ padding: '4px 10px', fontSize: '0.76rem', display: 'inline-flex', alignItems: 'center', gap: '5px' }}
            onClick={handleGeocodeAddress}
            disabled={isGeocoding}
          >
            <Search size={13} aria-hidden="true" />
            <span>{isGeocoding ? 'Buscando...' : 'Buscar dirección'}</span>
          </button>

          {hasCoords && (
            <button
              type="button"
              className="btn btn-ghost"
              style={{ padding: '4px 8px', fontSize: '0.76rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: '3px' }}
              onClick={() => {
                setLookupError(null);
                onChangeData({ latitude: null, longitude: null });
              }}
            >
              <X size={13} aria-hidden="true" />
              <span>Limpiar</span>
            </button>
          )}
        </div>
      </div>

      {lookupError && (
        <div role="alert" style={{ marginTop: '8px', fontSize: '0.76rem', color: 'var(--color-danger)', fontWeight: 500 }}>
          {lookupError}
        </div>
      )}

      {showMap && (
        <div style={{ marginTop: '10px' }}>
          <OfficialGoogleMap
            heightPx={230}
            showDepot={false}
            showDirections={false}
            singlePin={{
              lat: activeLat,
              lng: activeLng,
              onChange: (lat, lng) => onChangeData({ latitude: lat, longitude: lng }),
            }}
          />
        </div>
      )}
    </div>
  );
};
