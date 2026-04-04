type LocalizedValueMap = Record<string, string | null | undefined> | null | undefined;

const normalizeLanguage = (language?: string | null) => {
  const trimmed = String(language || '').trim().toLowerCase();
  if (!trimmed) return 'en';
  return trimmed.split('-')[0] || 'en';
};

export const pickLocalizedCmsString = (
  language: string | null | undefined,
  localized: LocalizedValueMap,
  fallback?: string | null,
): string | null => {
  const normalizedLanguage = normalizeLanguage(language);
  const direct = localized?.[normalizedLanguage];
  if (typeof direct === 'string' && direct.trim()) return direct;

  const english = localized?.en;
  if (typeof english === 'string' && english.trim()) return english;

  if (typeof fallback === 'string' && fallback.trim()) return fallback;
  return fallback ?? null;
};

export const normalizeLocalizedCmsMap = (value: unknown): Record<string, string> | undefined => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return undefined;
  const entries = Object.entries(value).filter(([, item]) => typeof item === 'string');
  if (entries.length === 0) return undefined;
  return Object.fromEntries(entries) as Record<string, string>;
};
