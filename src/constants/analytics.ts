import { ONE_DAY_MS } from './time';

export const ANALYTICS_LIMITS = {
  geoTopLocations: 10,
  maxCustomRangeYears: 3,
} as const;

export const ANALYTICS_RANGE_MS = {
  maxCustomRange: ANALYTICS_LIMITS.maxCustomRangeYears * 365 * ONE_DAY_MS,
} as const;

export const ANALYTICS_QUEUE_DELAYS_MS = {
  platformStats: 0,
  rangeStats: 120,
  growthTrend: 240,
  bloodType: 360,
  geo: 480,
} as const;

export const SYSTEM_HEALTH_THRESHOLDS = {
  inventoryAlertsDegraded: 20,
  emergencyRequestsDegraded: 50,
  pendingVerificationsDegraded: 100,
} as const;

export type AnalyticsRangeScope = 'selected_range' | 'all_time';
