/**
 * NotificationList Component
 *
 * Displays a list of notifications for any user role
 */

import React from 'react';
import { Notification } from '../../types/database.types';
import { formatRelativeTime } from '../../utils/dataTransform';
import {
  Bell,
  AlertCircle,
  Calendar,
  Heart,
  CheckCircle,
  Info,
} from 'lucide-react';

interface NotificationListProps {
  notifications: Notification[];
  onNotificationClick?: (notification: Notification) => void;
  onMarkAsRead?: (notificationId: string) => void;
  onMarkAllAsRead?: () => void;
  loading?: boolean;
}

/**
 * NotificationList component
 */
export const NotificationList: React.FC<NotificationListProps> = ({
  notifications,
  onNotificationClick,
  onMarkAsRead,
  onMarkAllAsRead,
  loading = false,
}) => {
  const getNotificationIcon = (type: Notification['type']) => {
    const iconClass = 'w-5 h-5';

    switch (type) {
      case 'emergency_request':
        return <AlertCircle className={`${iconClass} text-red-600`} />;
      case 'appointment_reminder':
        return <Calendar className={`${iconClass} text-blue-600`} />;
      case 'campaign_invite':
        return <Bell className={`${iconClass} text-purple-600`} />;
      case 'donation_confirmation':
        return <Heart className={`${iconClass} text-red-500`} />;
      case 'verification_status':
        return <CheckCircle className={`${iconClass} text-green-600`} />;
      case 'achievement':
        return <CheckCircle className={`${iconClass} text-yellow-600`} />;
      default:
        return <Info className={`${iconClass} text-gray-600`} />;
    }
  };

  const getPriorityColor = (priority: Notification['priority']) => {
    switch (priority) {
      case 'high':
        return 'border-l-red-500';
      case 'medium':
        return 'border-l-yellow-500';
      case 'low':
        return 'border-l-gray-400';
      default:
        return 'border-l-gray-300';
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.read && onMarkAsRead && notification.id) {
      onMarkAsRead(notification.id);
    }
    if (onNotificationClick) {
      onNotificationClick(notification);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600"></div>
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-8">
        <Bell className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600">No notifications</p>
      </div>
    );
  }

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 px-2 py-1 bg-red-600 text-white text-xs rounded-full">
              {unreadCount}
            </span>
          )}
        </h3>
        {unreadCount > 0 && onMarkAllAsRead && (
          <button
            onClick={onMarkAllAsRead}
            className="text-sm text-blue-600 hover:text-blue-700 font-medium"
          >
            Mark all as read
          </button>
        )}
      </div>

      {/* Notification List */}
      <div className="space-y-2">
        {notifications.map(notification => (
          <div
            key={notification.id}
            onClick={() => handleNotificationClick(notification)}
            className={`
              p-4 rounded-lg border-l-4 cursor-pointer transition-all
              ${getPriorityColor(notification.priority)}
              ${
                notification.read
                  ? 'bg-white hover:bg-gray-50'
                  : 'bg-blue-50 hover:bg-blue-100'
              }
            `}
          >
            <div className="flex items-start gap-3">
              {/* Icon */}
              <div className="flex-shrink-0 mt-0.5">
                {getNotificationIcon(notification.type)}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <h4
                    className={`text-sm font-medium ${
                      notification.read ? 'text-gray-900' : 'text-gray-900 font-semibold'
                    }`}
                  >
                    {notification.title}
                  </h4>
                  {!notification.read && (
                    <span className="flex-shrink-0 w-2 h-2 bg-blue-600 rounded-full"></span>
                  )}
                </div>

                <p className="text-sm text-gray-700 mt-1">{notification.message}</p>

                <div className="flex items-center gap-4 mt-2">
                  <span className="text-xs text-gray-500">
                    {formatRelativeTime(notification.createdAt)}
                  </span>

                  {notification.actionLabel && notification.actionUrl && (
                    <a
                      href={notification.actionUrl}
                      onClick={e => e.stopPropagation()}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      {notification.actionLabel}
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default NotificationList;
