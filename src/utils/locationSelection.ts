export type CoordinatePair = [number, number];

export const isValidCoordinatePair = (value: CoordinatePair): boolean =>
  Number.isFinite(value[0]) && Number.isFinite(value[1]);

export const parseSuggestionCoordinatePair = (suggestion: { lat?: unknown; lon?: unknown }): CoordinatePair | null => {
  const lat = parseFloat(String(suggestion?.lat ?? ''));
  const lon = parseFloat(String(suggestion?.lon ?? ''));
  if (Number.isNaN(lat) || Number.isNaN(lon)) {
    return null;
  }
  return [lat, lon];
};

