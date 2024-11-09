// src/components/ProtectedRoute.tsx
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import Loading from './Loading';

const ProtectedRoute = () => {
  const { user, authLoading } = useAuth();

  if (authLoading) {
    return <Loading />;
  }
  
  //return user ? <Outlet /> : <Navigate to="/donor/login" replace />;
  return user && user.onboardingCompleted ? <Outlet /> : <Navigate to="/donor/onboarding" replace />;
};

export default ProtectedRoute;