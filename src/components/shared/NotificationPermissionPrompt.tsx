/**
 * NotificationPermissionPrompt Component
 *
 * Component for requesting notification permissions
 */

import React, { useState } from 'react';
import { Bell, BellOff, X } from 'lucide-react';
import { usePushNotifications, useNotificationPermission } from '../../hooks/usePushNotifications';

interface NotificationPermissionPromptProps {
  onClose?: () => void;
  showCloseButton?: boolean;
}

/**
 * NotificationPermissionPrompt Component
 */
export const NotificationPermissionPrompt: React.FC<NotificationPermissionPromptProps> = ({
  onClose,
  showCloseButton = true,
}) => {
  const { isGranted, isDenied } = useNotificationPermission();
  const { requestPermission, loading } = usePushNotifications();
  const [dismissed, setDismissed] = useState(false);

  // Don't show if already granted or user dismissed
  if (isGranted || dismissed) {
    return null;
  }

  const handleRequestPermission = async () => {
    await requestPermission();
  };

  const handleDismiss = () => {
    setDismissed(true);
    onClose?.();
  };

  return (
    <div className="bg-gradient-to-r from-red-50 to-red-100 border border-red-200 rounded-lg p-4 shadow-md">
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div className={`p-2 rounded-full ${isDenied ? 'bg-gray-200' : 'bg-red-600'}`}>
          {isDenied ? (
            <BellOff className="w-6 h-6 text-gray-600" />
          ) : (
            <Bell className="w-6 h-6 text-white" />
          )}
        </div>

        {/* Content */}
        <div className="flex-1">
          <h3 className="font-semibold text-gray-900 mb-1">
            {isDenied ? 'Notifications Blocked' : 'Stay Updated with Notifications'}
          </h3>

          <p className="text-sm text-gray-600 mb-3">
            {isDenied
              ? 'You have blocked notifications. To receive emergency alerts and updates, please enable notifications in your browser settings.'
              : 'Get real-time alerts for emergency blood requests, appointment reminders, and important updates.'}
          </p>

          {/* Actions */}
          <div className="flex gap-2">
            {!isDenied && (
              <button
                onClick={handleRequestPermission}
                disabled={loading}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 disabled:bg-gray-400 transition-colors font-medium text-sm"
              >
                {loading ? 'Requesting...' : 'Enable Notifications'}
              </button>
            )}

            {showCloseButton && (
              <button
                onClick={handleDismiss}
                className="px-4 py-2 bg-white text-gray-700 rounded border border-gray-300 hover:bg-gray-50 transition-colors text-sm"
              >
                Maybe Later
              </button>
            )}
          </div>
        </div>

        {/* Close Button */}
        {showCloseButton && (
          <button
            onClick={handleDismiss}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}
      </div>
    </div>
  );
};

export default NotificationPermissionPrompt;
