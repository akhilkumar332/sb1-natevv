import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './Loading';

const ProtectedRoute = () => {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return <Loading />;
  }

  if (!user) {
    return <Navigate to="/donor/login" replace />;
  }

  if (!user.onboardingCompleted) {
    return <Navigate to="/donor/onboarding" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;