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
import { db } from '../firebase';
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
  const [error, setError] = useState<string | null>(null);
  const [useFallback, setUseFallback] = useState(false);
  const notificationsRef = useRef<Notification[]>([]);

  useEffect(() => {
    notificationsRef.current = notifications;
  }, [notifications]);

  useEffect(() => {
    setUseFallback(false);
  }, [userId]);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

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
        console.error('Error listening to notifications:', err);
        setError('Failed to listen to notifications');
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [userId, limitCount, useFallback, onNewNotification]);

  return {
    notifications,
    unreadCount,
    loading,
    error,
  };
};

/**
 * Hook for unread notification count only
 * Lighter weight for displaying badge counts
 */
export const useUnreadNotificationCount = (userId: string): number => {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [userId]);

  return unreadCount;
};

/**
 * Hook for emergency notifications only
 */
export const useEmergencyNotifications = (userId: string): Notification[] => {
  const [emergencyNotifications, setEmergencyNotifications] = useState<Notification[]>([]);

  useEffect(() => {
    if (!userId) return;

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      where('type', '==', 'emergency_request'),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifications = extractQueryData<Notification>(snapshot, [
        'createdAt',
        'readAt',
        'expiresAt',
      ]);
      setEmergencyNotifications(notifications);
    });

    return () => unsubscribe();
  }, [userId]);

  return emergencyNotifications;
};
