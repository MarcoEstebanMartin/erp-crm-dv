import React from 'react';
import { DEPOT_VILLEGAS } from '../../utils/geoUtils';
import { OfficialGoogleMap } from './OfficialGoogleMap';
import type {
  OfficialMapMarker,
  OfficialMapPinColor,
} from '../../utils/officialGoogleMapHelpers';

export type MapPinColor = OfficialMapPinColor;
export type RouteMapMarker = OfficialMapMarker;

interface InteractiveRouteMapProps {
  markers: RouteMapMarker[];
  heightPx?: number;
  showRouteLine?: boolean;
  centerLat?: number;
  centerLng?: number;
  defaultZoom?: number;
  draggablePin?: {
    lat: number;
    lng: number;
    label?: string;
    onMove: (lat: number, lng: number) => void;
  };
  onSelectMarker?: (markerId: string) => void;
}

export function InteractiveRouteMap({
  markers,
  heightPx = 540,
  showRouteLine = false,
  centerLat = DEPOT_VILLEGAS.lat,
  centerLng = DEPOT_VILLEGAS.lng,
  defaultZoom = 14,
  draggablePin,
  onSelectMarker,
}: InteractiveRouteMapProps): React.JSX.Element {
  return (
    <OfficialGoogleMap
      markers={markers}
      heightPx={heightPx}
      showDepot={false}
      showDirections={false}
      showMarkersPolyline={showRouteLine}
      centerLat={centerLat}
      centerLng={centerLng}
      defaultZoom={defaultZoom}
      singlePin={
        draggablePin
          ? {
              lat: draggablePin.lat,
              lng: draggablePin.lng,
              onChange: draggablePin.onMove,
            }
          : undefined
      }
      onSelectMarker={onSelectMarker}
    />
  );
}

export default InteractiveRouteMap;
