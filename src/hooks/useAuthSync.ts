// src/hooks/useAuthSync.ts

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { authStorage } from '../utils/authStorage';
import { captureHandledError } from '../services/errorLog.service';
import { FIVE_MINUTES_MS, ONE_DAY_MS } from '../constants/time';

const CHECK_INTERVAL = FIVE_MINUTES_MS; // Check every 5 minutes instead of every minute
const SESSION_DURATION = ONE_DAY_MS; // 24 hours

export const useAuthSync = () => {
  const { user, logout, impersonationSession } = useAuth();
  const navigate = useNavigate();
  const lastCheckRef = useRef(Date.now());
  const reportAuthSyncError = (error: unknown, kind: string) => {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'auth',
      metadata: {
        hook: 'useAuthSync',
        kind,
      },
    });
  };

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
        // Token is missing but user is logged in - try to recover token first
        const tokenPromise = auth.currentUser?.getIdToken();
        if (!tokenPromise) {
          if (!impersonationSession) {
            logout(navigate);
          }
          return;
        }
        tokenPromise
          .then((token) => {
            if (token) {
              authStorage.setAuthToken(token);
            } else if (!impersonationSession) {
              logout(navigate);
            }
          })
          .catch((error) => {
            reportAuthSyncError(error, 'auth.sync.token_refresh');
            if (!impersonationSession) {
              logout(navigate);
            }
          });
        return;
      }

      if (lastLoginTime) {
        const timeElapsed = now - parseInt(lastLoginTime);
        // Force logout after 24 hours of inactivity
        if (timeElapsed > SESSION_DURATION && !impersonationSession) {
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
  }, [user, navigate, logout, impersonationSession]);
};
