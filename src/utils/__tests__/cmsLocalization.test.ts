import { describe, expect, it } from 'vitest';
import { normalizeLocalizedCmsMap, pickLocalizedCmsString } from '../cmsLocalization';

describe('cmsLocalization', () => {
  it('returns the requested locale when present', () => {
    expect(pickLocalizedCmsString('hi', { hi: 'नमस्ते', en: 'Hello' }, 'Fallback')).toBe('नमस्ते');
  });

  it('falls back to english when the requested locale is missing', () => {
    expect(pickLocalizedCmsString('te', { en: 'Hello' }, 'Fallback')).toBe('Hello');
  });

  it('falls back to the base field when no localized value exists', () => {
    expect(pickLocalizedCmsString('kn', undefined, 'Fallback')).toBe('Fallback');
  });

  it('normalizes localized maps from unknown values', () => {
    expect(normalizeLocalizedCmsMap({ en: 'Hello', hi: 'नमस्ते', count: 2 })).toEqual({
      en: 'Hello',
      hi: 'नमस्ते',
    });
    expect(normalizeLocalizedCmsMap(null)).toBeUndefined();
  });
});
