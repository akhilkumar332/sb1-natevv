/**
 * Firebase Cloud Messaging Configuration
 *
 * Configuration for push notifications and FCM
 */

// FCM configuration
export const FCM_CONFIG = {
  // Vapid key for web push (to be added from Firebase Console)
  vapidKey: process.env.VITE_FCM_VAPID_KEY || '',

  // Notification options
  defaultNotificationOptions: {
    requireInteraction: false,
    badge: '/notification-badge.png',
    icon: '/notification-icon.png',
    vibrate: [200, 100, 200],
  },

  // Request permission on app load
  autoRequestPermission: false,

  // Enable background notifications
  enableBackgroundNotifications: true,
};

// Notification types
export enum NotificationType {
  // Blood Requests
  EMERGENCY_REQUEST = 'emergency_request',
  BLOOD_REQUEST_NEARBY = 'blood_request_nearby',
  REQUEST_FULFILLED = 'request_fulfilled',

  // Donations
  DONATION_REMINDER = 'donation_reminder',
  DONATION_CONFIRMED = 'donation_confirmed',
  DONATION_COMPLETED = 'donation_completed',

  // Appointments
  APPOINTMENT_SCHEDULED = 'appointment_scheduled',
  APPOINTMENT_REMINDER = 'appointment_reminder',
  APPOINTMENT_CANCELLED = 'appointment_cancelled',

  // Campaigns
  CAMPAIGN_NEARBY = 'campaign_nearby',
  CAMPAIGN_STARTING = 'campaign_starting',
  CAMPAIGN_REMINDER = 'campaign_reminder',

  // Inventory
  INVENTORY_LOW = 'inventory_low',
  INVENTORY_CRITICAL = 'inventory_critical',

  // Achievements
  BADGE_EARNED = 'badge_earned',
  MILESTONE_REACHED = 'milestone_reached',

  // Admin
  VERIFICATION_APPROVED = 'verification_approved',
  VERIFICATION_REJECTED = 'verification_rejected',

  // General
  SYSTEM_ANNOUNCEMENT = 'system_announcement',
  CUSTOM = 'custom',
}

// Notification priority levels
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

// Notification channels (for grouping)
export enum NotificationChannel {
  EMERGENCY = 'emergency',
  REQUESTS = 'requests',
  DONATIONS = 'donations',
  APPOINTMENTS = 'appointments',
  CAMPAIGNS = 'campaigns',
  ACHIEVEMENTS = 'achievements',
  SYSTEM = 'system',
}

// Priority configuration
export const NOTIFICATION_PRIORITY_CONFIG = {
  [NotificationType.EMERGENCY_REQUEST]: NotificationPriority.URGENT,
  [NotificationType.INVENTORY_CRITICAL]: NotificationPriority.URGENT,
  [NotificationType.BLOOD_REQUEST_NEARBY]: NotificationPriority.HIGH,
  [NotificationType.APPOINTMENT_REMINDER]: NotificationPriority.HIGH,
  [NotificationType.DONATION_REMINDER]: NotificationPriority.NORMAL,
  [NotificationType.CAMPAIGN_NEARBY]: NotificationPriority.NORMAL,
  [NotificationType.BADGE_EARNED]: NotificationPriority.LOW,
};

// Channel configuration
export const NOTIFICATION_CHANNEL_CONFIG = {
  [NotificationType.EMERGENCY_REQUEST]: NotificationChannel.EMERGENCY,
  [NotificationType.BLOOD_REQUEST_NEARBY]: NotificationChannel.REQUESTS,
  [NotificationType.DONATION_REMINDER]: NotificationChannel.DONATIONS,
  [NotificationType.APPOINTMENT_REMINDER]: NotificationChannel.APPOINTMENTS,
  [NotificationType.CAMPAIGN_NEARBY]: NotificationChannel.CAMPAIGNS,
  [NotificationType.BADGE_EARNED]: NotificationChannel.ACHIEVEMENTS,
};
