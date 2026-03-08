const HTTP_URL_REGEX = /^https?:\/\/\S+$/i;
const RELATIVE_PATH_REGEX = /^\/\S+$/;
const TEXT_URL_REGEX = /https?:\/\/[^\s"'<>)]+|\/[a-z0-9/_\-.]+/gi;
const MAX_WALK_DEPTH = 8;

export const normalizeMediaUrlKey = (value: string | null | undefined): string => {
  const raw = (value || '').trim();
  if (!raw) return '';
  if (raw.startsWith('/')) {
    return raw.replace(/\/+$/, '') || '/';
  }
  return raw.replace(/\/+$/, '');
};

const isMediaLikeString = (value: string): boolean => (
  HTTP_URL_REGEX.test(value) || RELATIVE_PATH_REGEX.test(value)
);

const walkForUrls = (value: unknown, output: Set<string>, depth: number): void => {
  if (depth > MAX_WALK_DEPTH || value == null) return;

  if (typeof value === 'string') {
    if (isMediaLikeString(value)) {
      const normalized = normalizeMediaUrlKey(value);
      if (normalized) output.add(normalized);
    }
    return;
  }

  if (Array.isArray(value)) {
    value.forEach((entry) => walkForUrls(entry, output, depth + 1));
    return;
  }

  if (typeof value === 'object') {
    Object.values(value as Record<string, unknown>).forEach((entry) => walkForUrls(entry, output, depth + 1));
  }
};

const extractUrlsFromRawText = (raw: string, output: Set<string>): void => {
  const matches = raw.match(TEXT_URL_REGEX) || [];
  matches.forEach((match) => {
    const normalized = normalizeMediaUrlKey(match);
    if (normalized) output.add(normalized);
  });
};

export const extractMediaUrlReferences = (contentJson: string | null | undefined): Set<string> => {
  const output = new Set<string>();
  const raw = typeof contentJson === 'string' ? contentJson.trim() : '';
  if (!raw) return output;

  try {
    const parsed = JSON.parse(raw) as unknown;
    walkForUrls(parsed, output, 0);
    if (!output.size) {
      extractUrlsFromRawText(raw, output);
    }
    return output;
  } catch {
    extractUrlsFromRawText(raw, output);
    return output;
  }
};
