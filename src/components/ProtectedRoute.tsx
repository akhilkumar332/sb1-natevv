import { useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './Loading';
import { toast } from 'react-hot-toast';

const ProtectedRoute = () => {
  const { user, authLoading, loading, portalRole, effectiveRole, isSuperAdmin, isImpersonating } = useAuth();
  const location = useLocation();
  const lastDeniedRef = useRef<string | null>(null);

  if (authLoading || loading) {
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
            toast.error(`You're not a ${role.charAt(0).toUpperCase() + role.slice(1)}`, { id: toastId });
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
