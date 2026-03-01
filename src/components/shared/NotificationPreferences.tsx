/**
 * NotificationPreferences Component
 *
 * Component for managing notification preferences
 */

import React, { useState, useEffect } from 'react';
import { Bell, Mail, Smartphone, AlertCircle, Save } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase';
import { usePushNotifications } from '../../hooks/usePushNotifications';
import { captureHandledError } from '../../services/errorLog.service';
import { COLLECTIONS } from '../../constants/firestore';
import { THREE_SECONDS_MS } from '../../constants/time';

interface NotificationPreferencesProps {
  onSave?: () => void;
}

interface Preferences {
  email: boolean;
  sms: boolean;
  push: boolean;
  emergencyAlerts: boolean;
}

/**
 * NotificationPreferences Component
 */
export const NotificationPreferences: React.FC<NotificationPreferencesProps> = ({ onSave }) => {
  const { user } = useAuth();
  const {
    permission,
    loading: pushLoading,
    requestPermission,
    unsubscribe,
  } = usePushNotifications();

  const [preferences, setPreferences] = useState<Preferences>({
    email: true,
    sms: true,
    push: true,
    emergencyAlerts: true,
  });

  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  // Load preferences from user data
  useEffect(() => {
    const userPrefs = (user as any)?.notificationPreferences;
    if (userPrefs) {
      setPreferences((prev) => ({ ...prev, ...userPrefs }));
    }
  }, [user]);

  // Handle preference change
  const handleToggle = async (key: keyof Preferences) => {
    if (key === 'push') {
      const wantsEnable = !preferences.push;
      setSaved(false);
      setPushMessage(null);

      if (typeof window === 'undefined' || !('Notification' in window)) {
        setPushMessage('Push notifications are not supported in this browser.');
        return;
      }

      if (wantsEnable) {
        await requestPermission();
        const granted = Notification.permission === 'granted';
        setPreferences((prev) => ({ ...prev, push: granted }));
        if (!granted) {
          setPushMessage('Notifications are blocked. Enable them in your browser settings.');
        }
      } else {
        await unsubscribe();
        setPreferences((prev) => ({ ...prev, push: false }));
      }
      return;
    }

    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
    setSaved(false);
  };

  // Save preferences
  const handleSave = async () => {
    if (!user) return;

    setSaving(true);
    setSaved(false);

    try {
      const userRef = doc(db, COLLECTIONS.USERS, user.uid);

      await updateDoc(userRef, {
        notificationPreferences: preferences,
      });

      setSaved(true);
      onSave?.();

      // Reset saved state after 3 seconds
      setTimeout(() => setSaved(false), THREE_SECONDS_MS);
    } catch (error) {
      void captureHandledError(error, {
        source: 'frontend',
        scope: 'unknown',
        metadata: { kind: 'notification_preferences.save', component: 'NotificationPreferences' },
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">
          Notification Preferences
        </h3>
        <p className="text-sm text-gray-600">
          Choose how you want to receive notifications
        </p>
      </div>

      {/* Preference Options */}
      <div className="space-y-4">
        {/* Email Notifications */}
        <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="p-2 bg-blue-100 rounded">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">Email Notifications</h4>
            <p className="text-sm text-gray-600 mt-1">
              Receive notifications via email
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.email}
              onChange={() => handleToggle('email')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>
        </div>

        {/* SMS Notifications */}
        <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="p-2 bg-green-100 rounded">
            <Smartphone className="w-5 h-5 text-green-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">SMS Notifications</h4>
            <p className="text-sm text-gray-600 mt-1">
              Receive notifications via SMS
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.sms}
              onChange={() => handleToggle('sms')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>
        </div>

        {/* Push Notifications */}
        <div className="flex items-start gap-4 p-4 bg-gray-50 rounded-lg">
          <div className="p-2 bg-purple-100 rounded">
            <Bell className="w-5 h-5 text-purple-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">Push Notifications</h4>
            <p className="text-sm text-gray-600 mt-1">
              Receive push notifications in your browser
            </p>
            {permission === 'denied' && !pushMessage && (
              <p className="text-xs text-red-600 mt-2">
                Notifications are blocked. Enable them in your browser settings.
              </p>
            )}
            {pushMessage && (
              <p className="text-xs text-red-600 mt-2">
                {pushMessage}
              </p>
            )}
            {pushLoading && (
              <p className="text-xs text-gray-500 mt-2">
                Updating push preference...
              </p>
            )}
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.push}
              onChange={() => handleToggle('push')}
              disabled={pushLoading}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>
        </div>

        {/* Emergency Alerts */}
        <div className="flex items-start gap-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <div className="p-2 bg-red-100 rounded">
            <AlertCircle className="w-5 h-5 text-red-600" />
          </div>
          <div className="flex-1">
            <h4 className="font-medium text-gray-900">Emergency Alerts</h4>
            <p className="text-sm text-gray-600 mt-1">
              Critical alerts for emergency blood requests nearby
            </p>
            <p className="text-xs text-red-600 mt-1">
              Recommended to keep enabled to help save lives
            </p>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              checked={preferences.emergencyAlerts}
              onChange={() => handleToggle('emergencyAlerts')}
              className="sr-only peer"
            />
            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-red-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-red-600"></div>
          </label>
        </div>
      </div>

      {/* Save Button */}
      <div className="flex items-center gap-3">
        <button
          onClick={handleSave}
          disabled={saving || pushLoading}
          className="flex items-center gap-2 px-6 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 transition-colors font-medium"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Saving...' : 'Save Preferences'}
        </button>

        {saved && (
          <span className="text-sm text-green-600 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            Saved successfully
          </span>
        )}
      </div>
    </div>
  );
};

// Import CheckCircle icon
import { CheckCircle } from 'lucide-react';

export default NotificationPreferences;
