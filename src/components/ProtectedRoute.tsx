import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

interface ProtectedRouteProps {
  children?: React.ReactNode;
}

function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/donor/login" replace />;
  }

  return children ? <>{children}</> : <Outlet />;
}

export default ProtectedRoute;