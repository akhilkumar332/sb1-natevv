import { useEffect, useMemo, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { monitoringService } from '../services/monitoring.service';
import { ANALYTICS_SURFACES, FIREBASE_ANALYTICS_EVENTS, type AnalyticsSurface } from '../constants/analytics';
import { ROUTES } from '../constants/routes';
import { getDeviceInfo } from '../utils/device';
import { getAnalyticsRuntimeContext } from '../utils/analyticsRuntimeContext';
import { captureHandledError } from '../services/errorLog.service';

type VersionMetadata = {
  appVersion?: string;
  buildTime?: string;
  gitCommit?: string;
  deployId?: string;
  environment?: string;
};

const VERSION_URL = '/version.json';
const RELEASE_SEEN_STORAGE_PREFIX = 'bh_analytics_release_seen';

const getAnalyticsSurface = (pathname: string): AnalyticsSurface => {
  if (pathname.startsWith(ROUTES.portal.admin.dashboard.root) || pathname === ROUTES.portal.admin.login) {
    return ANALYTICS_SURFACES.admin;
  }
  if (pathname.startsWith(ROUTES.portal.ngo.dashboard.root) || pathname === ROUTES.portal.ngo.login || pathname === ROUTES.portal.ngo.register) {
    return ANALYTICS_SURFACES.ngo;
  }
  if (pathname.startsWith(ROUTES.portal.bloodbank.dashboard.root) || pathname === ROUTES.portal.bloodbank.login || pathname === ROUTES.portal.bloodbank.register) {
    return ANALYTICS_SURFACES.bloodbank;
  }
  if (pathname.startsWith(ROUTES.portal.hospital.dashboard) || pathname === ROUTES.portal.hospital.login || pathname === ROUTES.portal.hospital.register) {
    return ANALYTICS_SURFACES.bloodbank;
  }
  if (pathname.startsWith(ROUTES.portal.donor.dashboard.root) || pathname === ROUTES.portal.donor.login || pathname === ROUTES.portal.donor.register) {
    return ANALYTICS_SURFACES.donor;
  }
  if (pathname.startsWith('/admin') || pathname.startsWith('/donor') || pathname.startsWith('/ngo') || pathname.startsWith('/bloodbank') || pathname.startsWith('/hospital')) {
    return ANALYTICS_SURFACES.auth;
  }
  return ANALYTICS_SURFACES.public;
};

export const useAnalyticsTracking = (): void => {
  const location = useLocation();
  const { i18n } = useTranslation();
  const { user, isImpersonating } = useAuth();
  const releaseSeenRef = useRef<string | null>(null);
  const runtimeContext = useMemo(
    () => getAnalyticsRuntimeContext(getDeviceInfo()),
    [],
  );

  useEffect(() => {
    const pagePath = `${location.pathname}${location.search}${location.hash}`;
    monitoringService.trackPageView(pagePath, {
      language: i18n.resolvedLanguage || 'en',
      surface: getAnalyticsSurface(location.pathname),
      ...runtimeContext,
    });
  }, [i18n.resolvedLanguage, location.hash, location.pathname, location.search, runtimeContext]);

  useEffect(() => {
    if (!user?.uid) {
      monitoringService.clearUser();
      return;
    }

    monitoringService.setUser(user.uid, {
      user_role: user.role || 'unknown',
      portal_surface: getAnalyticsSurface(location.pathname),
      onboarding_completed: Boolean(user.onboardingCompleted),
      verified: Boolean(user.verified),
      preferred_language: user.preferredLanguage || i18n.resolvedLanguage || 'en',
      impersonating: isImpersonating,
      ...runtimeContext,
    });
  }, [
    i18n.resolvedLanguage,
    isImpersonating,
    location.pathname,
    runtimeContext,
    user?.onboardingCompleted,
    user?.preferredLanguage,
    user?.role,
    user?.uid,
    user?.verified,
  ]);

  useEffect(() => {
    let isActive = true;

    const trackReleaseSeen = async () => {
      try {
        const response = await fetch(`${VERSION_URL}?ts=${Date.now()}`, { cache: 'no-store' });
        if (!response.ok || !isActive) return;
        const data = await response.json() as VersionMetadata;
        const releaseKey = String(data.buildTime || data.appVersion || data.gitCommit || 'unknown');
        if (!releaseKey || releaseSeenRef.current === releaseKey) {
          return;
        }

        const storageKey = `${RELEASE_SEEN_STORAGE_PREFIX}:${releaseKey}`;
        try {
          if (sessionStorage.getItem(storageKey)) {
            releaseSeenRef.current = releaseKey;
            return;
          }
          sessionStorage.setItem(storageKey, '1');
        } catch {
          // ignore storage restrictions
        }

        releaseSeenRef.current = releaseKey;
        monitoringService.trackEvent(FIREBASE_ANALYTICS_EVENTS.appReleaseSeen, {
          app_version: data.appVersion || 'unknown',
          build_time: data.buildTime || 'unknown',
          git_commit: data.gitCommit || 'unknown',
          deploy_id: data.deployId || 'unknown',
          environment: data.environment || 'unknown',
          surface: getAnalyticsSurface(location.pathname),
          language: i18n.resolvedLanguage || 'en',
          ...runtimeContext,
        });
      } catch (error) {
        void captureHandledError(error, {
          source: 'frontend',
          scope: 'unknown',
          metadata: { kind: 'analytics.release_seen.fetch_metadata' },
        });
      }
    };

    void trackReleaseSeen();

    return () => {
      isActive = false;
    };
  }, [i18n.resolvedLanguage, location.pathname, runtimeContext]);
};
