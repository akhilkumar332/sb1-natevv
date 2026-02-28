import { useCallback } from 'react';
import { getCurrentCoordinates, reverseGeocode, type CoordinatesTuple } from '../utils/geolocation.utils';

type ResolverScope = 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';

type ResolveCurrentLocationOptions = {
  positionErrorMessage?: string;
  positionErrorMessages?: {
    permissionDenied?: string;
    positionUnavailable?: string;
    timeout?: string;
    default?: string;
  };
  unsupportedErrorMessage?: string;
  enableHighAccuracy?: boolean;
  timeout?: number;
  maximumAge?: number;
  skipReverseGeocode?: boolean;
  onErrorMessage?: (message: string) => void;
};

type ResolveAddressOptions = {
  errorMessage?: string;
};

export const useLocationResolver = (scope: ResolverScope) => {
  const resolveFromCoordinates = useCallback(
    async (coords: CoordinatesTuple, options?: ResolveAddressOptions) => {
      if (!Number.isFinite(coords[0]) || !Number.isFinite(coords[1])) {
        return {
          coords,
          geocode: null,
        };
      }
      const geocode = await reverseGeocode(coords[0], coords[1], {
        scope,
        errorMessage: options?.errorMessage,
      });
      return {
        coords,
        geocode,
      };
    },
    [scope]
  );

  const resolveCurrentLocation = useCallback(
    async (options?: ResolveCurrentLocationOptions) => {
      const coords = await getCurrentCoordinates({
        scope,
        enableHighAccuracy: options?.enableHighAccuracy,
        timeout: options?.timeout,
        maximumAge: options?.maximumAge,
        positionErrorMessage: options?.positionErrorMessage,
        positionErrorMessages: options?.positionErrorMessages,
        unsupportedErrorMessage: options?.unsupportedErrorMessage,
        onErrorMessage: options?.onErrorMessage,
      });
      if (!coords) {
        return null;
      }
      const geocode = options?.skipReverseGeocode
        ? null
        : await reverseGeocode(coords[0], coords[1], { scope });
      return {
        coords,
        geocode,
      };
    },
    [scope]
  );

  return {
    resolveCurrentLocation,
    resolveFromCoordinates,
  };
};

export default useLocationResolver;
