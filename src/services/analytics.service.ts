import { FIVE_MINUTES_MS, TEN_MINUTES_MS } from '../constants/time';
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
  limit,
  documentId,
} from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestore';
import { User, Donation, BloodRequest, Campaign, BloodInventory } from '../types/database.types';
import { extractQueryData } from '../utils/firestore.utils';
import { countCollection } from '../utils/firestoreCount';
import { clearDedupedRequestCache, runDedupedRequest } from '../utils/requestDedupe';
import { DatabaseError } from '../utils/errorHandler';
import { BLOOD_TYPE_CHART_COLORS, CHART_PALETTE } from '../constants/theme';
import {
  getAnalyticsByDateRange as getAnalyticsSnapshotsByDateRange,
  getPlatformStats as getAdminPlatformStats,
} from './admin.service';

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

export interface BloodBankStats {
  totalRequests: number;
  fulfilledRequests: number;
  fulfillmentRate: number;
  totalUnitsReceived: number;
  averageResponseTime: number; // hours
  inventoryTurnover: number;
  criticalAlerts: number;
}

// Legacy alias
export type HospitalStats = BloodBankStats;

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

export interface PlatformRangeStats {
  newUsers: number;
  newDonors: number;
  completedDonations: number;
  requestsCreated: number;
  campaignsCreated: number;
  source: 'snapshot' | 'raw';
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

export interface NgoPlatformAnalytics {
  totalVolunteers: number;
  activeVolunteers: number;
  totalPartnerships: number;
  activePartnerships: number;
  donorReach: number;
  donorConfirmed: number;
  confirmationRate: number;
  campaignTypeDistribution: Array<{ label: string; value: number }>;
  topNgos: Array<{
    ngoId: string;
    ngoName: string;
    campaigns: number;
    donorReach: number;
    confirmedDonors: number;
  }>;
}

export interface BloodBankPlatformAnalytics {
  totalBloodBanks: number;
  verifiedBloodBanks: number;
  requestsCreated: number;
  completedDonationsReceived: number;
  totalUnitsReceived: number;
  inventoryUnits: number;
  criticalInventoryRecords: number;
  lowInventoryRecords: number;
  inventoryStatusDistribution: Array<{ label: string; value: number }>;
  topBloodBanks: Array<{
    bloodBankId: string;
    bloodBankName: string;
    requestsCreated: number;
    unitsReceived: number;
  }>;
}

export interface AnalyticsHealthReport {
  status: 'healthy' | 'degraded';
  checkedAt: Date;
  range: {
    startDate: Date;
    endDate: Date;
  };
  datasets: {
    platformStats: number;
    rangeSource: PlatformRangeStats['source'];
    growthPoints: number;
    bloodTypes: number;
    geoLocations: number;
    ngoLeaders: number;
    bloodBankLeaders: number;
    topDonors: number;
  };
  issues: string[];
}

const resolveRole = (role?: 'donor' | 'bloodbank' | 'hospital' | 'ngo') => {
  if (!role) return undefined;
  if (role === 'hospital') return 'bloodbank';
  return role;
};

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
      collection(db, COLLECTIONS.DONATIONS),
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
      collection(db, COLLECTIONS.DONATIONS),
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
export const getBloodBankStats = async (hospitalId: string): Promise<BloodBankStats> => {
  try {
    // Get blood requests
    const requestsQuery = query(
      collection(db, COLLECTIONS.BLOOD_REQUESTS),
      where('requesterId', '==', hospitalId)
    );

    const requestsSnapshot = await getDocs(requestsQuery);
    const requests = extractQueryData<BloodRequest>(requestsSnapshot, ['requestedAt', 'neededBy', 'fulfilledAt']);

    const totalRequests = requests.length;
    const fulfilledRequests = requests.filter(r => r.status === 'fulfilled').length;
    const fulfillmentRate = totalRequests > 0 ? (fulfilledRequests / totalRequests) * 100 : 0;

    // Get donations received
    const donationsQuery = query(
      collection(db, COLLECTIONS.DONATIONS),
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
    throw new DatabaseError('Failed to get bloodbank stats');
  }
};

// Legacy alias
export const getHospitalStats = getBloodBankStats;

/**
 * Get blood request trend
 */
export const getBloodRequestTrend = async (
  hospitalId: string,
  dateRange: DateRange
): Promise<TrendData[]> => {
  try {
    const requestsQuery = query(
      collection(db, COLLECTIONS.BLOOD_REQUESTS),
      where('requesterId', '==', hospitalId),
      where('requestedAt', '>=', Timestamp.fromDate(dateRange.startDate)),
      where('requestedAt', '<=', Timestamp.fromDate(dateRange.endDate)),
      orderBy('requestedAt', 'asc')
    );

    const snapshot = await getDocs(requestsQuery);
    const requests = extractQueryData<BloodRequest>(snapshot, ['requestedAt', 'neededBy']);

    return groupByMonth(requests, 'requestedAt');
  } catch (error) {
    const code = String((error as any)?.code || '').toLowerCase();
    // Fallback for missing composite indexes or transient permission races during auth hydration.
    if (code === 'failed-precondition' || code === 'permission-denied' || code === 'unauthenticated') {
      try {
        const fallbackQuery = query(
          collection(db, COLLECTIONS.BLOOD_REQUESTS),
          where('requesterId', '==', hospitalId)
        );
        const fallbackSnap = await getDocs(fallbackQuery);
        const requests = extractQueryData<BloodRequest>(fallbackSnap, ['requestedAt', 'neededBy']).filter((item) => {
          const requestedAt = item.requestedAt instanceof Date ? item.requestedAt : item.requestedAt?.toDate?.();
          if (!requestedAt) return false;
          return requestedAt >= dateRange.startDate && requestedAt <= dateRange.endDate;
        });
        return groupByMonth(requests, 'requestedAt');
      } catch {
        return [];
      }
    }
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
      collection(db, COLLECTIONS.BLOOD_INVENTORY),
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
      collection(db, COLLECTIONS.CAMPAIGNS),
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
      collection(db, COLLECTIONS.CAMPAIGNS),
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
    const [adminStats, activeDonors, verifiedUsers] = await Promise.all([
      getAdminPlatformStats(),
      countCollection('users', where('role', '==', 'donor'), where('status', '==', 'active'), where('isAvailable', '==', true)),
      countCollection('users', where('verified', '==', true)),
    ]);

    return {
      totalUsers: adminStats.users.total,
      totalDonors: adminStats.users.byRole.donors,
      totalHospitals: adminStats.users.byRole.hospitals,
      totalNGOs: adminStats.users.byRole.ngos,
      totalDonations: adminStats.donations.total,
      totalBloodRequests: adminStats.requests.total,
      totalCampaigns: adminStats.campaigns.total,
      activeDonors,
      verifiedUsers,
    };
  } catch (error) {
    throw new DatabaseError('Failed to get platform stats');
  }
};

/**
 * Get range-scoped platform metrics
 */
export const getPlatformRangeStats = async (
  dateRange: DateRange
): Promise<PlatformRangeStats> => {
  try {
    const cacheKey = `analytics:platformRangeStats:${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}`;
    return runDedupedRequest(cacheKey, async () => {
      const snapshots = await getAnalyticsSnapshotsByDateRange(dateRange.startDate, dateRange.endDate);
      const hasDailyRangeFields = snapshots.some((entry: any) => (
        typeof entry.newDonations === 'number'
        || typeof entry.newRequests === 'number'
        || typeof entry.newCampaigns === 'number'
        || typeof entry.newDonors === 'number'
      ));

      if (snapshots.length > 0 && hasDailyRangeFields) {
        const fromSnapshots = snapshots.reduce((acc, entry: any) => ({
          newUsers: acc.newUsers + Number(entry.newUsers || 0),
          newDonors: acc.newDonors + Number(entry.newDonors || 0),
          completedDonations: acc.completedDonations + Number(entry.newDonations || 0),
          requestsCreated: acc.requestsCreated + Number(entry.newRequests || 0),
          campaignsCreated: acc.campaignsCreated + Number(entry.newCampaigns || 0),
        }), {
          newUsers: 0,
          newDonors: 0,
          completedDonations: 0,
          requestsCreated: 0,
          campaignsCreated: 0,
        });

        return {
          ...fromSnapshots,
          source: 'snapshot',
        };
      }

      let newUsers = 0;
      let newDonors = 0;
      let completedDonations = 0;
      let requestsCreated = 0;
      let campaignsCreated = 0;
      try {
        [newUsers, newDonors, completedDonations, requestsCreated, campaignsCreated] = await Promise.all([
          countCollection(
            COLLECTIONS.USERS,
            where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate)),
            where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate)),
          ),
          countCollection(
            COLLECTIONS.USERS,
            where('role', '==', 'donor'),
            where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate)),
            where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate)),
          ),
          countCollection(
            COLLECTIONS.DONATIONS,
            where('status', '==', 'completed'),
            where('donationDate', '>=', Timestamp.fromDate(dateRange.startDate)),
            where('donationDate', '<=', Timestamp.fromDate(dateRange.endDate)),
          ),
          countCollection(
            COLLECTIONS.BLOOD_REQUESTS,
            where('requestedAt', '>=', Timestamp.fromDate(dateRange.startDate)),
            where('requestedAt', '<=', Timestamp.fromDate(dateRange.endDate)),
          ),
          countCollection(
            COLLECTIONS.CAMPAIGNS,
            where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate)),
            where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate)),
          ),
        ]);
      } catch {
        const [usersSnapshot, donationsSnapshot, requestsSnapshot, campaignsSnapshot] = await Promise.all([
          getDocs(collection(db, COLLECTIONS.USERS)),
          getDocs(query(collection(db, COLLECTIONS.DONATIONS), where('status', '==', 'completed'))),
          getDocs(collection(db, COLLECTIONS.BLOOD_REQUESTS)),
          getDocs(collection(db, COLLECTIONS.CAMPAIGNS)),
        ]);
        const fromMs = dateRange.startDate.getTime();
        const toMs = dateRange.endDate.getTime();

        const users = extractQueryData<User>(usersSnapshot, ['createdAt', 'lastLoginAt', 'dateOfBirth', 'lastDonation']);
        const donations = extractQueryData<Donation>(donationsSnapshot, ['donationDate']);
        const requests = extractQueryData<BloodRequest>(requestsSnapshot, ['requestedAt', 'neededBy', 'fulfilledAt']);
        const campaigns = extractQueryData<Campaign>(campaignsSnapshot, ['createdAt', 'startDate', 'endDate']);

        users.forEach((user) => {
          const createdAt = user.createdAt instanceof Date ? user.createdAt : user.createdAt?.toDate?.();
          if (!createdAt) return;
          const createdAtMs = createdAt.getTime();
          if (createdAtMs >= fromMs && createdAtMs <= toMs) {
            newUsers += 1;
            if (user.role === 'donor') newDonors += 1;
          }
        });
        donations.forEach((donation) => {
          const donationDate = donation.donationDate instanceof Date ? donation.donationDate : donation.donationDate?.toDate?.();
          if (!donationDate) return;
          const donationDateMs = donationDate.getTime();
          if (donationDateMs >= fromMs && donationDateMs <= toMs) completedDonations += 1;
        });
        requests.forEach((request) => {
          const requestedAt = request.requestedAt instanceof Date ? request.requestedAt : request.requestedAt?.toDate?.();
          if (!requestedAt) return;
          const requestedAtMs = requestedAt.getTime();
          if (requestedAtMs >= fromMs && requestedAtMs <= toMs) requestsCreated += 1;
        });
        campaigns.forEach((campaign) => {
          const createdAt = campaign.createdAt instanceof Date ? campaign.createdAt : campaign.createdAt?.toDate?.();
          if (!createdAt) return;
          const createdAtMs = createdAt.getTime();
          if (createdAtMs >= fromMs && createdAtMs <= toMs) campaignsCreated += 1;
        });
      }

      return {
        newUsers,
        newDonors,
        completedDonations,
        requestsCreated,
        campaignsCreated,
        source: 'raw',
      };
    }, TEN_MINUTES_MS);
  } catch (error) {
    throw new DatabaseError('Failed to get range platform stats');
  }
};

/**
 * Get user growth trend
 */
export const getUserGrowthTrend = async (
  dateRange: DateRange,
  role?: 'donor' | 'bloodbank' | 'hospital' | 'ngo'
): Promise<TrendData[]> => {
  try {
    const normalizedRole = resolveRole(role);
    if (!normalizedRole) {
      const snapshots = await getAnalyticsSnapshotsByDateRange(dateRange.startDate, dateRange.endDate);
      if (snapshots.length > 0) {
        const snapshotTrend = snapshots
          .sort((a, b) => {
            const aMs = (a.date as any)?.toDate?.()?.getTime?.() || 0;
            const bMs = (b.date as any)?.toDate?.()?.getTime?.() || 0;
            return aMs - bMs;
          })
          .map((item) => {
            const dateObj = (item.date as any)?.toDate?.() || item.date;
            const monthKey = dateObj instanceof Date
              ? `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}`
              : '';
            return {
              date: monthKey,
              label: monthKey,
              value: Number(item.newUsers || 0),
            };
          })
          .filter((entry) => Boolean(entry.date));

        if (snapshotTrend.length > 0) {
          // Merge day-level snapshot rows into month buckets.
          const bucket: Record<string, number> = {};
          snapshotTrend.forEach((entry) => {
            bucket[entry.date] = (bucket[entry.date] || 0) + entry.value;
          });
          return Object.entries(bucket)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, value]) => ({ date, label: date, value }));
        }
      }
    }

    const constraints: any[] = [
      where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate)),
      where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate)),
      orderBy('createdAt', 'asc'),
    ];

    if (normalizedRole) {
      constraints.push(where('role', '==', normalizedRole));
    }

    const usersQuery = query(collection(db, COLLECTIONS.USERS), ...constraints);
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
export const getBloodTypeDistribution = async (
  dateRange?: DateRange
): Promise<BloodTypeDistribution[]> => {
  try {
    const cacheKey = dateRange
      ? `analytics:bloodTypeDistribution:${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}`
      : 'analytics:bloodTypeDistribution';
    return runDedupedRequest(cacheKey, async () => {
      const bloodTypes = Object.keys(BLOOD_TYPE_CHART_COLORS);
      let countsByType: Record<string, number> = {};

      if (!dateRange) {
        const counts = await Promise.all(
          bloodTypes.map((bloodType) => (
            countCollection('users', where('role', '==', 'donor'), where('bloodType', '==', bloodType))
          ))
        );
        countsByType = bloodTypes.reduce<Record<string, number>>((acc, bloodType, index) => {
          acc[bloodType] = counts[index] || 0;
          return acc;
        }, {});
      } else {
        const fromMs = dateRange.startDate.getTime();
        const toMs = dateRange.endDate.getTime();
        let users: User[] = [];
        try {
          const usersSnapshot = await getDocs(query(
            collection(db, COLLECTIONS.USERS),
            where('role', '==', 'donor'),
            where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate)),
            where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate)),
          ));
          users = extractQueryData<User>(usersSnapshot, ['createdAt', 'lastLoginAt', 'dateOfBirth', 'lastDonation']);
        } catch (error) {
          const fallbackSnapshot = await getDocs(query(
            collection(db, COLLECTIONS.USERS),
            where('role', '==', 'donor'),
          ));
          users = extractQueryData<User>(fallbackSnapshot, ['createdAt', 'lastLoginAt', 'dateOfBirth', 'lastDonation']).filter((user) => {
            const createdAt = user.createdAt instanceof Date ? user.createdAt : user.createdAt?.toDate?.();
            if (!createdAt) return false;
            const createdAtMs = createdAt.getTime();
            return createdAtMs >= fromMs && createdAtMs <= toMs;
          });
        }

        countsByType = users.reduce<Record<string, number>>((acc, user) => {
          const key = String(user.bloodType || '').trim().toUpperCase();
          if (!key) return acc;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {});
      }

      const total = Object.values(countsByType).reduce((sum, count) => sum + count, 0);

      return bloodTypes.map((bloodType) => {
        const count = countsByType[bloodType] || 0;
        return ({
          bloodType,
          count,
          percentage: total > 0 ? (count / total) * 100 : 0,
          color: BLOOD_TYPE_CHART_COLORS[bloodType] || CHART_PALETTE.neutral,
        });
      }).filter((entry) => entry.count > 0);
    }, TEN_MINUTES_MS);
  } catch (error) {
    throw new DatabaseError('Failed to get blood type distribution');
  }
};

/**
 * Get geographic distribution
 */
export const getGeographicDistribution = async (
  dateRange?: DateRange
): Promise<GeographicDistribution[]> => {
  try {
    const cacheKey = dateRange
      ? `analytics:geoDistribution:${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}`
      : 'analytics:geoDistribution';
    return runDedupedRequest(cacheKey, async () => {
      let users: User[] = [];
      if (!dateRange) {
        const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
        users = extractQueryData<User>(usersSnapshot, ['createdAt', 'lastLoginAt', 'dateOfBirth', 'lastDonation']);
      } else {
        try {
          const usersSnapshot = await getDocs(query(
            collection(db, COLLECTIONS.USERS),
            where('createdAt', '>=', Timestamp.fromDate(dateRange.startDate)),
            where('createdAt', '<=', Timestamp.fromDate(dateRange.endDate)),
          ));
          users = extractQueryData<User>(usersSnapshot, ['createdAt', 'lastLoginAt', 'dateOfBirth', 'lastDonation']);
        } catch (error) {
          const fromMs = dateRange.startDate.getTime();
          const toMs = dateRange.endDate.getTime();
          const usersSnapshot = await getDocs(collection(db, COLLECTIONS.USERS));
          users = extractQueryData<User>(usersSnapshot, ['createdAt', 'lastLoginAt', 'dateOfBirth', 'lastDonation']).filter((user) => {
            const createdAt = user.createdAt instanceof Date ? user.createdAt : user.createdAt?.toDate?.();
            if (!createdAt) return false;
            const createdAtMs = createdAt.getTime();
            return createdAtMs >= fromMs && createdAtMs <= toMs;
          });
        }
      }

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
          } else if (user.role === 'bloodbank' || user.role === 'hospital') {
            distribution[key].hospitalCount++;
            distribution[key].hospitals++;
          }
        }
      });

      return Object.values(distribution).sort((a, b) => b.count - a.count);
    }, TEN_MINUTES_MS);
  } catch (error) {
    throw new DatabaseError('Failed to get geographic distribution');
  }
};

/**
 * Get top donors
 */
export const getTopDonors = async (limitCount: number = 10): Promise<Array<User & { donationCount: number }>> => {
  try {
    return runDedupedRequest(`analytics:topDonors:${limitCount}`, async () => {
      const donationsSnapshot = await getDocs(query(collection(db, COLLECTIONS.DONATIONS), where('status', '==', 'completed')));
      const donations = extractQueryData<Donation>(donationsSnapshot, ['donationDate']);

      const donorCounts: Record<string, number> = {};
      donations.forEach(donation => {
        donorCounts[donation.donorId] = (donorCounts[donation.donorId] || 0) + 1;
      });

      const topDonorIds = Object.entries(donorCounts)
        .sort(([, a], [, b]) => b - a)
        .slice(0, limitCount)
        .map(([id]) => id);

      if (topDonorIds.length === 0) return [];
      const donorChunks: string[][] = [];
      for (let i = 0; i < topDonorIds.length; i += 10) {
        donorChunks.push(topDonorIds.slice(i, i + 10));
      }
      const userSnapshots = await Promise.all(
        donorChunks.map((chunk) => getDocs(query(
          collection(db, COLLECTIONS.USERS),
          where(documentId(), 'in', chunk),
          limit(chunk.length)
        )))
      );
      const usersById = new Map<string, User>();
      userSnapshots.forEach((snapshot) => {
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data() as User;
          usersById.set(docSnap.id, {
            ...data,
            uid: data.uid || docSnap.id,
          });
        });
      });

      return topDonorIds
        .map((id) => {
          const user = usersById.get(id);
          return user ? { ...user, donationCount: donorCounts[id] } : null;
        })
        .filter(Boolean) as Array<User & { donationCount: number }>;
    }, FIVE_MINUTES_MS);
  } catch (error) {
    throw new DatabaseError('Failed to get top donors');
  }
};

/**
 * Get platform-wide NGO analytics for the selected range
 */
export const getNgoPlatformAnalytics = async (
  dateRange: DateRange
): Promise<NgoPlatformAnalytics> => {
  try {
    const cacheKey = `analytics:ngoPlatform:${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}`;
    return runDedupedRequest(cacheKey, async () => {
      const fromMs = dateRange.startDate.getTime();
      const toMs = dateRange.endDate.getTime();

      const [campaignsSnapshot, volunteersSnapshot, partnershipsSnapshot] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.CAMPAIGNS)),
        getDocs(collection(db, COLLECTIONS.VOLUNTEERS)),
        getDocs(collection(db, COLLECTIONS.PARTNERSHIPS)),
      ]);

      const campaigns = extractQueryData<Campaign>(campaignsSnapshot, ['createdAt', 'startDate', 'endDate']);
      const volunteers = extractQueryData<any>(volunteersSnapshot, ['createdAt', 'joinedAt', 'lastActiveAt']);
      const partnerships = extractQueryData<any>(partnershipsSnapshot, ['createdAt', 'startDate', 'endDate']);

      const rangeCampaigns = campaigns.filter((campaign) => {
        const createdAt = campaign.createdAt instanceof Date ? campaign.createdAt : campaign.createdAt?.toDate?.();
        if (!createdAt) return false;
        const createdAtMs = createdAt.getTime();
        return createdAtMs >= fromMs && createdAtMs <= toMs;
      });

      const byType: Record<string, number> = {};
      const byNgo: Record<string, { ngoId: string; ngoName: string; campaigns: number; donorReach: number; confirmedDonors: number }> = {};
      let donorReach = 0;
      let donorConfirmed = 0;

      rangeCampaigns.forEach((campaign) => {
        const typeLabel = campaign.type === 'blood-drive'
          ? 'Blood Drives'
          : campaign.type === 'awareness'
            ? 'Awareness'
            : campaign.type === 'fundraising'
              ? 'Fundraising'
              : 'Volunteer';
        byType[typeLabel] = (byType[typeLabel] || 0) + 1;

        const registeredCount = Array.isArray(campaign.registeredDonors) ? campaign.registeredDonors.length : 0;
        const confirmedCount = Array.isArray(campaign.confirmedDonors) ? campaign.confirmedDonors.length : 0;
        donorReach += registeredCount;
        donorConfirmed += confirmedCount;

        if (!byNgo[campaign.ngoId]) {
          byNgo[campaign.ngoId] = {
            ngoId: campaign.ngoId,
            ngoName: campaign.ngoName || campaign.ngoId,
            campaigns: 0,
            donorReach: 0,
            confirmedDonors: 0,
          };
        }

        byNgo[campaign.ngoId].campaigns += 1;
        byNgo[campaign.ngoId].donorReach += registeredCount;
        byNgo[campaign.ngoId].confirmedDonors += confirmedCount;
      });

      const campaignTypeDistribution = Object.entries(byType)
        .map(([label, value]) => ({ label, value }))
        .sort((a, b) => b.value - a.value);

      const topNgos = Object.values(byNgo)
        .sort((a, b) => {
          if (b.campaigns !== a.campaigns) return b.campaigns - a.campaigns;
          return b.donorReach - a.donorReach;
        })
        .slice(0, 6);

      const totalVolunteers = volunteers.length;
      const activeVolunteers = volunteers.filter((volunteer) => volunteer.status === 'active').length;
      const totalPartnerships = partnerships.length;
      const activePartnerships = partnerships.filter((partnership) => partnership.status === 'active').length;

      return {
        totalVolunteers,
        activeVolunteers,
        totalPartnerships,
        activePartnerships,
        donorReach,
        donorConfirmed,
        confirmationRate: donorReach > 0 ? Math.round((donorConfirmed / donorReach) * 1000) / 10 : 0,
        campaignTypeDistribution,
        topNgos,
      };
    }, TEN_MINUTES_MS);
  } catch (error) {
    throw new DatabaseError('Failed to get NGO platform analytics');
  }
};

/**
 * Get platform-wide blood bank analytics for the selected range
 */
export const getBloodBankPlatformAnalytics = async (
  dateRange: DateRange
): Promise<BloodBankPlatformAnalytics> => {
  try {
    const cacheKey = `analytics:bloodBankPlatform:${dateRange.startDate.toISOString()}:${dateRange.endDate.toISOString()}`;
    return runDedupedRequest(cacheKey, async () => {
      const fromMs = dateRange.startDate.getTime();
      const toMs = dateRange.endDate.getTime();

      const [usersSnapshot, requestsSnapshot, donationsSnapshot, inventorySnapshot] = await Promise.all([
        getDocs(collection(db, COLLECTIONS.USERS)),
        getDocs(collection(db, COLLECTIONS.BLOOD_REQUESTS)),
        getDocs(query(collection(db, COLLECTIONS.DONATIONS), where('status', '==', 'completed'))),
        getDocs(collection(db, COLLECTIONS.BLOOD_INVENTORY)),
      ]);

      const users = extractQueryData<User>(usersSnapshot, ['createdAt', 'lastLoginAt', 'dateOfBirth', 'lastDonation']);
      const requests = extractQueryData<BloodRequest>(requestsSnapshot, ['requestedAt', 'neededBy', 'fulfilledAt']);
      const donations = extractQueryData<Donation>(donationsSnapshot, ['donationDate']);
      const inventory = extractQueryData<BloodInventory>(inventorySnapshot, ['updatedAt', 'lastRestocked']);

      const bloodBanks = users.filter((user) => user.role === 'bloodbank' || user.role === 'hospital');
      const bloodBankLookup = bloodBanks.reduce<Record<string, User>>((acc, user) => {
        acc[user.uid] = user;
        return acc;
      }, {});

      const rangeRequests = requests.filter((request) => {
        const requestedAt = request.requestedAt instanceof Date ? request.requestedAt : request.requestedAt?.toDate?.();
        if (!requestedAt) return false;
        const requestedAtMs = requestedAt.getTime();
        return requestedAtMs >= fromMs && requestedAtMs <= toMs;
      });

      const rangeDonations = donations.filter((donation) => {
        const donationDate = donation.donationDate instanceof Date ? donation.donationDate : donation.donationDate?.toDate?.();
        if (!donationDate) return false;
        const donationDateMs = donationDate.getTime();
        return donationDateMs >= fromMs && donationDateMs <= toMs;
      });

      const requestCounts: Record<string, number> = {};
      rangeRequests.forEach((request) => {
        requestCounts[request.requesterId] = (requestCounts[request.requesterId] || 0) + 1;
      });

      const donationUnitsByHospital: Record<string, number> = {};
      rangeDonations.forEach((donation) => {
        donationUnitsByHospital[donation.hospitalId] = (donationUnitsByHospital[donation.hospitalId] || 0) + Number(donation.units || 0);
      });

      const inventoryStatusDistributionMap: Record<string, number> = {};
      let inventoryUnits = 0;
      let criticalInventoryRecords = 0;
      let lowInventoryRecords = 0;
      inventory.forEach((record) => {
        inventoryUnits += Number(record.units || 0);
        inventoryStatusDistributionMap[record.status] = (inventoryStatusDistributionMap[record.status] || 0) + 1;
        if (record.status === 'critical') criticalInventoryRecords += 1;
        if (record.status === 'low') lowInventoryRecords += 1;
      });

      const topBloodBanks = Object.keys({ ...requestCounts, ...donationUnitsByHospital })
        .map((bloodBankId) => {
          const user = bloodBankLookup[bloodBankId];
          return {
            bloodBankId,
            bloodBankName: user?.bloodBankName || user?.hospitalName || user?.displayName || user?.email || bloodBankId,
            requestsCreated: requestCounts[bloodBankId] || 0,
            unitsReceived: donationUnitsByHospital[bloodBankId] || 0,
          };
        })
        .sort((a, b) => {
          if (b.requestsCreated !== a.requestsCreated) return b.requestsCreated - a.requestsCreated;
          return b.unitsReceived - a.unitsReceived;
        })
        .slice(0, 6);

      return {
        totalBloodBanks: bloodBanks.length,
        verifiedBloodBanks: bloodBanks.filter((user) => user.verified === true).length,
        requestsCreated: rangeRequests.length,
        completedDonationsReceived: rangeDonations.length,
        totalUnitsReceived: rangeDonations.reduce((sum, donation) => sum + Number(donation.units || 0), 0),
        inventoryUnits,
        criticalInventoryRecords,
        lowInventoryRecords,
        inventoryStatusDistribution: Object.entries(inventoryStatusDistributionMap)
          .map(([label, value]) => ({ label, value }))
          .sort((a, b) => b.value - a.value),
        topBloodBanks,
      };
    }, TEN_MINUTES_MS);
  } catch (error) {
    throw new DatabaseError('Failed to get blood bank platform analytics');
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

export const getAnalyticsHealthReport = async (
  dateRange: DateRange
): Promise<AnalyticsHealthReport> => {
  try {
    clearDedupedRequestCache('analytics:');

    const [platformStats, rangeStats, growthTrend, bloodTypes, geo, ngo, bloodBank, topDonors] = await Promise.all([
      getPlatformStats(),
      getPlatformRangeStats(dateRange),
      getUserGrowthTrend(dateRange),
      getBloodTypeDistribution(dateRange),
      getGeographicDistribution(dateRange),
      getNgoPlatformAnalytics(dateRange),
      getBloodBankPlatformAnalytics(dateRange),
      getTopDonors(8),
    ]);

    const issues: string[] = [];
    if (platformStats.totalUsers <= 0) issues.push('Platform stats returned zero users.');
    if (growthTrend.length === 0) issues.push('Growth trend returned no points for the selected range.');
    if (geo.length === 0) issues.push('Geographic distribution returned no locations.');
    if (bloodTypes.length === 0) issues.push('Blood-type distribution returned no donor mix data.');
    if (ngo.topNgos.length === 0) issues.push('NGO analytics returned no ranked NGOs for the selected range.');
    if (bloodBank.topBloodBanks.length === 0) issues.push('Blood bank analytics returned no ranked blood banks for the selected range.');
    if (topDonors.length === 0) issues.push('Top donor leaderboard returned no donors.');

    return {
      status: issues.length > 0 ? 'degraded' : 'healthy',
      checkedAt: new Date(),
      range: {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
      },
      datasets: {
        platformStats: platformStats.totalUsers,
        rangeSource: rangeStats.source,
        growthPoints: growthTrend.length,
        bloodTypes: bloodTypes.length,
        geoLocations: geo.length,
        ngoLeaders: ngo.topNgos.length,
        bloodBankLeaders: bloodBank.topBloodBanks.length,
        topDonors: topDonors.length,
      },
      issues,
    };
  } catch (error) {
    throw new DatabaseError('Failed to get analytics health report');
  }
};
