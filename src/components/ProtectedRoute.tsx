import { useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './Loading';
import { notify } from 'services/notify.service';
import { authMessages } from '../constants/messages';
import { LEGACY_ROUTE_PREFIXES, PORTAL_PATH_PREFIXES, ROUTES } from '../constants/routes';

const ProtectedRoute = () => {
  const { user, authLoading, loading, portalRole, effectiveRole, isSuperAdmin, isImpersonating } = useAuth();
  const location = useLocation();
  const lastDeniedRef = useRef<string | null>(null);
  const roleMismatchMessageByRole: Record<'donor' | 'admin' | 'ngo' | 'bloodbank', string> = {
    donor: authMessages.roleMismatch.donor,
    admin: authMessages.roleMismatch.admin,
    ngo: authMessages.roleMismatch.ngo,
    bloodbank: authMessages.roleMismatch.bloodbank,
  };

  // Allow rendering protected shells when a user is already available.
  // This avoids post-login blocking while profile refresh continues in the background.
  if (authLoading || (loading && !user)) {
    return <Loading />;
  }

  // Define role-based paths
  const rolePaths = PORTAL_PATH_PREFIXES;

  const resolvedImpersonatedRole = effectiveRole === 'hospital' ? 'bloodbank' : effectiveRole;
  const activeRole = isImpersonating
    ? resolvedImpersonatedRole
    : isSuperAdmin
      ? portalRole
      : (effectiveRole ?? user?.role);

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
          const toastId = `role-mismatch-${role}`;
          const deniedKey = `${toastId}:${location.pathname}`;
          if (lastDeniedRef.current !== deniedKey) {
            notify.error(roleMismatchMessageByRole[role as keyof typeof roleMismatchMessageByRole], { id: toastId });
            lastDeniedRef.current = deniedKey;
          }
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
