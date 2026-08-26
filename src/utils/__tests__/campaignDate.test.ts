import { describe, expect, it } from 'vitest';
import { parseLocalDate, toInputDate } from '../campaignDate';

/**
 * Regression cover for the campaign date shift.
 *
 * `parseLocalDate` builds a Date at LOCAL midnight. `toInputDate` used to format
 * via `toISOString()`, which converts to UTC first -- so in any UTC+ timezone
 * (IST, where most of this product's users are) local midnight is the previous
 * day in UTC, and re-opening the edit modal moved every campaign one day
 * earlier. Saving repeatedly walked the dates backwards.
 */
describe('campaignDate round-tripping', () => {
  it('round-trips a date string through parse and format', () => {
    const input = '2026-03-15';
    expect(toInputDate(parseLocalDate(input) as Date)).toBe(input);
  });

  it('round-trips across a month boundary', () => {
    const input = '2026-03-01';
    expect(toInputDate(parseLocalDate(input) as Date)).toBe(input);
  });

  it('round-trips across a year boundary', () => {
    const input = '2026-01-01';
    expect(toInputDate(parseLocalDate(input) as Date)).toBe(input);
  });

  it('round-trips a leap day', () => {
    const input = '2028-02-29';
    expect(toInputDate(parseLocalDate(input) as Date)).toBe(input);
  });

  it('does not drift when the round trip is repeated', () => {
    // Simulates opening and saving the edit modal several times.
    let value = '2026-06-10';
    for (let i = 0; i < 5; i += 1) {
      value = toInputDate(parseLocalDate(value) as Date);
    }
    expect(value).toBe('2026-06-10');
  });

  it('formats from local calendar parts, not the UTC instant', () => {
    // A local midnight Date must format as its own local calendar day
    // regardless of which side of UTC the runtime sits on.
    const localMidnight = new Date(2026, 4, 20, 0, 0, 0, 0);
    expect(toInputDate(localMidnight)).toBe('2026-05-20');
  });

  it('returns null for unparseable input', () => {
    expect(parseLocalDate('')).toBeNull();
    expect(parseLocalDate('not-a-date')).toBeNull();
  });
});
