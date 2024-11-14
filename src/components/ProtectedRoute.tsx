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

  // Check if the user is not logged in
  if (!user) {
    return <Navigate to="/donor/login" replace />;
  }

  // Check if the user is trying to access admin routes
  if (location.pathname.startsWith('/admin')) {
    // If the user is not an admin, show an error and redirect to the admin login
    if (user.role !== 'admin') {
      toast.error("You're not an Admin");
      return <Navigate to="/admin/login" replace />;
    }
  }

  // Check if the user is trying to access NGO routes
  if (location.pathname.startsWith('/ngo')) {
    // If the user is not an NGO, show an error and redirect to the NGO login
    if (user.role !== 'ngo') {
      toast.error("You're not an NGO");
      return <Navigate to="/ngo/login" replace />;
    }
  }

  // Check for onboarding completion
  if (!user.onboardingCompleted) {
    // Redirect to the correct onboarding page based on role
    if (user.role === 'admin') {
      return <Navigate to="/admin/onboarding" replace />;
    } else if (user.role === 'ngo') {
      return <Navigate to="/ngo/onboarding" replace />;
    } else {
      return <Navigate to="/donor/onboarding" replace />;
    }
  }

  return <Outlet />;
};

export default ProtectedRoute;