import { useEffect, useMemo, useState } from 'react';
import { CircleMarker, Popup, useMap, useMapEvents } from 'react-leaflet';

type DonorPoint = {
  id: string;
  name: string;
  bloodType?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
};

type DonorCluster = {
  id: string;
  latitude: number;
  longitude: number;
  count: number;
  donors: DonorPoint[];
};

const getGridSize = (zoom: number) => {
  if (zoom >= 10) return 0.08;
  if (zoom >= 8) return 0.2;
  if (zoom >= 6) return 0.5;
  if (zoom >= 4) return 1;
  return 2;
};

const buildClusters = (donors: DonorPoint[], zoom: number): DonorCluster[] => {
  const gridSize = getGridSize(zoom);
  const buckets = new Map<string, DonorCluster>();

  donors.forEach((donor) => {
    if (typeof donor.latitude !== 'number' || typeof donor.longitude !== 'number') return;
    const key = `${Math.round(donor.latitude / gridSize)}:${Math.round(donor.longitude / gridSize)}`;
    const existing = buckets.get(key);
    if (existing) {
      existing.count += 1;
      existing.donors.push(donor);
      existing.latitude = (existing.latitude * (existing.count - 1) + donor.latitude) / existing.count;
      existing.longitude = (existing.longitude * (existing.count - 1) + donor.longitude) / existing.count;
    } else {
      buckets.set(key, {
        id: key,
        latitude: donor.latitude,
        longitude: donor.longitude,
        count: 1,
        donors: [donor],
      });
    }
  });

  return Array.from(buckets.values());
};

export function DonorClusterLayer({
  donors,
  singleFillColor,
  clusterFillColor,
}: {
  donors: DonorPoint[];
  singleFillColor: string;
  clusterFillColor: string;
}) {
  const map = useMap();
  const [zoom, setZoom] = useState(map.getZoom());
  const [bounds, setBounds] = useState(() => map.getBounds());

  useMapEvents({
    zoomend: () => {
      setZoom(map.getZoom());
      setBounds(map.getBounds());
    },
    moveend: () => {
      setBounds(map.getBounds());
    },
  });

  useEffect(() => {
    setZoom(map.getZoom());
    setBounds(map.getBounds());
  }, [map]);

  const visibleDonors = useMemo(() => {
    if (!bounds) return donors;
    return donors.filter((donor) =>
      typeof donor.latitude === 'number'
        && typeof donor.longitude === 'number'
        && bounds.contains([donor.latitude, donor.longitude])
    );
  }, [donors, bounds]);

  const clusters = useMemo(() => buildClusters(visibleDonors, zoom), [visibleDonors, zoom]);

  return (
    <>
      {clusters.map((cluster) => {
        const isSingle = cluster.count === 1;
        const radius = isSingle ? 6 : Math.min(28, 8 + cluster.count * 1.2);
        return (
          <CircleMarker
            key={cluster.id}
            center={[cluster.latitude, cluster.longitude]}
            radius={radius}
            pathOptions={{
              color: isSingle ? '#f43f5e' : '#be123c',
              weight: 1,
              fillColor: isSingle ? singleFillColor : clusterFillColor,
              fillOpacity: 0.85,
            }}
          >
            <Popup>
              {isSingle ? (
                <>
                  <div className="text-sm font-semibold text-gray-900">{cluster.donors[0].name}</div>
                  <div className="text-xs text-gray-600">
                    {cluster.donors[0].bloodType || 'Blood type'} • {cluster.donors[0].city || 'City'}
                  </div>
                </>
              ) : (
                <>
                  <div className="text-sm font-semibold text-gray-900">{cluster.count} donors</div>
                  <div className="text-xs text-gray-600">Zoom in to see individuals</div>
                </>
              )}
            </Popup>
          </CircleMarker>
        );
      })}
    </>
  );
}
