/**
 * Location-Based Search Service
 *
 * Services for location-based searches with distance filtering
 */

import {
  collection,
  query,
  where,
  getDocs,
} from 'firebase/firestore';
import { db } from '../firebase';
import {
  User,
  BloodRequest,
  Campaign,
  Coordinates,
} from '../types/database.types';
import { extractQueryData } from '../utils/firestore.utils';
import {
  calculateDistance,
  filterByRadius,
  sortByDistance,
} from '../utils/geolocation';
import { DatabaseError } from '../utils/errorHandler';

// ============================================================================
// LOCATION-BASED DONOR SEARCH
// ============================================================================

/**
 * Find donors within radius of a location
 */
export const findDonorsNearby = async (
  location: Coordinates,
  radiusKm: number,
  bloodType?: string,
  options: {
    isAvailable?: boolean;
    verified?: boolean;
  } = {}
): Promise<(User & { distance: number })[]> => {
  try {
    // Build query constraints
    const constraints: any[] = [
      where('role', '==', 'donor'),
      // Note: Firestore doesn't support geoqueries natively
      // We'll fetch a wider area and filter client-side
    ];

    if (bloodType) {
      constraints.push(where('bloodType', '==', bloodType));
    }

    if (options.isAvailable !== undefined) {
      constraints.push(where('isAvailable', '==', options.isAvailable));
    }

    if (options.verified !== undefined) {
      constraints.push(where('verified', '==', options.verified));
    }

    const q = query(collection(db, 'users'), ...constraints);
    const snapshot = await getDocs(q);

    const donors = extractQueryData<User>(snapshot, [
      'createdAt',
      'lastLoginAt',
      'lastDonation',
      'dateOfBirth',
    ]);

    // Filter by actual distance and add distance field
    const nearbyDonors = filterByRadius(donors, location, radiusKm);

    return nearbyDonors;
  } catch (error) {
    throw new DatabaseError('Failed to find nearby donors');
  }
};

/**
 * Find closest donors to a location
 */
export const findClosestDonors = async (
  location: Coordinates,
  bloodType: string,
  count: number = 10
): Promise<(User & { distance: number })[]> => {
  try {
    // Start with a reasonable radius and expand if needed
    let radiusKm = 10;
    let donors: (User & { distance: number })[] = [];

    // Try expanding radius until we find enough donors
    while (donors.length < count && radiusKm <= 100) {
      donors = await findDonorsNearby(location, radiusKm, bloodType, {
        isAvailable: true,
        verified: true,
      });

      if (donors.length < count) {
        radiusKm += 10; // Expand radius by 10km
      }
    }

    return donors.slice(0, count);
  } catch (error) {
    throw new DatabaseError('Failed to find closest donors');
  }
};

// ============================================================================
// LOCATION-BASED HOSPITAL SEARCH
// ============================================================================

/**
 * Find hospitals within radius of a location
 */
export const findHospitalsNearby = async (
  location: Coordinates,
  radiusKm: number,
  options: {
    hasBloodBank?: boolean;
    hospitalType?: 'government' | 'private' | 'trust';
    verified?: boolean;
  } = {}
): Promise<(User & { distance: number })[]> => {
  try {
    const constraints: any[] = [where('role', '==', 'hospital')];

    if (options.hospitalType) {
      constraints.push(where('hospitalType', '==', options.hospitalType));
    }

    if (options.verified !== undefined) {
      constraints.push(where('verified', '==', options.verified));
    }

    const q = query(collection(db, 'users'), ...constraints);
    const snapshot = await getDocs(q);

    let hospitals = extractQueryData<User>(snapshot, [
      'createdAt',
      'lastLoginAt',
      'lastDonation',
      'dateOfBirth',
    ]);

    // Filter by blood bank if specified
    if (options.hasBloodBank !== undefined) {
      hospitals = hospitals.filter((h) =>
        options.hasBloodBank
          ? h.facilities?.includes('Blood Bank')
          : !h.facilities?.includes('Blood Bank')
      );
    }

    // Filter by distance
    const nearbyHospitals = filterByRadius(hospitals, location, radiusKm);

    return nearbyHospitals;
  } catch (error) {
    throw new DatabaseError('Failed to find nearby hospitals');
  }
};

/**
 * Find closest hospital with blood bank
 */
export const findClosestBloodBank = async (
  location: Coordinates
): Promise<(User & { distance: number }) | null> => {
  try {
    let radiusKm = 5;
    const maxRadius = 50;

    while (radiusKm <= maxRadius) {
      const hospitals = await findHospitalsNearby(location, radiusKm, {
        hasBloodBank: true,
        verified: true,
      });

      if (hospitals.length > 0) {
        return hospitals[0]; // Return closest
      }

      radiusKm += 5;
    }

    return null;
  } catch (error) {
    throw new DatabaseError('Failed to find closest blood bank');
  }
};

// ============================================================================
// LOCATION-BASED BLOOD REQUEST SEARCH
// ============================================================================

/**
 * Find blood requests within radius of a location
 */
export const findBloodRequestsNearby = async (
  location: Coordinates,
  radiusKm: number,
  options: {
    bloodType?: string;
    urgency?: 'critical' | 'high' | 'medium' | 'low';
    isEmergency?: boolean;
    status?: string;
  } = {}
): Promise<(BloodRequest & { distance: number })[]> => {
  try {
    const constraints: any[] = [where('status', '==', options.status || 'active')];

    if (options.bloodType) {
      constraints.push(where('bloodType', '==', options.bloodType));
    }

    if (options.urgency) {
      constraints.push(where('urgency', '==', options.urgency));
    }

    if (options.isEmergency !== undefined) {
      constraints.push(where('isEmergency', '==', options.isEmergency));
    }

    const q = query(collection(db, 'bloodRequests'), ...constraints);
    const snapshot = await getDocs(q);

    const requests = extractQueryData<BloodRequest>(snapshot, [
      'requestedAt',
      'neededBy',
      'expiresAt',
      'fulfilledAt',
      'createdAt',
      'updatedAt',
    ]);

    // Filter by distance (only those with valid coordinates)
    const requestsWithCoordinates = requests
      .filter((r) => r.location && r.location.latitude && r.location.longitude)
      .map((r) => ({
        ...r,
        distance: calculateDistance(location, {
          latitude: r.location.latitude,
          longitude: r.location.longitude,
        }),
      }))
      .filter((r) => r.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    const nearbyRequests = requestsWithCoordinates;

    return nearbyRequests;
  } catch (error) {
    throw new DatabaseError('Failed to find nearby blood requests');
  }
};

/**
 * Find emergency blood requests nearby
 */
export const findEmergencyRequestsNearby = async (
  location: Coordinates,
  radiusKm: number,
  bloodType?: string
): Promise<(BloodRequest & { distance: number })[]> => {
  return findBloodRequestsNearby(location, radiusKm, {
    bloodType,
    isEmergency: true,
    status: 'active',
  });
};

// ============================================================================
// LOCATION-BASED CAMPAIGN SEARCH
// ============================================================================

/**
 * Find campaigns within radius of a location
 */
export const findCampaignsNearby = async (
  location: Coordinates,
  radiusKm: number,
  options: {
    status?: 'draft' | 'active' | 'upcoming' | 'completed' | 'cancelled';
    type?: 'blood-drive' | 'awareness' | 'fundraising' | 'volunteer';
  } = {}
): Promise<(Campaign & { distance: number })[]> => {
  try {
    const constraints: any[] = [];

    if (options.status) {
      constraints.push(where('status', '==', options.status));
    } else {
      // Default to active and upcoming
      constraints.push(where('status', 'in', ['active', 'upcoming']));
    }

    if (options.type) {
      constraints.push(where('type', '==', options.type));
    }

    const q = query(collection(db, 'campaigns'), ...constraints);
    const snapshot = await getDocs(q);

    const campaigns = extractQueryData<Campaign>(snapshot, [
      'startDate',
      'endDate',
      'createdAt',
      'updatedAt',
    ]);

    // Filter by distance (only those with valid coordinates)
    const campaignsWithCoordinates = campaigns
      .filter((c) => c.location && c.location.latitude && c.location.longitude)
      .map((c) => ({
        ...c,
        distance: calculateDistance(location, {
          latitude: c.location.latitude!,
          longitude: c.location.longitude!,
        }),
      }))
      .filter((c) => c.distance <= radiusKm)
      .sort((a, b) => a.distance - b.distance);

    const nearbyCampaigns = campaignsWithCoordinates;

    return nearbyCampaigns;
  } catch (error) {
    throw new DatabaseError('Failed to find nearby campaigns');
  }
};

/**
 * Find active campaigns nearby
 */
export const findActiveCampaignsNearby = async (
  location: Coordinates,
  radiusKm: number
): Promise<(Campaign & { distance: number })[]> => {
  return findCampaignsNearby(location, radiusKm, { status: 'active' });
};

// ============================================================================
// DISTANCE CALCULATION FOR EXISTING DATA
// ============================================================================

/**
 * Add distance to donors from a location
 */
export const addDistanceToDonors = (
  donors: User[],
  fromLocation: Coordinates
): (User & { distance?: number })[] => {
  return sortByDistance(donors, fromLocation);
};

/**
 * Add distance to hospitals from a location
 */
export const addDistanceToHospitals = (
  hospitals: User[],
  fromLocation: Coordinates
): (User & { distance?: number })[] => {
  return sortByDistance(hospitals, fromLocation);
};

/**
 * Add distance to blood requests from a location
 */
export const addDistanceToBloodRequests = (
  requests: BloodRequest[],
  fromLocation: Coordinates
): (BloodRequest & { distance?: number })[] => {
  return requests.map((request) => {
    if (!request.location || !request.location.latitude || !request.location.longitude) {
      return { ...request, distance: undefined };
    }

    const distance = calculateDistance(fromLocation, {
      latitude: request.location.latitude,
      longitude: request.location.longitude,
    });

    return { ...request, distance };
  }).sort((a, b) => {
    if (a.distance === undefined) return 1;
    if (b.distance === undefined) return -1;
    return a.distance - b.distance;
  });
};

// ============================================================================
// LOCATION SUGGESTIONS
// ============================================================================

/**
 * Get location suggestions based on activity
 */
export const getPopularLocations = async (): Promise<
  Array<{ city: string; state: string; count: number }>
> => {
  try {
    // Get all donors to find popular locations
    const donorsQuery = query(collection(db, 'users'), where('role', '==', 'donor'));
    const donorsSnapshot = await getDocs(donorsQuery);
    const donors = extractQueryData<User>(donorsSnapshot, [
      'createdAt',
      'lastLoginAt',
      'lastDonation',
      'dateOfBirth',
    ]);

    // Count by city
    const locationCounts: Record<string, { state: string; count: number }> = {};

    donors.forEach((donor) => {
      if (donor.city) {
        const key = donor.city;
        if (!locationCounts[key]) {
          locationCounts[key] = { state: donor.state || '', count: 0 };
        }
        locationCounts[key].count++;
      }
    });

    // Convert to array and sort by count
    const locations = Object.entries(locationCounts)
      .map(([city, data]) => ({
        city,
        state: data.state,
        count: data.count,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 20); // Top 20 locations

    return locations;
  } catch (error) {
    throw new DatabaseError('Failed to get popular locations');
  }
};
