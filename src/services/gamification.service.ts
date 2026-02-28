/**
 * Gamification Service
 *
 * Handles badges, points, leaderboards, and achievements for donors
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  increment,
  serverTimestamp,
  writeBatch
} from 'firebase/firestore';
import { db } from '../firebase';
import type { User } from '../types/database.types';
import { captureHandledError } from './errorLog.service';

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  category: 'donation' | 'streak' | 'emergency' | 'special';
  requirement: number;
  earned: boolean;
  earnedDate?: Date;
  progress?: number;
}

export interface UserStats {
  userId: string;
  totalDonations: number;
  points: number;
  currentStreak: number;
  longestStreak: number;
  emergencyResponses: number;
  rank?: number;
  level: number;
  nextLevelPoints: number;
}

export interface LeaderboardEntry {
  userId: string;
  displayName: string;
  photoURL?: string;
  points: number;
  totalDonations: number;
  rank: number;
  city?: string;
  bloodType?: string;
}

const BADGES: Omit<Badge, 'earned' | 'earnedDate' | 'progress'>[] = [
  {
    id: 'first_timer',
    name: 'First Timer',
    icon: '🎯',
    description: 'Completed your first donation',
    category: 'donation',
    requirement: 1
  },
  {
    id: 'regular_donor',
    name: 'Regular Donor',
    icon: '⭐',
    description: 'Completed 5 donations',
    category: 'donation',
    requirement: 5
  },
  {
    id: 'super_donor',
    name: 'Super Donor',
    icon: '🚀',
    description: 'Completed 10 donations',
    category: 'donation',
    requirement: 10
  },
  {
    id: 'hero_donor',
    name: 'Hero Donor',
    icon: '🦸',
    description: 'Completed 25 donations',
    category: 'donation',
    requirement: 25
  },
  {
    id: 'legend_donor',
    name: 'Legend Donor',
    icon: '👑',
    description: 'Completed 50 donations',
    category: 'donation',
    requirement: 50
  },
  {
    id: 'century_club',
    name: 'Century Club',
    icon: '💯',
    description: 'Completed 100 donations',
    category: 'donation',
    requirement: 100
  },
  {
    id: 'streak_master',
    name: 'Streak Master',
    icon: '🔥',
    description: 'Maintained a 3-donation streak',
    category: 'streak',
    requirement: 3
  },
  {
    id: 'streak_legend',
    name: 'Streak Legend',
    icon: '🔥🔥',
    description: 'Maintained a 5-donation streak',
    category: 'streak',
    requirement: 5
  },
  {
    id: 'lifesaver',
    name: 'Lifesaver',
    icon: '🏆',
    description: 'Responded to an emergency request',
    category: 'emergency',
    requirement: 1
  },
  {
    id: 'emergency_hero',
    name: 'Emergency Hero',
    icon: '🚨',
    description: 'Responded to 5 emergency requests',
    category: 'emergency',
    requirement: 5
  },
  {
    id: 'rare_hero',
    name: 'Rare Hero',
    icon: '💎',
    description: 'Donated rare blood type (AB-, B-, O-)',
    category: 'special',
    requirement: 1
  }
];

class GamificationService {
  private reportError(error: unknown, kind: string, metadata?: Record<string, unknown>) {
    void captureHandledError(error, {
      source: 'frontend',
      scope: 'donor',
      metadata: {
        kind,
        service: 'gamification',
        ...(metadata || {}),
      },
    });
  }

  private isOfflineFirestoreError(error: any): boolean {
    const code = error?.code || '';
    const message = String(error?.message || '').toLowerCase();
    return code === 'unavailable' || message.includes('client is offline');
  }

  private buildDefaultStats(userId: string, overrides: Partial<UserStats> = {}): UserStats {
    return {
      userId,
      totalDonations: 0,
      points: 0,
      currentStreak: 0,
      longestStreak: 0,
      emergencyResponses: 0,
      level: 1,
      nextLevelPoints: 500,
      ...overrides,
    };
  }

  private async getUserProfile(userId: string): Promise<User | null> {
    try {
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      return userSnap.exists() ? (userSnap.data() as User) : null;
    } catch (error) {
      if (!this.isOfflineFirestoreError(error)) {
        this.reportError(error, 'gamification.user_profile.fetch');
      }
      return null;
    }
  }

  private async buildStatsFromProfile(userId: string): Promise<UserStats> {
    const userProfile = await this.getUserProfile(userId);
    if (!userProfile) {
      return this.buildDefaultStats(userId);
    }

    const totalDonations = userProfile.totalDonations || 0;
    const fallbackPoints = userProfile.impactScore || (totalDonations * 100);

    return this.buildDefaultStats(userId, {
      totalDonations,
      points: fallbackPoints,
    });
  }

  private calculateBadgeProgress(
    badge: Omit<Badge, 'earned' | 'earnedDate' | 'progress'>,
    stats: UserStats,
    userData?: User | null
  ): number {
    switch (badge.category) {
      case 'donation':
        return Math.min(stats.totalDonations, badge.requirement);
      case 'streak':
        return Math.min(stats.currentStreak, badge.requirement);
      case 'emergency':
        return Math.min(stats.emergencyResponses, badge.requirement);
      case 'special':
        if (badge.id === 'rare_hero') {
          const rareBloodTypes = ['AB-', 'B-', 'O-'];
          return rareBloodTypes.includes(userData?.bloodType || '') ? 1 : 0;
        }
        return 0;
      default:
        return 0;
    }
  }

  private buildBadgeList(
    stats: UserStats,
    userData?: User | null,
    earnedBadgeIds?: Set<string>
  ): Badge[] {
    return BADGES.map(badge => {
      const progress = this.calculateBadgeProgress(badge, stats, userData);
      const earned = earnedBadgeIds
        ? earnedBadgeIds.has(badge.id)
        : progress >= badge.requirement;

      return {
        ...badge,
        earned,
        progress,
      };
    });
  }

  private parseDonationDate(value: any): Date | null {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') {
      try {
        return value.toDate();
      } catch (error) {
        return null;
      }
    }
    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) return parsed;
    }
    return null;
  }

  private calculateStreaksFromDates(dates: Date[]): { currentStreak: number; longestStreak: number } {
    if (dates.length === 0) return { currentStreak: 0, longestStreak: 0 };

    const sorted = [...dates].sort((a, b) => b.getTime() - a.getTime());
    let currentStreak = 1;
    let longestStreak = 1;
    let tempStreak = 1;

    for (let i = 1; i < sorted.length; i++) {
      const prevDate = sorted[i - 1];
      const currDate = sorted[i];
      const daysDiff = Math.abs((prevDate.getTime() - currDate.getTime()) / (1000 * 60 * 60 * 24));

      if (daysDiff <= 120) {
        tempStreak++;
        if (i === sorted.length - 1 || i === 0) {
          currentStreak = tempStreak;
        }
      } else {
        longestStreak = Math.max(longestStreak, tempStreak);
        tempStreak = 1;
      }
    }

    longestStreak = Math.max(longestStreak, tempStreak);

    return { currentStreak, longestStreak };
  }

  private buildDonationKey(date: Date | null, entry: any): string {
    if (!date) return '';
    const hospital = entry?.hospitalId || entry?.hospitalName || entry?.bloodBank || '';
    const location = entry?.location || entry?.city || '';
    return `${date.getTime()}::${hospital}::${location}`;
  }

  private async buildStatsFromDonations(userId: string, fallback: UserStats, userData?: User | null): Promise<UserStats> {
    try {
      const [donationsSnap, historySnap] = await Promise.all([
        getDocs(query(
          collection(db, 'donations'),
          where('donorId', '==', userId)
        )),
        getDoc(doc(db, 'DonationHistory', userId))
      ]);

      const seenKeys = new Set<string>();
      const dates: Date[] = [];

      donationsSnap.docs.forEach((snapshot) => {
        const data = snapshot.data();
        if (data?.status && data.status !== 'completed') return;
        const date = this.parseDonationDate(data?.donationDate);
        const idKey = snapshot.id;
        const fallbackKey = this.buildDonationKey(date, data);
        if (idKey && seenKeys.has(idKey)) return;
        if (!idKey && fallbackKey && seenKeys.has(fallbackKey)) return;
        if (idKey) seenKeys.add(idKey);
        if (fallbackKey) seenKeys.add(fallbackKey);
        if (date) dates.push(date);
      });

      if (historySnap.exists()) {
        const historyData = historySnap.data();
        const rawDonations = Array.isArray(historyData?.donations) ? historyData.donations : [];
        rawDonations.forEach((entry: any) => {
          if (entry?.status && entry.status === 'cancelled') return;
          const date = this.parseDonationDate(entry?.date ?? entry?.donationDate ?? entry?.createdAt);
          const idKey = entry?.legacyId || entry?.id || entry?.donationId;
          const fallbackKey = this.buildDonationKey(date, entry);
          if (idKey && seenKeys.has(idKey)) return;
          if (!idKey && fallbackKey && seenKeys.has(fallbackKey)) return;
          if (idKey) seenKeys.add(idKey);
          if (fallbackKey) seenKeys.add(fallbackKey);
          if (date) dates.push(date);
        });
      }

      const totalDonations = dates.length;
      const { currentStreak, longestStreak } = this.calculateStreaksFromDates(dates);
      const points = fallback.points || userData?.impactScore || totalDonations * 100;

      return {
        ...fallback,
        totalDonations: Math.max(fallback.totalDonations, totalDonations),
        currentStreak: Math.max(fallback.currentStreak, currentStreak),
        longestStreak: Math.max(fallback.longestStreak, longestStreak),
        points,
      };
    } catch (error) {
      if (!this.isOfflineFirestoreError(error)) {
        this.reportError(error, 'gamification.stats.derive_from_donations');
      }
      return fallback;
    }
  }

  /**
   * Get or create user stats
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const userStatsRef = doc(db, 'userStats', userId);
    try {
      const userStatsSnap = await getDoc(userStatsRef);

      if (userStatsSnap.exists()) {
        const data = userStatsSnap.data();
        return this.buildDefaultStats(userId, {
          totalDonations: data.totalDonations || 0,
          points: data.points || 0,
          currentStreak: data.currentStreak || 0,
          longestStreak: data.longestStreak || 0,
          emergencyResponses: data.emergencyResponses || 0,
          rank: data.rank,
          level: data.level || 1,
          nextLevelPoints: data.nextLevelPoints || 500,
        });
      }

      const initialStats = this.buildDefaultStats(userId);
      try {
        await setDoc(userStatsRef, {
          ...initialStats,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
      } catch (error) {
        if (!this.isOfflineFirestoreError(error)) {
          this.reportError(error, 'gamification.user_stats.create_default');
        }
      }

      return initialStats;
    } catch (error) {
      if (!this.isOfflineFirestoreError(error)) {
        this.reportError(error, 'gamification.user_stats.fetch');
      }
      return this.buildStatsFromProfile(userId);
    }
  }

  /**
   * Get user badges with progress
   */
  async getUserBadges(userId: string): Promise<Badge[]> {
    const stats = await this.getUserStats(userId);
    const userData = await this.getUserProfile(userId);

    try {
      const userBadgesRef = collection(db, 'userBadges');
      const q = query(userBadgesRef, where('userId', '==', userId));
      const userBadgesSnap = await getDocs(q);

      const earnedBadgeIds = new Set(
        userBadgesSnap.docs.map(doc => doc.data().badgeId)
      );

      const derivedStats = userBadgesSnap.empty || stats.totalDonations === 0
        ? await this.buildStatsFromDonations(userId, stats, userData)
        : stats;

      const computed = this.buildBadgeList(derivedStats, userData);
      const badges = computed;

      const missingEarned = computed.filter((badge) => badge.earned && !earnedBadgeIds.has(badge.id));
      if (missingEarned.length > 0) {
        const batch = writeBatch(db);
        missingEarned.forEach((badge) => {
          const userBadgeRef = doc(collection(db, 'userBadges'));
          batch.set(userBadgeRef, {
            userId,
            badgeId: badge.id,
            earnedAt: serverTimestamp(),
          });
        });
        try {
          await batch.commit();
        } catch (error) {
          if (!this.isOfflineFirestoreError(error)) {
            this.reportError(error, 'gamification.badges.backfill');
          }
        }
      }

      if (derivedStats !== stats && derivedStats) {
        try {
          const userStatsRef = doc(db, 'userStats', userId);
          await setDoc(
            userStatsRef,
            {
              totalDonations: derivedStats.totalDonations,
              currentStreak: derivedStats.currentStreak,
              longestStreak: derivedStats.longestStreak,
              points: derivedStats.points,
              updatedAt: serverTimestamp(),
            },
            { merge: true }
          );
        } catch (error) {
          if (!this.isOfflineFirestoreError(error)) {
            this.reportError(error, 'gamification.user_stats.backfill');
          }
        }
      }

      return badges;
    } catch (error) {
      if (!this.isOfflineFirestoreError(error)) {
        this.reportError(error, 'gamification.badges.fetch');
      }
      return this.buildBadgeList(stats, userData);
    }
  }

  /**
   * Award points to user
   */
  async awardPoints(userId: string, points: number, reason: string): Promise<void> {
    const userStatsRef = doc(db, 'userStats', userId);

    await updateDoc(userStatsRef, {
      points: increment(points),
      updatedAt: serverTimestamp(),
    });

    // Log point transaction
    const transactionRef = doc(collection(db, 'pointTransactions'));
    await setDoc(transactionRef, {
      userId,
      points,
      reason,
      timestamp: serverTimestamp(),
    });
  }

  /**
   * Check and award badges after donation
   */
  async checkAndAwardBadges(userId: string): Promise<Badge[]> {
    const badges = await this.getUserBadges(userId);
    const newlyEarned: Badge[] = [];

    for (const badge of badges) {
      if (!badge.earned && (badge.progress || 0) >= badge.requirement) {
        // Award the badge
        const userBadgeRef = doc(collection(db, 'userBadges'));
        await setDoc(userBadgeRef, {
          userId,
          badgeId: badge.id,
          earnedAt: serverTimestamp(),
        });

        // Award bonus points
        const bonusPoints = badge.requirement * 50; // 50 points per requirement unit
        await this.awardPoints(userId, bonusPoints, `Earned badge: ${badge.name}`);

        newlyEarned.push({
          ...badge,
          earned: true,
          earnedDate: new Date(),
        });
      }
    }

    return newlyEarned;
  }

  /**
   * Record donation and update stats
   */
  async recordDonation(userId: string): Promise<void> {
    const userStatsRef = doc(db, 'userStats', userId);
    const currentStats = await this.getUserStats(userId);

    // Update donation count
    await updateDoc(userStatsRef, {
      totalDonations: increment(1),
      currentStreak: increment(1),
      longestStreak: Math.max(currentStats.currentStreak + 1, currentStats.longestStreak),
      updatedAt: serverTimestamp(),
    });

    // Award points for donation
    await this.awardPoints(userId, 100, 'Blood donation');

    // Check for new badges
    await this.checkAndAwardBadges(userId);
  }

  /**
   * Record emergency response
   */
  async recordEmergencyResponse(userId: string): Promise<void> {
    const userStatsRef = doc(db, 'userStats', userId);

    await updateDoc(userStatsRef, {
      emergencyResponses: increment(1),
      updatedAt: serverTimestamp(),
    });

    // Award bonus points for emergency response
    await this.awardPoints(userId, 50, 'Emergency response');

    // Check for emergency badges
    await this.checkAndAwardBadges(userId);
  }

  /**
   * Get leaderboard (global or by city)
   */
  async getLeaderboard(city?: string, limitCount: number = 10): Promise<LeaderboardEntry[]> {
    const statsRef = collection(db, 'userStats');
    let q = query(statsRef, orderBy('points', 'desc'), limit(limitCount));

    const statsSnap = await getDocs(q);
    const leaderboard: LeaderboardEntry[] = [];

    let rank = 1;
    for (const statDoc of statsSnap.docs) {
      const statData = statDoc.data();
      const userId = statDoc.id;

      // Get user details
      const userRef = doc(db, 'users', userId);
      const userSnap = await getDoc(userRef);
      const userData = userSnap.data();

      // Filter by city if specified
      if (city && userData?.city !== city) {
        continue;
      }

      leaderboard.push({
        userId,
        displayName: userData?.displayName || 'Anonymous',
        photoURL: userData?.photoURL,
        points: statData.points || 0,
        totalDonations: statData.totalDonations || 0,
        rank: rank++,
        city: userData?.city,
        bloodType: userData?.bloodType,
      });
    }

    return leaderboard;
  }

  /**
   * Get user's rank
   */
  async getUserRank(userId: string): Promise<number> {
    const userStats = await this.getUserStats(userId);
    const statsRef = collection(db, 'userStats');
    const q = query(
      statsRef,
      where('points', '>', userStats.points),
      orderBy('points', 'desc')
    );

    const higherRankedSnap = await getDocs(q);
    return higherRankedSnap.size + 1;
  }
}

export const gamificationService = new GamificationService();
