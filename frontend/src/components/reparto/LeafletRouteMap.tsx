import { OfficialGoogleMap } from '../common/OfficialGoogleMap';
import type { LiveVehicleGpsPoint } from '../../utils/officialGoogleMapHelpers';

interface RouteMapProps {
  locations: any[];
  routePoints?: [number, number][];
  onUpdateClientCoords?: (clientId: number, lat: number, lng: number) => void;
  gpsLocation?: LiveVehicleGpsPoint | null;
  gpsTrail?: [number, number][];
  fillHeight?: boolean;
}

export function LeafletRouteMap({
  locations,
  onUpdateClientCoords,
  gpsLocation,
  gpsTrail,
  fillHeight = false,
}: RouteMapProps) {
  return (
    <OfficialGoogleMap
      stops={locations}
      showDepot
      showDirections
      onUpdateClientCoords={onUpdateClientCoords}
      gpsLocation={gpsLocation}
      gpsTrail={gpsTrail}
      heightPx={420}
      fillHeight={fillHeight}
    />
  );
}

export function RouteMap({
  locations,
  onUpdateClientCoords,
  gpsLocation,
  gpsTrail,
  fillHeight = false,
}: RouteMapProps) {
  return (
    <OfficialGoogleMap
      stops={locations}
      showDepot
      showDirections
      onUpdateClientCoords={onUpdateClientCoords}
      gpsLocation={gpsLocation}
      gpsTrail={gpsTrail}
      heightPx={420}
      fillHeight={fillHeight}
    />
  );
}
