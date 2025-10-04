/**
 * Custom hook for Donor Dashboard data
 * Fetches all donor-related data from Firestore
 */

import { useState, useEffect } from 'react';
import { collection, query, where, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { gamificationService } from '../services/gamification.service';

export interface DonationHistory {
  id: string;
  date: Date;
  location: string;
  bloodBank: string;
  hospitalId: string;
  hospitalName: string;
  quantity: string;
  status: 'completed' | 'scheduled' | 'cancelled';
  certificateUrl?: string;
  units: number;
}

export interface Badge {
  id: string;
  name: string;
  icon: string;
  description: string;
  earned: boolean;
  earnedDate?: Date;
  progress?: number;
  requirement?: number;
}

export interface EmergencyRequest {
  id: string;
  bloodType: string;
  units: number;
  urgency: 'critical' | 'high' | 'medium';
  hospitalName: string;
  hospitalId: string;
  location: string;
  city: string;
  distance?: number;
  requestedAt: Date;
  patientInfo?: string;
  contactPhone?: string;
  status: 'active' | 'fulfilled' | 'expired';
}

export interface BloodCamp {
  id: string;
  name: string;
  organizerName: string;
  location: string;
  city: string;
  address: string;
  date: Date;
  startTime: string;
  endTime: string;
  distance?: number;
  registeredCount?: number;
  capacity?: number;
}

export interface DonorStats {
  totalDonations: number;
  livesSaved: number;
  nextEligibleDate: Date | null;
  daysUntilEligible: number;
  impactScore: number;
  streak: number;
  rank?: number;
  badges: Badge[];
}

interface UseDonorDataReturn {
  donationHistory: DonationHistory[];
  emergencyRequests: EmergencyRequest[];
  bloodCamps: BloodCamp[];
  stats: DonorStats | null;
  badges: Badge[];
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export const useDonorData = (userId: string, bloodType?: string, city?: string): UseDonorDataReturn => {
  const [donationHistory, setDonationHistory] = useState<DonationHistory[]>([]);
  const [emergencyRequests, setEmergencyRequests] = useState<EmergencyRequest[]>([]);
  const [bloodCamps, setBloodCamps] = useState<BloodCamp[]>([]);
  const [stats, setStats] = useState<DonorStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch donation history
  const fetchDonationHistory = async () => {
    try {
      const donationsRef = collection(db, 'donations');
      // Simplified query - fetch by donorId only, then sort in memory
      // This avoids needing a composite index (donorId + donationDate)
      const q = query(
        donationsRef,
        where('donorId', '==', userId),
        limit(20) // Fetch more to allow client-side sorting
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allDonations: DonationHistory[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            date: data.donationDate?.toDate() || new Date(),
            location: data.location || '',
            bloodBank: data.hospitalName || data.bloodBank || '',
            hospitalId: data.hospitalId || '',
            hospitalName: data.hospitalName || '',
            quantity: data.quantity || '450ml',
            status: data.status || 'completed',
            certificateUrl: data.certificateUrl,
            units: data.units || 1,
          };
        });

        // Sort by date descending (newest first) client-side
        const sortedDonations = allDonations
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 10); // Take top 10

        setDonationHistory(sortedDonations);
      });

      return unsubscribe;
    } catch (err) {
      console.error('Error fetching donation history:', err);
      setError('Failed to load donation history');
      return () => {};
    }
  };

  // Fetch emergency blood requests matching donor's blood type and city
  const fetchEmergencyRequests = async () => {
    if (!bloodType) return () => {};

    try {
      const requestsRef = collection(db, 'bloodRequests');
      // Simplified query - fetch by blood type only, then filter and sort in memory
      const q = query(
        requestsRef,
        where('bloodType', '==', bloodType),
        limit(20) // Fetch more to allow client-side filtering
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const allRequests: EmergencyRequest[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            bloodType: data.bloodType,
            units: data.units || data.unitsNeeded || 1,
            urgency: data.urgency || 'medium',
            hospitalName: data.hospitalName || data.hospital || 'Hospital',
            hospitalId: data.hospitalId || '',
            location: data.location || data.city || '',
            city: data.city || '',
            requestedAt: data.createdAt?.toDate() || data.requestedAt?.toDate() || new Date(),
            patientInfo: data.patientInfo,
            contactPhone: data.contactPhone,
            status: data.status || 'active',
          };
        });

        // Filter for active requests and sort by urgency then date (client-side)
        const urgencyOrder = { critical: 3, high: 2, medium: 1 };
        const activeRequests = allRequests
          .filter(r => r.status === 'active')
          .sort((a, b) => {
            // Sort by urgency first
            const urgencyDiff = (urgencyOrder[b.urgency] || 0) - (urgencyOrder[a.urgency] || 0);
            if (urgencyDiff !== 0) return urgencyDiff;
            // Then by date (newest first)
            return b.requestedAt.getTime() - a.requestedAt.getTime();
          })
          .slice(0, 5); // Take top 5

        setEmergencyRequests(activeRequests);
      });

      return unsubscribe;
    } catch (err) {
      console.error('Error fetching emergency requests:', err);
      setError('Failed to load emergency requests');
      return () => {};
    }
  };

  // Fetch nearby blood camps
  const fetchBloodCamps = async () => {
    if (!city) return;

    try {
      const campsRef = collection(db, 'campaigns');
      // Simplified query - fetch by type only, then filter and sort in memory
      const q = query(
        campsRef,
        where('type', '==', 'blood-drive'),
        limit(20) // Fetch more to allow client-side filtering
      );

      const snapshot = await getDocs(q);
      const allCamps: BloodCamp[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || data.title || 'Blood Camp',
          organizerName: data.organizerName || data.ngoName || 'Organizer',
          location: data.location || '',
          city: data.city || '',
          address: data.address || data.location || '',
          date: data.startDate?.toDate() || data.date?.toDate() || new Date(),
          startTime: data.startTime || '10:00 AM',
          endTime: data.endTime || '4:00 PM',
          registeredCount: data.registeredDonors?.length || 0,
          capacity: data.targetDonors || data.target || 100,
        };
      });

      // Filter for active status and city, then sort by date (client-side)
      const now = new Date();
      const activeCamps = allCamps
        .filter(camp => {
          // Filter by city (case-insensitive)
          const matchesCity = camp.city.toLowerCase() === city.toLowerCase();
          // Filter for future camps only
          const isFuture = camp.date >= now;
          return matchesCity && isFuture;
        })
        .sort((a, b) => a.date.getTime() - b.date.getTime()) // Sort by date ascending
        .slice(0, 5); // Take top 5

      setBloodCamps(activeCamps);
    } catch (err) {
      console.error('Error fetching blood camps:', err);
    }
  };

  // Fetch donor stats and badges using gamification service
  const fetchStatsAndBadges = async () => {
    try {
      // Get user badges
      const userBadges = await gamificationService.getUserBadges(userId);
      setBadges(userBadges);

      // Get user stats
      const userStats = await gamificationService.getUserStats(userId);

      // Calculate lives saved (each donation saves ~3 lives)
      const livesSaved = userStats.totalDonations * 3;

      // Calculate next eligible date (90 days after last donation)
      let nextEligibleDate: Date | null = null;
      let daysUntilEligible = 0;

      if (donationHistory.length > 0) {
        const lastDonation = donationHistory[0].date;
        nextEligibleDate = new Date(lastDonation);
        nextEligibleDate.setDate(nextEligibleDate.getDate() + 90);

        const today = new Date();
        const diffTime = nextEligibleDate.getTime() - today.getTime();
        daysUntilEligible = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (daysUntilEligible < 0) {
          daysUntilEligible = 0;
          nextEligibleDate = null;
        }
      }

      // Calculate impact score
      const impactScore = userStats.points || (userStats.totalDonations * 100);

      setStats({
        totalDonations: userStats.totalDonations,
        livesSaved,
        nextEligibleDate,
        daysUntilEligible,
        impactScore,
        streak: userStats.currentStreak || 0,
        rank: userStats.rank,
        badges: userBadges,
      });
    } catch (err) {
      console.error('Error fetching stats and badges:', err);
      setError('Failed to load donor stats');
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (!userId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Set up real-time listeners
        const unsubscribeDonations = await fetchDonationHistory();
        const unsubscribeRequests = await fetchEmergencyRequests();

        // Fetch camps and stats
        await fetchBloodCamps();
        await fetchStatsAndBadges();

        setLoading(false);

        // Cleanup listeners on unmount
        return () => {
          unsubscribeDonations();
          unsubscribeRequests();
        };
      } catch (err) {
        console.error('Error loading donor data:', err);
        setError('Failed to load donor data');
        setLoading(false);
      }
    };

    loadData();
  }, [userId, bloodType, city]);

  // Refresh stats after donation history changes
  useEffect(() => {
    if (donationHistory.length > 0 && !loading) {
      fetchStatsAndBadges();
    }
  }, [donationHistory.length]);

  const refreshData = async () => {
    setLoading(true);
    await fetchDonationHistory();
    await fetchEmergencyRequests();
    await fetchBloodCamps();
    await fetchStatsAndBadges();
    setLoading(false);
  };

  return {
    donationHistory,
    emergencyRequests,
    bloodCamps,
    stats,
    badges,
    loading,
    error,
    refreshData,
  };
};
