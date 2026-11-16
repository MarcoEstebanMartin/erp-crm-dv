import { OfficialGoogleMap } from '../common/OfficialGoogleMap';
import type { LiveVehicleGpsPoint } from '../../utils/officialGoogleMapHelpers';

export function GoogleRouteMap({
  locations,
  onUpdateClientCoords,
  gpsLocation,
  gpsTrail,
}: {
  locations: any[];
  routePoints?: [number, number][];
  onUpdateClientCoords?: (clientId: number, lat: number, lng: number) => void;
  gpsLocation?: LiveVehicleGpsPoint | null;
  gpsTrail?: [number, number][];
}) {
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
