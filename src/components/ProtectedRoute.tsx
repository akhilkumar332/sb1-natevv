import { useEffect, useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './Loading';
import { notify } from 'services/notify.service';
import { authMessages } from '../constants/messages';
import { LEGACY_ROUTE_PREFIXES, PORTAL_PATH_PREFIXES, ROUTES } from '../constants/routes';
import { clearPendingPortalRole, readPendingPortalRole } from '../utils/registrationIntent';

const ProtectedRoute = () => {
  const { user, authLoading, loading, portalRole, effectiveRole, isSuperAdmin, isImpersonating, profileResolved } = useAuth();
  const location = useLocation();
  const lastDeniedRef = useRef<string | null>(null);
  const pendingToastRef = useRef<{ role: 'donor' | 'admin' | 'ngo' | 'bloodbank'; deniedKey: string } | null>(null);
  const roleMismatchMessageByRole: Record<'donor' | 'admin' | 'ngo' | 'bloodbank', string> = {
    donor: authMessages.roleMismatch.donor,
    admin: authMessages.roleMismatch.admin,
    ngo: authMessages.roleMismatch.ngo,
    bloodbank: authMessages.roleMismatch.bloodbank,
  };

  useEffect(() => {
    if (!pendingToastRef.current || isSuperAdmin) return;
    const { role, deniedKey } = pendingToastRef.current;
    if (lastDeniedRef.current === deniedKey) {
      pendingToastRef.current = null;
      return;
    }
    notify.error(roleMismatchMessageByRole[role], { id: `role-mismatch-${role}` });
    lastDeniedRef.current = deniedKey;
    pendingToastRef.current = null;
  }, [isSuperAdmin, location.pathname]);

  // Define role-based paths
  const rolePaths = PORTAL_PATH_PREFIXES;

  const resolvedImpersonatedRole = effectiveRole === 'hospital' ? 'bloodbank' : effectiveRole;
  const activeRole = isImpersonating
    ? resolvedImpersonatedRole
    : isSuperAdmin
      ? portalRole
      : (effectiveRole ?? user?.role);
  const pendingPortalRole = readPendingPortalRole();
  const routePortalRole = (() => {
    for (const role in rolePaths) {
      if (location.pathname.startsWith(rolePaths[role as keyof typeof rolePaths])) {
        return role as 'donor' | 'ngo' | 'bloodbank' | 'admin';
      }
    }
    if (location.pathname.startsWith(LEGACY_ROUTE_PREFIXES.hospital)) {
      return 'bloodbank';
    }
    return null;
  })();

  useEffect(() => {
    if (!activeRole || typeof window === 'undefined') return;
    clearPendingPortalRole();
  }, [activeRole]);

  // Allow rendering protected shells when a user is already available.
  // This avoids post-login blocking while profile refresh continues in the background.
  if (authLoading || (loading && !user)) {
    return <Loading />;
  }

  if (user && !profileResolved && !activeRole) {
    if (location.pathname.includes('/onboarding') && pendingPortalRole) {
      return <Outlet />;
    }
    return <Loading />;
  }

  if (
    user
    && !activeRole
    && pendingPortalRole
    && routePortalRole === pendingPortalRole
    && location.pathname.includes('/onboarding')
  ) {
    return <Outlet />;
  }

  if (!user) {
    if (location.pathname.startsWith(LEGACY_ROUTE_PREFIXES.hospital)) {
      return <Navigate to={ROUTES.portal.hospital.login} replace />;
    }
    for (const role in rolePaths) {
      if (location.pathname.startsWith(rolePaths[role as keyof typeof rolePaths])) {
        const key = role as keyof typeof rolePaths;
        return <Navigate to={ROUTES.portal[key].login} replace />;
      }
    }
  } else {
    if (isSuperAdmin && !portalRole && !isImpersonating) {
      if (location.pathname.startsWith(LEGACY_ROUTE_PREFIXES.hospital)) {
        return <Navigate to={ROUTES.portal.hospital.login} replace />;
      }
      for (const role in rolePaths) {
        if (location.pathname.startsWith(rolePaths[role as keyof typeof rolePaths])) {
          const key = role as keyof typeof rolePaths;
          return <Navigate to={ROUTES.portal[key].login} replace />;
        }
      }
    }

    const userRole = activeRole;

    // Check for onboarding completion (only redirect if explicitly false/undefined and not already on onboarding page)
    if (!isSuperAdmin && !isImpersonating && userRole && user.onboardingCompleted !== true && !location.pathname.includes('/onboarding')) {
      const onboardingRole = userRole === 'hospital' ? 'bloodbank' : userRole;
      if (onboardingRole === 'donor' || onboardingRole === 'ngo' || onboardingRole === 'bloodbank' || onboardingRole === 'admin') {
        return <Navigate to={ROUTES.portal[onboardingRole].onboarding} replace />;
      }
    }

    // Role-based access
    for (const role in rolePaths) {
      if (location.pathname.startsWith(rolePaths[role as keyof typeof rolePaths]) && userRole !== role) {
        if (!isSuperAdmin) {
          const typedRole = role as keyof typeof roleMismatchMessageByRole;
          const deniedKey = `role-mismatch-${typedRole}:${location.pathname}`;
          pendingToastRef.current = { role: typedRole, deniedKey };
        }
        const key = role as keyof typeof rolePaths;
        return <Navigate to={ROUTES.portal[key].login} replace />;
      }
    }
    if (location.pathname.startsWith(LEGACY_ROUTE_PREFIXES.hospital) && userRole !== 'bloodbank' && userRole !== 'hospital') {
      return <Navigate to={ROUTES.portal.hospital.login} replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
