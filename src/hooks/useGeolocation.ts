/**
 * Geolocation Hooks
 *
 * React hooks for geolocation functionality
 */

import { useState, useEffect, useCallback } from 'react';
import { Coordinates } from '../types/database.types';
import { getCurrentLocation, watchLocation } from '../utils/geolocation';

// ============================================================================
// CURRENT LOCATION HOOK
// ============================================================================

interface UseCurrentLocationOptions {
  watch?: boolean;
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
}

interface UseCurrentLocationResult {
  location: Coordinates | null;
  loading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
}

/**
 * Hook to get user's current location
 */
export const useCurrentLocation = (
  options: UseCurrentLocationOptions = {}
): UseCurrentLocationResult => {
  const {
    watch = false,
  } = options;

  const [location, setLocation] = useState<Coordinates | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  // Fetch current location
  const fetchLocation = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const coords = await getCurrentLocation();
      setLocation(coords);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to get location'));
    } finally {
      setLoading(false);
    }
  }, []);

  // Watch location changes
  useEffect(() => {
    if (!watch) {
      return;
    }

    const stopWatching = watchLocation(
      (coords) => {
        setLocation(coords);
        setError(null);
      },
      (err) => {
        setError(err);
      }
    );

    return () => {
      stopWatching();
    };
  }, [watch]);

  // Initial fetch if not watching
  useEffect(() => {
    if (!watch) {
      fetchLocation();
    }
  }, [watch, fetchLocation]);

  return {
    location,
    loading,
    error,
    refetch: fetchLocation,
  };
};

// ============================================================================
// NEARBY SEARCH HOOK
// ============================================================================

interface UseNearbySearchOptions<T> {
  searchFn: (location: Coordinates, radiusKm: number) => Promise<T[]>;
  location: Coordinates | null;
  radiusKm: number;
  autoSearch?: boolean;
}

interface UseNearbySearchResult<T> {
  results: T[];
  loading: boolean;
  error: Error | null;
  search: () => Promise<void>;
  setRadius: (radius: number) => void;
}

/**
 * Hook for nearby search with location and radius
 */
export const useNearbySearch = <T>(
  options: UseNearbySearchOptions<T>
): UseNearbySearchResult<T> => {
  const { searchFn, location, radiusKm: initialRadius, autoSearch = true } = options;

  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [radiusKm, setRadiusKm] = useState(initialRadius);

  // Perform search
  const search = useCallback(async () => {
    if (!location) {
      setError(new Error('Location is required'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const searchResults = await searchFn(location, radiusKm);
      setResults(searchResults);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Search failed'));
      setResults([]);
    } finally {
      setLoading(false);
    }
  }, [location, radiusKm, searchFn]);

  // Auto-search when location or radius changes
  useEffect(() => {
    if (autoSearch && location) {
      search();
    }
  }, [autoSearch, location, radiusKm, search]);

  return {
    results,
    loading,
    error,
    search,
    setRadius: setRadiusKm,
  };
};

// ============================================================================
// LOCATION PERMISSION HOOK
// ============================================================================

interface UseLocationPermissionResult {
  permission: 'granted' | 'denied' | 'prompt' | 'unknown';
  loading: boolean;
  requestPermission: () => Promise<void>;
}

/**
 * Hook to check and request location permission
 */
export const useLocationPermission = (): UseLocationPermissionResult => {
  const [permission, setPermission] = useState<'granted' | 'denied' | 'prompt' | 'unknown'>(
    'unknown'
  );
  const [loading, setLoading] = useState(false);

  // Check permission status
  useEffect(() => {
    if (!navigator.permissions) {
      setPermission('unknown');
      return;
    }

    navigator.permissions.query({ name: 'geolocation' }).then((result) => {
      setPermission(result.state as 'granted' | 'denied' | 'prompt');

      // Listen for permission changes
      result.addEventListener('change', () => {
        setPermission(result.state as 'granted' | 'denied' | 'prompt');
      });
    });
  }, []);

  // Request permission by attempting to get location
  const requestPermission = useCallback(async () => {
    setLoading(true);

    try {
      await getCurrentLocation();
      setPermission('granted');
    } catch (err) {
      setPermission('denied');
    } finally {
      setLoading(false);
    }
  }, []);

  return {
    permission,
    loading,
    requestPermission,
  };
};

// ============================================================================
// DISTANCE TRACKING HOOK
// ============================================================================

interface UseDistanceTrackingOptions {
  targetLocation: Coordinates;
  threshold?: number; // Alert when within this distance (km)
}

interface UseDistanceTrackingResult {
  currentLocation: Coordinates | null;
  distance: number | null;
  isWithinThreshold: boolean;
  loading: boolean;
  error: Error | null;
}

/**
 * Hook to track distance from a target location
 */
export const useDistanceTracking = (
  options: UseDistanceTrackingOptions
): UseDistanceTrackingResult => {
  const { targetLocation, threshold } = options;

  const { location, loading, error } = useCurrentLocation({ watch: true });
  const [distance, setDistance] = useState<number | null>(null);

  useEffect(() => {
    if (!location) {
      setDistance(null);
      return;
    }

    // Calculate distance using Haversine formula
    const calculateDistance = (coord1: Coordinates, coord2: Coordinates): number => {
      const R = 6371; // Earth's radius in km
      const dLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
      const dLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((coord1.latitude * Math.PI) / 180) *
          Math.cos((coord2.latitude * Math.PI) / 180) *
          Math.sin(dLon / 2) *
          Math.sin(dLon / 2);
      const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
      return R * c;
    };

    const dist = calculateDistance(location, targetLocation);
    setDistance(dist);
  }, [location, targetLocation]);

  return {
    currentLocation: location,
    distance,
    isWithinThreshold: distance !== null && threshold !== undefined && distance <= threshold,
    loading,
    error,
  };
};
