// src/hooks/useAuthSync.ts

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export const useAuthSync = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // Check authentication status periodically
    const checkAuthStatus = () => {
      const lastLoginTime = localStorage.getItem('lastLoginTime');
      const authToken = localStorage.getItem('authToken');

      if (!authToken && user) {
        // Token is missing but user is logged in - force logout
        window.location.href = '/donor/login';
      }

      if (lastLoginTime) {
        const timeElapsed = Date.now() - parseInt(lastLoginTime);
        // Force logout after 24 hours of inactivity
        if (timeElapsed > 24 * 60 * 60 * 1000) {
          window.location.href = '/donor/login';
        }
      }
    };

    const interval = setInterval(checkAuthStatus, 1000 * 60); // Check every minute
    
    return () => clearInterval(interval);
  }, [user, navigate]);
};