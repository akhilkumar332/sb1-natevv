// src/hooks/useActivityTracker.ts

import { useCallback, useEffect, useRef } from 'react';
import { authStorage } from '../utils/authStorage';

const ACTIVITY_UPDATE_INTERVAL = 60000; // Update activity every 1 minute

export const useActivityTracker = () => {
  const lastUpdateRef = useRef(Date.now());

  const updateActivity = useCallback(() => {
    const now = Date.now();
    if (now - lastUpdateRef.current >= ACTIVITY_UPDATE_INTERVAL) {
      if (localStorage.getItem('authToken')) {
        authStorage.updateLastActiveTime();
      }
      lastUpdateRef.current = now;
    }
  }, []);

  useEffect(() => {
    const events = ['mousemove', 'keydown', 'click', 'scroll'];
    
    const handleActivity = () => {
      updateActivity();
    };

    // Add event listeners
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    // Cleanup
    return () => {
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [updateActivity]);
};