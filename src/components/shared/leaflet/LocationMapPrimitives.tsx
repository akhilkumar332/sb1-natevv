import { useEffect } from 'react';
import { Marker, Popup, useMap, useMapEvents } from 'react-leaflet';

type LatLngTuple = [number, number];

export function LeafletMapUpdater({ center, zoom }: { center: LatLngTuple; zoom?: number }) {
  const map = useMap();

  useEffect(() => {
    if (typeof zoom === 'number') {
      map.setView(center, zoom);
      return;
    }
    map.setView(center);
  }, [center, map, zoom]);

  return null;
}

export function LeafletClickMarker({
  position,
  onPositionChange,
  popupText,
}: {
  position: LatLngTuple;
  onPositionChange: (pos: LatLngTuple) => void;
  popupText?: string;
}) {
  useMapEvents({
    click(event) {
      onPositionChange([event.latlng.lat, event.latlng.lng]);
    },
  });

  return (
    <Marker position={position}>
      {popupText ? <Popup>{popupText}</Popup> : null}
    </Marker>
  );
}

