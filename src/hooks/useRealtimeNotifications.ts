/**
 * useRealtimeNotifications Hook
 *
 * Real-time notification listener using Firebase onSnapshot
 */

import { useState, useEffect, useRef } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
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
import { reportRealtimeError } from '../utils/realtimeError';
import { useSyncedRef } from './useSyncedRef';
import { COLLECTIONS } from '../constants/firestore';
import { notifyNewestItem } from '../utils/realtimeEvents';
import {
  clearRealtimeRetryTimeout,
  isTransientRealtimeCode,
  scheduleRealtimeRetry,
} from '../utils/realtimeRetry';

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

const useAuthUidMatch = (userId: string) => {
  const [authReady, setAuthReady] = useState<boolean>(() => Boolean(auth.currentUser));
  const [authUid, setAuthUid] = useState<string | null>(() => auth.currentUser?.uid ?? null);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      setAuthReady(true);
      setAuthUid(firebaseUser?.uid ?? null);
    });

    return () => unsubscribe();
  }, []);

  return {
    authReady,
    authUid,
    canListen: Boolean(userId) && authReady && authUid === userId,
  };
};

type SharedNotificationState = UseRealtimeNotificationsResult;

type SharedNotificationListener = (state: SharedNotificationState) => void;

interface SharedNotificationEntry {
  userId: string;
  limitCount: number;
  listeners: Set<SharedNotificationListener>;
  state: SharedNotificationState;
  unsubscribe: (() => void) | null;
  retryTimeout: number | null;
  retryCount: number;
  useFallback: boolean;
  listenEpoch: number;
}

const sharedNotificationStreams = new Map<string, SharedNotificationEntry>();
const maxRetryAttempts = 4;
const retryDelayMs = 1200;
const immediateRetryDelayMs = 0;

const makeSharedState = (): SharedNotificationState => ({
  notifications: [],
  unreadCount: 0,
  loading: true,
  reconnecting: false,
  error: null,
});

const emitSharedNotificationState = (entry: SharedNotificationEntry) => {
  for (const listener of entry.listeners) {
    listener(entry.state);
  }
};

const updateSharedNotificationState = (
  entry: SharedNotificationEntry,
  partial: Partial<SharedNotificationState>
) => {
  entry.state = { ...entry.state, ...partial };
  emitSharedNotificationState(entry);
};

const clearSharedRetryTimeout = (entry: SharedNotificationEntry) => {
  if (entry.retryTimeout !== null) {
    globalThis.clearTimeout(entry.retryTimeout);
    entry.retryTimeout = null;
  }
};

const scheduleSharedStreamRestart = (entry: SharedNotificationEntry, epoch: number, delayMs: number) => {
  clearSharedRetryTimeout(entry);
  entry.retryTimeout = globalThis.setTimeout(() => {
    if (entry.listenEpoch !== epoch) return;
    startSharedNotificationStream(entry);
  }, delayMs) as unknown as number;
};

const isIndexError = (err: any) => {
  const message = err?.message || '';
  return err?.code === 'failed-precondition' || message.includes('requires an index');
};

const isTransientError = (err: any, userId: string) => {
  const code = err?.code;
  if (isTransientRealtimeCode(code)) {
    return true;
  }

  // During page refresh, auth may not be fully hydrated when listener starts.
  if (code === 'permission-denied' || code === 'unauthenticated') {
    return !auth.currentUser || auth.currentUser.uid !== userId;
  }

  return false;
};

const startSharedNotificationStream = (entry: SharedNotificationEntry) => {
  entry.listenEpoch += 1;
  const epoch = entry.listenEpoch;

  if (entry.unsubscribe) {
    entry.unsubscribe();
    entry.unsubscribe = null;
  }
  clearSharedRetryTimeout(entry);

  const orderedQuery = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', entry.userId),
    orderBy('createdAt', 'desc'),
    limit(entry.limitCount)
  );
  const fallbackQuery = query(
    collection(db, COLLECTIONS.NOTIFICATIONS),
    where('userId', '==', entry.userId)
  );

  const q = entry.useFallback ? fallbackQuery : orderedQuery;

  entry.unsubscribe = onSnapshot(
    q,
    (snapshot) => {
      if (entry.listenEpoch !== epoch) return;
      try {
        let notificationData = extractQueryData<Notification>(snapshot, [
          'createdAt',
          'readAt',
          'expiresAt',
        ]);

        if (entry.useFallback) {
          notificationData = notificationData
            .sort((a, b) => {
              const aTime = a.createdAt instanceof Date
                ? a.createdAt.getTime()
                : a.createdAt?.toDate?.().getTime?.() || 0;
              const bTime = b.createdAt instanceof Date
                ? b.createdAt.getTime()
                : b.createdAt?.toDate?.().getTime?.() || 0;
              return bTime - aTime;
            })
            .slice(0, entry.limitCount);
        }

        if (entry.retryCount > 0) {
          entry.retryCount = 0;
        }
        updateSharedNotificationState(entry, {
          notifications: notificationData,
          unreadCount: notificationData.filter((notification) => !notification.read).length,
          loading: false,
          reconnecting: false,
          error: null,
        });
      } catch (err) {
        reportRealtimeError(
          { scope: 'unknown', hook: 'useRealtimeNotifications' },
          err,
          'notifications.process'
        );
        updateSharedNotificationState(entry, {
          loading: false,
          reconnecting: false,
          error: 'Failed to load notifications',
        });
      }
    },
    (err) => {
      if (entry.listenEpoch !== epoch) return;

      if (!entry.useFallback && isIndexError(err)) {
        reportRealtimeError(
          { scope: 'unknown', hook: 'useRealtimeNotifications' },
          err,
          'notifications.index_fallback'
        );
        entry.useFallback = true;
        updateSharedNotificationState(entry, {
          loading: true,
          reconnecting: false,
          error: null,
        });
        scheduleSharedStreamRestart(entry, epoch, immediateRetryDelayMs);
        return;
      }

      if (isTransientError(err, entry.userId) && entry.retryCount < maxRetryAttempts) {
        entry.retryCount += 1;
        updateSharedNotificationState(entry, {
          loading: true,
          reconnecting: true,
        });
        scheduleSharedStreamRestart(entry, epoch, retryDelayMs);
        return;
      }

      reportRealtimeError(
        { scope: 'unknown', hook: 'useRealtimeNotifications' },
        err,
        'notifications.listen'
      );
      updateSharedNotificationState(entry, {
        loading: false,
        reconnecting: false,
        error: 'Failed to listen to notifications',
      });
    }
  );
};

const subscribeToSharedNotifications = (
  userId: string,
  limitCount: number,
  listener: SharedNotificationListener
) => {
  const key = `${userId}:${limitCount}`;
  let entry = sharedNotificationStreams.get(key);

  if (!entry) {
    entry = {
      userId,
      limitCount,
      listeners: new Set<SharedNotificationListener>(),
      state: makeSharedState(),
      unsubscribe: null,
      retryTimeout: null,
      retryCount: 0,
      useFallback: false,
      listenEpoch: 0,
    };
    sharedNotificationStreams.set(key, entry);
    startSharedNotificationStream(entry);
  }

  entry.listeners.add(listener);
  listener(entry.state);

  return () => {
    const current = sharedNotificationStreams.get(key);
    if (!current) return;

    current.listeners.delete(listener);
    if (current.listeners.size > 0) return;

    current.listenEpoch += 1;
    if (current.unsubscribe) {
      current.unsubscribe();
      current.unsubscribe = null;
    }
    clearSharedRetryTimeout(current);
    sharedNotificationStreams.delete(key);
  };
};

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
  const notificationsRef = useSyncedRef(notifications);
  const onNewNotificationRef = useSyncedRef(onNewNotification);
  const mountedRef = useRef(true);
  const { canListen, authReady } = useAuthUidMatch(userId);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      setReconnecting(false);
      setError(null);
      return;
    }

    if (!canListen) {
      const waitingForAuthHydration = !authReady;
      if (!waitingForAuthHydration) {
        setNotifications([]);
        setUnreadCount(0);
      }
      setLoading(waitingForAuthHydration);
      setReconnecting(false);
      setError(null);
      return;
    }

    let isFirstEmission = true;
    return subscribeToSharedNotifications(userId, limitCount, (state) => {
      if (!mountedRef.current) return;

      if (!isFirstEmission) {
        notifyNewestItem({
          previous: notificationsRef.current,
          current: state.notifications,
          onNew: onNewNotificationRef.current ?? undefined,
        });
      }
      isFirstEmission = false;

      setNotifications(state.notifications);
      setUnreadCount(state.unreadCount);
      setLoading(state.loading);
      setReconnecting(state.reconnecting);
      setError(state.error);
    });
  }, [userId, limitCount, canListen, authReady]);

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
  const { canListen, authReady } = useAuthUidMatch(userId);

  useEffect(() => {
    if (!userId) {
      setUnreadCount(0);
      setRetryCount(0);
      clearRealtimeRetryTimeout(retryTimeoutRef);
      return;
    }
    if (!canListen) {
      if (authReady) {
        setUnreadCount(0);
      }
      clearRealtimeRetryTimeout(retryTimeoutRef);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('userId', '==', userId),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          if (retryCount > 0) {
            setRetryCount(0);
          }
          setUnreadCount(snapshot.size);
        } catch (err) {
          reportRealtimeError(
            { scope: 'unknown', hook: 'useUnreadNotificationCount' },
            err,
            'notifications.unread.process'
          );
        }
      },
      (err) => {
        const isTransient = isTransientRealtimeCode(err?.code);
        if (isTransient && retryCount < 3) {
          scheduleRealtimeRetry({
            timeoutRef: retryTimeoutRef,
            delayMs: 1000,
            onRetry: () => {
              setRetryCount((prev) => prev + 1);
            },
          });
          return;
        }
        reportRealtimeError(
          { scope: 'unknown', hook: 'useUnreadNotificationCount' },
          err,
          'notifications.unread.listen'
        );
      }
    );

    return () => {
      unsubscribe();
      clearRealtimeRetryTimeout(retryTimeoutRef);
    };
  }, [userId, retryCount, canListen, authReady]);

  return unreadCount;
};

/**
 * Hook for emergency notifications only
 */
export const useEmergencyNotifications = (userId: string): Notification[] => {
  const [emergencyNotifications, setEmergencyNotifications] = useState<Notification[]>([]);
  const [retryCount, setRetryCount] = useState(0);
  const retryTimeoutRef = useRef<number | null>(null);
  const { canListen, authReady } = useAuthUidMatch(userId);

  useEffect(() => {
    if (!userId) {
      setEmergencyNotifications([]);
      setRetryCount(0);
      clearRealtimeRetryTimeout(retryTimeoutRef);
      return;
    }
    if (!canListen) {
      if (authReady) {
        setEmergencyNotifications([]);
      }
      clearRealtimeRetryTimeout(retryTimeoutRef);
      return;
    }

    const q = query(
      collection(db, COLLECTIONS.NOTIFICATIONS),
      where('userId', '==', userId),
      where('type', '==', 'emergency_request'),
      where('read', '==', false),
      orderBy('createdAt', 'desc'),
      limit(5)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          if (retryCount > 0) {
            setRetryCount(0);
          }
          const notifications = extractQueryData<Notification>(snapshot, [
            'createdAt',
            'readAt',
            'expiresAt',
          ]);
          setEmergencyNotifications(notifications);
        } catch (err) {
          reportRealtimeError(
            { scope: 'unknown', hook: 'useEmergencyNotifications' },
            err,
            'notifications.emergency.process'
          );
        }
      },
      (err) => {
        const isTransient = isTransientRealtimeCode(err?.code);
        if (isTransient && retryCount < 3) {
          scheduleRealtimeRetry({
            timeoutRef: retryTimeoutRef,
            delayMs: 1000,
            onRetry: () => {
              setRetryCount((prev) => prev + 1);
            },
          });
          return;
        }
        reportRealtimeError(
          { scope: 'unknown', hook: 'useEmergencyNotifications' },
          err,
          'notifications.emergency.listen'
        );
      }
    );

    return () => {
      unsubscribe();
      clearRealtimeRetryTimeout(retryTimeoutRef);
    };
  }, [userId, retryCount, canListen, authReady]);

  return emergencyNotifications;
};
