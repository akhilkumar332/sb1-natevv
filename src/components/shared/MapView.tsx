/**
 * MapView Component
 *
 * Component for displaying locations on a map
 * Note: This is a placeholder that can be integrated with Google Maps, Mapbox, or Leaflet
 */

import React, { useState } from 'react';
import { MapPin, Navigation, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { Coordinates } from '../../types/database.types';
import { formatDistance, calculateDistance } from '../../utils/geolocation';

interface MapMarker {
  id: string;
  position: Coordinates;
  label: string;
  type?: 'donor' | 'bloodbank' | 'hospital' | 'request' | 'campaign' | 'default';
  onClick?: () => void;
}

interface MapViewProps {
  center: Coordinates;
  markers?: MapMarker[];
  zoom?: number;
  height?: string;
  showControls?: boolean;
  showCurrentLocation?: boolean;
  currentLocation?: Coordinates | null;
  onMarkerClick?: (marker: MapMarker) => void;
}

/**
 * MapView Component
 *
 * Placeholder for map integration. In production, replace with:
 * - Google Maps (@react-google-maps/api)
 * - Mapbox (react-map-gl)
 * - Leaflet (react-leaflet)
 */
export const MapView: React.FC<MapViewProps> = ({
  center,
  markers = [],
  zoom: initialZoom = 12,
  height = '400px',
  showControls = true,
  showCurrentLocation = false,
  currentLocation,
  onMarkerClick,
}) => {
  const [zoom, setZoom] = useState(initialZoom);
  const [selectedMarker, setSelectedMarker] = useState<MapMarker | null>(null);

  // Marker color by type
  const getMarkerColor = (type?: string): string => {
    switch (type) {
      case 'donor':
        return 'text-green-600';
      case 'bloodbank':
      case 'hospital':
        return 'text-blue-600';
      case 'request':
        return 'text-red-600';
      case 'campaign':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  const getMarkerTypeLabel = (type?: string) => {
    if (!type) return '';
    return type === 'hospital' ? 'bloodbank' : type;
  };

  // Handle marker click
  const handleMarkerClick = (marker: MapMarker) => {
    setSelectedMarker(marker);
    onMarkerClick?.(marker);
  };

  // Zoom controls
  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 1, 20));
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 1, 1));

  return (
    <div className="relative bg-gray-100 rounded-lg overflow-hidden border border-gray-300" style={{ height }}>
      {/* Map Placeholder */}
      <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-gray-200 to-gray-300">
        <div className="text-center p-6">
          <MapPin className="w-16 h-16 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600 mb-2">Map View</p>
          <p className="text-sm text-gray-500">
            Center: {center.latitude.toFixed(4)}, {center.longitude.toFixed(4)}
          </p>
          <p className="text-xs text-gray-400 mt-2">
            Integrate with Google Maps, Mapbox, or Leaflet for interactive map
          </p>
        </div>
      </div>

      {/* Markers List Overlay (Simulated) */}
      {markers.length > 0 && (
        <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-3 max-w-xs max-h-64 overflow-y-auto">
          <h3 className="font-semibold text-sm mb-2 text-gray-900">
            Locations ({markers.length})
          </h3>
          <div className="space-y-2">
            {markers.map((marker) => {
              const distance = currentLocation
                ? calculateDistance(currentLocation, marker.position)
                : null;

              return (
                <button
                  key={marker.id}
                  onClick={() => handleMarkerClick(marker)}
                  className={`w-full text-left p-2 rounded hover:bg-gray-100 transition-colors ${
                    selectedMarker?.id === marker.id ? 'bg-red-50 border border-red-200' : ''
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <MapPin className={`w-4 h-4 mt-0.5 ${getMarkerColor(marker.type)}`} />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">
                        {marker.label}
                      </div>
                      {marker.type && (
                        <div className="text-xs text-gray-500 capitalize">
                          {getMarkerTypeLabel(marker.type)}
                        </div>
                      )}
                      {distance !== null && (
                        <div className="text-xs text-gray-500">
                          {formatDistance(distance)} away
                        </div>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Current Location Indicator */}
      {showCurrentLocation && currentLocation && (
        <div className="absolute bottom-20 left-4 bg-blue-600 text-white rounded-full p-2 shadow-lg">
          <Navigation className="w-4 h-4" />
        </div>
      )}

      {/* Map Controls */}
      {showControls && (
        <div className="absolute bottom-4 right-4 flex flex-col gap-2">
          {/* Zoom In */}
          <button
            onClick={handleZoomIn}
            className="bg-white p-2 rounded shadow-lg hover:bg-gray-100 transition-colors"
            title="Zoom In"
          >
            <ZoomIn className="w-5 h-5 text-gray-700" />
          </button>

          {/* Zoom Out */}
          <button
            onClick={handleZoomOut}
            className="bg-white p-2 rounded shadow-lg hover:bg-gray-100 transition-colors"
            title="Zoom Out"
          >
            <ZoomOut className="w-5 h-5 text-gray-700" />
          </button>

          {/* Fullscreen */}
          <button
            onClick={() => {
              // Implement fullscreen toggle
            }}
            className="bg-white p-2 rounded shadow-lg hover:bg-gray-100 transition-colors"
            title="Fullscreen"
          >
            <Maximize2 className="w-5 h-5 text-gray-700" />
          </button>
        </div>
      )}

      {/* Zoom Level Indicator */}
      {showControls && (
        <div className="absolute top-4 right-4 bg-white px-3 py-1 rounded shadow text-sm text-gray-700">
          Zoom: {zoom}
        </div>
      )}

      {/* Selected Marker Info */}
      {selectedMarker && (
        <div className="absolute bottom-4 left-4 right-4 bg-white rounded-lg shadow-lg p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <MapPin className={`w-5 h-5 ${getMarkerColor(selectedMarker.type)}`} />
              <div>
                <h4 className="font-semibold text-gray-900">{selectedMarker.label}</h4>
                {selectedMarker.type && (
                  <p className="text-sm text-gray-500 capitalize">{selectedMarker.type}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">
                  {selectedMarker.position.latitude.toFixed(6)},{' '}
                  {selectedMarker.position.longitude.toFixed(6)}
                </p>
                {currentLocation && (
                  <p className="text-sm text-gray-600 mt-1">
                    {formatDistance(calculateDistance(currentLocation, selectedMarker.position))}{' '}
                    away
                  </p>
                )}
              </div>
            </div>
            <button
              onClick={() => setSelectedMarker(null)}
              className="text-gray-400 hover:text-gray-600"
            >
              ✕
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default MapView;
