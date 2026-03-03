import { describe, expect, it } from 'vitest';
import {
  NPS_MIN_SAMPLE_SIZE,
  computeNpsScore,
  getNpsCycleKey,
  getNpsSampleConfidence,
  getNpsSegmentFromScore,
  isNpsSampleReliable,
  normalizeNpsRole,
} from '../nps';

describe('nps constants helpers', () => {
  it('computes NPS score correctly', () => {
    expect(computeNpsScore(60, 20, 100)).toBe(40);
    expect(computeNpsScore(0, 0, 0)).toBe(0);
  });

  it('maps score to segment', () => {
    expect(getNpsSegmentFromScore(10)).toBe('promoter');
    expect(getNpsSegmentFromScore(7)).toBe('passive');
    expect(getNpsSegmentFromScore(3)).toBe('detractor');
  });

  it('computes quarter cycle key', () => {
    expect(getNpsCycleKey(new Date('2026-01-10T00:00:00.000Z'))).toBe('2026-Q1');
    expect(getNpsCycleKey(new Date('2026-08-10T00:00:00.000Z'))).toBe('2026-Q3');
  });

  it('computes sample reliability and confidence bands', () => {
    expect(isNpsSampleReliable(NPS_MIN_SAMPLE_SIZE - 1)).toBe(false);
    expect(isNpsSampleReliable(NPS_MIN_SAMPLE_SIZE)).toBe(true);
    expect(getNpsSampleConfidence(10)).toBe('low');
    expect(getNpsSampleConfidence(40)).toBe('medium');
    expect(getNpsSampleConfidence(150)).toBe('high');
  });

  it('normalizes nps role values', () => {
    expect(normalizeNpsRole('donor')).toBe('donor');
    expect(normalizeNpsRole('ngo')).toBe('ngo');
    expect(normalizeNpsRole('bloodbank')).toBe('bloodbank');
    expect(normalizeNpsRole('hospital')).toBe('bloodbank');
    expect(normalizeNpsRole('admin')).toBeNull();
  });
});
