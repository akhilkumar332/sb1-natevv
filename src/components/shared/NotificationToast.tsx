/**
 * NotificationToast Component
 *
 * Toast notification for displaying foreground push notifications
 */

import React, { useEffect, useState } from 'react';
import { X, Bell, AlertCircle, CheckCircle } from 'lucide-react';
import { THREE_HUNDRED_MS } from '../../constants/time';

interface NotificationToastProps {
  title: string;
  message: string;
  type?: 'info' | 'success' | 'warning' | 'error' | 'emergency';
  duration?: number;
  onClose?: () => void;
  actionLabel?: string;
  onAction?: () => void;
}

/**
 * NotificationToast Component
 */
export const NotificationToast: React.FC<NotificationToastProps> = ({
  title,
  message,
  type = 'info',
  duration = 5000,
  onClose,
  actionLabel,
  onAction,
}) => {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        setVisible(false);
        setTimeout(() => onClose?.(), THREE_HUNDRED_MS);
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [duration, onClose]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => onClose?.(), THREE_HUNDRED_MS);
  };

  const handleAction = () => {
    onAction?.();
    handleClose();
  };

  // Get icon based on type
  const getIcon = () => {
    switch (type) {
      case 'success':
        return <CheckCircle className="w-5 h-5" />;
      case 'warning':
      case 'emergency':
        return <AlertCircle className="w-5 h-5" />;
      case 'error':
        return <AlertCircle className="w-5 h-5" />;
      default:
        return <Bell className="w-5 h-5" />;
    }
  };

  // Get colors based on type
  const getColors = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200 text-green-900';
      case 'warning':
        return 'bg-yellow-50 border-yellow-200 text-yellow-900';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-900';
      case 'emergency':
        return 'bg-red-600 border-red-700 text-white animate-pulse';
      default:
        return 'bg-blue-50 border-blue-200 text-blue-900';
    }
  };

  const getIconColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-600';
      case 'warning':
        return 'text-yellow-600';
      case 'error':
        return 'text-red-600';
      case 'emergency':
        return 'text-white';
      default:
        return 'text-blue-600';
    }
  };

  return (
    <div
      className={`fixed top-4 right-4 z-50 max-w-sm w-full transition-all duration-300 ${
        visible ? 'translate-x-0 opacity-100' : 'translate-x-full opacity-0'
      }`}
    >
      <div className={`${getColors()} border rounded-lg shadow-lg p-4`}>
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={getIconColor()}>{getIcon()}</div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-sm mb-1">{title}</h4>
            <p className="text-sm opacity-90">{message}</p>

            {/* Action Button */}
            {actionLabel && onAction && (
              <button
                onClick={handleAction}
                className={`mt-2 px-3 py-1 rounded text-xs font-medium transition-colors ${
                  type === 'emergency'
                    ? 'bg-white text-red-600 hover:bg-gray-100'
                    : 'bg-white bg-opacity-50 hover:bg-opacity-75'
                }`}
              >
                {actionLabel}
              </button>
            )}
          </div>

          {/* Close Button */}
          <button
            onClick={handleClose}
            className={`${
              type === 'emergency' ? 'text-white' : 'text-gray-400'
            } hover:text-gray-600 transition-colors`}
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default NotificationToast;
