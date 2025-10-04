import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './Loading';
import { toast } from 'react-hot-toast';

const ProtectedRoute = () => {
  const { user, authLoading } = useAuth();
  const location = useLocation();

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
    if (user.onboardingCompleted !== true && !location.pathname.includes('/onboarding')) {
      return <Navigate to={`/${userRole}/onboarding`} replace />;
    }

    // Role-based access
    for (const role in rolePaths) {
      if (location.pathname.startsWith(rolePaths[role as keyof typeof rolePaths]) && userRole !== role) {
        toast.error(`You're not a ${role.charAt(0).toUpperCase() + role.slice(1)}`);
        return <Navigate to={`${rolePaths[role as keyof typeof rolePaths]}/login`} replace />;
      }
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;