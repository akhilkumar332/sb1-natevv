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
  serverTimestamp
} from 'firebase/firestore';
import { db } from '../firebase';

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
  /**
   * Get or create user stats
   */
  async getUserStats(userId: string): Promise<UserStats> {
    const userStatsRef = doc(db, 'userStats', userId);
    const userStatsSnap = await getDoc(userStatsRef);

    if (userStatsSnap.exists()) {
      const data = userStatsSnap.data();
      return {
        userId,
        totalDonations: data.totalDonations || 0,
        points: data.points || 0,
        currentStreak: data.currentStreak || 0,
        longestStreak: data.longestStreak || 0,
        emergencyResponses: data.emergencyResponses || 0,
        rank: data.rank,
        level: data.level || 1,
        nextLevelPoints: data.nextLevelPoints || 500,
      };
    }

    // Create initial stats
    const initialStats: UserStats = {
      userId,
      totalDonations: 0,
      points: 0,
      currentStreak: 0,
      longestStreak: 0,
      emergencyResponses: 0,
      level: 1,
      nextLevelPoints: 500,
    };

    await setDoc(userStatsRef, {
      ...initialStats,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return initialStats;
  }

  /**
   * Get user badges with progress
   */
  async getUserBadges(userId: string): Promise<Badge[]> {
    const stats = await this.getUserStats(userId);
    const userRef = doc(db, 'users', userId);
    const userSnap = await getDoc(userRef);
    const userData = userSnap.data();

    // Get user's earned badges
    const userBadgesRef = collection(db, 'userBadges');
    const q = query(userBadgesRef, where('userId', '==', userId));
    const userBadgesSnap = await getDocs(q);

    const earnedBadgeIds = new Set(
      userBadgesSnap.docs.map(doc => doc.data().badgeId)
    );

    return BADGES.map(badge => {
      const earned = earnedBadgeIds.has(badge.id);
      let progress = 0;

      // Calculate progress based on badge category
      switch (badge.category) {
        case 'donation':
          progress = Math.min(stats.totalDonations, badge.requirement);
          break;
        case 'streak':
          progress = Math.min(stats.currentStreak, badge.requirement);
          break;
        case 'emergency':
          progress = Math.min(stats.emergencyResponses, badge.requirement);
          break;
        case 'special':
          // Check for rare blood types
          if (badge.id === 'rare_hero') {
            const rareBloodTypes = ['AB-', 'B-', 'O-'];
            progress = rareBloodTypes.includes(userData?.bloodType || '') ? 1 : 0;
          }
          break;
      }

      return {
        ...badge,
        earned,
        progress,
      };
    });
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
