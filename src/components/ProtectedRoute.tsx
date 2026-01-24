import { useRef } from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './Loading';
import { toast } from 'react-hot-toast';

const ProtectedRoute = () => {
  const { user, authLoading } = useAuth();
  const location = useLocation();
  const lastDeniedRef = useRef<string | null>(null);

  if (authLoading) {
    return <Loading />;
  }

  // Define role-based paths
  const rolePaths = {
    donor: '/donor',
    admin: '/admin',
    ngo: '/ngo',
    hospital: '/hospital',
  } as const;

  if (!user) {
    for (const role in rolePaths) {
      if (location.pathname.startsWith(rolePaths[role as keyof typeof rolePaths])) {
        return <Navigate to={`${rolePaths[role as keyof typeof rolePaths]}/login`} replace />;
      }
    }
  } else {
    const userRole = user.role;

    // Check for onboarding completion (only redirect if explicitly false/undefined and not already on onboarding page)
    if (userRole && user.onboardingCompleted !== true && !location.pathname.includes('/onboarding')) {
      return <Navigate to={`/${userRole}/onboarding`} replace />;
    }

    // Role-based access
    for (const role in rolePaths) {
      if (location.pathname.startsWith(rolePaths[role as keyof typeof rolePaths]) && userRole !== role) {
        const toastId = `role-mismatch-${role}`;
        const deniedKey = `${toastId}:${location.pathname}`;
        if (lastDeniedRef.current !== deniedKey) {
          toast.error(`You're not a ${role.charAt(0).toUpperCase() + role.slice(1)}`, { id: toastId });
          lastDeniedRef.current = deniedKey;
        }
        return <Navigate to={`${rolePaths[role as keyof typeof rolePaths]}/login`} replace />;
      }
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;
