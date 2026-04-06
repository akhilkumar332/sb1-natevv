// src/hooks/useAuthSync.ts

import { useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { AuthContext, useAuth } from '../contexts/AuthContext';
import { auth } from '../firebase';
import { authStorage } from '../utils/authStorage';
import { captureHandledError } from '../services/errorLog.service';
import { FIVE_MINUTES_MS, ONE_DAY_MS } from '../constants/time';
import { useContext } from 'react';

const CHECK_INTERVAL = FIVE_MINUTES_MS; // Check every 5 minutes instead of every minute
const SESSION_DURATION = ONE_DAY_MS; // 24 hours

export const useAuthSync = () => {
  const authContext = useContext(AuthContext);
  const { user, logout, impersonationSession, authLoading, profileResolved } = useAuth();
  const navigate = useNavigate();
  const lastCheckRef = useRef(Date.now());
  const missingTokenGraceStartedAtRef = useRef<number | null>(null);
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
    if (!authContext) {
      return undefined;
    }

    const checkAuthStatus = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') {
        return;
      }
      if (authLoading || !profileResolved) {
        return;
      }
      const now = Date.now();
      
      // Only perform check if enough time has passed since last check
      if (now - lastCheckRef.current < CHECK_INTERVAL) {
        return;
      }
      
      lastCheckRef.current = now;
      
      const lastLoginTime = localStorage.getItem('lastLoginTime');
      const authToken = localStorage.getItem('authToken');

      if (!authToken && user) {
        if (!auth.currentUser) {
          if (missingTokenGraceStartedAtRef.current === null) {
            missingTokenGraceStartedAtRef.current = now;
            return;
          }
          if (now - missingTokenGraceStartedAtRef.current < CHECK_INTERVAL * 2) {
            return;
          }
          return;
        }
        missingTokenGraceStartedAtRef.current = null;
        // Token is missing but user is logged in - try to recover token first
        const tokenPromise = auth.currentUser?.getIdToken();
        if (!tokenPromise) {
          return;
        }
        tokenPromise
          .then((token) => {
            if (token) {
              authStorage.setAuthToken(token);
              missingTokenGraceStartedAtRef.current = null;
            }
          })
          .catch((error) => {
            reportAuthSyncError(error, 'auth.sync.token_refresh');
          });
        return;
      }

      missingTokenGraceStartedAtRef.current = null;

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
  }, [authContext, user, navigate, logout, impersonationSession, authLoading, profileResolved]);
};
