type LocaleRecord = Record<string, any>;

const isPlainObject = (value: unknown): value is LocaleRecord =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

export function mergeLocale(base: LocaleRecord, overrides: LocaleRecord): LocaleRecord {
  const output: LocaleRecord = { ...base };

  for (const [key, value] of Object.entries(overrides)) {
    const baseValue = output[key];
    if (isPlainObject(baseValue) && isPlainObject(value)) {
      output[key] = mergeLocale(baseValue, value);
      continue;
    }
    output[key] = value;
  }

  return output;
}
