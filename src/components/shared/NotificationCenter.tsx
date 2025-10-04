/**
 * NotificationCenter Component
 *
 * Dropdown panel for viewing and managing notifications
 */

import React, { useState } from 'react';
import { Bell, Check, Trash2, X, ExternalLink } from 'lucide-react';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { useAuth } from '../../contexts/AuthContext';
import { formatRelativeTime } from '../../utils/dataTransform';
import { doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { db } from '../../firebase';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
}

/**
 * NotificationCenter Component
 */
export const NotificationCenter: React.FC<NotificationCenterProps> = ({
  isOpen,
  onClose,
}) => {
  const { user } = useAuth();
  const { notifications, unreadCount, loading } = useRealtimeNotifications({
    userId: user?.uid || '',
    limitCount: 20,
  });

  const [markingRead, setMarkingRead] = useState<Set<string>>(new Set());

  // Mark notification as read
  const handleMarkAsRead = async (notificationId: string) => {
    if (!user) return;

    setMarkingRead((prev) => new Set(prev).add(notificationId));

    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await updateDoc(notifRef, {
        read: true,
        readAt: new Date(),
      });
    } catch (error) {
      console.error('Error marking notification as read:', error);
    } finally {
      setMarkingRead((prev) => {
        const next = new Set(prev);
        next.delete(notificationId);
        return next;
      });
    }
  };

  // Mark all as read
  const handleMarkAllAsRead = async () => {
    if (!user) return;

    const unreadNotifs = notifications.filter((n) => !n.read);

    await Promise.all(
      unreadNotifs.map((n) => {
        if (n.id) return handleMarkAsRead(n.id);
        return Promise.resolve();
      })
    );
  };

  // Delete notification
  const handleDelete = async (notificationId: string) => {
    if (!user) return;

    try {
      const notifRef = doc(db, 'notifications', notificationId);
      await deleteDoc(notifRef);
    } catch (error) {
      console.error('Error deleting notification:', error);
    }
  };

  // Get notification icon/color based on type
  const getNotificationStyle = (type: string, priority: string) => {
    if (priority === 'urgent') {
      return {
        bg: 'bg-red-100',
        text: 'text-red-600',
        border: 'border-red-200',
      };
    }

    switch (type) {
      case 'emergency_request':
        return { bg: 'bg-red-100', text: 'text-red-600', border: 'border-red-200' };
      case 'appointment_reminder':
      case 'appointment_scheduled':
        return { bg: 'bg-blue-100', text: 'text-blue-600', border: 'border-blue-200' };
      case 'badge_earned':
      case 'milestone_reached':
        return { bg: 'bg-yellow-100', text: 'text-yellow-600', border: 'border-yellow-200' };
      case 'donation_completed':
        return { bg: 'bg-green-100', text: 'text-green-600', border: 'border-green-200' };
      default:
        return { bg: 'bg-gray-100', text: 'text-gray-600', border: 'border-gray-200' };
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay */}
      <div
        className="fixed inset-0 bg-black bg-opacity-25 z-40"
        onClick={onClose}
      />

      {/* Notification Panel */}
      <div className="fixed top-16 right-4 w-96 max-h-[600px] bg-white rounded-lg shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 bg-red-600 text-white text-xs rounded-full">
                  {unreadCount}
                </span>
              )}
            </h3>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {unreadCount > 0 && (
            <button
              onClick={handleMarkAllAsRead}
              className="text-sm text-red-600 hover:text-red-700 font-medium"
            >
              Mark all as read
            </button>
          )}
        </div>

        {/* Notifications List */}
        <div className="flex-1 overflow-y-auto">
          {loading && notifications.length === 0 ? (
            <div className="flex items-center justify-center h-32">
              <div className="text-gray-500">Loading notifications...</div>
            </div>
          ) : notifications.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-32 text-gray-500">
              <Bell className="w-12 h-12 mb-2 opacity-50" />
              <p>No notifications yet</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {notifications.map((notification) => {
                const style = getNotificationStyle(
                  notification.type,
                  notification.priority || 'normal'
                );

                return (
                  <div
                    key={notification.id}
                    className={`p-4 hover:bg-gray-50 transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Icon */}
                      <div className={`p-2 rounded ${style.bg}`}>
                        <Bell className={`w-4 h-4 ${style.text}`} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm text-gray-900 mb-1">
                          {notification.title}
                        </h4>
                        <p className="text-sm text-gray-600 mb-2">
                          {notification.message}
                        </p>
                        <div className="flex items-center gap-2 text-xs text-gray-500">
                          <span>
                            {formatRelativeTime(
                              notification.createdAt instanceof Date
                                ? notification.createdAt
                                : notification.createdAt.toDate()
                            )}
                          </span>
                          {notification.actionUrl && (
                            <a
                              href={notification.actionUrl}
                              className="flex items-center gap-1 text-red-600 hover:text-red-700"
                            >
                              <ExternalLink className="w-3 h-3" />
                              View
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex gap-1">
                        {!notification.read && (
                          <button
                            onClick={() => notification.id && handleMarkAsRead(notification.id)}
                            disabled={markingRead.has(notification.id || '')}
                            className="p-1 text-gray-400 hover:text-green-600 transition-colors"
                            title="Mark as read"
                          >
                            <Check className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => notification.id && handleDelete(notification.id)}
                          className="p-1 text-gray-400 hover:text-red-600 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default NotificationCenter;
