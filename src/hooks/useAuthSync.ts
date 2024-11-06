// src/hooks/useAuthSync.ts

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

const CHECK_INTERVAL = 5 * 60 * 1000; // Check every 5 minutes instead of every minute
const SESSION_DURATION = 24 * 60 * 60 * 1000; // 24 hours

export const useAuthSync = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const lastCheckRef = useRef(Date.now());

  useEffect(() => {
    const checkAuthStatus = () => {
      const now = Date.now();
      
      // Only perform check if enough time has passed since last check
      if (now - lastCheckRef.current < CHECK_INTERVAL) {
        return;
      }
      
      lastCheckRef.current = now;
      
      const lastLoginTime = localStorage.getItem('lastLoginTime');
      const authToken = localStorage.getItem('authToken');

      if (!authToken && user) {
        // Token is missing but user is logged in - force logout
        logout(navigate);
        return;
      }

      if (lastLoginTime) {
        const timeElapsed = now - parseInt(lastLoginTime);
        // Force logout after 24 hours of inactivity
        if (timeElapsed > SESSION_DURATION) {
          logout(navigate);
        }
      }
    };

    // Initial check
    checkAuthStatus();

    // Set up interval with a longer duration
    const intervalId = setInterval(checkAuthStatus, CHECK_INTERVAL);
    
    // Add event listener for storage changes
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'authToken' || e.key === 'lastLoginTime') {
        checkAuthStatus();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    return () => {
      clearInterval(intervalId);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [user, navigate, logout]);
};