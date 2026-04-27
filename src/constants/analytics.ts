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

export const FIREBASE_ANALYTICS_EVENTS = {
  pageView: 'page_view',
  login: 'login',
  signUp: 'sign_up',
  onboardingCompleted: 'onboarding_completed',
  webVitals: 'web_vitals',
  donorRequestBatchSubmitted: 'donor_request_batch_submitted',
  campaignParticipation: 'campaign_participation_confirmed',
} as const;

export const ANALYTICS_SURFACES = {
  public: 'public',
  donor: 'donor',
  ngo: 'ngo',
  bloodbank: 'bloodbank',
  admin: 'admin',
  auth: 'auth',
  unknown: 'unknown',
} as const;

export const ANALYTICS_METHODS = {
  email: 'email',
  google: 'google',
  phone: 'phone',
  biometric: 'biometric',
  profileUpdate: 'profile_update',
} as const;

export type AnalyticsRangeScope = 'selected_range' | 'all_time';
export type AnalyticsSurface = typeof ANALYTICS_SURFACES[keyof typeof ANALYTICS_SURFACES];
