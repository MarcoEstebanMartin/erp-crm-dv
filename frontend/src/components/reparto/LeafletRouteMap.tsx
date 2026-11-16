import { OfficialGoogleMap } from '../common/OfficialGoogleMap';
import type { LiveVehicleGpsPoint } from '../../utils/officialGoogleMapHelpers';

interface RouteMapProps {
  locations: any[];
  routePoints?: [number, number][];
  onUpdateClientCoords?: (clientId: number, lat: number, lng: number) => void;
  gpsLocation?: LiveVehicleGpsPoint | null;
  gpsTrail?: [number, number][];
}

export function LeafletRouteMap({
  locations,
  onUpdateClientCoords,
  gpsLocation,
  gpsTrail,
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
    />
  );
}

export function RouteMap({
  locations,
  onUpdateClientCoords,
  gpsLocation,
  gpsTrail,
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
    />
  );
}
