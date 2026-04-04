import { describe, expect, it } from 'vitest';

import en from '../en';
import hi from '../hi';
import te from '../te';
import ta from '../ta';
import kn from '../kn';
import ml from '../ml';

interface LocaleTree {
  [key: string]: string | LocaleTree;
}

const flattenLocale = (locale: LocaleTree, prefix = ''): Record<string, string> => {
  const result: Record<string, string> = {};

  for (const [key, value] of Object.entries(locale)) {
    const nextKey = prefix ? `${prefix}.${key}` : key;
    if (typeof value === 'string') {
      result[nextKey] = value;
      continue;
    }

    Object.assign(result, flattenLocale(value, nextKey));
  }

  return result;
};

describe('locale parity', () => {
  const englishKeys = Object.keys(flattenLocale(en)).sort();

  it.each([
    ['hi', hi],
    ['te', te],
    ['ta', ta],
    ['kn', kn],
    ['ml', ml],
  ])('%s matches the english locale key set', (_language, locale) => {
    expect(Object.keys(flattenLocale(locale)).sort()).toEqual(englishKeys);
  });
});
