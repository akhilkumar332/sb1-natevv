/**
 * NotificationBadge Component
 *
 * Badge component for showing unread notification count
 */

import React, { useState } from 'react';
import { Bell } from 'lucide-react';
import { useRealtimeNotifications } from '../../hooks/useRealtimeNotifications';
import { useAuth } from '../../contexts/AuthContext';
import { NotificationCenter } from './NotificationCenter';

interface NotificationBadgeProps {
  showLabel?: boolean;
  className?: string;
}

/**
 * NotificationBadge Component
 */
export const NotificationBadge: React.FC<NotificationBadgeProps> = ({
  showLabel = false,
  className = '',
}) => {
  const { user } = useAuth();
  const { unreadCount } = useRealtimeNotifications({
    userId: user?.uid || '',
    limitCount: 50,
  });

  const [isOpen, setIsOpen] = useState(false);

  const handleToggle = () => {
    setIsOpen(!isOpen);
  };

  return (
    <>
      <button
        onClick={handleToggle}
        className={`relative flex items-center gap-2 p-2 rounded-lg hover:bg-gray-100 transition-colors ${className}`}
      >
        <Bell className="w-5 h-5 text-gray-700" />

        {/* Badge */}
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 flex items-center justify-center w-5 h-5 text-xs font-bold text-white bg-red-600 rounded-full border-2 border-white">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}

        {/* Label */}
        {showLabel && <span className="text-sm text-gray-700">Notifications</span>}
      </button>

      {/* Notification Center */}
      <NotificationCenter isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
};

export default NotificationBadge;
