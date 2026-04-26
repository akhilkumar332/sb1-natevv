import type { Analytics } from 'firebase/analytics';
import app, { firebaseMeasurementId } from '../firebase';
import { FIREBASE_ANALYTICS_EVENTS } from '../constants/analytics';

type AnalyticsEventValue = string | number | boolean | null | undefined;
type AnalyticsEventParams = Record<string, AnalyticsEventValue>;
type AnalyticsUserProperties = Record<string, AnalyticsEventValue>;

const isAnalyticsEnabled = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';
const hasMeasurementId = Boolean(firebaseMeasurementId);

let analyticsInstance: Analytics | null = null;
let analyticsInitPromise: Promise<Analytics | null> | null = null;

const toAnalyticsValue = (value: AnalyticsEventValue): string | number | undefined => {
  if (value === null || value === undefined) return undefined;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  const normalized = String(value).trim();
  return normalized.length > 0 ? normalized.slice(0, 100) : undefined;
};

const sanitizeParams = (params?: AnalyticsEventParams): Record<string, string | number> => {
  if (!params) return {};
  return Object.entries(params).reduce<Record<string, string | number>>((acc, [key, value]) => {
    const normalized = toAnalyticsValue(value);
    if (normalized === undefined) return acc;
    acc[key] = normalized;
    return acc;
  }, {});
};

const sanitizeUserProperties = (properties?: AnalyticsUserProperties): Record<string, string> => {
  if (!properties) return {};
  return Object.entries(properties).reduce<Record<string, string>>((acc, [key, value]) => {
    const normalized = toAnalyticsValue(value);
    if (normalized === undefined) return acc;
    acc[key] = String(normalized).slice(0, 36);
    return acc;
  }, {});
};

export const canInitializeFirebaseAnalytics = (): boolean => (
  typeof window !== 'undefined'
  && isAnalyticsEnabled
  && hasMeasurementId
);

export const initializeFirebaseAnalytics = async (): Promise<Analytics | null> => {
  if (!canInitializeFirebaseAnalytics()) return null;
  if (analyticsInstance) return analyticsInstance;
  if (analyticsInitPromise) return analyticsInitPromise;

  analyticsInitPromise = import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      const supported = await isSupported().catch(() => false);
      if (!supported) return null;
      analyticsInstance = getAnalytics(app);
      return analyticsInstance;
    })
    .catch(() => null)
    .finally(() => {
      analyticsInitPromise = null;
    });

  return analyticsInitPromise;
};

export const trackFirebaseAnalyticsEvent = async (
  eventName: string,
  params?: AnalyticsEventParams,
): Promise<void> => {
  const analytics = await initializeFirebaseAnalytics();
  if (!analytics) return;

  const { logEvent } = await import('firebase/analytics');
  logEvent(analytics, eventName, sanitizeParams(params));
};

export const trackFirebaseAnalyticsPageView = async (
  pagePath: string,
  params?: AnalyticsEventParams,
): Promise<void> => {
  const analytics = await initializeFirebaseAnalytics();
  if (!analytics) return;

  const { logEvent } = await import('firebase/analytics');
  logEvent(analytics, FIREBASE_ANALYTICS_EVENTS.pageView, sanitizeParams({
    page_path: pagePath,
    page_title: typeof document !== 'undefined' ? document.title : undefined,
    ...params,
  }));
};

export const setFirebaseAnalyticsUser = async (
  userId: string,
  properties?: AnalyticsUserProperties,
): Promise<void> => {
  const analytics = await initializeFirebaseAnalytics();
  if (!analytics) return;

  const { setUserId, setUserProperties } = await import('firebase/analytics');
  setUserId(analytics, userId);
  const sanitizedProperties = sanitizeUserProperties(properties);
  if (Object.keys(sanitizedProperties).length > 0) {
    setUserProperties(analytics, sanitizedProperties);
  }
};

export const clearFirebaseAnalyticsUser = async (): Promise<void> => {
  const analytics = await initializeFirebaseAnalytics();
  if (!analytics) return;

  const { setUserId, setUserProperties } = await import('firebase/analytics');
  setUserId(analytics, null);
  setUserProperties(analytics, {
    user_role: '',
    portal_surface: '',
    onboarding_completed: '',
    verified: '',
    preferred_language: '',
    impersonating: '',
  });
};
