/**
 * useRealtimeNotifications Hook
 *
 * Real-time notification listener using Firebase onSnapshot
 */

import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { Notification } from '../types/database.types';
import { extractQueryData } from '../utils/firestore.utils';

interface UseRealtimeNotificationsOptions {
  userId: string;
  limitCount?: number;
  onNewNotification?: (notification: Notification) => void;
}

interface UseRealtimeNotificationsResult {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  reconnecting: boolean;
  error: string | null;
}

/**
 * Hook for real-time notifications
 * Automatically updates when new notifications arrive
 */
export const useRealtimeNotifications = ({
  userId,
  limitCount = 20,
  onNewNotification,
}: UseRealtimeNotificationsOptions): UseRealtimeNotificationsResult => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [reconnecting, setReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const notificationsRef = useRef<Notification[]>([]);
  const retryTimeoutRef = useRef<number | null>(null);

  const maxRetryAttempts = 4;
  const retryDelayMs = 1200;

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    setUseFallback(false);
    setRetryCount(0);
    if (retryTimeoutRef.current) {
      window.clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      setReconnecting(false);
      setError(null);
      return;
    }

    setLoading(true);
    setReconnecting(retryCount > 0);
    if (retryCount === 0) {
      setError(null);
    }

    const orderedQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const fallbackQuery = query(
      collection(db, 'notifications'),
      where('userId', '==', userId)
    );
    const isIndexError = (err: any) => {
      const message = err?.message || '';
      return err?.code === 'failed-precondition' || message.includes('requires an index');
    };
    const isTransientError = (err: any) => {
      const code = err?.code;
      if (['unavailable', 'deadline-exceeded', 'aborted', 'internal', 'cancelled'].includes(code)) {
        return true;
      }
      if (code === 'already-exists') {
        return true;
      }

      // During page refresh, auth may not be fully hydrated when listener starts.
      if (code === 'permission-denied' || code === 'unauthenticated') {
        return !auth.currentUser || auth.currentUser.uid !== userId;
      }

      return false;
    };

    const q = useFallback ? fallbackQuery : orderedQuery;
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          let notificationData = extractQueryData<Notification>(snapshot, [
            'createdAt',
            'readAt',
            'expiresAt',
          ]);

          if (useFallback) {
            notificationData = notificationData.sort((a, b) => {
              const aTime = a.createdAt instanceof Date ? a.createdAt.getTime() : a.createdAt?.toDate?.().getTime?.() || 0;
              const bTime = b.createdAt instanceof Date ? b.createdAt.getTime() : b.createdAt?.toDate?.().getTime?.() || 0;
              return bTime - aTime;
            }).slice(0, limitCount);
          }

          // Detect new notifications
          if (notificationsRef.current.length > 0 && notificationData.length > 0) {
            const latestNotification = notificationData[0];
            const wasNew = !notificationsRef.current.find(n => n.id === latestNotification.id);

            if (wasNew && onNewNotification) {
              onNewNotification(latestNotification);
            }
          }

          setNotifications(notificationData);
          setUnreadCount(notificationData.filter(n => !n.read).length);
          if (retryCount > 0) {
            setRetryCount(0);
          }
          setReconnecting(false);
          setError(null);
          setLoading(false);
        } catch (err) {
          console.error('Error processing notifications:', err);
          setError('Failed to load notifications');
          setLoading(false);
        }
      },
      (err) => {
        if (!useFallback && isIndexError(err)) {
          console.warn('Notifications query missing index; falling back to client-side sort.');
          setUseFallback(true);
          return;
        }

        if (isTransientError(err) && retryCount < maxRetryAttempts) {
          if (retryTimeoutRef.current) {
            window.clearTimeout(retryTimeoutRef.current);
          }
          retryTimeoutRef.current = window.setTimeout(() => {
            setRetryCount((prev) => prev + 1);
          }, retryDelayMs);
          setLoading(true);
          setReconnecting(true);
          return;
        }

        console.error('Error listening to notifications:', err);
        setReconnecting(false);
        setError('Failed to listen to notifications');
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => {
      unsubscribe();
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [userId, limitCount, useFallback, onNewNotification, retryCount]);

  return {
    notifications,
    unreadCount,
    loading,
    reconnecting,
    error,
  };
};

/**
 * Hook for unread notification count only
 * Lighter weight for displaying badge counts
 */
export const useUnreadNotificationCount = (userId: string): number => {
  const [unreadCount, setUnreadCount] = useState(0);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (retryCount > 0) {
          setRetryCount(0);
        }
        setUnreadCount(snapshot.size);
      },
      (err) => {
        const isTransient = ['already-exists', 'unavailable', 'deadline-exceeded', 'aborted', 'internal', 'cancelled'].includes(err?.code);
        if (isTransient && retryCount < 3) {
          if (retryTimeoutRef.current) {
            window.clearTimeout(retryTimeoutRef.current);
          }
          retryTimeoutRef.current = window.setTimeout(() => {
            setRetryCount((prev) => prev + 1);
          }, 1000);
          return;
        }
        console.warn('Unread notifications listener failed:', err);
      }
    );

    return () => {
      unsubscribe();
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [userId, retryCount]);

  return unreadCount;
};

/**
 * Hook for emergency notifications only
 */
export const useEmergencyNotifications = (userId: string): Notification[] => {
  const [emergencyNotifications, setEmergencyNotifications] = useState<Notification[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId) {
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('type', '==', 'emergency_request'),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (retryCount > 0) {
          setRetryCount(0);
        }
        const notifications = extractQueryData<Notification>(snapshot, [
          'createdAt',
          'readAt',
          'expiresAt',
        ]);
        setEmergencyNotifications(notifications);
      },
      (err) => {
        const isTransient = ['already-exists', 'unavailable', 'deadline-exceeded', 'aborted', 'internal', 'cancelled'].includes(err?.code);
        if (isTransient && retryCount < 3) {
          if (retryTimeoutRef.current) {
            window.clearTimeout(retryTimeoutRef.current);
          }
          retryTimeoutRef.current = window.setTimeout(() => {
            setRetryCount((prev) => prev + 1);
          }, 1000);
          return;
        }
        console.warn('Emergency notifications listener failed:', err);
      }
    );

    return () => {
      unsubscribe();
      if (retryTimeoutRef.current) {
        window.clearTimeout(retryTimeoutRef.current);
        retryTimeoutRef.current = null;
      }
    };
  }, [userId, retryCount]);

  return emergencyNotifications;
};
