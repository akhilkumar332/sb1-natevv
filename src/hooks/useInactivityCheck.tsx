// src/hooks/useInactivityCheck.tsx
import { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { authStorage } from '../utils/authStorage';
import WarningModal from '../components/WarningModal';
import { FIVE_MINUTES_MS, FOUR_MINUTES_MS } from '../constants/time';

const INACTIVITY_TIMEOUT = FIVE_MINUTES_MS; // 5 minutes FIVE_MINUTES_MS
const WARNING_TIMEOUT = FOUR_MINUTES_MS; // 4 minutes FOUR_MINUTES_MS
const CHECK_INTERVAL = 30000; // Check every 30 seconds

export const useInactivityCheck = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
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
    if (!user) {
      // Clear any existing timers if the user is not logged in
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
      return;
    }

    checkIntervalRef.current = setInterval(checkInactivity, CHECK_INTERVAL);

    return () => {
      if (checkIntervalRef.current) clearInterval(checkIntervalRef.current);
      if (logoutTimerRef.current) clearTimeout(logoutTimerRef.current);
    };
  }, [checkInactivity, user]);

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

  return { WarningComponent: user ? WarningComponent : () => null };
};