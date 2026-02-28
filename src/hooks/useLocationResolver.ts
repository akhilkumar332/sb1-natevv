import { useCallback } from 'react';
import { getCurrentCoordinates, reverseGeocode, type CoordinatesTuple } from '../utils/geolocation.utils';

type ResolverScope = 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';

type ResolveCurrentLocationOptions = {
  positionErrorMessage?: string;
  unsupportedErrorMessage?: string;
  onErrorMessage?: (message: string) => void;
};

type ResolveAddressOptions = {
  errorMessage?: string;
};

export const useLocationResolver = (scope: ResolverScope) => {
  const resolveFromCoordinates = useCallback(
    async (coords: CoordinatesTuple, options?: ResolveAddressOptions) => {
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
        positionErrorMessage: options?.positionErrorMessage,
        unsupportedErrorMessage: options?.unsupportedErrorMessage,
        onErrorMessage: options?.onErrorMessage,
      });
      if (!coords) {
        return null;
      }
      const geocode = await reverseGeocode(coords[0], coords[1], { scope });
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
