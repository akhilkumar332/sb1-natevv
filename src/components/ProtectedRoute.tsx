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
  } as const; // Use 'as const' to make it a readonly object with literal types

  // If user is not logged in, redirect to the appropriate login page
  if (!user) {
    for (const role in rolePaths) {
      if (location.pathname.startsWith(rolePaths[role as keyof typeof rolePaths])) {
        return <Navigate to={`${rolePaths[role as keyof typeof rolePaths]}/login`} replace />;
      }
    }
  } else {
    // If user is logged in, check their role
    const userRole = user.role;

    // Redirect if the user role does not match the path
    for (const role in rolePaths) {
      if (location.pathname.startsWith(rolePaths[role as keyof typeof rolePaths]) && userRole !== role) {
        toast.error(`You're not a ${role.charAt(0).toUpperCase() + role.slice(1)}`);
        return <Navigate to={`${rolePaths[role as keyof typeof rolePaths]}/login`} replace />;
      }
    }

    // Check for onboarding completion
    if (!user.onboardingCompleted) {
      return <Navigate to={`/${userRole}/onboarding`} replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;