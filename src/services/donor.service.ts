/**
 * Donor Service
 *
 * Service layer for donor-specific operations including:
 * - Donation history tracking
 * - Blood request notifications
 * - Appointment scheduling
 * - Eligibility checking
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  doc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  Donation,
  BloodRequest,
  Appointment,
  User,
  Notification,
} from '../types/database.types';
import { extractQueryData, getServerTimestamp } from '../utils/firestore.utils';
import { isEligibleToDonate } from '../utils/auth.utils';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errorHandler';

// ============================================================================
// DONATION HISTORY
// ============================================================================

/**
 * Get donation history for a donor
 * @param donorId - Donor user ID
 * @param limitCount - Number of donations to fetch
 * @returns Array of donations
 */
export const getDonationHistory = async (
  donorId: string,
  limitCount: number = 20
): Promise<Donation[]> => {
  try {
    const q = query(
      collection(db, 'donations'),
      where('donorId', '==', donorId),
      orderBy('donationDate', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return extractQueryData<Donation>(snapshot, ['donationDate', 'createdAt', 'updatedAt']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch donation history');
  }
};

/**
 * Get upcoming scheduled donations
 * @param donorId - Donor user ID
 * @returns Array of scheduled donations
 */
export const getUpcomingDonations = async (donorId: string): Promise<Donation[]> => {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'donations'),
      where('donorId', '==', donorId),
      where('status', '==', 'scheduled'),
      where('donationDate', '>=', now),
      orderBy('donationDate', 'asc')
    );

    const snapshot = await getDocs(q);
    return extractQueryData<Donation>(snapshot, ['donationDate', 'createdAt', 'updatedAt']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch upcoming donations');
  }
};

/**
 * Get donation statistics for a donor
 * @param donorId - Donor user ID
 * @returns Donation statistics
 */
export const getDonationStats = async (donorId: string) => {
  try {
    const allDonations = await getDonationHistory(donorId, 1000);

    const completed = allDonations.filter(d => d.status === 'completed');
    const scheduled = allDonations.filter(d => d.status === 'scheduled');
    const cancelled = allDonations.filter(d => d.status === 'cancelled');

    // Calculate total units donated
    const totalUnits = completed.reduce((sum, d) => sum + (d.units || 0), 0);

    // Get last donation date
    const lastDonation = completed.length > 0 ? completed[0].donationDate : null;

    // Calculate donation frequency (donations per year)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
    const donationsLastYear = completed.filter(d => {
      const donationDate = d.donationDate instanceof Date
        ? d.donationDate
        : d.donationDate.toDate();
      return donationDate >= oneYearAgo;
    });

    return {
      totalDonations: completed.length,
      totalUnits,
      scheduledDonations: scheduled.length,
      cancelledDonations: cancelled.length,
      lastDonation,
      donationsLastYear: donationsLastYear.length,
      donationsByBloodType: completed.reduce((acc, d) => {
        acc[d.bloodType] = (acc[d.bloodType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
    };
  } catch (error) {
    throw new DatabaseError('Failed to calculate donation statistics');
  }
};

// ============================================================================
// BLOOD REQUEST NOTIFICATIONS
// ============================================================================

/**
 * Get nearby active blood requests for a donor
 * @param donorId - Donor user ID
 * @param maxDistance - Maximum distance in km (not implemented yet)
 * @returns Array of blood requests
 */
export const getNearbyBloodRequests = async (
  donorId: string,
  _maxDistance: number = 50
): Promise<BloodRequest[]> => {
  try {
    // Get donor details
    const donorDoc = await getDoc(doc(db, 'users', donorId));
    if (!donorDoc.exists()) {
      throw new NotFoundError('Donor not found');
    }

    const donor = { ...donorDoc.data(), id: donorDoc.id } as User;

    if (!donor.bloodType) {
      return [];
    }

    // Get active requests matching donor's blood type
    const q = query(
      collection(db, 'bloodRequests'),
      where('status', '==', 'active'),
      where('bloodType', '==', donor.bloodType),
      orderBy('requestedAt', 'desc'),
      limit(20)
    );

    const snapshot = await getDocs(q);
    const requests = extractQueryData<BloodRequest>(snapshot, [
      'requestedAt',
      'neededBy',
      'expiresAt',
      'fulfilledAt',
      'createdAt',
      'updatedAt',
    ]);

    // TODO: Filter by distance using geolocation
    // For now, return all matching requests
    return requests;
  } catch (error) {
    throw new DatabaseError('Failed to fetch blood requests');
  }
};

/**
 * Get emergency blood requests
 * @param donorId - Donor user ID
 * @returns Array of emergency blood requests
 */
export const getEmergencyBloodRequests = async (donorId: string): Promise<BloodRequest[]> => {
  try {
    const donorDoc = await getDoc(doc(db, 'users', donorId));
    if (!donorDoc.exists()) {
      throw new NotFoundError('Donor not found');
    }

    const donor = { ...donorDoc.data(), id: donorDoc.id } as User;

    if (!donor.bloodType) {
      return [];
    }

    const q = query(
      collection(db, 'bloodRequests'),
      where('status', '==', 'active'),
      where('bloodType', '==', donor.bloodType),
      where('isEmergency', '==', true),
      orderBy('requestedAt', 'desc'),
      limit(10)
    );

    const snapshot = await getDocs(q);
    return extractQueryData<BloodRequest>(snapshot, [
      'requestedAt',
      'neededBy',
      'expiresAt',
      'fulfilledAt',
      'createdAt',
      'updatedAt',
    ]);
  } catch (error) {
    throw new DatabaseError('Failed to fetch emergency blood requests');
  }
};

/**
 * Respond to a blood request
 * @param donorId - Donor user ID
 * @param requestId - Blood request ID
 * @returns Updated blood request
 */
export const respondToBloodRequest = async (
  donorId: string,
  requestId: string
): Promise<void> => {
  try {
    // Check if donor is eligible
    const donorDoc = await getDoc(doc(db, 'users', donorId));
    if (!donorDoc.exists()) {
      throw new NotFoundError('Donor not found');
    }

    const donor = { ...donorDoc.data(), id: donorDoc.id } as User;

    if (!isEligibleToDonate(donor)) {
      throw new ValidationError('You are not eligible to donate at this time');
    }

    // Get the blood request
    const requestDoc = await getDoc(doc(db, 'bloodRequests', requestId));
    if (!requestDoc.exists()) {
      throw new NotFoundError('Blood request not found');
    }

    const request = { ...requestDoc.data(), id: requestDoc.id } as BloodRequest;

    // Check if donor already responded
    if (request.respondedDonors?.includes(donorId)) {
      throw new ValidationError('You have already responded to this request');
    }

    // Update blood request
    const respondedDonors = [...(request.respondedDonors || []), donorId];
    await updateDoc(doc(db, 'bloodRequests', requestId), {
      respondedDonors,
      updatedAt: getServerTimestamp(),
    });

    // Create notification for requester
    await addDoc(collection(db, 'notifications'), {
      userId: request.requesterId,
      userRole: request.requesterType === 'hospital' ? 'hospital' : 'donor',
      type: 'donation_confirmation',
      title: 'Donor Responded to Your Request',
      message: `A donor has responded to your blood request for ${request.bloodType}`,
      read: false,
      priority: 'high',
      relatedId: requestId,
      relatedType: 'blood_request',
      createdAt: getServerTimestamp(),
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to respond to blood request');
  }
};

// ============================================================================
// APPOINTMENT SCHEDULING
// ============================================================================

/**
 * Get upcoming appointments for a donor
 * @param donorId - Donor user ID
 * @returns Array of appointments
 */
export const getUpcomingAppointments = async (donorId: string): Promise<Appointment[]> => {
  try {
    const now = Timestamp.now();
    const q = query(
      collection(db, 'appointments'),
      where('donorId', '==', donorId),
      where('scheduledDate', '>=', now),
      where('status', 'in', ['scheduled', 'confirmed']),
      orderBy('scheduledDate', 'asc'),
      limit(10)
    );

    const snapshot = await getDocs(q);
    return extractQueryData<Appointment>(snapshot, [
      'scheduledDate',
      'reminderSentAt',
      'completedAt',
      'createdAt',
      'updatedAt',
    ]);
  } catch (error) {
    throw new DatabaseError('Failed to fetch appointments');
  }
};

/**
 * Get appointment history for a donor
 * @param donorId - Donor user ID
 * @param limitCount - Number of appointments to fetch
 * @returns Array of appointments
 */
export const getAppointmentHistory = async (
  donorId: string,
  limitCount: number = 20
): Promise<Appointment[]> => {
  try {
    const q = query(
      collection(db, 'appointments'),
      where('donorId', '==', donorId),
      orderBy('scheduledDate', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return extractQueryData<Appointment>(snapshot, [
      'scheduledDate',
      'reminderSentAt',
      'completedAt',
      'createdAt',
      'updatedAt',
    ]);
  } catch (error) {
    throw new DatabaseError('Failed to fetch appointment history');
  }
};

/**
 * Schedule a new appointment
 * @param appointment - Appointment data
 * @returns Created appointment ID
 */
export const scheduleAppointment = async (
  appointment: Omit<Appointment, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Validate donor eligibility
    const donorDoc = await getDoc(doc(db, 'users', appointment.donorId));
    if (!donorDoc.exists()) {
      throw new NotFoundError('Donor not found');
    }

    const donor = { ...donorDoc.data(), id: donorDoc.id } as User;

    if (!isEligibleToDonate(donor)) {
      throw new ValidationError('You are not eligible to donate at this time');
    }

    // Check if appointment time is in the future
    const scheduledDateTime = appointment.scheduledDate instanceof Date
      ? appointment.scheduledDate
      : appointment.scheduledDate.toDate();

    if (scheduledDateTime <= new Date()) {
      throw new ValidationError('Appointment must be scheduled in the future');
    }

    // Create appointment
    const docRef = await addDoc(collection(db, 'appointments'), {
      ...appointment,
      status: 'scheduled',
      reminderSent: false,
      createdAt: getServerTimestamp(),
      updatedAt: getServerTimestamp(),
    });

    // Create notification for donor
    await addDoc(collection(db, 'notifications'), {
      userId: appointment.donorId,
      userRole: 'donor',
      type: 'appointment_reminder',
      title: 'Appointment Scheduled',
      message: `Your donation appointment at ${appointment.hospitalName} has been scheduled for ${appointment.scheduledTime}`,
      read: false,
      priority: 'medium',
      relatedId: docRef.id,
      relatedType: 'appointment',
      createdAt: getServerTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to schedule appointment');
  }
};

/**
 * Cancel an appointment
 * @param appointmentId - Appointment ID
 * @param donorId - Donor user ID
 * @param reason - Cancellation reason
 */
export const cancelAppointment = async (
  appointmentId: string,
  donorId: string,
  reason?: string
): Promise<void> => {
  try {
    // Get appointment
    const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
    if (!appointmentDoc.exists()) {
      throw new NotFoundError('Appointment not found');
    }

    const appointment = { ...appointmentDoc.data(), id: appointmentDoc.id } as Appointment;

    // Verify ownership
    if (appointment.donorId !== donorId) {
      throw new ValidationError('You can only cancel your own appointments');
    }

    // Check if appointment can be cancelled
    if (appointment.status === 'completed') {
      throw new ValidationError('Cannot cancel a completed appointment');
    }

    if (appointment.status === 'cancelled') {
      throw new ValidationError('Appointment is already cancelled');
    }

    // Update appointment
    await updateDoc(doc(db, 'appointments', appointmentId), {
      status: 'cancelled',
      cancellationReason: reason,
      updatedAt: getServerTimestamp(),
    });

    // Create notification for hospital
    await addDoc(collection(db, 'notifications'), {
      userId: appointment.hospitalId,
      userRole: 'hospital',
      type: 'general',
      title: 'Appointment Cancelled',
      message: `${appointment.donorName} has cancelled their appointment scheduled for ${appointment.scheduledTime}`,
      read: false,
      priority: 'medium',
      relatedId: appointmentId,
      relatedType: 'appointment',
      createdAt: getServerTimestamp(),
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to cancel appointment');
  }
};

/**
 * Reschedule an appointment
 * @param appointmentId - Appointment ID
 * @param donorId - Donor user ID
 * @param newDate - New scheduled date
 * @param newTime - New scheduled time
 */
export const rescheduleAppointment = async (
  appointmentId: string,
  donorId: string,
  newDate: Timestamp,
  newTime: string
): Promise<void> => {
  try {
    // Get appointment
    const appointmentDoc = await getDoc(doc(db, 'appointments', appointmentId));
    if (!appointmentDoc.exists()) {
      throw new NotFoundError('Appointment not found');
    }

    const appointment = { ...appointmentDoc.data(), id: appointmentDoc.id } as Appointment;

    // Verify ownership
    if (appointment.donorId !== donorId) {
      throw new ValidationError('You can only reschedule your own appointments');
    }

    // Check if appointment can be rescheduled
    if (appointment.status === 'completed') {
      throw new ValidationError('Cannot reschedule a completed appointment');
    }

    if (appointment.status === 'cancelled') {
      throw new ValidationError('Cannot reschedule a cancelled appointment');
    }

    // Validate new date is in the future
    const newDateTime = newDate instanceof Date ? newDate : newDate.toDate();
    if (newDateTime <= new Date()) {
      throw new ValidationError('New appointment time must be in the future');
    }

    // Update appointment
    await updateDoc(doc(db, 'appointments', appointmentId), {
      scheduledDate: newDate,
      scheduledTime: newTime,
      reminderSent: false,
      updatedAt: getServerTimestamp(),
    });

    // Create notification for hospital
    await addDoc(collection(db, 'notifications'), {
      userId: appointment.hospitalId,
      userRole: 'hospital',
      type: 'general',
      title: 'Appointment Rescheduled',
      message: `${appointment.donorName} has rescheduled their appointment to ${newTime}`,
      read: false,
      priority: 'medium',
      relatedId: appointmentId,
      relatedType: 'appointment',
      createdAt: getServerTimestamp(),
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to reschedule appointment');
  }
};

// ============================================================================
// DONOR NOTIFICATIONS
// ============================================================================

/**
 * Get notifications for a donor
 * @param donorId - Donor user ID
 * @param limitCount - Number of notifications to fetch
 * @returns Array of notifications
 */
export const getDonorNotifications = async (
  donorId: string,
  limitCount: number = 20
): Promise<Notification[]> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', donorId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return extractQueryData<Notification>(snapshot, ['createdAt', 'readAt', 'expiresAt']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch notifications');
  }
};

/**
 * Mark notification as read
 * @param notificationId - Notification ID
 */
export const markNotificationAsRead = async (notificationId: string): Promise<void> => {
  try {
    await updateDoc(doc(db, 'notifications', notificationId), {
      read: true,
      readAt: getServerTimestamp(),
    });
  } catch (error) {
    throw new DatabaseError('Failed to mark notification as read');
  }
};

/**
 * Mark all notifications as read for a donor
 * @param donorId - Donor user ID
 */
export const markAllNotificationsAsRead = async (donorId: string): Promise<void> => {
  try {
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', donorId),
      where('read', '==', false)
    );

    const snapshot = await getDocs(q);
    const updatePromises = snapshot.docs.map(doc =>
      updateDoc(doc.ref, {
        read: true,
        readAt: getServerTimestamp(),
      })
    );

    await Promise.all(updatePromises);
  } catch (error) {
    throw new DatabaseError('Failed to mark all notifications as read');
  }
};
