/**
 * Push Notifications Hooks
 *
 * React hooks for managing push notifications and FCM
 */

import { useState, useEffect, useCallback } from 'react';
import { getMessaging, onMessage, Messaging } from 'firebase/messaging';
import { useAuth } from '../contexts/AuthContext';
import {
  initializeFCM,
  deleteFCMToken,
  removeFCMDeviceToken,
  removeFCMToken,
} from '../services/notification.service';
import { getDeviceId, getDeviceInfo } from '../utils/device';
import {
  clearStoredFcmToken,
  readStoredFcmToken,
  writeFcmTokenMeta,
  writeStoredFcmToken,
} from '../utils/fcmStorage';
import { captureHandledError } from '../services/errorLog.service';

// ============================================================================
// PUSH NOTIFICATIONS HOOK
// ============================================================================

interface UsePushNotificationsResult {
  permission: NotificationPermission;
  token: string | null;
  loading: boolean;
  error: Error | null;
  requestPermission: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

/**
 * Hook for managing push notifications
 */
export const usePushNotifications = (): UsePushNotificationsResult => {
  const { user } = useAuth();
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [messaging, setMessaging] = useState<Messaging | null>(null);
  const deviceId = getDeviceId();
  const deviceInfo = getDeviceInfo();
  const reportPushNotificationError = (err: unknown, kind: string) => {
    void captureHandledError(err, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        hook: 'usePushNotifications',
        kind,
      },
    });
  };

  // Initialize messaging
  useEffect(() => {
    try {
      const msg = getMessaging();
      setMessaging(msg);
    } catch (err) {
      reportPushNotificationError(err, 'push.messaging.init');
    }
  }, []);

  useEffect(() => {
    if (!user?.uid) {
      setToken(null);
      return;
    }
    const storedToken = readStoredFcmToken(user.uid);
    if (storedToken) {
      setToken(storedToken);
    }
  }, [user?.uid]);

  // Check current permission status
  useEffect(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  // Request notification permission
  const requestPermission = useCallback(async () => {
    if (!user || !messaging) {
      setError(new Error('User not authenticated or messaging not initialized'));
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const fcmToken = await initializeFCM(user.uid, messaging, deviceId, deviceInfo);

      if (fcmToken) {
        setToken(fcmToken);
        writeStoredFcmToken(user.uid, fcmToken);
        writeFcmTokenMeta(user.uid, { token: fcmToken, deviceId, savedAt: Date.now() });
      }
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      }
    } catch (err) {
      reportPushNotificationError(err, 'push.permission.request');
      setError(err instanceof Error ? err : new Error('Failed to request permission'));
      if (typeof window !== 'undefined' && 'Notification' in window) {
        setPermission(Notification.permission);
      } else {
        setPermission('default');
      }
    } finally {
      setLoading(false);
    }
  }, [user, messaging]);

  // Unsubscribe from notifications
  const unsubscribe = useCallback(async () => {
    const tokenToRemove = token || (user?.uid ? readStoredFcmToken(user.uid) : null);
    if (!user || !messaging || !tokenToRemove) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      if (deviceId) {
        await removeFCMDeviceToken(user.uid, deviceId, tokenToRemove);
      } else {
        await removeFCMToken(user.uid, tokenToRemove);
      }
      await deleteFCMToken(messaging);
      setToken(null);
      clearStoredFcmToken(user.uid);
    } catch (err) {
      reportPushNotificationError(err, 'push.unsubscribe');
      setError(err instanceof Error ? err : new Error('Failed to unsubscribe'));
    } finally {
      setLoading(false);
    }
  }, [user, messaging, token]);

  return {
    permission,
    token,
    loading,
    error,
    requestPermission,
    unsubscribe,
  };
};

// ============================================================================
// FOREGROUND MESSAGE LISTENER HOOK
// ============================================================================

interface UseForegroundMessagesOptions {
  onMessage?: (payload: any) => void;
  enabled?: boolean;
}

/**
 * Hook for listening to foreground messages
 */
export const useForegroundMessages = (
  options: UseForegroundMessagesOptions = {}
): void => {
  const { onMessage: onMessageCallback, enabled = true } = options;
  const reportForegroundMessageError = (err: unknown, kind: string) => {
    void captureHandledError(err, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        hook: 'useForegroundMessages',
        kind,
      },
    });
  };

  useEffect(() => {
    if (!enabled) {
      return;
    }
    let unsubscribe: (() => void) | undefined;

    try {
      const messaging = getMessaging();

      // Listen for foreground messages
      unsubscribe = onMessage(messaging, (payload) => {

        // Show browser notification
        if ('Notification' in window && Notification.permission === 'granted') {
          const { title, body, icon } = payload.notification || {};
          const notificationTitle = title || 'BloodHub India';
          const notificationOptions: NotificationOptions = {
            body: body || '',
            icon: icon || '/notification-icon.svg',
            badge: '/notification-badge.svg',
            data: payload.data,
            tag: payload.data?.type || 'default',
          };

          if ('serviceWorker' in navigator) {
            navigator.serviceWorker.ready
              .then((registration) => registration.showNotification(notificationTitle, notificationOptions))
              .catch((error) => {
                reportForegroundMessageError(error, 'push.foreground.service_worker_show');
                try {
                  new Notification(notificationTitle, notificationOptions);
                } catch (notificationError) {
                  reportForegroundMessageError(notificationError, 'push.foreground.notification_fallback');
                }
              });
          } else {
            try {
              new Notification(notificationTitle, notificationOptions);
            } catch (notificationError) {
              reportForegroundMessageError(notificationError, 'push.foreground.notification_direct');
            }
          }
        }

        // Call custom callback
        if (onMessageCallback) {
          onMessageCallback(payload);
        }
      });
    } catch (err) {
      reportForegroundMessageError(err, 'push.foreground.listener_setup');
    }

    return () => {
      if (unsubscribe) {
        unsubscribe();
      }
    };
  }, [enabled, onMessageCallback]);
};

// ============================================================================
// NOTIFICATION PERMISSION STATUS HOOK
// ============================================================================

interface UseNotificationPermissionResult {
  permission: NotificationPermission;
  isGranted: boolean;
  isDenied: boolean;
  isDefault: boolean;
  checkPermission: () => void;
}

/**
 * Hook for checking notification permission status
 */
export const useNotificationPermission = (): UseNotificationPermissionResult => {
  const [permission, setPermission] = useState<NotificationPermission>('default');

  const checkPermission = useCallback(() => {
    if ('Notification' in window) {
      setPermission(Notification.permission);
    }
  }, []);

  useEffect(() => {
    checkPermission();

    // Listen for permission changes (not widely supported)
    if ('permissions' in navigator) {
      navigator.permissions.query({ name: 'notifications' as PermissionName }).then((result) => {
        setPermission(result.state as NotificationPermission);

        result.addEventListener('change', () => {
          setPermission(result.state as NotificationPermission);
        });
      });
    }
  }, [checkPermission]);

  return {
    permission,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    isDefault: permission === 'default',
    checkPermission,
  };
};

// ============================================================================
// NOTIFICATION SOUND HOOK
// ============================================================================

interface UseNotificationSoundOptions {
  soundUrl?: string;
  enabled?: boolean;
}

/**
 * Hook for playing notification sounds
 */
export const useNotificationSound = (
  options: UseNotificationSoundOptions = {}
): ((type?: string) => void) => {
  const { soundUrl = '/notification-sound.mp3', enabled = true } = options;
  const reportNotificationSoundError = (err: unknown, kind: string, audioUrl: string) => {
    void captureHandledError(err, {
      source: 'frontend',
      scope: 'unknown',
      metadata: {
        hook: 'useNotificationSound',
        kind,
        audioUrl,
      },
    });
  };

  const playSound = useCallback(
    (type?: string) => {
      if (!enabled) return;

      // Use different sounds for different types
      let audioUrl = soundUrl;

      if (type === 'emergency') {
        audioUrl = '/sounds/emergency.mp3';
      } else if (type === 'success') {
        audioUrl = '/sounds/success.mp3';
      }

      try {
        const audio = new Audio(audioUrl);
        audio.volume = 0.5;
        audio.play().catch((err) => {
          reportNotificationSoundError(err, 'push.sound.play', audioUrl);
        });
      } catch (err) {
        reportNotificationSoundError(err, 'push.sound.create', audioUrl);
      }
    },
    [soundUrl, enabled]
  );

  return playSound;
};
