const isPlainObject = (value: unknown): value is Record<string, unknown> => (
  Boolean(value) && typeof value === 'object' && !Array.isArray(value)
);

const deepMerge = <T>(base: T, override: unknown): T => {
  if (Array.isArray(base)) {
    return (Array.isArray(override) ? override : base) as T;
  }
  if (!isPlainObject(base)) {
    return (override ?? base) as T;
  }
  if (!isPlainObject(override)) {
    return base;
  }
  const merged: Record<string, unknown> = { ...base };
  Object.keys(base).forEach((key) => {
    merged[key] = deepMerge((base as Record<string, unknown>)[key], override[key]);
  });
  Object.keys(override).forEach((key) => {
    if (!(key in merged)) {
      merged[key] = override[key];
    }
  });
  return merged as T;
};

export const resolveCmsFrontendContent = <T extends Record<string, unknown>>(
  contentJson: string | null | undefined,
  fallback: T
): T => {
  if (!contentJson) return fallback;
  try {
    const parsed = JSON.parse(contentJson);
    return deepMerge(fallback, parsed);
  } catch {
    return fallback;
  }
};
