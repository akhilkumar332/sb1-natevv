// src/hooks/useActivityTracker.ts

import { useEffect } from 'react';
import { authStorage } from '../utils/authStorage';

export const useActivityTracker = () => {
  useEffect(() => {
    const updateActivity = () => {
      if (localStorage.getItem('authToken')) {
        authStorage.updateLastActiveTime();
      }
    };

    // Update last active time on user activity
    window.addEventListener('mousemove', updateActivity);
    window.addEventListener('keydown', updateActivity);
    window.addEventListener('click', updateActivity);
    window.addEventListener('scroll', updateActivity);

    return () => {
      window.removeEventListener('mousemove', updateActivity);
      window.removeEventListener('keydown', updateActivity);
      window.removeEventListener('click', updateActivity);
      window.removeEventListener('scroll', updateActivity);
    };
  }, []);
};