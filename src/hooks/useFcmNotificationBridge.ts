import { useCallback, useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useForegroundMessages } from './usePushNotifications';
import { getQueuedFcmMessages, removeQueuedFcmMessages } from '../utils/fcmQueue';
import { saveFcmNotification } from '../services/fcmNotification.service';

const SUPPORTED_ROLES = new Set(['donor', 'ngo', 'bloodbank']);

export const useFcmNotificationBridge = () => {
  const { user } = useAuth();
  const queuedFlushInFlightRef = useRef(false);
  const queuedFlushRef = useRef<string | null>(null);
  const isSupportedRole = Boolean(user?.role && SUPPORTED_ROLES.has(user.role));
  const canBridge = Boolean(user?.uid && isSupportedRole);

  useForegroundMessages({
    enabled: canBridge,
    onMessage: async (payload) => {
      if (!user?.uid) return;
      const targetUserId = payload?.data?.userId;
      if (targetUserId && targetUserId !== user.uid) return;
      try {
        await saveFcmNotification(user.uid, user.role || 'donor', payload);
      } catch (error) {
        console.warn('Failed to persist foreground FCM notification:', error);
      }
    },
  });

  const flushQueuedNotifications = useCallback(async () => {
    if (!user?.uid) return;
    if (typeof indexedDB === 'undefined') return;
    if (queuedFlushInFlightRef.current) return;
    queuedFlushInFlightRef.current = true;
    try {
      const queued = await getQueuedFcmMessages();
      if (queued.length === 0) return;
      const idsToRemove: string[] = [];
      for (const entry of queued) {
        const payload = entry.payload || {};
        const targetUserId = payload?.data?.userId;
        if (targetUserId && targetUserId !== user.uid) {
          idsToRemove.push(entry.id);
          continue;
        }
        try {
          await saveFcmNotification(user.uid, user.role || 'donor', payload, entry.id);
          idsToRemove.push(entry.id);
        } catch (error) {
          console.warn('Failed to persist queued FCM notification:', error);
        }
      }
      await removeQueuedFcmMessages(idsToRemove);
    } catch (error) {
      console.warn('Failed to flush queued FCM notifications:', error);
    } finally {
      queuedFlushInFlightRef.current = false;
    }
  }, [user?.role, user?.uid]);

  useEffect(() => {
    if (!canBridge) {
      queuedFlushRef.current = null;
      return;
    }
    if (!user?.uid) return;
    if (queuedFlushRef.current === user.uid) return;
    queuedFlushRef.current = user.uid;
    flushQueuedNotifications();
  }, [canBridge, flushQueuedNotifications, user?.uid]);

  useEffect(() => {
    if (!canBridge) return;
    if (!user?.uid) return;
    if (!('serviceWorker' in navigator)) return;

    const handleMessage = (event: MessageEvent) => {
      if (event?.data?.type === 'FCM_QUEUE_UPDATED') {
        flushQueuedNotifications();
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        flushQueuedNotifications();
      }
    };

    navigator.serviceWorker.addEventListener('message', handleMessage);
    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('focus', flushQueuedNotifications);

    return () => {
      navigator.serviceWorker.removeEventListener('message', handleMessage);
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('focus', flushQueuedNotifications);
    };
  }, [canBridge, flushQueuedNotifications, user?.uid]);
};
