import type { Analytics } from 'firebase/analytics';
import app, { firebaseMeasurementId } from '../firebase';
import { FIREBASE_ANALYTICS_EVENTS } from '../constants/analytics';

type AnalyticsEventValue = string | number | boolean | null | undefined;
type AnalyticsEventParams = Record<string, AnalyticsEventValue>;
type AnalyticsUserProperties = Record<string, AnalyticsEventValue>;

const isAnalyticsEnabled = import.meta.env.VITE_ENABLE_ANALYTICS === 'true';

let analyticsInstance: Analytics | null = null;
let analyticsInitPromise: Promise<Analytics | null> | null = null;
let analyticsStatus:
  | 'idle'
  | 'disabled'
  | 'missing_measurement_id'
  | 'unsupported_environment'
  | 'unsupported_browser'
  | 'initialized'
  | 'init_failed' = 'idle';
let analyticsError: string | null = null;

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
  && Boolean(firebaseMeasurementId)
);

export const getFirebaseAnalyticsStatus = () => ({
  enabled: isAnalyticsEnabled,
  measurementIdConfigured: Boolean(firebaseMeasurementId),
  measurementId: firebaseMeasurementId || null,
  status: analyticsStatus,
  error: analyticsError,
});

export const initializeFirebaseAnalytics = async (): Promise<Analytics | null> => {
  if (typeof window === 'undefined') {
    analyticsStatus = 'unsupported_environment';
    return null;
  }
  if (!isAnalyticsEnabled) {
    analyticsStatus = 'disabled';
    return null;
  }
  if (!firebaseMeasurementId) {
    analyticsStatus = 'missing_measurement_id';
    return null;
  }
  if (analyticsInstance) return analyticsInstance;
  if (analyticsInitPromise) return analyticsInitPromise;

  analyticsInitPromise = import('firebase/analytics')
    .then(async ({ getAnalytics, isSupported }) => {
      const supported = await isSupported().catch(() => false);
      if (!supported) {
        analyticsStatus = 'unsupported_browser';
        return null;
      }
      analyticsInstance = getAnalytics(app);
      analyticsStatus = 'initialized';
      analyticsError = null;
      return analyticsInstance;
    })
    .catch((error) => {
      analyticsStatus = 'init_failed';
      analyticsError = error instanceof Error ? error.message : 'unknown_error';
      return null;
    })
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
    device_category: '',
    device_model_family: '',
    os_family: '',
    browser_family: '',
    memory_tier: '',
    network_effective_type: '',
    connection_type: '',
    save_data: '',
    touch_capable: '',
  });
};
