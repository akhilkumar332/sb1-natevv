import { describe, expect, it } from 'vitest';
import {
  isAbsoluteHttpUrl,
  isMediaUrlOrPath,
  parseJsonObject,
  validateScheduleWindow,
} from '../cmsValidation';

describe('cmsValidation', () => {
  it('validates absolute http urls', () => {
    expect(isAbsoluteHttpUrl('https://bloodhubindia.com')).toBe(true);
    expect(isAbsoluteHttpUrl('http://bloodhubindia.com')).toBe(true);
    expect(isAbsoluteHttpUrl('/relative/path')).toBe(false);
    expect(isAbsoluteHttpUrl('javascript:alert(1)')).toBe(false);
  });

  it('accepts media paths or absolute urls', () => {
    expect(isMediaUrlOrPath('')).toBe(true);
    expect(isMediaUrlOrPath('/images/cover.jpg')).toBe(true);
    expect(isMediaUrlOrPath('https://cdn.example.com/cover.jpg')).toBe(true);
    expect(isMediaUrlOrPath('ftp://cdn.example.com/cover.jpg')).toBe(false);
  });

  it('parses json object only', () => {
    expect(parseJsonObject('{"a":1}')).toEqual({ a: 1 });
    expect(parseJsonObject('[]')).toBeNull();
    expect(parseJsonObject('invalid')).toBeNull();
  });

  it('validates schedule windows', () => {
    const valid = validateScheduleWindow('2026-03-08T10:00', '2026-03-08T11:00');
    expect(valid.error).toBeNull();
    expect(valid.publishAt).not.toBeNull();
    expect(valid.unpublishAt).not.toBeNull();

    const invalidPublish = validateScheduleWindow('bad-date', '');
    expect(invalidPublish.error).toBe('Scheduled publish date/time is invalid.');

    const invalidRange = validateScheduleWindow('2026-03-08T11:00', '2026-03-08T10:00');
    expect(invalidRange.error).toBe('Scheduled unpublish must be after scheduled publish.');
  });
});
