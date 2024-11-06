// src/hooks/useInactivityCheck.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authStorage } from '../utils/authStorage';
import WarningModal from '../components/WarningModal';

const INACTIVITY_TIMEOUT = 5 * 60 * 1000; // 3 minutes
const WARNING_TIMEOUT = 4 * 60 * 1000; // 2 minutes
const CHECK_INTERVAL = 30000; // Check every 30 seconds

export const useInactivityCheck = () => {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const [showWarning, setShowWarning] = useState(false);
  const logoutTimerRef = useRef<NodeJS.Timeout | null>(null);
  const checkIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const startLogoutTimer = useCallback(() => {
    if (logoutTimerRef.current) {
      clearTimeout(logoutTimerRef.current);
    }
    logoutTimerRef.current = setTimeout(() => {
      logout(navigate);
    }, 60000); // 1 minute
  }, [logout, navigate]);

  const resetActivity = useCallback(() => {
    authStorage.updateLastActiveTime();
    if (showWarning) {
      setShowWarning(false);
      if (logoutTimerRef.current) {
        clearTimeout(logoutTimerRef.current);
      }
    }
  }, [showWarning]);

  const checkInactivity = useCallback(() => {
    const lastActiveTime = authStorage.getLastActiveTime();
    const currentTime = Date.now();
    const timeSinceLastActivity = currentTime - lastActiveTime;

    if (timeSinceLastActivity >= INACTIVITY_TIMEOUT) {
      logout(navigate);
    } else if (timeSinceLastActivity >= WARNING_TIMEOUT && !showWarning) {
      setShowWarning(true);
      startLogoutTimer();
    }
  }, [logout, navigate, showWarning, startLogoutTimer]);

  useEffect(() => {
    checkIntervalRef.current = setInterval(checkInactivity, CHECK_INTERVAL);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, [checkInactivity]);

  useEffect(() => {
    const handleActivity = () => {
      if (showWarning) {
        resetActivity();
      } else {
        authStorage.updateLastActiveTime();
      }
    };

    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    events.forEach(event => window.addEventListener(event, handleActivity, { passive: true }));

    return () => {
      events.forEach(event => window.removeEventListener(event, handleActivity));
    };
  }, [showWarning, resetActivity]);

  useEffect(() => {
    authStorage.updateLastActiveTime();
  }, []);

  const WarningComponent = useCallback(() => (
    <WarningModal isVisible={showWarning} onDismiss={resetActivity} />
  ), [showWarning, resetActivity]);

  return { WarningComponent };
};