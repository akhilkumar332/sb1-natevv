/**
 * Authentication Utility Functions
 *
 * This file provides helper functions for authentication-related operations,
 * including role checking, verification status, and permission management.
 */

import { User, UserRole, UserStatus } from '../types/database.types';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import { timestampToDate } from './firestore.utils';

// ============================================================================
// ROLE CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if user is a donor
 * @param user - User object or null
 * @returns Boolean indicating if user is a donor
 */
export const isDonor = (user: User | null): boolean => {
  return user?.role === 'donor';
};

/**
 * Check if user is a bloodbank (legacy hospital supported)
 * @param user - User object or null
 * @returns Boolean indicating if user is a bloodbank
 */
export const isHospital = (user: User | null): boolean => {
  return user?.role === 'bloodbank' || user?.role === 'hospital';
};

/**
 * Check if user is an NGO
 * @param user - User object or null
 * @returns Boolean indicating if user is an NGO
 */
export const isNGO = (user: User | null): boolean => {
  return user?.role === 'ngo';
};

/**
 * Check if user is an admin
 * @param user - User object or null
 * @returns Boolean indicating if user is an admin
 */
export const isAdmin = (user: User | null): boolean => {
  return user?.role === 'admin' || user?.role === 'superadmin';
};

/**
 * Check if user has one of the specified roles
 * @param user - User object or null
 * @param roles - Array of roles to check
 * @returns Boolean indicating if user has any of the specified roles
 */
export const hasAnyRole = (user: User | null, roles: UserRole[]): boolean => {
  return user?.role ? roles.includes(user.role) : false;
};

/**
 * Check if user has all of the specified roles (usually just one role check)
 * @param user - User object or null
 * @param role - Role to check
 * @returns Boolean indicating if user has the role
 */
export const hasRole = (user: User | null, role: UserRole): boolean => {
  return user?.role === role;
};

// ============================================================================
// VERIFICATION STATUS FUNCTIONS
// ============================================================================

/**
 * Check if user is verified
 * @param user - User object or null
 * @returns Boolean indicating if user is verified
 */
export const isVerified = (user: User | null): boolean => {
  return user?.verified === true;
};

/**
 * Check if user is pending verification
 * @param user - User object or null
 * @returns Boolean indicating if user is pending verification
 */
export const isPendingVerification = (user: User | null): boolean => {
  return user?.status === 'pending_verification';
};

/**
 * Check if organization (bloodbank or NGO) is verified
 * @param user - User object or null
 * @returns Boolean indicating if organization is verified
 */
export const isOrganizationVerified = (user: User | null): boolean => {
  if (!user) return false;
  if (user.role === 'bloodbank' || user.role === 'hospital' || user.role === 'ngo') {
    return user.verified === true && user.status === 'active';
  }
  return true; // Donors and admins don't need verification
};

// ============================================================================
// USER STATUS FUNCTIONS
// ============================================================================

/**
 * Check if user account is active
 * @param user - User object or null
 * @returns Boolean indicating if user account is active
 */
export const isActive = (user: User | null): boolean => {
  return user?.status === 'active';
};

/**
 * Check if user account is inactive
 * @param user - User object or null
 * @returns Boolean indicating if user account is inactive
 */
export const isInactive = (user: User | null): boolean => {
  return user?.status === 'inactive';
};

/**
 * Check if user account is suspended
 * @param user - User object or null
 * @returns Boolean indicating if user account is suspended
 */
export const isSuspended = (user: User | null): boolean => {
  return user?.status === 'suspended';
};

/**
 * Get user status display text
 * @param status - User status
 * @returns Display text for status
 */
export const getStatusDisplayText = (status: UserStatus): string => {
  const statusMap: Record<UserStatus, string> = {
    active: 'Active',
    inactive: 'Inactive',
    suspended: 'Suspended',
    pending_verification: 'Pending Verification',
  };
  return statusMap[status] || 'Unknown';
};

// ============================================================================
// PERMISSION CHECKING FUNCTIONS
// ============================================================================

/**
 * Check if user can create blood requests
 * @param user - User object or null
 * @returns Boolean indicating if user can create blood requests
 */
export const canCreateBloodRequest = (user: User | null): boolean => {
  if (!user) return false;
  return (isHospital(user) && isVerified(user) && isActive(user)) || isAdmin(user);
};

/**
 * Check if user can create campaigns
 * @param user - User object or null
 * @returns Boolean indicating if user can create campaigns
 */
export const canCreateCampaign = (user: User | null): boolean => {
  if (!user) return false;
  return (isNGO(user) && isVerified(user) && isActive(user)) || isAdmin(user);
};

/**
 * Check if user can donate blood
 * @param user - User object or null
 * @returns Boolean indicating if user can donate blood
 */
export const canDonateBlood = (user: User | null): boolean => {
  if (!user) return false;
  return isDonor(user) && isActive(user);
};

/**
 * Check if user can manage inventory
 * @param user - User object or null
 * @returns Boolean indicating if user can manage inventory
 */
export const canManageInventory = (user: User | null): boolean => {
  if (!user) return false;
  return (isHospital(user) && isVerified(user) && isActive(user)) || isAdmin(user);
};

/**
 * Check if user can manage volunteers
 * @param user - User object or null
 * @returns Boolean indicating if user can manage volunteers
 */
export const canManageVolunteers = (user: User | null): boolean => {
  if (!user) return false;
  return (isNGO(user) && isVerified(user) && isActive(user)) || isAdmin(user);
};

/**
 * Check if user can view analytics
 * @param user - User object or null
 * @returns Boolean indicating if user can view analytics
 */
export const canViewAnalytics = (user: User | null): boolean => {
  if (!user) return false;
  // Hospitals and NGOs can view their own analytics, admins can view all
  return (
    (isHospital(user) && isVerified(user)) ||
    (isNGO(user) && isVerified(user)) ||
    isAdmin(user)
  );
};

/**
 * Check if user can approve verification requests
 * @param user - User object or null
 * @returns Boolean indicating if user can approve verification requests
 */
export const canApproveVerifications = (user: User | null): boolean => {
  return isAdmin(user);
};

/**
 * Check if user owns a resource
 * @param user - User object or null
 * @param resourceOwnerId - ID of the resource owner
 * @returns Boolean indicating if user owns the resource
 */
export const ownsResource = (user: User | null, resourceOwnerId: string): boolean => {
  return user?.uid === resourceOwnerId;
};

/**
 * Check if user can edit a resource
 * @param user - User object or null
 * @param resourceOwnerId - ID of the resource owner
 * @returns Boolean indicating if user can edit the resource
 */
export const canEditResource = (user: User | null, resourceOwnerId: string): boolean => {
  return ownsResource(user, resourceOwnerId) || isAdmin(user);
};

/**
 * Check if user can delete a resource
 * @param user - User object or null
 * @param resourceOwnerId - ID of the resource owner
 * @returns Boolean indicating if user can delete the resource
 */
export const canDeleteResource = (user: User | null, resourceOwnerId: string): boolean => {
  return ownsResource(user, resourceOwnerId) || isAdmin(user);
};

// ============================================================================
// ONBOARDING STATUS FUNCTIONS
// ============================================================================

/**
 * Check if user has completed onboarding
 * @param user - User object or null
 * @returns Boolean indicating if user has completed onboarding
 */
export const hasCompletedOnboarding = (user: User | null): boolean => {
  return user?.onboardingCompleted === true;
};

/**
 * Get the appropriate dashboard route for user role
 * @param user - User object or null
 * @returns Dashboard route path
 */
export const getDashboardRoute = (user: User | null): string => {
  if (!user) return '/';

  switch (user.role) {
    case 'donor':
      return '/donor/dashboard';
    case 'bloodbank':
    case 'hospital':
      return '/bloodbank/dashboard';
    case 'ngo':
      return '/ngo/dashboard';
    case 'admin':
      return '/admin/dashboard';
    case 'superadmin':
      return '/admin/dashboard';
    default:
      return '/';
  }
};

/**
 * Get the appropriate onboarding route for user role
 * @param user - User object or null
 * @returns Onboarding route path
 */
export const getOnboardingRoute = (user: User | null): string => {
  if (!user) return '/';

  switch (user.role) {
    case 'donor':
      return '/donor/onboarding';
    case 'bloodbank':
    case 'hospital':
      return '/bloodbank/onboarding';
    case 'ngo':
      return '/ngo/onboarding';
    case 'admin':
      return '/admin/onboarding';
    case 'superadmin':
      return '/admin/onboarding';
    default:
      return '/';
  }
};

// ============================================================================
// USER SESSION MANAGEMENT
// ============================================================================

/**
 * Get user's full name
 * @param user - User object or null
 * @returns User's display name or email
 */
export const getUserDisplayName = (user: User | null): string => {
  if (!user) return 'Guest';

  if (user.displayName) return user.displayName;

  if ((user.role === 'bloodbank' || user.role === 'hospital') && (user.bloodBankName || user.hospitalName)) {
    return user.bloodBankName || user.hospitalName || 'BloodBank';
  }

  if (user.role === 'ngo' && user.organizationName) {
    return user.organizationName;
  }

  if (user.email) return user.email.split('@')[0];

  return 'User';
};

/**
 * Get user's initials for avatar
 * @param user - User object or null
 * @returns User's initials (up to 2 characters)
 */
export const getUserInitials = (user: User | null): string => {
  if (!user) return 'G';

  const name = getUserDisplayName(user);
  const parts = name.split(' ');

  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }

  return name.substring(0, 2).toUpperCase();
};

/**
 * Fetch user data from Firestore by UID
 * @param uid - User ID
 * @returns User object or null
 */
export const fetchUserByUid = async (uid: string): Promise<User | null> => {
  try {
    const userRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userRef);

    if (userSnap.exists()) {
      return { ...userSnap.data(), uid: userSnap.id } as User;
    }

    return null;
  } catch (error) {
    console.error('Error fetching user:', error);
    return null;
  }
};

/**
 * Check if user needs to complete profile
 * @param user - User object or null
 * @returns Boolean indicating if profile is incomplete
 */
export const needsProfileCompletion = (user: User | null): boolean => {
  if (!user) return false;

  const hasBasicInfo = !!(user.displayName && user.city && user.state && user.country);

  if (user.role === 'donor') {
    return !hasBasicInfo || !user.bloodType || !user.gender || !user.dateOfBirth;
  }

  if (user.role === 'bloodbank') {
    return !hasBasicInfo || !user.bloodBankName || !user.contactPerson;
  }

  if (user.role === 'hospital') {
    return !hasBasicInfo || !user.hospitalName || !user.contactPerson;
  }

  if (user.role === 'ngo') {
    return !hasBasicInfo || !user.organizationName || !user.mission;
  }

  return !hasBasicInfo;
};

/**
 * Get role display text
 * @param role - User role
 * @returns Display text for role
 */
export const getRoleDisplayText = (role: UserRole): string => {
  const roleMap: Record<UserRole, string> = {
    donor: 'Blood Donor',
    bloodbank: 'BloodBank',
    hospital: 'Hospital (Legacy)',
    ngo: 'NGO',
    admin: 'Administrator',
    superadmin: 'SuperAdmin',
  };
  return roleMap[role] || 'Unknown';
};

/**
 * Check if user can respond to blood requests
 * @param user - User object or null
 * @returns Boolean indicating if user can respond to requests
 */
export const canRespondToBloodRequests = (user: User | null): boolean => {
  if (!user) return false;
  return isDonor(user) && isActive(user) && user.isAvailable === true;
};

/**
 * Check if user is eligible to donate (based on last donation date)
 * @param user - User object or null
 * @returns Boolean indicating if user is eligible to donate
 */
export const isEligibleToDonate = (user: User | null): boolean => {
  if (!user || !isDonor(user)) return false;

  if (!user.lastDonation) return true;

  // Handle both Date and Timestamp types
  const lastDonationDate = user.lastDonation instanceof Date
    ? user.lastDonation
    : timestampToDate(user.lastDonation) || new Date();

  const daysSinceLastDonation = Math.floor(
    (Date.now() - lastDonationDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // Minimum 90 days between donations
  return daysSinceLastDonation >= 90;
};

/**
 * Get days until user can donate again
 * @param user - User object or null
 * @returns Number of days until eligible, or 0 if already eligible
 */
export const getDaysUntilEligible = (user: User | null): number => {
  if (!user || !isDonor(user) || !user.lastDonation) return 0;

  // Handle both Date and Timestamp types
  const lastDonationDate = user.lastDonation instanceof Date
    ? user.lastDonation
    : timestampToDate(user.lastDonation) || new Date();

  const daysSinceLastDonation = Math.floor(
    (Date.now() - lastDonationDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  const daysRemaining = 90 - daysSinceLastDonation;
  return daysRemaining > 0 ? daysRemaining : 0;
};
