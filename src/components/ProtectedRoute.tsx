import { useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './Loading';
import { notify } from 'services/notify.service';
import { authMessages } from '../constants/messages';

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
  const rolePaths = {
    donor: '/donor',
    admin: '/admin',
    ngo: '/ngo',
    bloodbank: '/bloodbank',
  } as const;

  const resolvedImpersonatedRole = effectiveRole === 'hospital' ? 'bloodbank' : effectiveRole;
  const activeRole = isImpersonating
    ? resolvedImpersonatedRole
    : isSuperAdmin
      ? portalRole
      : (effectiveRole ?? user?.role);

  if (!user) {
    for (const role in rolePaths) {
      if (location.pathname.startsWith(rolePaths[role as keyof typeof rolePaths])) {
        return <Navigate to={`${rolePaths[role as keyof typeof rolePaths]}/login`} replace />;
      }
    }
  } else {
    if (isSuperAdmin && !portalRole && !isImpersonating) {
      for (const role in rolePaths) {
        if (location.pathname.startsWith(rolePaths[role as keyof typeof rolePaths])) {
          return <Navigate to={`${rolePaths[role as keyof typeof rolePaths]}/login`} replace />;
        }
      }
    }

    const userRole = activeRole;

    // Check for onboarding completion (only redirect if explicitly false/undefined and not already on onboarding page)
    if (!isSuperAdmin && !isImpersonating && userRole && user.onboardingCompleted !== true && !location.pathname.includes('/onboarding')) {
      return <Navigate to={`/${userRole}/onboarding`} replace />;
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
        return <Navigate to={`${rolePaths[role as keyof typeof rolePaths]}/login`} replace />;
      }
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
