/**
 * Analytics Service
 *
 * Service for analytics, metrics, and reporting
 */

import {
  collection,
  query,
  where,
  getDocs,
  Timestamp,
  orderBy,
} from 'firebase/firestore';
import { db } from '../firebase';
import { User, Donation, BloodRequest, Campaign } from '../types/database.types';
import { extractQueryData } from '../utils/firestore.utils';
import { DatabaseError } from '../utils/errorHandler';

// ============================================================================
// ANALYTICS TYPES
// ============================================================================

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface DonorStats {
  totalDonations: number;
  totalUnits: number;
  lastDonationDate: Date | null;
  donationFrequency: number; // donations per year
  impactScore: number;
  currentStreak: number;
  longestStreak: number;
  lifetimeImpact: number; // estimated lives saved
}

export interface HospitalStats {
  totalRequests: number;
  fulfilledRequests: number;
  fulfillmentRate: number;
  totalUnitsReceived: number;
  averageResponseTime: number; // hours
  inventoryTurnover: number;
  criticalAlerts: number;
}

export interface CampaignStats {
  totalParticipants: number;
  totalDonationsCollected: number;
  targetAchievement: number; // percentage
  participationRate: number;
  averageDonationPerParticipant: number;
}

export interface PlatformStats {
  totalUsers: number;
  totalDonors: number;
  totalHospitals: number;
  totalNGOs: number;
  totalDonations: number;
  totalBloodRequests: number;
  totalCampaigns: number;
  activeDonors: number;
  verifiedUsers: number;
}

export interface TrendData {
  date: string;
  label: string;
  value: number;
}

export interface BloodTypeDistribution {
  bloodType: string;
  count: number;
  percentage: number;
  color?: string;
}

export interface GeographicDistribution {
  city: string;
  state: string;
  location: string;
  count: number;
  totalUsers: number;
  donors: number;
  hospitals: number;
  donorCount: number;
  hospitalCount: number;
}

// ============================================================================
// DONOR ANALYTICS
// ============================================================================

/**
 * Get donor statistics
 */
export const getDonorStats = async (donorId: string): Promise<DonorStats> => {
  try {
    // Get all donations for donor
    const donationsQuery = query(
      collection(db, 'donations'),
      where('donorId', '==', donorId),
      where('status', '==', 'completed'),
      orderBy('donationDate', 'desc')
    );

    const snapshot = await getDocs(donationsQuery);
    const donations = extractQueryData<Donation>(snapshot, ['donationDate']);

    const totalDonations = donations.length;
    const totalUnits = donations.reduce((sum, d) => sum + (d.units || 0), 0);
    const lastDonationDate = donations.length > 0 ? donations[0].donationDate : null;

    // Calculate donation frequency (donations per year)
    const donationFrequency = calculateDonationFrequency(donations);

    // Calculate streaks
    const { currentStreak, longestStreak } = calculateStreaks(donations);

    // Calculate impact
    const impactScore = calculateImpactScore(totalDonations, totalUnits);
    const lifetimeImpact = Math.floor(totalUnits / 0.5); // Estimate: 1 unit can save 2 lives

    return {
      totalDonations,
      totalUnits,
      lastDonationDate: lastDonationDate instanceof Date ? lastDonationDate : lastDonationDate?.toDate() || null,
      donationFrequency,
      impactScore,
      currentStreak,
      longestStreak,
      lifetimeImpact,
    };
  } catch (error) {
    throw new DatabaseError('Failed to get donor stats');
  }
};

/**
 * Get donation trend over time
 */
export const getDonationTrend = async (
  donorId: string,
  dateRange: DateRange
): Promise<TrendData[]> => {
  try {
    const donationsQuery = query(
      collection(db, 'donations'),
      where('donorId', '==', donorId),
      where('donationDate', '>=', Timestamp.fromDate(dateRange.startDate)),
      where('donationDate', '<=', Timestamp.fromDate(dateRange.endDate)),
      orderBy('donationDate', 'asc')
    );

    const snapshot = await getDocs(donationsQuery);
    const donations = extractQueryData<Donation>(snapshot, ['donationDate']);

    // Group by month
    return groupByMonth(donations, 'donationDate');
  } catch (error) {
    throw new DatabaseError('Failed to get donation trend');
  }
};

// ============================================================================
// HOSPITAL ANALYTICS
// ============================================================================

/**
 * Get hospital statistics
 */
export const getHospitalStats = async (hospitalId: string): Promise<HospitalStats> => {
  try {
    // Get blood requests
    const requestsQuery = query(
      collection(db, 'bloodRequests'),
      where('requesterId', '==', hospitalId)
    );

    const requestsSnapshot = await getDocs(requestsQuery);
    const requests = extractQueryData<BloodRequest>(requestsSnapshot, ['requestedAt', 'neededBy', 'fulfilledAt']);

    const totalRequests = requests.length;
    const fulfilledRequests = requests.filter(r => r.status === 'fulfilled').length;
    const fulfillmentRate = totalRequests > 0 ? (fulfilledRequests / totalRequests) * 100 : 0;

    // Get donations received
    const donationsQuery = query(
      collection(db, 'donations'),
      where('hospitalId', '==', hospitalId),
      where('status', '==', 'completed')
    );

    const donationsSnapshot = await getDocs(donationsQuery);
    const donations = extractQueryData<Donation>(donationsSnapshot, ['donationDate']);

    const totalUnitsReceived = donations.reduce((sum, d) => sum + (d.units || 0), 0);

    // Calculate average response time
    const averageResponseTime = calculateAverageResponseTime(requests);

    return {
      totalRequests,
      fulfilledRequests,
      fulfillmentRate: Math.round(fulfillmentRate * 100) / 100,
      totalUnitsReceived,
      averageResponseTime,
      inventoryTurnover: 0, // Would need inventory history
      criticalAlerts: 0, // Would need alert history
    };
  } catch (error) {
    throw new DatabaseError('Failed to get hospital stats');
  }
};

/**
 * Get blood request trend
 */
export const getBloodRequestTrend = async (
  hospitalId: string,
  dateRange: DateRange
): Promise<TrendData[]> => {
  try {
    const requestsQuery = query(
      collection(db, 'bloodRequests'),
      where('requesterId', '==', hospitalId),
      where('requestedAt', '>=', Timestamp.fromDate(dateRange.startDate)),
      where('requestedAt', '<=', Timestamp.fromDate(dateRange.endDate)),
      orderBy('requestedAt', 'asc')
    );

    const snapshot = await getDocs(requestsQuery);
    const requests = extractQueryData<BloodRequest>(snapshot, ['requestedAt', 'neededBy']);

    return groupByMonth(requests, 'requestedAt');
  } catch (error) {
    throw new DatabaseError('Failed to get blood request trend');
  }
};

/**
 * Get inventory distribution by blood type
 */
export const getInventoryDistribution = async (
  hospitalId: string
): Promise<BloodTypeDistribution[]> => {
  try {
    const inventoryQuery = query(
      collection(db, 'bloodInventory'),
      where('hospitalId', '==', hospitalId)
    );

    const snapshot = await getDocs(inventoryQuery);
    const inventory = snapshot.docs.map(doc => doc.data());

    const totalUnits = inventory.reduce((sum: number, item: any) => sum + (item.units || 0), 0);

    return inventory.map((item: any) => ({
      bloodType: item.bloodType,
      count: item.units || 0,
      percentage: totalUnits > 0 ? ((item.units || 0) / totalUnits) * 100 : 0,
    }));
  } catch (error) {
    throw new DatabaseError('Failed to get inventory distribution');
  }
};

// ============================================================================
// NGO/CAMPAIGN ANALYTICS
// ============================================================================

/**
 * Get campaign statistics
 */
export const getCampaignStats = async (campaignId: string): Promise<CampaignStats> => {
  try {
    // Get campaign details
    const campaignQuery = query(
      collection(db, 'campaigns'),
      where('__name__', '==', campaignId)
    );

    const campaignSnapshot = await getDocs(campaignQuery);
    const campaigns = extractQueryData<Campaign>(campaignSnapshot, ['startDate', 'endDate']);

    if (campaigns.length === 0) {
      throw new Error('Campaign not found');
    }

    const campaign = campaigns[0];

    const totalParticipants = campaign.registeredDonors?.length || 0;
    const totalDonationsCollected = campaign.achieved || 0;
    const target = campaign.target || 1;
    const targetAchievement = (totalDonationsCollected / target) * 100;

    return {
      totalParticipants,
      totalDonationsCollected,
      targetAchievement: Math.round(targetAchievement * 100) / 100,
      participationRate: totalParticipants > 0 ? 100 : 0, // Would need registered vs attended
      averageDonationPerParticipant:
        totalParticipants > 0 ? totalDonationsCollected / totalParticipants : 0,
    };
  } catch (error) {
    throw new DatabaseError('Failed to get campaign stats');
  }
};

/**
 * Get NGO campaign performance
 */
export const getNGOCampaignPerformance = async (
  ngoId: string,
  dateRange: DateRange
): Promise<TrendData[]> => {
  try {
    const campaignsQuery = query(
      collection(db, 'campaigns'),
      where('ngoId', '==', ngoId),
      where('startDate', '>=', Timestamp.fromDate(dateRange.startDate)),
      where('startDate', '<=', Timestamp.fromDate(dateRange.endDate)),
      orderBy('startDate', 'asc')
    );

    const snapshot = await getDocs(campaignsQuery);
    const campaigns = extractQueryData<Campaign>(snapshot, ['startDate', 'endDate']);

    return groupByMonth(campaigns, 'startDate');
  } catch (error) {
    throw new DatabaseError('Failed to get NGO campaign performance');
  }
};

// ============================================================================
// ADMIN/PLATFORM ANALYTICS
// ============================================================================

/**
 * Get platform-wide statistics
 */
export const getPlatformStats = async (): Promise<PlatformStats> => {
  try {
    // Get user counts
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = extractQueryData<User>(usersSnapshot, ['createdAt', 'lastLoginAt', 'dateOfBirth', 'lastDonation']);

    const totalUsers = users.length;
    const totalDonors = users.filter(u => u.role === 'donor').length;
    const totalHospitals = users.filter(u => u.role === 'hospital').length;
    const totalNGOs = users.filter(u => u.role === 'ngo').length;
    const activeDonors = users.filter(u => u.role === 'donor' && u.isAvailable).length;
    const verifiedUsers = users.filter(u => u.verified).length;

    // Get donation count
    const donationsSnapshot = await getDocs(collection(db, 'donations'));
    const totalDonations = donationsSnapshot.size;

    // Get request count
    const requestsSnapshot = await getDocs(collection(db, 'bloodRequests'));
    const totalBloodRequests = requestsSnapshot.size;

    // Get campaign count
    const campaignsSnapshot = await getDocs(collection(db, 'campaigns'));
    const totalCampaigns = campaignsSnapshot.size;

    return {
      totalUsers,
      totalDonors,
      totalHospitals,
      totalNGOs,
      totalDonations,
      totalBloodRequests,
      totalCampaigns,
      activeDonors,
      verifiedUsers,
    };
  } catch (error) {
    throw new DatabaseError('Failed to get platform stats');
  }
};

/**
 * Get user growth trend
 */
export const getUserGrowthTrend = async (
  dateRange: DateRange,
  role?: 'donor' | 'hospital' | 'ngo'
): Promise<TrendData[]> => {
  try {
    const constraints: any[] = [
      where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate)),
      where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate)),
      orderBy('createdAt', 'asc'),
    ];

    if (role) {
      constraints.push(where('role', '==', role));
    }

    const usersQuery = query(collection(db, 'users'), ...constraints);
    const snapshot = await getDocs(usersQuery);
    const users = extractQueryData<User>(snapshot, ['createdAt', 'lastLoginAt', 'dateOfBirth', 'lastDonation']);

    return groupByMonth(users, 'createdAt');
  } catch (error) {
    throw new DatabaseError('Failed to get user growth trend');
  }
};

/**
 * Get blood type distribution across platform
 */
export const getBloodTypeDistribution = async (): Promise<BloodTypeDistribution[]> => {
  try {
    const donorsQuery = query(
      collection(db, 'users'),
      where('role', '==', 'donor')
    );

    const snapshot = await getDocs(donorsQuery);
    const donors = extractQueryData<User>(snapshot, ['createdAt', 'lastLoginAt', 'dateOfBirth', 'lastDonation']);

    const distribution: Record<string, number> = {};
    donors.forEach(donor => {
      if (donor.bloodType) {
        distribution[donor.bloodType] = (distribution[donor.bloodType] || 0) + 1;
      }
    });

    const total = Object.values(distribution).reduce((sum, count) => sum + count, 0);

    const BLOOD_TYPE_COLORS: Record<string, string> = {
      'A+': '#DC2626',
      'A-': '#EA580C',
      'B+': '#D97706',
      'B-': '#16A34A',
      'O+': '#0891B2',
      'O-': '#2563EB',
      'AB+': '#7C3AED',
      'AB-': '#DB2777',
    };

    return Object.entries(distribution).map(([bloodType, count]) => ({
      bloodType,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
      color: BLOOD_TYPE_COLORS[bloodType] || '#6B7280',
    }));
  } catch (error) {
    throw new DatabaseError('Failed to get blood type distribution');
  }
};

/**
 * Get geographic distribution
 */
export const getGeographicDistribution = async (): Promise<GeographicDistribution[]> => {
  try {
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = extractQueryData<User>(usersSnapshot, ['createdAt', 'lastLoginAt', 'dateOfBirth', 'lastDonation']);

    const distribution: Record<string, GeographicDistribution> = {};

    users.forEach(user => {
      if (user.city && user.state) {
        const key = `${user.city}, ${user.state}`;

        if (!distribution[key]) {
          distribution[key] = {
            city: user.city,
            state: user.state,
            location: key,
            count: 0,
            totalUsers: 0,
            donors: 0,
            hospitals: 0,
            donorCount: 0,
            hospitalCount: 0,
          };
        }

        distribution[key].count++;
        distribution[key].totalUsers++;

        if (user.role === 'donor') {
          distribution[key].donorCount++;
          distribution[key].donors++;
        } else if (user.role === 'hospital') {
          distribution[key].hospitalCount++;
          distribution[key].hospitals++;
        }
      }
    });

    return Object.values(distribution).sort((a, b) => b.count - a.count);
  } catch (error) {
    throw new DatabaseError('Failed to get geographic distribution');
  }
};

/**
 * Get top donors
 */
export const getTopDonors = async (limitCount: number = 10): Promise<Array<User & { donationCount: number }>> => {
  try {
    const donationsSnapshot = await getDocs(collection(db, 'donations'));
    const donations = extractQueryData<Donation>(donationsSnapshot, ['donationDate']);

    // Count donations per donor
    const donorCounts: Record<string, number> = {};
    donations.forEach(donation => {
      donorCounts[donation.donorId] = (donorCounts[donation.donorId] || 0) + 1;
    });

    // Get top donor IDs
    const topDonorIds = Object.entries(donorCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, limitCount)
      .map(([id]) => id);

    // Get donor details
    const usersSnapshot = await getDocs(collection(db, 'users'));
    const users = extractQueryData<User>(usersSnapshot, ['createdAt', 'lastLoginAt', 'dateOfBirth', 'lastDonation']);

    return topDonorIds
      .map(id => {
        const user = users.find(u => u.uid === id);
        return user ? { ...user, donationCount: donorCounts[id] } : null;
      })
      .filter(Boolean) as Array<User & { donationCount: number }>;
  } catch (error) {
    throw new DatabaseError('Failed to get top donors');
  }
};

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate donation frequency (donations per year)
 */
const calculateDonationFrequency = (donations: Donation[]): number => {
  if (donations.length === 0) return 0;

  const firstDonation = donations[donations.length - 1].donationDate;
  const lastDonation = donations[0].donationDate;

  const firstDate = firstDonation instanceof Date ? firstDonation : firstDonation.toDate();
  const lastDate = lastDonation instanceof Date ? lastDonation : lastDonation.toDate();

  const yearsDiff = (lastDate.getTime() - firstDate.getTime()) / (1000 * 60 * 60 * 24 * 365);

  return yearsDiff > 0 ? donations.length / yearsDiff : donations.length;
};

/**
 * Calculate donation streaks
 */
const calculateStreaks = (
  donations: Donation[]
): { currentStreak: number; longestStreak: number } => {
  if (donations.length === 0) return { currentStreak: 0, longestStreak: 0 };

  let currentStreak = 1;
  let longestStreak = 1;
  let tempStreak = 1;

  for (let i = 1; i < donations.length; i++) {
    const prevDonationDate = donations[i - 1].donationDate;
    const currDonationDate = donations[i].donationDate;

    const prevDate: Date = prevDonationDate instanceof Date
      ? prevDonationDate
      : (prevDonationDate as any).toDate();
    const currDate: Date = currDonationDate instanceof Date
      ? currDonationDate
      : (currDonationDate as any).toDate();

    const daysDiff = Math.abs((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));

    // Consider streak if within 120 days (donation eligibility period)
    if (daysDiff <= 120) {
      tempStreak++;
      if (i === donations.length - 1 || i === 0) {
        currentStreak = tempStreak;
      }
    } else {
      longestStreak = Math.max(longestStreak, tempStreak);
      tempStreak = 1;
    }
  }

  longestStreak = Math.max(longestStreak, tempStreak);

  return { currentStreak, longestStreak };
};

/**
 * Calculate impact score
 */
const calculateImpactScore = (totalDonations: number, totalUnits: number): number => {
  // Simple formula: (donations * 10) + (units * 5)
  return (totalDonations * 10) + (totalUnits * 5);
};

/**
 * Calculate average response time for blood requests
 */
const calculateAverageResponseTime = (requests: BloodRequest[]): number => {
  const fulfilledRequests = requests.filter(r => r.status === 'fulfilled' && r.fulfilledAt);

  if (fulfilledRequests.length === 0) return 0;

  const totalHours = fulfilledRequests.reduce((sum, request) => {
    const requestedAt = request.requestedAt instanceof Date
      ? request.requestedAt
      : request.requestedAt.toDate();
    const fulfilledAt = request.fulfilledAt instanceof Date
      ? request.fulfilledAt
      : request.fulfilledAt!.toDate();

    const hours = (fulfilledAt.getTime() - requestedAt.getTime()) / (1000 * 60 * 60);
    return sum + hours;
  }, 0);

  return totalHours / fulfilledRequests.length;
};

/**
 * Group data by month
 */
const groupByMonth = (data: any[], dateField: string): TrendData[] => {
  const monthGroups: Record<string, number> = {};

  data.forEach(item => {
    const date = item[dateField] instanceof Date
      ? item[dateField]
      : item[dateField]?.toDate();

    if (date) {
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      monthGroups[monthKey] = (monthGroups[monthKey] || 0) + 1;
    }
  });

  return Object.entries(monthGroups)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, value]) => ({ date, label: date, value }));
};
