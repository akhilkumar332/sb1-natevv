import { notify } from 'services/notify.service';

export type CoordinatesTuple = [number, number];

const DEFAULT_POSITION_ERROR = 'Unable to retrieve your location. Please enable location services.';
const DEFAULT_UNSUPPORTED_ERROR = 'Geolocation is not supported by your browser';
const DEFAULT_REVERSE_GEOCODE_ERROR = 'Could not fetch address details';

export const getCurrentCoordinates = async (options?: {
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
  scope?: 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';
  onErrorMessage?: (message: string) => void;
}): Promise<CoordinatesTuple | null> => {
  const scope = options?.scope || 'unknown';
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    const message = options?.unsupportedErrorMessage || DEFAULT_UNSUPPORTED_ERROR;
    options?.onErrorMessage?.(message);
    notify.error(
      message,
      { id: 'geolocation-unsupported' },
      { scope, source: 'frontend', metadata: { kind: 'geolocation.unsupported' } }
    );
    return null;
  }

  try {
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        resolve,
        reject,
        {
          enableHighAccuracy: options?.enableHighAccuracy ?? true,
          timeout: options?.timeout ?? 10000,
          maximumAge: options?.maximumAge ?? 0,
        }
      );
    });
    return [position.coords.latitude, position.coords.longitude];
  } catch (error) {
    const geolocationCode = typeof (error as { code?: unknown })?.code === 'number'
      ? Number((error as { code?: number }).code)
      : null;
    const mappedPositionMessage =
      geolocationCode === 1
        ? options?.positionErrorMessages?.permissionDenied
        : geolocationCode === 2
          ? options?.positionErrorMessages?.positionUnavailable
          : geolocationCode === 3
            ? options?.positionErrorMessages?.timeout
            : options?.positionErrorMessages?.default;
    const message = mappedPositionMessage || options?.positionErrorMessage || DEFAULT_POSITION_ERROR;
    options?.onErrorMessage?.(message);
    notify.fromError(
      error,
      message,
      { id: 'geolocation-position-error' },
      { scope, source: 'frontend', metadata: { kind: 'geolocation.position' } }
    );
    return null;
  }
};

export const reverseGeocode = async (
  latitude: number,
  longitude: number,
  options?: {
    errorMessage?: string;
    scope?: 'auth' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'unknown';
  }
): Promise<{ display_name?: string; address?: Record<string, any> } | null> => {
  const scope = options?.scope || 'unknown';
  try {
    const response = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`
    );
    if (!response.ok) {
      throw new Error(`Reverse geocode failed: ${response.status}`);
    }
    const data = await response.json();
    if (!data || typeof data !== 'object') return null;
    return data as { display_name?: string; address?: Record<string, any> };
  } catch (error) {
    notify.fromError(
      error,
      options?.errorMessage || DEFAULT_REVERSE_GEOCODE_ERROR,
      { id: 'geolocation-reverse-error' },
      {
        scope,
        source: 'frontend',
        metadata: {
          kind: 'geolocation.reverse',
          latitude,
          longitude,
        },
      }
    );
    return null;
  }
};
