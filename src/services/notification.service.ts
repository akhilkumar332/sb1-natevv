/**
 * Notification Service
 *
 * Service for managing push notifications and FCM
 */

import { getToken, deleteToken, Messaging } from 'firebase/messaging';
import {
  collection,
  doc,
  setDoc,
  updateDoc,
  query,
  where,
  getDocs,
  arrayUnion,
  arrayRemove,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import type { Notification as NotificationData, Coordinates, NotificationType, NotificationPriority } from '../types/database.types';
import { FCM_CONFIG } from '../config/fcm.config';
import { calculateDistance } from '../utils/geolocation';
import { DatabaseError } from '../utils/errorHandler';

// ============================================================================
// FCM TOKEN MANAGEMENT
// ============================================================================

/**
 * Request notification permission and get FCM token
 */
export const requestNotificationPermission = async (
  messaging: Messaging
): Promise<string | null> => {
  try {
    const permission = await Notification.requestPermission();

    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: FCM_CONFIG.vapidKey,
      });

      return token;
    }

    return null;
  } catch (error) {
    console.error('Error requesting notification permission:', error);
    throw new DatabaseError('Failed to request notification permission');
  }
};

/**
 * Save FCM token to user document
 */
export const saveFCMToken = async (userId: string, token: string): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
      fcmTokens: arrayUnion(token),
      lastTokenUpdate: Timestamp.now(),
    });
  } catch (error) {
    throw new DatabaseError('Failed to save FCM token');
  }
};

/**
 * Remove FCM token from user document
 */
export const removeFCMToken = async (
  userId: string,
  token: string
): Promise<void> => {
  try {
    const userRef = doc(db, 'users', userId);

    await updateDoc(userRef, {
      fcmTokens: arrayRemove(token),
    });
  } catch (error) {
    throw new DatabaseError('Failed to remove FCM token');
  }
};

/**
 * Delete FCM token completely
 */
export const deleteFCMToken = async (messaging: Messaging): Promise<void> => {
  try {
    await deleteToken(messaging);
  } catch (error) {
    throw new DatabaseError('Failed to delete FCM token');
  }
};

/**
 * Initialize FCM for user
 */
export const initializeFCM = async (
  userId: string,
  messaging: Messaging
): Promise<string | null> => {
  try {
    const token = await requestNotificationPermission(messaging);

    if (token) {
      await saveFCMToken(userId, token);
      return token;
    }

    return null;
  } catch (error) {
    console.error('Error initializing FCM:', error);
    return null;
  }
};

// ============================================================================
// NOTIFICATION CREATION
// ============================================================================

/**
 * Create a notification in Firestore
 */
export const createNotification = async (
  notification: Omit<NotificationData, 'id' | 'createdAt' | 'read'>
): Promise<string> => {
  try {
    const notificationRef = doc(collection(db, 'notifications'));

    const notificationData: NotificationData = {
      ...notification,
      createdAt: Timestamp.now(),
      read: false,
    };

    await setDoc(notificationRef, notificationData);

    return notificationRef.id;
  } catch (error) {
    throw new DatabaseError('Failed to create notification');
  }
};

/**
 * Send notification to specific user
 */
export const sendNotificationToUser = async (
  userId: string,
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<string> => {
  return createNotification({
    userId,
    userRole: data?.userRole || '',
    type,
    title,
    message,
    priority: (data?.priority || 'medium') as NotificationPriority,
    actionUrl: data?.actionUrl,
    relatedId: data?.relatedId,
    relatedType: data?.relatedType,
  });
};

/**
 * Send notification to multiple users
 */
export const sendNotificationToUsers = async (
  userIds: string[],
  type: NotificationType,
  title: string,
  message: string,
  data?: Record<string, any>
): Promise<string[]> => {
  const promises = userIds.map((userId) =>
    sendNotificationToUser(userId, type, title, message, data)
  );

  return Promise.all(promises);
};

// ============================================================================
// EMERGENCY NOTIFICATIONS
// ============================================================================

/**
 * Send emergency blood request notification to nearby donors
 */
export const sendEmergencyRequestNotification = async (
  requestId: string,
  bloodType: string,
  location: Coordinates,
  radiusKm: number,
  patientName?: string
): Promise<number> => {
  try {
    // Find nearby donors with matching blood type
    const donorsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'donor'),
      where('bloodType', '==', bloodType),
      where('isAvailable', '==', true),
      where('verified', '==', true)
    );

    const snapshot = await getDocs(donorsQuery);
    const donors = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((donor: any) => {
        if (!donor.location) return false;
        const distance = calculateDistance(location, donor.location);
        return distance <= radiusKm;
      });

    // Check notification preferences
    const notifiableDonors = donors.filter(
      (donor: any) => donor.notificationPreferences?.emergencyAlerts !== false
    );

    // Send notifications
    const title = 'Emergency Blood Request';
    const message = patientName
      ? `Urgent: ${patientName} needs ${bloodType} blood nearby!`
      : `Urgent: ${bloodType} blood needed nearby!`;

    await sendNotificationToUsers(
      notifiableDonors.map((d: any) => d.id),
      'emergency_request',
      title,
      message,
      {
        requestId,
        bloodType,
        priority: 'high',
        actionUrl: `/blood-requests/${requestId}`,
      }
    );

    return notifiableDonors.length;
  } catch (error) {
    throw new DatabaseError('Failed to send emergency notification');
  }
};

/**
 * Send nearby blood request notification
 */
export const sendNearbyRequestNotification = async (
  requestId: string,
  bloodType: string,
  location: Coordinates,
  radiusKm: number = 10
): Promise<number> => {
  return sendEmergencyRequestNotification(requestId, bloodType, location, radiusKm);
};

// ============================================================================
// APPOINTMENT NOTIFICATIONS
// ============================================================================

/**
 * Send appointment scheduled notification
 */
export const sendAppointmentScheduledNotification = async (
  donorId: string,
  appointmentId: string,
  hospitalName: string,
  appointmentDate: Date
): Promise<string> => {
  const title = 'Appointment Scheduled';
  const message = `Your donation appointment at ${hospitalName} is scheduled for ${appointmentDate.toLocaleDateString()}`;

  return sendNotificationToUser(
    donorId,
    'appointment_reminder',
    title,
    message,
    {
      appointmentId,
      hospitalName,
      appointmentDate: appointmentDate.toISOString(),
      priority: 'high',
      actionUrl: `/appointments/${appointmentId}`,
    }
  );
};

/**
 * Send appointment reminder notification
 */
export const sendAppointmentReminderNotification = async (
  donorId: string,
  appointmentId: string,
  hospitalName: string,
  hoursUntil: number
): Promise<string> => {
  const title = 'Appointment Reminder';
  const message = `Reminder: Your donation appointment at ${hospitalName} is in ${hoursUntil} hours`;

  return sendNotificationToUser(
    donorId,
    'appointment_reminder',
    title,
    message,
    {
      appointmentId,
      hospitalName,
      hoursUntil,
      priority: 'high',
      actionUrl: `/appointments/${appointmentId}`,
    }
  );
};

/**
 * Send appointment cancelled notification
 */
export const sendAppointmentCancelledNotification = async (
  donorId: string,
  appointmentId: string,
  hospitalName: string,
  reason?: string
): Promise<string> => {
  const title = 'Appointment Cancelled';
  const message = reason
    ? `Your appointment at ${hospitalName} has been cancelled. Reason: ${reason}`
    : `Your appointment at ${hospitalName} has been cancelled`;

  return sendNotificationToUser(
    donorId,
    'appointment_reminder',
    title,
    message,
    {
      appointmentId,
      hospitalName,
      reason,
      priority: 'medium',
    }
  );
};

// ============================================================================
// DONATION NOTIFICATIONS
// ============================================================================

/**
 * Send donation reminder notification
 */
export const sendDonationReminderNotification = async (
  donorId: string,
  daysSinceLastDonation: number
): Promise<string> => {
  const title = 'Time to Donate Again';
  const message = `It's been ${daysSinceLastDonation} days since your last donation. You're eligible to donate again!`;

  return sendNotificationToUser(
    donorId,
    'donation_confirmation',
    title,
    message,
    {
      daysSinceLastDonation,
      priority: 'medium',
      actionUrl: '/donor/dashboard',
    }
  );
};

/**
 * Send donation confirmation notification
 */
export const sendDonationConfirmedNotification = async (
  donorId: string,
  donationId: string,
  hospitalName: string
): Promise<string> => {
  const title = 'Donation Confirmed';
  const message = `Thank you! Your donation at ${hospitalName} has been confirmed.`;

  return sendNotificationToUser(
    donorId,
    'donation_confirmation',
    title,
    message,
    {
      donationId,
      hospitalName,
      priority: 'medium',
    }
  );
};

/**
 * Send donation completed notification
 */
export const sendDonationCompletedNotification = async (
  donorId: string,
  donationId: string,
  unitsCollected: number
): Promise<string> => {
  const title = 'Donation Completed - You\'re a Hero!';
  const message = `Thank you for donating ${unitsCollected} unit(s) of blood. You just saved lives!`;

  return sendNotificationToUser(
    donorId,
    'donation_confirmation',
    title,
    message,
    {
      donationId,
      unitsCollected,
      priority: 'medium',
    }
  );
};

// ============================================================================
// CAMPAIGN NOTIFICATIONS
// ============================================================================

/**
 * Send nearby campaign notification to donors
 */
export const sendNearbyCampaignNotification = async (
  campaignId: string,
  campaignTitle: string,
  location: Coordinates,
  radiusKm: number,
  startDate: Date
): Promise<number> => {
  try {
    // Find nearby donors
    const donorsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'donor'),
      where('verified', '==', true)
    );

    const snapshot = await getDocs(donorsQuery);
    const donors = snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() }))
      .filter((donor: any) => {
        if (!donor.location) return false;
        const distance = calculateDistance(location, donor.location);
        return distance <= radiusKm;
      });

    // Check notification preferences
    const notifiableDonors = donors.filter(
      (donor: any) => donor.notificationPreferences?.push !== false
    );

    const title = 'Blood Donation Campaign Nearby';
    const message = `${campaignTitle} is happening near you on ${startDate.toLocaleDateString()}!`;

    await sendNotificationToUsers(
      notifiableDonors.map((d: any) => d.id),
      'campaign_invite',
      title,
      message,
      {
        campaignId,
        campaignTitle,
        startDate: startDate.toISOString(),
        priority: 'medium',
        actionUrl: `/campaigns/${campaignId}`,
      }
    );

    return notifiableDonors.length;
  } catch (error) {
    throw new DatabaseError('Failed to send campaign notification');
  }
};

/**
 * Send campaign starting notification
 */
export const sendCampaignStartingNotification = async (
  campaignId: string,
  campaignTitle: string,
  registeredDonorIds: string[]
): Promise<number> => {
  const title = 'Campaign Starting Soon';
  const message = `${campaignTitle} is starting soon. See you there!`;

  await sendNotificationToUsers(
    registeredDonorIds,
    'campaign_invite',
    title,
    message,
    {
      campaignId,
      campaignTitle,
      priority: 'high',
      actionUrl: `/campaigns/${campaignId}`,
    }
  );

  return registeredDonorIds.length;
};

// ============================================================================
// INVENTORY NOTIFICATIONS
// ============================================================================

/**
 * Send low inventory alert
 */
export const sendLowInventoryAlert = async (
  hospitalId: string,
  bloodType: string,
  units: number,
  criticalLevel: number
): Promise<string> => {
  const title = 'Low Blood Inventory Alert';
  const message = `${bloodType} blood inventory is low (${units} units). Critical level: ${criticalLevel} units.`;

  return sendNotificationToUser(
    hospitalId,
    'general',
    title,
    message,
    {
      bloodType,
      units,
      criticalLevel,
      priority: 'high',
      actionUrl: '/bloodbank/dashboard/inventory',
    }
  );
};

/**
 * Send critical inventory alert
 */
export const sendCriticalInventoryAlert = async (
  hospitalId: string,
  bloodType: string,
  units: number
): Promise<string> => {
  const title = 'CRITICAL: Blood Inventory Alert';
  const message = `URGENT: ${bloodType} blood inventory is critically low (${units} units)!`;

  return sendNotificationToUser(
    hospitalId,
    'general',
    title,
    message,
    {
      bloodType,
      units,
      priority: 'high',
      actionUrl: '/bloodbank/dashboard/inventory',
    }
  );
};

// ============================================================================
// ACHIEVEMENT NOTIFICATIONS
// ============================================================================

/**
 * Send badge earned notification
 */
export const sendBadgeEarnedNotification = async (
  userId: string,
  badgeName: string,
  badgeDescription: string
): Promise<string> => {
  const title = 'New Badge Earned!';
  const message = `Congratulations! You earned the "${badgeName}" badge!`;

  return sendNotificationToUser(
    userId,
    'achievement',
    title,
    message,
    {
      badgeName,
      badgeDescription,
      priority: 'low',
      actionUrl: '/profile/achievements',
    }
  );
};

/**
 * Send milestone reached notification
 */
export const sendMilestoneReachedNotification = async (
  userId: string,
  milestone: string,
  count: number
): Promise<string> => {
  const title = 'Milestone Reached!';
  const message = `Amazing! You've reached ${count} ${milestone}!`;

  return sendNotificationToUser(
    userId,
    'achievement',
    title,
    message,
    {
      milestone,
      count,
      priority: 'low',
      actionUrl: '/profile/achievements',
    }
  );
};

// ============================================================================
// VERIFICATION NOTIFICATIONS
// ============================================================================

/**
 * Send verification approved notification
 */
export const sendVerificationApprovedNotification = async (
  userId: string,
  userType: string
): Promise<string> => {
  const title = 'Account Verified';
  const message = `Great news! Your ${userType} account has been verified.`;

  return sendNotificationToUser(
    userId,
    'verification_status',
    title,
    message,
    {
      userType,
      priority: 'high',
    }
  );
};

/**
 * Send verification rejected notification
 */
export const sendVerificationRejectedNotification = async (
  userId: string,
  userType: string,
  reason: string
): Promise<string> => {
  const title = 'Verification Status Update';
  const message = `Your ${userType} verification needs attention. Reason: ${reason}`;

  return sendNotificationToUser(
    userId,
    'verification_status',
    title,
    message,
    {
      userType,
      reason,
      priority: 'high',
    }
  );
};

// ============================================================================
// SYSTEM NOTIFICATIONS
// ============================================================================

/**
 * Send system announcement to all users
 */
export const sendSystemAnnouncement = async (
  title: string,
  message: string,
  targetRole?: 'donor' | 'bloodbank' | 'hospital' | 'ngo' | 'admin'
): Promise<number> => {
  try {
    const constraints: any[] = [];

    if (targetRole) {
      constraints.push(where('role', '==', targetRole));
    }

    const q = query(collection(db, 'users'), ...constraints);
    const snapshot = await getDocs(q);

    const userIds = snapshot.docs.map((doc) => doc.id);

    await sendNotificationToUsers(
      userIds,
      'general',
      title,
      message,
      {
        priority: 'medium',
      }
    );

    return userIds.length;
  } catch (error) {
    throw new DatabaseError('Failed to send system announcement');
  }
};
