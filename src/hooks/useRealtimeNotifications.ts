/**
 * useRealtimeNotifications Hook
 *
 * Real-time notification listener using Firebase onSnapshot
 */

import { useState, useEffect } from 'react';
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

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Create query for user's notifications
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const notificationData = extractQueryData<Notification>(snapshot, [
            'createdAt',
            'readAt',
            'expiresAt',
          ]);

          // Detect new notifications
          if (notifications.length > 0 && notificationData.length > 0) {
            const latestNotification = notificationData[0];
            const wasNew = !notifications.find(n => n.id === latestNotification.id);

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
        console.error('Error listening to notifications:', err);
        setError('Failed to listen to notifications');
        setLoading(false);
      }
    );

    // Cleanup listener on unmount
    return () => unsubscribe();
  }, [userId, limitCount]);

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
