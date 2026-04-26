import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../contexts/AuthContext';
import { monitoringService } from '../services/monitoring.service';
import { ANALYTICS_SURFACES, type AnalyticsSurface } from '../constants/analytics';
import { ROUTES } from '../constants/routes';

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

  useEffect(() => {
    const pagePath = location.pathname;
    monitoringService.trackPageView(pagePath, {
      language: i18n.resolvedLanguage || 'en',
      surface: getAnalyticsSurface(pagePath),
      authenticated: Boolean(user?.uid),
      user_role: user?.role || 'anonymous',
      impersonating: isImpersonating,
    });
  }, [i18n.resolvedLanguage, isImpersonating, location.pathname, user?.role, user?.uid]);

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
    });
  }, [
    i18n.resolvedLanguage,
    isImpersonating,
    location.pathname,
    user?.onboardingCompleted,
    user?.preferredLanguage,
    user?.role,
    user?.uid,
    user?.verified,
  ]);
};
