/**
 * Admin Service
 *
 * Service layer for admin-specific operations including:
 * - User management
 * - Verification workflow
 * - Platform monitoring
 * - Analytics and reporting
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
  startAt,
  endAt,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  User,
  VerificationRequest,
  Analytics,
  Donation,
  BloodRequest,
  Campaign,
  BloodInventory,
} from '../types/database.types';
import { extractQueryData, getServerTimestamp } from '../utils/firestore.utils';
import { DatabaseError, ValidationError, NotFoundError, PermissionError } from '../utils/errorHandler';
import { logAuditEvent } from './audit.service';

export type ImpersonationUser = {
  uid: string;
  displayName: string;
  email: string | null;
  role: User['role'];
  bhId?: string | null;
  photoURL?: string | null;
  status?: User['status'];
};

const mapImpersonationUser = (docSnap: any): ImpersonationUser | null => {
  const data = docSnap.data?.() ?? docSnap.data ?? {};
  const role = data.role || 'donor';
  const status = data.status || 'active';
  if (role === 'superadmin' || status === 'deleted') {
    return null;
  }
  return {
    uid: data.uid || docSnap.id,
    displayName: data.displayName
      || data.name
      || data.organizationName
      || data.hospitalName
      || data.bloodBankName
      || data.contactPerson
      || 'User',
    email: data.email || null,
    role,
    bhId: data.bhId || null,
    photoURL: data.photoURL || null,
    status,
  };
};

export const searchUsersForImpersonation = async (rawQuery: string): Promise<ImpersonationUser[]> => {
  const queryText = rawQuery.trim();
  if (!queryText || queryText.length < 2) return [];

  const usersRef = collection(db, 'users');
  const results = new Map<string, ImpersonationUser>();

  const addSnapshot = (snapshot: any) => {
    snapshot.forEach((docSnap: any) => {
      const mapped = mapImpersonationUser(docSnap);
      if (mapped) {
        results.set(mapped.uid, mapped);
      }
    });
  };

  if (queryText.includes('@')) {
    const normalizedEmail = queryText.toLowerCase();
    const emailQueries = normalizedEmail !== queryText
      ? [queryText, normalizedEmail]
      : [queryText];
    for (const email of emailQueries) {
      const snapshot = await getDocs(
        query(usersRef, where('email', '==', email), limit(20))
      );
      addSnapshot(snapshot);
      if (results.size >= 20) break;
    }
    return Array.from(results.values());
  }

  if (queryText.toUpperCase().startsWith('BH')) {
    const normalizedBhId = queryText.toUpperCase();
    const snapshot = await getDocs(
      query(usersRef, where('bhId', '==', normalizedBhId), limit(20))
    );
    addSnapshot(snapshot);
    return Array.from(results.values());
  }

  const buildVariants = (value: string) => {
    const variants = new Set<string>();
    variants.add(value);
    const lower = value.toLowerCase();
    const upper = value.toUpperCase();
    if (lower !== value) variants.add(lower);
    if (upper !== value) variants.add(upper);
    const title = value.length > 0 ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
    if (title !== value) variants.add(title);
    return Array.from(variants);
  };

  const runPrefixSearch = async (field: string, prefixes: string[]) => {
    for (const prefix of prefixes) {
      try {
        const snapshot = await getDocs(
          query(
            usersRef,
            orderBy(field),
            startAt(prefix),
            endAt(`${prefix}\uf8ff`),
            limit(20)
          )
        );
        addSnapshot(snapshot);
      } catch (error) {
        console.warn(`Impersonation search failed for ${field}:`, error);
      }
      if (results.size >= 20) {
        return;
      }
    }
  };

  const variants = buildVariants(queryText);
  const fields = ['displayName', 'organizationName', 'hospitalName', 'bloodBankName', 'name'];
  for (const field of fields) {
    await runPrefixSearch(field, variants);
    if (results.size >= 20) break;
  }

  return Array.from(results.values());
};

// ============================================================================
// USER MANAGEMENT
// ============================================================================

/**
 * Get all users with pagination
 * @param role - Filter by role (optional)
 * @param status - Filter by status (optional)
 * @param limitCount - Number of users to fetch
 * @returns Array of users
 */
export const getAllUsers = async (
  role?: 'donor' | 'bloodbank' | 'hospital' | 'ngo' | 'admin',
  status?: 'active' | 'inactive' | 'suspended' | 'pending_verification',
  limitCount: number = 100
): Promise<User[]> => {
  try {
    let q;

    if (role && status) {
      q = query(
        collection(db, 'users'),
        where('role', '==', role),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    } else if (role) {
      q = query(
        collection(db, 'users'),
        where('role', '==', role),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    } else if (status) {
      q = query(
        collection(db, 'users'),
        where('status', '==', status),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    } else {
      q = query(
        collection(db, 'users'),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return extractQueryData<User>(snapshot, ['createdAt', 'lastLoginAt', 'lastDonation', 'dateOfBirth']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch users');
  }
};

/**
 * Get user by ID
 * @param userId - User ID
 * @returns User data
 */
export const getUserById = async (userId: string): Promise<User> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (!userDoc.exists()) {
      throw new NotFoundError('User not found');
    }

    const userData = userDoc.data();
    return {
      ...userData,
      id: userDoc.id,
      createdAt: userData.createdAt,
      lastLoginAt: userData.lastLoginAt,
      lastDonation: userData.lastDonation,
      dateOfBirth: userData.dateOfBirth,
    } as User;
  } catch (error) {
    if (error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to fetch user');
  }
};

/**
 * Update user status
 * @param userId - User ID
 * @param status - New status
 * @param adminId - Admin performing the action
 */
export const updateUserStatus = async (
  userId: string,
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification',
  adminId: string
): Promise<void> => {
  try {
    // Verify admin permissions
    const adminDoc = await getDoc(doc(db, 'users', adminId));
    if (!adminDoc.exists() || !['admin', 'superadmin'].includes(adminDoc.data().role)) {
      throw new PermissionError('Only admins can update user status');
    }
    const adminRole = adminDoc.data().role || 'admin';

    await updateDoc(doc(db, 'users', userId), {
      status,
      updatedAt: getServerTimestamp(),
    });

    // Create notification for user
    await addDoc(collection(db, 'notifications'), {
      userId,
      userRole: 'donor', // Will be updated based on actual user role
      type: 'verification_status',
      title: 'Account Status Updated',
      message: `Your account status has been changed to ${status}`,
      read: false,
      priority: 'high',
      createdAt: getServerTimestamp(),
    });

    await logAuditEvent({
      actorUid: adminId,
      actorRole: adminRole,
      action: 'admin_update_user_status',
      targetUid: userId,
      metadata: { status },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      throw error;
    }
    throw new DatabaseError('Failed to update user status');
  }
};

/**
 * Verify user account
 * @param userId - User ID
 * @param adminId - Admin performing the action
 */
export const verifyUserAccount = async (
  userId: string,
  adminId: string
): Promise<void> => {
  try {
    // Verify admin permissions
    const adminDoc = await getDoc(doc(db, 'users', adminId));
    if (!adminDoc.exists() || !['admin', 'superadmin'].includes(adminDoc.data().role)) {
      throw new PermissionError('Only admins can verify user accounts');
    }
    const adminRole = adminDoc.data().role || 'admin';

    await updateDoc(doc(db, 'users', userId), {
      verified: true,
      status: 'active',
      updatedAt: getServerTimestamp(),
    });

    // Create notification for user
    await addDoc(collection(db, 'notifications'), {
      userId,
      userRole: 'donor', // Will be updated based on actual user role
      type: 'verification_status',
      title: 'Account Verified',
      message: 'Your account has been successfully verified',
      read: false,
      priority: 'high',
      createdAt: getServerTimestamp(),
    });

    await logAuditEvent({
      actorUid: adminId,
      actorRole: adminRole,
      action: 'admin_verify_user',
      targetUid: userId,
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      throw error;
    }
    throw new DatabaseError('Failed to verify user account');
  }
};

/**
 * Delete user account
 * @param userId - User ID
 * @param adminId - Admin performing the action
 */
export const deleteUserAccount = async (
  userId: string,
  adminId: string
): Promise<void> => {
  try {
    // Verify admin permissions
    const adminDoc = await getDoc(doc(db, 'users', adminId));
    if (!adminDoc.exists() || !['admin', 'superadmin'].includes(adminDoc.data().role)) {
      throw new PermissionError('Only admins can delete user accounts');
    }
    const adminRole = adminDoc.data().role || 'admin';

    // Prevent deleting admin accounts
    const userDoc = await getDoc(doc(db, 'users', userId));
    if (userDoc.exists() && ['admin', 'superadmin'].includes(userDoc.data().role)) {
      throw new ValidationError('Cannot delete admin accounts');
    }

    // Instead of deleting, mark as inactive
    await updateDoc(doc(db, 'users', userId), {
      status: 'inactive',
      updatedAt: getServerTimestamp(),
    });

    await logAuditEvent({
      actorUid: adminId,
      actorRole: adminRole,
      action: 'admin_delete_user',
      targetUid: userId,
      metadata: { status: 'inactive' },
    });
  } catch (error) {
    if (error instanceof PermissionError || error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to delete user account');
  }
};

/**
 * Search users by name or email
 * @param searchTerm - Search term
 * @param limitCount - Number of results
 * @returns Array of users
 */
export const searchUsers = async (
  searchTerm: string,
  limitCount: number = 20
): Promise<User[]> => {
  try {
    // Note: This is a simple implementation. For production, use Algolia or similar
    const q = query(
      collection(db, 'users'),
      orderBy('displayName'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    const allUsers = extractQueryData<User>(snapshot, ['createdAt', 'lastLoginAt', 'lastDonation', 'dateOfBirth']);

    // Filter by search term (case-insensitive)
    const searchLower = searchTerm.toLowerCase();
    return allUsers.filter(user =>
      user.displayName?.toLowerCase().includes(searchLower) ||
      user.email?.toLowerCase().includes(searchLower) ||
      user.phoneNumber?.includes(searchTerm)
    );
  } catch (error) {
    throw new DatabaseError('Failed to search users');
  }
};

// ============================================================================
// VERIFICATION WORKFLOW
// ============================================================================

/**
 * Get all verification requests
 * @param status - Filter by status (optional)
 * @param limitCount - Number of requests to fetch
 * @returns Array of verification requests
 */
export const getVerificationRequests = async (
  status?: 'pending' | 'under_review' | 'approved' | 'rejected',
  limitCount: number = 50
): Promise<VerificationRequest[]> => {
  try {
    let q;

    if (status) {
      q = query(
        collection(db, 'verificationRequests'),
        where('status', '==', status),
        orderBy('submittedAt', 'desc'),
        limit(limitCount)
      );
    } else {
      q = query(
        collection(db, 'verificationRequests'),
        orderBy('submittedAt', 'desc'),
        limit(limitCount)
      );
    }

    const snapshot = await getDocs(q);
    return extractQueryData<VerificationRequest>(snapshot, [
      'submittedAt',
      'updatedAt',
      'reviewedAt',
    ]);
  } catch (error) {
    throw new DatabaseError('Failed to fetch verification requests');
  }
};

/**
 * Approve verification request
 * @param requestId - Verification request ID
 * @param adminId - Admin performing the action
 * @param reviewNotes - Optional review notes
 */
export const approveVerificationRequest = async (
  requestId: string,
  adminId: string,
  reviewNotes?: string
): Promise<void> => {
  try {
    // Verify admin permissions
    const adminDoc = await getDoc(doc(db, 'users', adminId));
    if (!adminDoc.exists() || !['admin', 'superadmin'].includes(adminDoc.data().role)) {
      throw new PermissionError('Only admins can approve verification requests');
    }
    const adminRole = adminDoc.data().role || 'admin';

    const requestDoc = await getDoc(doc(db, 'verificationRequests', requestId));
    if (!requestDoc.exists()) {
      throw new NotFoundError('Verification request not found');
    }

    const request = { ...requestDoc.data(), id: requestDoc.id } as VerificationRequest;

    // Update verification request
    await updateDoc(doc(db, 'verificationRequests', requestId), {
      status: 'approved',
      reviewedBy: adminId,
      reviewedAt: getServerTimestamp(),
      reviewNotes,
      updatedAt: getServerTimestamp(),
    });

    // Update user account
    await updateDoc(doc(db, 'users', request.userId), {
      verified: true,
      status: 'active',
      updatedAt: getServerTimestamp(),
    });

    // Create notification for user
    await addDoc(collection(db, 'notifications'), {
      userId: request.userId,
      userRole: request.organizationType === 'bloodbank' || request.organizationType === 'hospital' ? 'bloodbank' : 'ngo',
      type: 'verification_status',
      title: 'Verification Approved',
      message: 'Your organization has been successfully verified',
      read: false,
      priority: 'high',
      createdAt: getServerTimestamp(),
    });

    await logAuditEvent({
      actorUid: adminId,
      actorRole: adminRole,
      action: 'admin_approve_verification',
      targetUid: request.userId,
      metadata: {
        requestId,
        organizationType: request.organizationType,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError || error instanceof NotFoundError) {
      throw error;
    }
    throw new DatabaseError('Failed to approve verification request');
  }
};

/**
 * Reject verification request
 * @param requestId - Verification request ID
 * @param adminId - Admin performing the action
 * @param rejectionReason - Reason for rejection
 */
export const rejectVerificationRequest = async (
  requestId: string,
  adminId: string,
  rejectionReason: string
): Promise<void> => {
  try {
    // Verify admin permissions
    const adminDoc = await getDoc(doc(db, 'users', adminId));
    if (!adminDoc.exists() || !['admin', 'superadmin'].includes(adminDoc.data().role)) {
      throw new PermissionError('Only admins can reject verification requests');
    }
    const adminRole = adminDoc.data().role || 'admin';

    if (!rejectionReason || rejectionReason.trim().length === 0) {
      throw new ValidationError('Rejection reason is required');
    }

    const requestDoc = await getDoc(doc(db, 'verificationRequests', requestId));
    if (!requestDoc.exists()) {
      throw new NotFoundError('Verification request not found');
    }

    const request = { ...requestDoc.data(), id: requestDoc.id } as VerificationRequest;

    // Update verification request
    await updateDoc(doc(db, 'verificationRequests', requestId), {
      status: 'rejected',
      reviewedBy: adminId,
      reviewedAt: getServerTimestamp(),
      rejectionReason,
      updatedAt: getServerTimestamp(),
    });

    // Create notification for user
    await addDoc(collection(db, 'notifications'), {
      userId: request.userId,
      userRole: request.organizationType === 'bloodbank' || request.organizationType === 'hospital' ? 'bloodbank' : 'ngo',
      type: 'verification_status',
      title: 'Verification Rejected',
      message: `Your verification request was rejected: ${rejectionReason}`,
      read: false,
      priority: 'high',
      createdAt: getServerTimestamp(),
    });

    await logAuditEvent({
      actorUid: adminId,
      actorRole: adminRole,
      action: 'admin_reject_verification',
      targetUid: request.userId,
      metadata: {
        requestId,
        organizationType: request.organizationType,
        reason: rejectionReason,
      },
    });
  } catch (error) {
    if (error instanceof PermissionError || error instanceof NotFoundError || error instanceof ValidationError) {
      throw error;
    }
    throw new DatabaseError('Failed to reject verification request');
  }
};

/**
 * Update verification request to under review
 * @param requestId - Verification request ID
 * @param adminId - Admin performing the action
 */
export const markVerificationUnderReview = async (
  requestId: string,
  adminId: string
): Promise<void> => {
  try {
    // Verify admin permissions
    const adminDoc = await getDoc(doc(db, 'users', adminId));
    if (!adminDoc.exists() || !['admin', 'superadmin'].includes(adminDoc.data().role)) {
      throw new PermissionError('Only admins can update verification requests');
    }
    const adminRole = adminDoc.data().role || 'admin';

    await updateDoc(doc(db, 'verificationRequests', requestId), {
      status: 'under_review',
      reviewedBy: adminId,
      updatedAt: getServerTimestamp(),
    });

    await logAuditEvent({
      actorUid: adminId,
      actorRole: adminRole,
      action: 'admin_mark_under_review',
      metadata: { requestId },
    });
  } catch (error) {
    if (error instanceof PermissionError) {
      throw error;
    }
    throw new DatabaseError('Failed to update verification request');
  }
};

// ============================================================================
// PLATFORM MONITORING
// ============================================================================

/**
 * Get platform statistics
 * @returns Platform statistics
 */
export const getPlatformStats = async () => {
  try {
    // Get user counts
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = extractQueryData<User>(usersSnapshot, ['createdAt', 'lastLoginAt', 'lastDonation', 'dateOfBirth']);

    const usersByRole = {
      donors: users.filter(u => u.role === 'donor').length,
      hospitals: users.filter(u => u.role === 'bloodbank' || u.role === 'hospital').length,
      ngos: users.filter(u => u.role === 'ngo').length,
      admins: users.filter(u => u.role === 'admin' || u.role === 'superadmin').length,
    };

    const usersByStatus = {
      active: users.filter(u => u.status === 'active').length,
      inactive: users.filter(u => u.status === 'inactive').length,
      suspended: users.filter(u => u.status === 'suspended').length,
      pendingVerification: users.filter(u => u.status === 'pending_verification').length,
    };

    // Get donation counts
    const donationsSnapshot = await getDocs(collection(db, 'donations'));
    const donations = extractQueryData<Donation>(donationsSnapshot, ['donationDate', 'createdAt', 'updatedAt']);

    const totalDonations = donations.length;
    const completedDonations = donations.filter(d => d.status === 'completed').length;
    const totalUnits = donations
      .filter(d => d.status === 'completed')
      .reduce((sum, d) => sum + (d.units || 0), 0);

    // Get blood request counts
    const requestsSnapshot = await getDocs(collection(db, 'bloodRequests'));
    const requests = extractQueryData<BloodRequest>(requestsSnapshot, [
      'requestedAt',
      'neededBy',
      'expiresAt',
      'fulfilledAt',
      'createdAt',
      'updatedAt',
    ]);

    const requestsByStatus = {
      active: requests.filter(r => r.status === 'active').length,
      fulfilled: requests.filter(r => r.status === 'fulfilled').length,
      partiallyFulfilled: requests.filter(r => r.status === 'partially_fulfilled').length,
      expired: requests.filter(r => r.status === 'expired').length,
      cancelled: requests.filter(r => r.status === 'cancelled').length,
    };

    // Get campaign counts
    const campaignsSnapshot = await getDocs(collection(db, 'campaigns'));
    const campaigns = extractQueryData<Campaign>(campaignsSnapshot, ['startDate', 'endDate', 'createdAt', 'updatedAt']);

    const campaignsByStatus = {
      active: campaigns.filter(c => c.status === 'active').length,
      upcoming: campaigns.filter(c => c.status === 'upcoming').length,
      completed: campaigns.filter(c => c.status === 'completed').length,
      cancelled: campaigns.filter(c => c.status === 'cancelled').length,
    };

    // Get verification request counts
    const verificationSnapshot = await getDocs(collection(db, 'verificationRequests'));
    const verifications = extractQueryData<VerificationRequest>(verificationSnapshot, [
      'submittedAt',
      'updatedAt',
      'reviewedAt',
    ]);

    const verificationsByStatus = {
      pending: verifications.filter(v => v.status === 'pending').length,
      underReview: verifications.filter(v => v.status === 'under_review').length,
      approved: verifications.filter(v => v.status === 'approved').length,
      rejected: verifications.filter(v => v.status === 'rejected').length,
    };

    return {
      users: {
        total: users.length,
        byRole: usersByRole,
        byStatus: usersByStatus,
      },
      donations: {
        total: totalDonations,
        completed: completedDonations,
        totalUnits,
      },
      requests: {
        total: requests.length,
        byStatus: requestsByStatus,
      },
      campaigns: {
        total: campaigns.length,
        byStatus: campaignsByStatus,
      },
      verifications: {
        total: verifications.length,
        byStatus: verificationsByStatus,
      },
    };
  } catch (error) {
    throw new DatabaseError('Failed to get platform statistics');
  }
};

/**
 * Get recent activity
 * @param limitCount - Number of activities to fetch
 * @returns Recent activity data
 */
export const getRecentActivity = async (limitCount: number = 20) => {
  try {
    // Get recent donations
    const donationsQuery = query(
      collection(db, 'donations'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const donationsSnapshot = await getDocs(donationsQuery);
    const donations = extractQueryData<Donation>(donationsSnapshot, ['donationDate', 'createdAt', 'updatedAt']);

    // Get recent blood requests
    const requestsQuery = query(
      collection(db, 'bloodRequests'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const requestsSnapshot = await getDocs(requestsQuery);
    const requests = extractQueryData<BloodRequest>(requestsSnapshot, [
      'requestedAt',
      'neededBy',
      'expiresAt',
      'fulfilledAt',
      'createdAt',
      'updatedAt',
    ]);

    // Get recent campaigns
    const campaignsQuery = query(
      collection(db, 'campaigns'),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const campaignsSnapshot = await getDocs(campaignsQuery);
    const campaigns = extractQueryData<Campaign>(campaignsSnapshot, ['startDate', 'endDate', 'createdAt', 'updatedAt']);

    return {
      donations: donations.slice(0, 5),
      requests: requests.slice(0, 5),
      campaigns: campaigns.slice(0, 5),
    };
  } catch (error) {
    throw new DatabaseError('Failed to get recent activity');
  }
};

/**
 * Get inventory alerts (low/critical stock)
 * @returns Array of inventory items with low/critical stock
 */
export const getInventoryAlerts = async (): Promise<BloodInventory[]> => {
  try {
    const q = query(
      collection(db, 'bloodInventory'),
      where('status', 'in', ['low', 'critical']),
      orderBy('units', 'asc'),
      limit(50)
    );

    const snapshot = await getDocs(q);
    return extractQueryData<BloodInventory>(snapshot, ['lastRestocked', 'updatedAt']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch inventory alerts');
  }
};

/**
 * Get emergency requests
 * @returns Array of emergency blood requests
 */
export const getEmergencyRequests = async (): Promise<BloodRequest[]> => {
  try {
    const q = query(
      collection(db, 'bloodRequests'),
      where('isEmergency', '==', true),
      where('status', '==', 'active'),
      orderBy('requestedAt', 'desc'),
      limit(20)
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
    throw new DatabaseError('Failed to fetch emergency requests');
  }
};

// ============================================================================
// ANALYTICS AND REPORTING
// ============================================================================

/**
 * Generate daily analytics snapshot
 * @returns Created analytics document ID
 */
export const generateDailyAnalytics = async (): Promise<string> => {
  try {
    const stats = await getPlatformStats();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Get inventory stats
    const inventorySnapshot = await getDocs(collection(db, 'bloodInventory'));
    const inventory = extractQueryData<BloodInventory>(inventorySnapshot, ['lastRestocked', 'updatedAt']);

    const totalBloodUnits = inventory.reduce((sum, inv) => sum + (inv.units || 0), 0);
    const criticalInventories = inventory.filter(inv => inv.status === 'critical').length;
    const lowInventories = inventory.filter(inv => inv.status === 'low').length;

    const analyticsData: Omit<Analytics, 'id'> = {
      date: Timestamp.fromDate(today),
      totalUsers: stats.users.total,
      newUsers: 0, // Would need to calculate based on createdAt
      activeUsers: stats.users.byStatus.active,
      usersByRole: stats.users.byRole,
      totalDonations: stats.donations.completed,
      donationsByBloodType: {}, // Would need to calculate
      donationsByCity: {}, // Would need to calculate
      totalRequests: stats.requests.total,
      fulfilledRequests: stats.requests.byStatus.fulfilled,
      pendingRequests: stats.requests.byStatus.active,
      averageResponseTime: 0, // Would need to calculate
      activeCampaigns: stats.campaigns.byStatus.active,
      completedCampaigns: stats.campaigns.byStatus.completed,
      totalParticipation: 0, // Would need to calculate
      totalBloodUnits,
      criticalInventories,
      lowInventories,
      systemUptime: 99.9, // Would integrate with monitoring service
      errorRate: 0.1, // Would integrate with error tracking
      generatedAt: getServerTimestamp() as Timestamp,
    };

    const docRef = await addDoc(collection(db, 'analytics'), analyticsData);
    return docRef.id;
  } catch (error) {
    throw new DatabaseError('Failed to generate daily analytics');
  }
};

/**
 * Get analytics for date range
 * @param startDate - Start date
 * @param endDate - End date
 * @returns Array of analytics documents
 */
export const getAnalyticsByDateRange = async (
  startDate: Date,
  endDate: Date
): Promise<Analytics[]> => {
  try {
    const q = query(
      collection(db, 'analytics'),
      where('date', '>=', Timestamp.fromDate(startDate)),
      where('date', '<=', Timestamp.fromDate(endDate)),
      orderBy('date', 'desc')
    );

    const snapshot = await getDocs(q);
    return extractQueryData<Analytics>(snapshot, ['date', 'generatedAt']);
  } catch (error) {
    throw new DatabaseError('Failed to fetch analytics');
  }
};

/**
 * Get system health report
 * @returns System health data
 */
export const getSystemHealthReport = async () => {
  try {
    const stats = await getPlatformStats();
    const inventoryAlerts = await getInventoryAlerts();
    const emergencyRequests = await getEmergencyRequests();

    return {
      status: 'healthy', // Would integrate with monitoring service
      users: {
        total: stats.users.total,
        activePercentage: Math.round(
          (stats.users.byStatus.active / stats.users.total) * 100
        ),
      },
      donations: {
        total: stats.donations.total,
        completionRate: Math.round(
          (stats.donations.completed / stats.donations.total) * 100
        ),
      },
      requests: {
        total: stats.requests.total,
        fulfillmentRate: Math.round(
          (stats.requests.byStatus.fulfilled / stats.requests.total) * 100
        ),
      },
      alerts: {
        inventoryAlerts: inventoryAlerts.length,
        emergencyRequests: emergencyRequests.length,
        pendingVerifications: stats.verifications.byStatus.pending,
      },
      timestamp: new Date(),
    };
  } catch (error) {
    throw new DatabaseError('Failed to get system health report');
  }
};
