import { COLLECTIONS } from '../constants/firestore';
/**
 * BloodBank Service
 *
 * Service layer for blood bank-specific operations including:
 * - Blood inventory management
 * - Emergency blood requests
 * - Appointment management
 * - Donation verification
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
  setDoc,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  BloodInventory,
  BloodRequest,
  Appointment,
  Donation,
  User,
} from '../types/database.types';
import { extractQueryData, getServerTimestamp } from '../utils/firestore.utils';
import { DatabaseError, ValidationError, NotFoundError } from '../utils/errorHandler';
import { captureHandledError } from './errorLog.service';

const reportBloodBankServiceError = (error: unknown, kind: string, metadata?: Record<string, unknown>) => {
  void captureHandledError(error, {
    source: 'frontend',
    scope: 'bloodbank',
    metadata: {
      kind,
      service: 'bloodbank.service',
      ...(metadata || {}),
    },
  });
};

// ============================================================================
// BLOOD INVENTORY MANAGEMENT
// ============================================================================

/**
 * Get blood inventory for a hospital
 * @param hospitalId - Hospital user ID
 * @returns Array of blood inventory items
 */
export const getBloodBankInventory = async (hospitalId: string): Promise<BloodInventory[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.BLOOD_INVENTORY),
      where('hospitalId', '==', hospitalId)
    );

    const snapshot = await getDocs(q);
    return extractQueryData<BloodInventory>(snapshot, ['lastRestocked', 'updatedAt']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch blood inventory');
  }
};

/**
 * Get inventory for a specific blood type
 * @param hospitalId - Hospital user ID
 * @param bloodType - Blood type
 * @returns Blood inventory item or null
 */
export const getBloodBankInventoryByType = async (
  hospitalId: string,
  bloodType: string
): Promise<BloodInventory | null> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.BLOOD_INVENTORY),
      where('hospitalId', '==', hospitalId),
      where('bloodType', '==', bloodType),
      limit(1)
    );

    const snapshot = await getDocs(q);
    const items = extractQueryData<BloodInventory>(snapshot, ['lastRestocked', 'updatedAt']);
    return items.length > 0 ? items[0] : null;
  } catch (error) {
    throw new DatabaseError('Failed to fetch inventory for blood type');
  }
};

/**
 * Update blood inventory
 * @param inventoryId - Inventory document ID
 * @param units - New unit count
 * @returns void
 */
export const updateBloodBankInventory = async (
  inventoryId: string,
  units: number
): Promise<void> => {
  try {
    if (units < 0) {
      throw new ValidationError('Units cannot be negative');
    }

    const inventoryDoc = await getDoc(doc(db, COLLECTIONS.BLOOD_INVENTORY, inventoryId));
    if (!inventoryDoc.exists()) {
      throw new NotFoundError('Inventory item not found');
    }

    const inventory = { ...inventoryDoc.data(), id: inventoryDoc.id } as BloodInventory;

    // Determine status based on units
    let status: 'adequate' | 'low' | 'critical' | 'surplus' = 'adequate';
    if (units === 0) {
      status = 'critical';
    } else if (units <= inventory.criticalLevel) {
      status = 'critical';
    } else if (units <= inventory.lowLevel) {
      status = 'low';
    } else if (units > inventory.lowLevel * 3) {
      status = 'surplus';
    }

    await updateDoc(doc(db, COLLECTIONS.BLOOD_INVENTORY, inventoryId), {
      units,
      status,
      updatedAt: getServerTimestamp(),
    });
  } catch (error) {
    if (error instanceof ValidationError || error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to update inventory');
  }
};

/**
 * Add blood batch to inventory
 * @param inventoryId - Inventory document ID
 * @param batch - Batch details
 */
export const addBloodBankBatch = async (
  inventoryId: string,
  batch: {
    batchId: string;
    units: number;
    collectionDate: Timestamp;
    expiryDate: Timestamp;
  }
): Promise<void> => {
  try {
    const inventoryDoc = await getDoc(doc(db, COLLECTIONS.BLOOD_INVENTORY, inventoryId));
    if (!inventoryDoc.exists()) {
      throw new NotFoundError('Inventory item not found');
    }

    const inventory = { ...inventoryDoc.data(), id: inventoryDoc.id } as BloodInventory;

    const newBatch = {
      ...batch,
      status: 'available' as const,
    };

    const batches = [...(inventory.batches || []), newBatch];
    const newUnits = inventory.units + batch.units;

    // Update status
    let status: 'adequate' | 'low' | 'critical' | 'surplus' = 'adequate';
    if (newUnits <= inventory.criticalLevel) {
      status = 'critical';
    } else if (newUnits <= inventory.lowLevel) {
      status = 'low';
    } else if (newUnits > inventory.lowLevel * 3) {
      status = 'surplus';
    }

    await updateDoc(doc(db, COLLECTIONS.BLOOD_INVENTORY, inventoryId), {
      batches,
      units: newUnits,
      status,
      lastRestocked: getServerTimestamp(),
      updatedAt: getServerTimestamp(),
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to add blood batch');
  }
};

/**
 * Remove expired batches from inventory
 * @param inventoryId - Inventory document ID
 */
export const removeBloodBankExpiredBatches = async (inventoryId: string): Promise<void> => {
  try {
    const inventoryDoc = await getDoc(doc(db, COLLECTIONS.BLOOD_INVENTORY, inventoryId));
    if (!inventoryDoc.exists()) {
      throw new NotFoundError('Inventory item not found');
    }

    const inventory = { ...inventoryDoc.data(), id: inventoryDoc.id } as BloodInventory;
    const now = Timestamp.now();

    // Filter out expired batches and calculate removed units
    const activeBatches = inventory.batches.filter(batch => {
      const expiryDate = batch.expiryDate instanceof Date
        ? Timestamp.fromDate(batch.expiryDate)
        : batch.expiryDate;
      return expiryDate.toMillis() > now.toMillis();
    });

    const removedUnits = inventory.batches
      .filter(batch => {
        const expiryDate = batch.expiryDate instanceof Date
          ? Timestamp.fromDate(batch.expiryDate)
          : batch.expiryDate;
        return expiryDate.toMillis() <= now.toMillis();
      })
      .reduce((sum, batch) => sum + batch.units, 0);

    const newUnits = inventory.units - removedUnits;

    // Update status
    let status: 'adequate' | 'low' | 'critical' | 'surplus' = 'adequate';
    if (newUnits === 0) {
      status = 'critical';
    } else if (newUnits <= inventory.criticalLevel) {
      status = 'critical';
    } else if (newUnits <= inventory.lowLevel) {
      status = 'low';
    } else if (newUnits > inventory.lowLevel * 3) {
      status = 'surplus';
    }

    await updateDoc(doc(db, COLLECTIONS.BLOOD_INVENTORY, inventoryId), {
      batches: activeBatches,
      units: Math.max(0, newUnits),
      status,
      updatedAt: getServerTimestamp(),
    });
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to remove expired batches');
  }
};

/**
 * Get low stock inventory items for a hospital
 * @param hospitalId - Hospital user ID
 * @returns Array of low stock inventory items
 */
export const getBloodBankLowStockInventory = async (hospitalId: string): Promise<BloodInventory[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.BLOOD_INVENTORY),
      where('hospitalId', '==', hospitalId),
      where('status', 'in', ['low', 'critical'])
    );

    const snapshot = await getDocs(q);
    return extractQueryData<BloodInventory>(snapshot, ['lastRestocked', 'updatedAt']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch low stock inventory');
  }
};

// ============================================================================
// BLOOD REQUESTS
// ============================================================================

/**
 * Create a new blood request
 * @param request - Blood request data
 * @returns Created request ID
 */
export const createBloodBankRequest = async (
  request: Omit<BloodRequest, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Validate required fields
    if (!request.bloodType || !request.units || request.units <= 0) {
      throw new ValidationError('Invalid blood request data');
    }

    // Validate dates
    const neededBy = request.neededBy instanceof Date
      ? request.neededBy
      : request.neededBy.toDate();

    if (neededBy <= new Date()) {
      throw new ValidationError('Needed by date must be in the future');
    }

    const docRef = await addDoc(collection(db, COLLECTIONS.BLOOD_REQUESTS), {
      ...request,
      status: 'active',
      unitsReceived: 0,
      respondedDonors: [],
      confirmedDonors: [],
      createdAt: getServerTimestamp(),
      updatedAt: getServerTimestamp(),
    });

    // If emergency, create notifications for matching donors
    if (request.isEmergency) {
      await notifyMatchingDonors(docRef.id, request.bloodType, request.location.city);
    }

    return docRef.id;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to create blood request');
  }
};

/**
 * Helper function to notify matching donors
 */
const notifyMatchingDonors = async (
  requestId: string,
  bloodType: string,
  city: string
): Promise<void> => {
  try {
    // Find matching donors
    const q = query(
      collection(db, COLLECTIONS.USERS),
      where('role', '==', 'donor'),
      where('bloodType', '==', bloodType),
      where('city', '==', city),
      where('isAvailable', '==', true),
      limit(50)
    );

    const snapshot = await getDocs(q);
    const donors = extractQueryData<User>(snapshot, ['createdAt', 'lastLoginAt', 'lastDonation', 'dateOfBirth']);

    // Create notifications for each donor
    const notificationPromises = donors.map(donor =>
      addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        userId: donor.uid,
        userRole: 'donor',
        type: 'emergency_request',
        title: 'Emergency Blood Request',
        message: `Urgent: ${bloodType} blood needed in ${city}`,
        read: false,
        priority: 'high',
        relatedId: requestId,
        relatedType: 'blood_request',
        createdAt: getServerTimestamp(),
      })
    );

    await Promise.all(notificationPromises);
  } catch (error) {
    // Log error but don't fail the request creation
    reportBloodBankServiceError(error, 'bloodbank.request.notify_donors', { requestId, bloodType, city });
  }
};

/**
 * Get active blood requests for a hospital
 * @param hospitalId - Hospital user ID
 * @returns Array of active blood requests
 */
export const getBloodBankRequests = async (hospitalId: string): Promise<BloodRequest[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.BLOOD_REQUESTS),
      where('requesterId', '==', hospitalId),
      orderBy('requestedAt', 'desc'),
      limit(50)
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
    throw new DatabaseError('Failed to fetch blood requests');
  }
};

/**
 * Update blood request status
 * @param requestId - Blood request ID
 * @param status - New status
 * @param unitsReceived - Units received (optional)
 */
export const updateBloodBankRequestStatus = async (
  requestId: string,
  status: 'active' | 'fulfilled' | 'partially_fulfilled' | 'expired' | 'cancelled',
  unitsReceived?: number
): Promise<void> => {
  try {
    const updateData: any = {
      status,
      updatedAt: getServerTimestamp(),
    };

    if (unitsReceived !== undefined) {
      updateData.unitsReceived = unitsReceived;
    }

    if (status === 'fulfilled') {
      updateData.fulfilledAt = getServerTimestamp();
    }

    await updateDoc(doc(db, COLLECTIONS.BLOOD_REQUESTS, requestId), updateData);
  } catch (error) {
    throw new DatabaseError('Failed to update blood request status');
  }
};

/**
 * Confirm donor for blood request
 * @param requestId - Blood request ID
 * @param donorId - Donor user ID
 */
export const confirmDonorForBloodBankRequest = async (
  requestId: string,
  donorId: string
): Promise<void> => {
  try {
    const requestDoc = await getDoc(doc(db, COLLECTIONS.BLOOD_REQUESTS, requestId));
    if (!requestDoc.exists()) {
      throw new NotFoundError('Blood request not found');
    }

    const request = { ...requestDoc.data(), id: requestDoc.id } as BloodRequest;

    // Add donor to confirmed list if not already there
    if (!request.confirmedDonors?.includes(donorId)) {
      const confirmedDonors = [...(request.confirmedDonors || []), donorId];
      await updateDoc(doc(db, COLLECTIONS.BLOOD_REQUESTS, requestId), {
        confirmedDonors,
        updatedAt: getServerTimestamp(),
      });

      // Create notification for donor
      await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
        userId: donorId,
        userRole: 'donor',
        type: 'donation_confirmation',
        title: 'Donation Confirmed',
        message: `Your donation for ${request.bloodType} blood has been confirmed`,
        read: false,
        priority: 'high',
        relatedId: requestId,
        relatedType: 'blood_request',
        createdAt: getServerTimestamp(),
      });
    }
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to confirm donor');
  }
};

// ============================================================================
// APPOINTMENT MANAGEMENT
// ============================================================================

/**
 * Get appointments for a hospital
 * @param hospitalId - Hospital user ID
 * @param status - Filter by status (optional)
 * @returns Array of appointments
 */
export const getBloodBankAppointments = async (
  hospitalId: string,
  status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'
): Promise<Appointment[]> => {
  try {
    let q;
    if (status) {
      q = query(
        collection(db, COLLECTIONS.APPOINTMENTS),
        where('hospitalId', '==', hospitalId),
        where('status', '==', status),
        orderBy('scheduledDate', 'desc'),
        limit(50)
      );
    } else {
      q = query(
        collection(db, COLLECTIONS.APPOINTMENTS),
        where('hospitalId', '==', hospitalId),
        orderBy('scheduledDate', 'desc'),
        limit(50)
      );
    }

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
 * Get today's appointments for a hospital
 * @param hospitalId - Hospital user ID
 * @returns Array of appointments
 */
export const getBloodBankTodayAppointments = async (hospitalId: string): Promise<Appointment[]> => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
      collection(db, COLLECTIONS.APPOINTMENTS),
      where('hospitalId', '==', hospitalId),
      where('scheduledDate', '>=', Timestamp.fromDate(today)),
      where('scheduledDate', '<', Timestamp.fromDate(tomorrow)),
      where('status', 'in', ['scheduled', 'confirmed']),
      orderBy('scheduledDate', 'asc')
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
    throw new DatabaseError('Failed to fetch today\'s appointments');
  }
};

/**
 * Update appointment status
 * @param appointmentId - Appointment ID
 * @param status - New status
 */
export const updateBloodBankAppointmentStatus = async (
  appointmentId: string,
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show'
): Promise<void> => {
  try {
    const updateData: any = {
      status,
      updatedAt: getServerTimestamp(),
    };

    if (status === 'completed') {
      updateData.completedAt = getServerTimestamp();
    }

    await updateDoc(doc(db, COLLECTIONS.APPOINTMENTS, appointmentId), updateData);
  } catch (error) {
    throw new DatabaseError('Failed to update appointment status');
  }
};

// ============================================================================
// DONATION VERIFICATION
// ============================================================================

/**
 * Record a completed donation
 * @param donation - Donation data
 * @returns Created donation ID
 */
export const recordBloodBankDonation = async (
  donation: Omit<Donation, 'id' | 'createdAt' | 'updatedAt'>
): Promise<string> => {
  try {
    // Validate donation data
    if (!donation.donorId || !donation.hospitalId || !donation.bloodType) {
      throw new ValidationError('Invalid donation data');
    }

    if (donation.units <= 0) {
      throw new ValidationError('Units must be greater than 0');
    }

    // Create donation record
    const docRef = await addDoc(collection(db, COLLECTIONS.DONATIONS), {
      ...donation,
      createdAt: getServerTimestamp(),
      updatedAt: getServerTimestamp(),
    });

    // Update donor's last donation and total donations
    const donorRef = doc(db, COLLECTIONS.USERS, donation.donorId);
    const donorDoc = await getDoc(donorRef);

    if (donorDoc.exists()) {
      const donor = { ...donorDoc.data(), id: donorDoc.id } as User;
      await updateDoc(donorRef, {
        lastDonation: donation.donationDate,
        totalDonations: (donor.totalDonations || 0) + 1,
        updatedAt: getServerTimestamp(),
      });
    }

    const historyRef = doc(db, COLLECTIONS.DONATION_HISTORY, donation.donorId);
    const historySnapshot = await getDoc(historyRef);
    const existingHistory = historySnapshot.exists() && Array.isArray(historySnapshot.data().donations)
      ? historySnapshot.data().donations
      : [];
    const entryId = docRef.id;
    const alreadyExists = existingHistory.some((entry: any) => {
      const existingId = entry?.id || entry?.legacyId;
      return existingId === entryId;
    });

    const parseHistoryDate = (value: any) => {
      if (!value) return 0;
      if (value instanceof Date) return value.getTime();
      if (typeof value?.toDate === 'function') return value.toDate().getTime();
      if (typeof value?.seconds === 'number') return value.seconds * 1000;
      return 0;
    };

    const nextHistory = [...existingHistory];
    if (!alreadyExists) {
      const locationLabel = donation.location?.city || '';
      const unitsValue = donation.units || 1;
      nextHistory.push({
        id: entryId,
        legacyId: entryId,
        date: donation.donationDate,
        location: locationLabel,
        bloodBank: donation.hospitalName || '',
        hospitalId: donation.hospitalId || '',
        hospitalName: donation.hospitalName || '',
        quantity: `${unitsValue} unit${unitsValue === 1 ? '' : 's'}`,
        status: donation.status || 'completed',
        units: unitsValue,
        notes: donation.notes || '',
        source: 'verified',
        createdAt: getServerTimestamp(),
      });
    }

    const sortedHistory = nextHistory
      .sort((a: any, b: any) => parseHistoryDate(b?.date ?? b?.donationDate) - parseHistoryDate(a?.date ?? a?.donationDate))
      .slice(0, 50);

    await setDoc(
      historyRef,
      {
        userId: donation.donorId,
        lastDonationDate: donation.donationDate,
        donations: sortedHistory,
        updatedAt: getServerTimestamp(),
      },
      { merge: true }
    );

    // If linked to an appointment, update it
    if (donation.requestId) {
      const appointmentQuery = query(
        collection(db, COLLECTIONS.APPOINTMENTS),
        where('relatedId', '==', donation.requestId),
        where('donorId', '==', donation.donorId),
        limit(1)
      );

      const appointmentSnapshot = await getDocs(appointmentQuery);
      if (!appointmentSnapshot.empty) {
        const appointmentDoc = appointmentSnapshot.docs[0];
        await updateDoc(appointmentDoc.ref, {
          status: 'completed',
          donationId: docRef.id,
          completedAt: getServerTimestamp(),
          updatedAt: getServerTimestamp(),
        });
      }
    }

    // Create notification for donor
    await addDoc(collection(db, COLLECTIONS.NOTIFICATIONS), {
      userId: donation.donorId,
      userRole: 'donor',
      type: 'donation_confirmation',
      title: 'Donation Recorded',
      message: `Thank you for your donation at ${donation.hospitalName}!`,
      read: false,
      priority: 'medium',
      relatedId: docRef.id,
      relatedType: 'donation',
      createdAt: getServerTimestamp(),
    });

    return docRef.id;
  } catch (error) {
    if (error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to record donation');
  }
};

/**
 * Get donations for a hospital
 * @param hospitalId - Hospital user ID
 * @param limitCount - Number of donations to fetch
 * @returns Array of donations
 */
export const getBloodBankDonations = async (
  hospitalId: string,
  limitCount: number = 50
): Promise<Donation[]> => {
  try {
    const q = query(
      collection(db, COLLECTIONS.DONATIONS),
      where('hospitalId', '==', hospitalId),
      orderBy('donationDate', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return extractQueryData<Donation>(snapshot, ['donationDate', 'createdAt', 'updatedAt']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch donations');
  }
};

/**
 * Get donation statistics for a blood bank
 * @param hospitalId - BloodBank user ID
 * @returns Donation statistics
 */
export const getBloodBankDonationStats = async (hospitalId: string) => {
  try {
    const donations = await getBloodBankDonations(hospitalId, 1000);

    const completed = donations.filter(d => d.status === 'completed');
    const totalUnits = completed.reduce((sum, d) => sum + (d.units || 0), 0);

    // Get donations by blood type
    const donationsByBloodType = completed.reduce((acc, d) => {
      acc[d.bloodType] = (acc[d.bloodType] || 0) + d.units;
      return acc;
    }, {} as Record<string, number>);

    // Get donations this month
    const now = new Date();
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const donationsThisMonth = completed.filter(d => {
      const donationDate = d.donationDate instanceof Date
        ? d.donationDate
        : d.donationDate.toDate();
      return donationDate >= firstDayOfMonth;
    });

    return {
      totalDonations: completed.length,
      totalUnits,
      donationsThisMonth: donationsThisMonth.length,
      unitsThisMonth: donationsThisMonth.reduce((sum, d) => sum + d.units, 0),
      donationsByBloodType,
    };
  } catch (error) {
    throw new DatabaseError('Failed to calculate donation statistics');
  }
};

// Legacy exports (Hospital naming)
export const getBloodInventory = getBloodBankInventory;
export const getInventoryByBloodType = getBloodBankInventoryByType;
export const updateInventory = updateBloodBankInventory;
export const addBloodBatch = addBloodBankBatch;
export const removeExpiredBatches = removeBloodBankExpiredBatches;
export const getLowStockInventory = getBloodBankLowStockInventory;
export const createBloodRequest = createBloodBankRequest;
export const getHospitalBloodRequests = getBloodBankRequests;
export const updateBloodRequestStatus = updateBloodBankRequestStatus;
export const confirmDonorForRequest = confirmDonorForBloodBankRequest;
export const getHospitalAppointments = getBloodBankAppointments;
export const getTodayAppointments = getBloodBankTodayAppointments;
export const updateAppointmentStatus = updateBloodBankAppointmentStatus;
export const recordDonation = recordBloodBankDonation;
export const getHospitalDonations = getBloodBankDonations;
export const getHospitalDonationStats = getBloodBankDonationStats;
