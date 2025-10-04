/**
 * Search Service
 *
 * Advanced search functionality with multiple filters and criteria
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  getDocs,
  DocumentSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  User,
  BloodRequest,
  Campaign,
} from '../types/database.types';
import { extractQueryData } from '../utils/firestore.utils';
import { DatabaseError } from '../utils/errorHandler';

// ============================================================================
// SEARCH TYPES
// ============================================================================

export interface DonorSearchCriteria {
  bloodType?: string;
  city?: string;
  state?: string;
  isAvailable?: boolean;
  gender?: string;
  minAge?: number;
  maxAge?: number;
  verified?: boolean;
}

export interface HospitalSearchCriteria {
  city?: string;
  state?: string;
  hospitalType?: 'government' | 'private' | 'trust';
  verified?: boolean;
  hasBloodBank?: boolean;
}

export interface CampaignSearchCriteria {
  status?: 'draft' | 'active' | 'upcoming' | 'completed' | 'cancelled';
  type?: 'blood-drive' | 'awareness' | 'fundraising' | 'volunteer';
  city?: string;
  state?: string;
  ngoId?: string;
  startDate?: Date;
  endDate?: Date;
}

export interface BloodRequestSearchCriteria {
  bloodType?: string;
  city?: string;
  state?: string;
  urgency?: 'critical' | 'high' | 'medium' | 'low';
  status?: 'active' | 'fulfilled' | 'partially_fulfilled' | 'expired' | 'cancelled';
  isEmergency?: boolean;
}

export interface PaginationOptions {
  limitCount?: number;
  lastDoc?: DocumentSnapshot;
}

export interface SearchResult<T> {
  results: T[];
  hasMore: boolean;
  lastDoc?: DocumentSnapshot;
  totalCount: number;
}

// ============================================================================
// DONOR SEARCH
// ============================================================================

/**
 * Advanced donor search with multiple filters
 */
export const searchDonors = async (
  criteria: DonorSearchCriteria,
  pagination: PaginationOptions = {}
): Promise<SearchResult<User>> => {
  try {
    const { limitCount = 20, lastDoc } = pagination;
    const constraints: any[] = [where('role', '==', 'donor')];

    // Add filters
    if (criteria.bloodType) {
      constraints.push(where('bloodType', '==', criteria.bloodType));
    }

    if (criteria.city) {
      constraints.push(where('city', '==', criteria.city));
    }

    if (criteria.state) {
      constraints.push(where('state', '==', criteria.state));
    }

    if (criteria.isAvailable !== undefined) {
      constraints.push(where('isAvailable', '==', criteria.isAvailable));
    }

    if (criteria.gender) {
      constraints.push(where('gender', '==', criteria.gender));
    }

    if (criteria.verified !== undefined) {
      constraints.push(where('verified', '==', criteria.verified));
    }

    // Add ordering and pagination
    constraints.push(orderBy('displayName', 'asc'));
    constraints.push(limit(limitCount + 1)); // Fetch one extra to check if more exist

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, 'users'), ...constraints);
    const snapshot = await getDocs(q);

    const allResults = extractQueryData<User>(snapshot, [
      'createdAt',
      'lastLoginAt',
      'lastDonation',
      'dateOfBirth',
    ]);

    // Filter by age if needed (client-side since Firestore doesn't support range queries on dates easily)
    let filteredResults = allResults;
    if (criteria.minAge !== undefined || criteria.maxAge !== undefined) {
      const now = new Date();
      filteredResults = allResults.filter(user => {
        if (!user.dateOfBirth) return true;

        const birthDate =
          user.dateOfBirth instanceof Date
            ? user.dateOfBirth
            : user.dateOfBirth.toDate();

        const age = now.getFullYear() - birthDate.getFullYear();

        if (criteria.minAge !== undefined && age < criteria.minAge) return false;
        if (criteria.maxAge !== undefined && age > criteria.maxAge) return false;

        return true;
      });
    }

    // Check if there are more results
    const hasMore = filteredResults.length > limitCount;
    const results = hasMore ? filteredResults.slice(0, limitCount) : filteredResults;

    return {
      results,
      hasMore,
      lastDoc: hasMore ? snapshot.docs[snapshot.docs.length - 2] : undefined,
      totalCount: results.length,
    };
  } catch (error) {
    throw new DatabaseError('Failed to search donors');
  }
};

/**
 * Search donors by blood type and location
 */
export const searchDonorsByBloodType = async (
  bloodType: string,
  city?: string,
  state?: string
): Promise<User[]> => {
  const result = await searchDonors({
    bloodType,
    city,
    state,
    isAvailable: true,
    verified: true,
  });

  return result.results;
};

/**
 * Search available donors near a location
 */
export const searchAvailableDonors = async (
  city: string,
  state: string,
  bloodType?: string
): Promise<User[]> => {
  const result = await searchDonors({
    city,
    state,
    bloodType,
    isAvailable: true,
    verified: true,
  });

  return result.results;
};

// ============================================================================
// HOSPITAL SEARCH
// ============================================================================

/**
 * Advanced hospital search with filters
 */
export const searchHospitals = async (
  criteria: HospitalSearchCriteria,
  pagination: PaginationOptions = {}
): Promise<SearchResult<User>> => {
  try {
    const { limitCount = 20, lastDoc } = pagination;
    const constraints: any[] = [where('role', '==', 'hospital')];

    // Add filters
    if (criteria.city) {
      constraints.push(where('city', '==', criteria.city));
    }

    if (criteria.state) {
      constraints.push(where('state', '==', criteria.state));
    }

    if (criteria.hospitalType) {
      constraints.push(where('hospitalType', '==', criteria.hospitalType));
    }

    if (criteria.verified !== undefined) {
      constraints.push(where('verified', '==', criteria.verified));
    }

    // Add ordering and pagination
    constraints.push(orderBy('hospitalName', 'asc'));
    constraints.push(limit(limitCount + 1));

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, 'users'), ...constraints);
    const snapshot = await getDocs(q);

    let allResults = extractQueryData<User>(snapshot, [
      'createdAt',
      'lastLoginAt',
      'lastDonation',
      'dateOfBirth',
    ]);

    // Filter by blood bank facility (client-side)
    if (criteria.hasBloodBank !== undefined) {
      allResults = allResults.filter(hospital =>
        criteria.hasBloodBank
          ? hospital.facilities?.includes('Blood Bank')
          : !hospital.facilities?.includes('Blood Bank')
      );
    }

    const hasMore = allResults.length > limitCount;
    const results = hasMore ? allResults.slice(0, limitCount) : allResults;

    return {
      results,
      hasMore,
      lastDoc: hasMore ? snapshot.docs[snapshot.docs.length - 2] : undefined,
      totalCount: results.length,
    };
  } catch (error) {
    throw new DatabaseError('Failed to search hospitals');
  }
};

/**
 * Search hospitals by location
 */
export const searchHospitalsByLocation = async (
  city: string,
  state?: string
): Promise<User[]> => {
  const result = await searchHospitals({
    city,
    state,
    verified: true,
  });

  return result.results;
};

/**
 * Search hospitals with blood banks
 */
export const searchHospitalsWithBloodBanks = async (
  city?: string,
  state?: string
): Promise<User[]> => {
  const result = await searchHospitals({
    city,
    state,
    verified: true,
    hasBloodBank: true,
  });

  return result.results;
};

// ============================================================================
// CAMPAIGN SEARCH
// ============================================================================

/**
 * Advanced campaign search with filters
 */
export const searchCampaigns = async (
  criteria: CampaignSearchCriteria,
  pagination: PaginationOptions = {}
): Promise<SearchResult<Campaign>> => {
  try {
    const { limitCount = 20, lastDoc } = pagination;
    const constraints: any[] = [];

    // Add filters
    if (criteria.status) {
      constraints.push(where('status', '==', criteria.status));
    }

    if (criteria.type) {
      constraints.push(where('type', '==', criteria.type));
    }

    if (criteria.city) {
      constraints.push(where('location.city', '==', criteria.city));
    }

    if (criteria.state) {
      constraints.push(where('location.state', '==', criteria.state));
    }

    if (criteria.ngoId) {
      constraints.push(where('ngoId', '==', criteria.ngoId));
    }

    // Add ordering and pagination
    constraints.push(orderBy('startDate', 'desc'));
    constraints.push(limit(limitCount + 1));

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, 'campaigns'), ...constraints);
    const snapshot = await getDocs(q);

    let allResults = extractQueryData<Campaign>(snapshot, [
      'startDate',
      'endDate',
      'createdAt',
      'updatedAt',
    ]);

    // Filter by date range (client-side)
    if (criteria.startDate || criteria.endDate) {
      allResults = allResults.filter(campaign => {
        const campaignStartDate =
          campaign.startDate instanceof Date
            ? campaign.startDate
            : campaign.startDate.toDate();

        if (criteria.startDate && campaignStartDate < criteria.startDate) {
          return false;
        }

        if (criteria.endDate && campaignStartDate > criteria.endDate) {
          return false;
        }

        return true;
      });
    }

    const hasMore = allResults.length > limitCount;
    const results = hasMore ? allResults.slice(0, limitCount) : allResults;

    return {
      results,
      hasMore,
      lastDoc: hasMore ? snapshot.docs[snapshot.docs.length - 2] : undefined,
      totalCount: results.length,
    };
  } catch (error) {
    throw new DatabaseError('Failed to search campaigns');
  }
};

/**
 * Search active campaigns by location
 */
export const searchActiveCampaigns = async (
  city?: string,
  state?: string
): Promise<Campaign[]> => {
  const result = await searchCampaigns({
    status: 'active',
    city,
    state,
  });

  return result.results;
};

/**
 * Search upcoming campaigns
 */
export const searchUpcomingCampaigns = async (
  city?: string,
  state?: string
): Promise<Campaign[]> => {
  const result = await searchCampaigns({
    status: 'upcoming',
    city,
    state,
  });

  return result.results;
};

// ============================================================================
// BLOOD REQUEST SEARCH
// ============================================================================

/**
 * Advanced blood request search with filters
 */
export const searchBloodRequests = async (
  criteria: BloodRequestSearchCriteria,
  pagination: PaginationOptions = {}
): Promise<SearchResult<BloodRequest>> => {
  try {
    const { limitCount = 20, lastDoc } = pagination;
    const constraints: any[] = [];

    // Add filters
    if (criteria.bloodType) {
      constraints.push(where('bloodType', '==', criteria.bloodType));
    }

    if (criteria.city) {
      constraints.push(where('location.city', '==', criteria.city));
    }

    if (criteria.state) {
      constraints.push(where('location.state', '==', criteria.state));
    }

    if (criteria.status) {
      constraints.push(where('status', '==', criteria.status));
    }

    if (criteria.urgency) {
      constraints.push(where('urgency', '==', criteria.urgency));
    }

    if (criteria.isEmergency !== undefined) {
      constraints.push(where('isEmergency', '==', criteria.isEmergency));
    }

    // Add ordering and pagination
    constraints.push(orderBy('requestedAt', 'desc'));
    constraints.push(limit(limitCount + 1));

    if (lastDoc) {
      constraints.push(startAfter(lastDoc));
    }

    const q = query(collection(db, 'bloodRequests'), ...constraints);
    const snapshot = await getDocs(q);

    const allResults = extractQueryData<BloodRequest>(snapshot, [
      'requestedAt',
      'neededBy',
      'expiresAt',
      'fulfilledAt',
      'createdAt',
      'updatedAt',
    ]);

    const hasMore = allResults.length > limitCount;
    const results = hasMore ? allResults.slice(0, limitCount) : allResults;

    return {
      results,
      hasMore,
      lastDoc: hasMore ? snapshot.docs[snapshot.docs.length - 2] : undefined,
      totalCount: results.length,
    };
  } catch (error) {
    throw new DatabaseError('Failed to search blood requests');
  }
};

/**
 * Search emergency blood requests
 */
export const searchEmergencyRequests = async (
  bloodType?: string,
  city?: string
): Promise<BloodRequest[]> => {
  const result = await searchBloodRequests({
    status: 'active',
    isEmergency: true,
    bloodType,
    city,
  });

  return result.results;
};

/**
 * Search active blood requests by criteria
 */
export const searchActiveBloodRequests = async (
  bloodType?: string,
  city?: string,
  urgency?: 'critical' | 'high' | 'medium' | 'low'
): Promise<BloodRequest[]> => {
  const result = await searchBloodRequests({
    status: 'active',
    bloodType,
    city,
    urgency,
  });

  return result.results;
};

// ============================================================================
// FULL-TEXT SEARCH (Simplified)
// ============================================================================

/**
 * Search users by name or email (simple text matching)
 * Note: For production, integrate with Algolia, ElasticSearch, or Typesense
 */
export const searchUsersByText = async (
  searchText: string,
  role?: 'donor' | 'hospital' | 'ngo' | 'admin'
): Promise<User[]> => {
  try {
    const constraints: any[] = [];

    if (role) {
      constraints.push(where('role', '==', role));
    }

    constraints.push(orderBy('displayName'));
    constraints.push(limit(100));

    const q = query(collection(db, 'users'), ...constraints);
    const snapshot = await getDocs(q);

    const allUsers = extractQueryData<User>(snapshot, [
      'createdAt',
      'lastLoginAt',
      'lastDonation',
      'dateOfBirth',
    ]);

    // Filter by search text (case-insensitive)
    const searchLower = searchText.toLowerCase();
    const filtered = allUsers.filter(
      user =>
        user.displayName?.toLowerCase().includes(searchLower) ||
        user.email?.toLowerCase().includes(searchLower) ||
        user.phoneNumber?.includes(searchText) ||
        (role === 'hospital' && user.hospitalName?.toLowerCase().includes(searchLower)) ||
        (role === 'ngo' && user.organizationName?.toLowerCase().includes(searchLower))
    );

    return filtered.slice(0, 20); // Limit results
  } catch (error) {
    throw new DatabaseError('Failed to search users');
  }
};

/**
 * Search campaigns by title or description
 */
export const searchCampaignsByText = async (searchText: string): Promise<Campaign[]> => {
  try {
    const q = query(
      collection(db, 'campaigns'),
      orderBy('title'),
      limit(100)
    );

    const snapshot = await getDocs(q);
    const allCampaigns = extractQueryData<Campaign>(snapshot, [
      'startDate',
      'endDate',
      'createdAt',
      'updatedAt',
    ]);

    const searchLower = searchText.toLowerCase();
    const filtered = allCampaigns.filter(
      campaign =>
        campaign.title?.toLowerCase().includes(searchLower) ||
        campaign.description?.toLowerCase().includes(searchLower) ||
        campaign.ngoName?.toLowerCase().includes(searchLower)
    );

    return filtered.slice(0, 20);
  } catch (error) {
    throw new DatabaseError('Failed to search campaigns');
  }
};
