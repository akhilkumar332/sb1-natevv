/**
 * Geolocation Utilities
 *
 * Utilities for geolocation, distance calculation, and location-based operations
 */

import { Coordinates } from '../types/database.types';

// ============================================================================
// CONSTANTS
// ============================================================================

// Earth's radius in kilometers
const EARTH_RADIUS_KM = 6371;

// Default coordinates for major Indian cities
export const CITY_COORDINATES: Record<string, Coordinates> = {
  Mumbai: { latitude: 19.076, longitude: 72.8777 },
  Delhi: { latitude: 28.7041, longitude: 77.1025 },
  Bangalore: { latitude: 12.9716, longitude: 77.5946 },
  Hyderabad: { latitude: 17.385, longitude: 78.4867 },
  Chennai: { latitude: 13.0827, longitude: 80.2707 },
  Kolkata: { latitude: 22.5726, longitude: 88.3639 },
  Pune: { latitude: 18.5204, longitude: 73.8567 },
  Ahmedabad: { latitude: 23.0225, longitude: 72.5714 },
  Jaipur: { latitude: 26.9124, longitude: 75.7873 },
  Lucknow: { latitude: 26.8467, longitude: 80.9462 },
  Chandigarh: { latitude: 30.7333, longitude: 76.7794 },
  Kochi: { latitude: 9.9312, longitude: 76.2673 },
  Indore: { latitude: 22.7196, longitude: 75.8577 },
  Coimbatore: { latitude: 11.0168, longitude: 76.9558 },
  Surat: { latitude: 21.1702, longitude: 72.8311 },
};

// ============================================================================
// DISTANCE CALCULATION
// ============================================================================

/**
 * Calculate distance between two coordinates using Haversine formula
 * @param coord1 - First coordinate
 * @param coord2 - Second coordinate
 * @returns Distance in kilometers
 */
export const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
  const lat1Rad = toRadians(coord1.latitude);
  const lat2Rad = toRadians(coord2.latitude);
  const deltaLat = toRadians(coord2.latitude - coord1.latitude);
  const deltaLon = toRadians(coord2.longitude - coord1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1Rad) *
      Math.cos(lat2Rad) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = EARTH_RADIUS_KM * c;

  return Math.round(distance * 100) / 100; // Round to 2 decimal places
};

/**
 * Convert degrees to radians
 */
const toRadians = (degrees: number): number => {
  return degrees * (Math.PI / 180);
};

/**
 * Convert radians to degrees
 */
const toDegrees = (radians: number): number => {
  return radians * (180 / Math.PI);
};

/**
 * Format distance for display
 * @param distanceKm - Distance in kilometers
 * @returns Formatted distance string
 */
export const formatDistance = (distanceKm: number): string => {
  if (distanceKm < 1) {
    return `${Math.round(distanceKm * 1000)} m`;
  } else if (distanceKm < 10) {
    return `${distanceKm.toFixed(1)} km`;
  } else {
    return `${Math.round(distanceKm)} km`;
  }
};

// ============================================================================
// GEOBOUNDING BOX
// ============================================================================

/**
 * Calculate bounding box for a given point and radius
 * @param center - Center coordinates
 * @param radiusKm - Radius in kilometers
 * @returns Bounding box coordinates
 */
export const calculateBoundingBox = (
  center: Coordinates,
  radiusKm: number
): {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
} => {
  const latDelta = radiusKm / EARTH_RADIUS_KM;
  const lonDelta = radiusKm / (EARTH_RADIUS_KM * Math.cos(toRadians(center.latitude)));

  return {
    minLat: center.latitude - toDegrees(latDelta),
    maxLat: center.latitude + toDegrees(latDelta),
    minLon: center.longitude - toDegrees(lonDelta),
    maxLon: center.longitude + toDegrees(lonDelta),
  };
};

/**
 * Check if a coordinate is within a bounding box
 */
export const isWithinBoundingBox = (
  coord: Coordinates,
  boundingBox: {
    minLat: number;
    maxLat: number;
    minLon: number;
    maxLon: number;
  }
): boolean => {
  return (
    coord.latitude >= boundingBox.minLat &&
    coord.latitude <= boundingBox.maxLat &&
    coord.longitude >= boundingBox.minLon &&
    coord.longitude <= boundingBox.maxLon
  );
};

// ============================================================================
// BROWSER GEOLOCATION
// ============================================================================

/**
 * Get user's current location from browser
 * @returns Promise with user's coordinates
 */
export const getCurrentLocation = (): Promise<Coordinates> => {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new Error('Geolocation is not supported by your browser'));
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        });
      },
      (error) => {
        reject(new Error(`Failed to get location: ${error.message}`));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  });
};

/**
 * Watch user's location for changes
 * @param callback - Called when location changes
 * @returns Function to stop watching
 */
export const watchLocation = (
  callback: (coords: Coordinates) => void,
  errorCallback?: (error: Error) => void
): (() => void) => {
  if (!navigator.geolocation) {
    if (errorCallback) {
      errorCallback(new Error('Geolocation is not supported'));
    }
    return () => {};
  }

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      callback({
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      });
    },
    (error) => {
      if (errorCallback) {
        errorCallback(new Error(`Location error: ${error.message}`));
      }
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 30000,
    }
  );

  return () => navigator.geolocation.clearWatch(watchId);
};

// ============================================================================
// LOCATION UTILITIES
// ============================================================================

/**
 * Get coordinates for a city name
 */
export const getCityCoordinates = (cityName: string): Coordinates | null => {
  return CITY_COORDINATES[cityName] || null;
};

/**
 * Find nearest city to given coordinates
 */
export const findNearestCity = (coords: Coordinates): string | null => {
  let nearestCity: string | null = null;
  let minDistance = Infinity;

  Object.entries(CITY_COORDINATES).forEach(([city, cityCoords]) => {
    const distance = calculateDistance(coords, cityCoords);
    if (distance < minDistance) {
      minDistance = distance;
      nearestCity = city;
    }
  });

  return nearestCity;
};

/**
 * Sort items by distance from a location
 */
export const sortByDistance = <T extends { location?: Coordinates }>(
  items: T[],
  fromLocation: Coordinates
): (T & { distance?: number })[] => {
  return items
    .map((item) => {
      if (!item.location) {
        return { ...item, distance: undefined };
      }

      const distance = calculateDistance(fromLocation, item.location);
      return { ...item, distance };
    })
    .sort((a, b) => {
      if (a.distance === undefined) return 1;
      if (b.distance === undefined) return -1;
      return a.distance - b.distance;
    });
};

/**
 * Filter items within a radius
 */
export const filterByRadius = <T extends { location?: Coordinates }>(
  items: T[],
  center: Coordinates,
  radiusKm: number
): (T & { distance: number })[] => {
  return items
    .filter((item) => item.location !== undefined)
    .map((item) => ({
      ...item,
      distance: calculateDistance(center, item.location!),
    }))
    .filter((item) => item.distance <= radiusKm)
    .sort((a, b) => a.distance - b.distance);
};

// ============================================================================
// GEOCODING (PLACEHOLDER)
// ============================================================================

/**
 * Convert address to coordinates
 * Note: This is a placeholder. For production, integrate with:
 * - Google Maps Geocoding API
 * - Mapbox Geocoding API
 * - OpenStreetMap Nominatim
 */
export const geocodeAddress = async (address: string): Promise<Coordinates | null> => {
  // Check if it's a known city
  const cityCoords = getCityCoordinates(address);
  if (cityCoords) {
    return cityCoords;
  }

  // For production, implement actual geocoding API call.
  // Keep this as a dev diagnostic only to avoid noisy runtime logs.
  if (import.meta.env.DEV) {
    console.warn('Geocoding not implemented. Using city coordinates if available.');
  }
  return null;
};

/**
 * Convert coordinates to address (reverse geocoding)
 * Note: This is a placeholder. For production, integrate with geocoding API
 */
export const reverseGeocode = async (
  coords: Coordinates
): Promise<{ city?: string; state?: string; address?: string } | null> => {
  // Find nearest city as fallback
  const nearestCity = findNearestCity(coords);

  if (nearestCity) {
    return {
      city: nearestCity,
      address: `Near ${nearestCity}`,
    };
  }

  // For production, implement actual reverse geocoding API call.
  // Keep this as a dev diagnostic only to avoid noisy runtime logs.
  if (import.meta.env.DEV) {
    console.warn('Reverse geocoding not implemented. Using nearest city.');
  }
  return null;
};

// ============================================================================
// VALIDATION
// ============================================================================

/**
 * Validate coordinates
 */
export const isValidCoordinates = (coords: Coordinates): boolean => {
  return (
    coords.latitude >= -90 &&
    coords.latitude <= 90 &&
    coords.longitude >= -180 &&
    coords.longitude <= 180
  );
};

/**
 * Validate Indian coordinates (approximate bounds)
 */
export const isWithinIndia = (coords: Coordinates): boolean => {
  return (
    coords.latitude >= 8 &&
    coords.latitude <= 37 &&
    coords.longitude >= 68 &&
    coords.longitude <= 97
  );
};

// ============================================================================
// MAP UTILITIES
// ============================================================================

/**
 * Calculate center point from multiple coordinates
 */
export const calculateCenter = (coordinates: Coordinates[]): Coordinates | null => {
  if (coordinates.length === 0) return null;

  const sum = coordinates.reduce(
    (acc, coord) => ({
      latitude: acc.latitude + coord.latitude,
      longitude: acc.longitude + coord.longitude,
    }),
    { latitude: 0, longitude: 0 }
  );

  return {
    latitude: sum.latitude / coordinates.length,
    longitude: sum.longitude / coordinates.length,
  };
};

/**
 * Calculate zoom level to fit all coordinates
 */
export const calculateZoomLevel = (
  coordinates: Coordinates[]
): number => {
  if (coordinates.length === 0) return 10;
  if (coordinates.length === 1) return 13;

  const latitudes = coordinates.map((c) => c.latitude);
  const longitudes = coordinates.map((c) => c.longitude);

  const maxLat = Math.max(...latitudes);
  const minLat = Math.min(...latitudes);
  const maxLon = Math.max(...longitudes);
  const minLon = Math.min(...longitudes);

  const latDiff = maxLat - minLat;
  const lonDiff = maxLon - minLon;

  // Simple zoom calculation (adjust as needed for specific map library)
  const latZoom = Math.log2(360 / latDiff);
  const lonZoom = Math.log2(360 / lonDiff);

  return Math.min(Math.floor(Math.min(latZoom, lonZoom)), 18);
};

/**
 * Get map bounds from coordinates
 */
export const getMapBounds = (
  coordinates: Coordinates[]
): {
  north: number;
  south: number;
  east: number;
  west: number;
} | null => {
  if (coordinates.length === 0) return null;

  const latitudes = coordinates.map((c) => c.latitude);
  const longitudes = coordinates.map((c) => c.longitude);

  return {
    north: Math.max(...latitudes),
    south: Math.min(...latitudes),
    east: Math.max(...longitudes),
    west: Math.min(...longitudes),
  };
};
