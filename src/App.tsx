// src/App.tsx
import { Suspense, useEffect } from 'react';
import { Toaster } from 'react-hot-toast';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Loading from './components/Loading';
import { LoadingProvider } from './contexts/LoadingContext';
import AppRoutes from './AppRoutes';
import { useAuth } from './contexts/AuthContext';
import { useAuthSync } from './hooks/useAuthSync';
import { useActivityTracker } from './hooks/useActivityTracker';
import { useInactivityCheck } from './hooks/useInactivityCheck';
import { useLocation } from 'react-router-dom';
import { useVersionCheck } from './hooks/useVersionCheck';
import { setReferralTracking, setReferralReferrerUid } from './utils/referralTracking';
import { applyPwaBranding } from './utils/pwaManifest';
import { useTheme } from './contexts/ThemeContext';
import { useViewport } from './hooks/useViewport';
import AppLaunchSplash from './components/mobile/AppLaunchSplash';
import MobileRouteTransition from './components/mobile/MobileRouteTransition';
import MobileBottomNav from './components/mobile/MobileBottomNav';
import NetworkStatusBadge from './components/shared/NetworkStatusBadge';
import { APP_ROUTE_PREFIXES_WITH_LEGACY, ROUTES } from './constants/routes';
import { TOAST_THEME_TOKENS } from './constants/theme';
import { FIVE_SECONDS_MS, ONE_MINUTE_MS, THREE_SECONDS_MS } from './constants/time';

function App() {
  useAuthSync();
  useActivityTracker();
  useVersionCheck();
  const { user } = useAuth();
  const { isDark } = useTheme();
  const { isMobileOrTablet, isTablet } = useViewport();
  const { WarningComponent } = useInactivityCheck();
  const location = useLocation();

  const mobileOnlyRoutes = new Set<string>([
    ROUTES.portal.donor.login,
    ROUTES.portal.donor.register,
    ROUTES.portal.ngo.login,
    ROUTES.portal.ngo.register,
    ROUTES.portal.bloodbank.login,
    ROUTES.portal.bloodbank.register,
  ]);
  const noFooterRoutes = new Set<string>([
    ROUTES.portal.donor.dashboard.root,
    ROUTES.portal.ngo.dashboard.root,
    ROUTES.portal.bloodbank.dashboard.root,
    ROUTES.portal.admin.dashboard.root,
    ROUTES.portal.donor.onboarding,
    ROUTES.portal.ngo.onboarding,
    ROUTES.portal.bloodbank.onboarding,
  ]);
  const noFooterPrefixes = [
    ROUTES.portal.donor.dashboard.root,
    ROUTES.portal.ngo.dashboard.root,
    ROUTES.portal.bloodbank.dashboard.root,
    ROUTES.portal.admin.dashboard.root,
  ];

  const hideCompletely = noFooterRoutes.has(location.pathname)
    || noFooterPrefixes.some(prefix => location.pathname.startsWith(prefix));
  const hideOnMobile = mobileOnlyRoutes.has(location.pathname);
  const appLikePrefixes = APP_ROUTE_PREFIXES_WITH_LEGACY;
  const publicMobileAppRoutes = new Set<string>([
    ROUTES.home,
    ROUTES.donors,
    ROUTES.requestBlood,
    ROUTES.about,
    ROUTES.contact,
  ]);
  const dashboardPrefixes = [ROUTES.portal.donor.dashboard.root, ROUTES.portal.ngo.dashboard.root, ROUTES.portal.bloodbank.dashboard.root, ROUTES.portal.admin.dashboard.root];
  const isAppLikeRoute = appLikePrefixes.some(prefix => location.pathname.startsWith(prefix));
  const isPublicFrontendRoute = publicMobileAppRoutes.has(location.pathname);
  const isDashboardRoute = dashboardPrefixes.some(prefix => location.pathname.startsWith(prefix));
  const useMobileAppExperience = isMobileOrTablet && (isAppLikeRoute || isPublicFrontendRoute);
  const footerWrapperClass = hideCompletely
    ? 'hidden'
    : hideOnMobile
      ? 'hidden md:block'
      : undefined;
  const mainClassName = `flex-grow ${useMobileAppExperience ? 'mobile-app-shell' : ''} ${
    isMobileOrTablet && isDashboardRoute ? 'pb-24' : ''
  } ${
    isMobileOrTablet && isDashboardRoute ? 'compact-hybrid-dashboard' : ''
  } ${
    isMobileOrTablet && isPublicFrontendRoute ? 'compact-hybrid-frontend' : ''
  }`;
  const appContentFrameClass = useMobileAppExperience
    ? `mobile-app-content-frame ${isTablet ? 'mobile-app-content-frame-tablet' : ''}`
    : '';

  useEffect(() => {
    if (!location.search) return;
    const params = new URLSearchParams(location.search);
    const bhId = params.get('BHID') || params.get('bhid');
    const referrerUid = params.get('ref') || params.get('referrer');
    if (bhId) {
      setReferralTracking(bhId.trim());
    }
    if (referrerUid) {
      setReferralReferrerUid(referrerUid.trim());
    }
  }, [location.search]);

  useEffect(() => {
    applyPwaBranding(location.pathname);
  }, [location.pathname]);

  return (
    <LoadingProvider>
      <div className="min-h-screen flex flex-col bg-gray-50 dark:bg-gray-950">
        <AppLaunchSplash enabled={useMobileAppExperience} />
        <Navbar />
        <NetworkStatusBadge />
        <Suspense fallback={<Loading />}>
          <main className={mainClassName}>
            <div className={appContentFrameClass}>
              <MobileRouteTransition enabled={useMobileAppExperience}>
                <AppRoutes />
              </MobileRouteTransition>
            </div>
          </main>
        </Suspense>
        <MobileBottomNav enabled={isMobileOrTablet && isDashboardRoute} />
        <div className={footerWrapperClass}>
          <Footer />
        </div>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: FIVE_SECONDS_MS,
            style: {
              background: isDark ? TOAST_THEME_TOKENS.surface.dark : TOAST_THEME_TOKENS.surface.light,
              color: isDark ? TOAST_THEME_TOKENS.text.dark : TOAST_THEME_TOKENS.text.light,
              boxShadow: isDark
                ? TOAST_THEME_TOKENS.shadow.dark
                : TOAST_THEME_TOKENS.shadow.light,
              borderRadius: '8px',
              padding: '16px',
              border: isDark ? TOAST_THEME_TOKENS.border.dark : TOAST_THEME_TOKENS.border.light,
            },
            success: {
              duration: THREE_SECONDS_MS,
              iconTheme: {
                primary: TOAST_THEME_TOKENS.icon.success,
                secondary: TOAST_THEME_TOKENS.icon.secondary,
              },
            },
            error: {
              duration: THREE_SECONDS_MS,
              iconTheme: {
                primary: TOAST_THEME_TOKENS.icon.error,
                secondary: TOAST_THEME_TOKENS.icon.secondary,
              },
            },
            // Add custom styling for warning toasts
            custom: {
              duration: ONE_MINUTE_MS,
              style: {
                background: isDark ? TOAST_THEME_TOKENS.warning.bgDark : TOAST_THEME_TOKENS.warning.bgLight,
                color: isDark ? TOAST_THEME_TOKENS.warning.textDark : TOAST_THEME_TOKENS.warning.textLight,
                border: isDark ? TOAST_THEME_TOKENS.warning.borderDark : TOAST_THEME_TOKENS.warning.borderLight,
              },
            },
          }}
        />
        {user && <WarningComponent />}
      </div>
    </LoadingProvider>
  );
}

export default App;
