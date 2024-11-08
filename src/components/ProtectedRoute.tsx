// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './Loading';

const ProtectedRoute = () => {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return <Loading />;
  }

  // Check if the user is authenticated and has completed onboarding
  if (!user) {
    return <Navigate to="/donor/login" replace />;
  }

  if (!user.onboardingCompleted) {
    return <Navigate to="/donor/onboarding" replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;