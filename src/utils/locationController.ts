import { mapNominatimAddress } from './addressMapping';
import { parseSuggestionCoordinatePair, type CoordinatePair } from './locationSelection';

type StateOption = { name: string };
type AddressLike = {
  state?: string;
  city?: string;
  town?: string;
  village?: string;
  postcode?: string;
};

type CurrentLocationFields = {
  address?: string;
  city?: string;
  state?: string;
  postalCode?: string;
};

const resolveFallbackCity = (address: AddressLike | undefined, fallback?: string) =>
  address?.city || address?.town || address?.village || fallback || '';

const resolveFallbackState = (address: AddressLike | undefined, fallback?: string) =>
  address?.state || fallback || '';

type BuildSuggestionOptions = {
  suggestion: { lat?: unknown; lon?: unknown; display_name?: string; address?: AddressLike };
  availableStates: StateOption[];
  countryCode: string;
  current?: CurrentLocationFields;
  coordinateMode?: 'number' | 'string6';
  includePostalCode?: boolean;
};

type BuildGeocodeOptions = {
  geocode: { display_name?: string; address?: AddressLike } | null | undefined;
  availableStates: StateOption[];
  countryCode: string;
  current?: CurrentLocationFields;
  includePostalCode?: boolean;
};

type SuggestionResult = {
  coords: CoordinatePair;
  patch: Record<string, string | number>;
};

export const buildSuggestionLocationUpdate = ({
  suggestion,
  availableStates,
  countryCode,
  current,
  coordinateMode = 'number',
  includePostalCode = true,
}: BuildSuggestionOptions): SuggestionResult | null => {
  const coords = parseSuggestionCoordinatePair(suggestion);
  if (!coords) return null;

  const mapped = mapNominatimAddress({
    address: suggestion.address,
    availableStates,
    countryCode,
  });

  const patch: Record<string, string | number> = {
    address: suggestion.display_name || current?.address || '',
    city: mapped.city || resolveFallbackCity(suggestion.address, current?.city),
    state: mapped.state || resolveFallbackState(suggestion.address, current?.state),
    latitude: coordinateMode === 'string6' ? coords[0].toFixed(6) : coords[0],
    longitude: coordinateMode === 'string6' ? coords[1].toFixed(6) : coords[1],
  };

  if (includePostalCode) {
    patch.postalCode = mapped.postalCode || current?.postalCode || '';
  }

  return { coords, patch };
};

export const buildGeocodeLocationPatch = ({
  geocode,
  availableStates,
  countryCode,
  current,
  includePostalCode = true,
}: BuildGeocodeOptions): Record<string, string> | null => {
  if (!geocode?.address) return null;

  const mapped = mapNominatimAddress({
    address: geocode.address,
    availableStates,
    countryCode,
  });

  const patch: Record<string, string> = {
    address: geocode.display_name || current?.address || '',
    city: mapped.city || resolveFallbackCity(geocode.address, current?.city),
    state: mapped.state || resolveFallbackState(geocode.address, current?.state),
  };

  if (includePostalCode) {
    patch.postalCode = mapped.postalCode || current?.postalCode || '';
  }

  return patch;
};

