/**
 * Custom hook for Donor Dashboard data
 * Fetches all donor-related data from Firestore
 */

import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  limit,
  onSnapshot,
  getDocs,
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
  Timestamp
} from 'firebase/firestore';
import { db } from '../firebase';
import { gamificationService } from '../services/gamification.service';

export interface DonationHistory {
  id: string;
  date: Date;
  location: string;
  latitude?: number | null;
  longitude?: number | null;
  bloodBank: string;
  hospitalId: string;
  hospitalName: string;
  quantity: string;
  donationType?: 'whole' | 'platelets' | 'plasma';
  status: 'completed' | 'scheduled' | 'cancelled';
  certificateUrl?: string;
  units: number;
  notes?: string;
  source?: 'manual' | 'legacy' | 'verified';
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
  emergencyResponses: number;
  rank?: number;
  badges: Badge[];
}

interface UseDonorDataReturn {
  donationHistory: DonationHistory[];
  firstDonationDate: Date | null;
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
  const [firstDonationDate, setFirstDonationDate] = useState<Date | null>(null);
  const [emergencyRequests, setEmergencyRequests] = useState<EmergencyRequest[]>([]);
  const [bloodCamps, setBloodCamps] = useState<BloodCamp[]>([]);
  const [stats, setStats] = useState<DonorStats | null>(null);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const legacySyncRef = useRef(false);

  const parseDonationDate = (value: any): Date | null => {
    if (!value) return null;
    if (value instanceof Date) return value;
    if (typeof value?.toDate === 'function') return value.toDate();
    if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
    return null;
  };

  const inferDonationType = (entry: any): DonationHistory['donationType'] => {
    const rawType = entry?.donationType
      || entry?.type
      || entry?.component
      || entry?.componentType
      || entry?.donationComponent;
    const rawTypeString = typeof rawType === 'string' ? rawType.toLowerCase() : '';
    const quantityString = typeof entry?.quantity === 'string' ? entry.quantity.toLowerCase() : '';
    const combined = `${rawTypeString} ${quantityString}`;
    if (combined.includes('platelet')) return 'platelets';
    if (combined.includes('plasma')) return 'plasma';
    if (combined.includes('whole') || combined.includes('blood') || quantityString.includes('ml')) return 'whole';
    return undefined;
  };

  const mapDonationEntry = (entry: any, fallbackId: string): DonationHistory => {
    const dateValue = parseDonationDate(entry?.date ?? entry?.donationDate);
    const sourceValue = entry?.source || (entry?.legacyId || entry?.hospitalId ? 'verified' : 'manual');
    const locationValue = typeof entry?.location === 'string'
      ? entry.location
      : entry?.location?.city || '';
    return {
      id: entry?.id || entry?.legacyId || fallbackId,
      date: dateValue || new Date(),
      location: locationValue,
      latitude: typeof entry?.latitude === 'number' ? entry.latitude : null,
      longitude: typeof entry?.longitude === 'number' ? entry.longitude : null,
      bloodBank: entry?.bloodBank || entry?.hospitalName || '',
      hospitalId: entry?.hospitalId || '',
      hospitalName: entry?.hospitalName || '',
      quantity: entry?.quantity || '450ml',
      donationType: entry?.donationType || inferDonationType(entry),
      status: entry?.status || 'completed',
      certificateUrl: entry?.certificateUrl,
      units: entry?.units || 1,
      notes: entry?.notes || '',
      source: sourceValue,
    };
  };

  const syncDonationHistoryFromLegacy = async () => {
    if (!userId) return;
    try {
      const historyRef = doc(db, 'DonationHistory', userId);
      const [historySnapshot, legacySnapshot] = await Promise.all([
        getDoc(historyRef),
        getDocs(query(
          collection(db, 'donations'),
          where('donorId', '==', userId),
          limit(50)
        ))
      ]);

      const existingDonations = historySnapshot.exists() && Array.isArray(historySnapshot.data().donations)
        ? historySnapshot.data().donations
        : [];
      const existingLegacyIds = new Set(
        existingDonations
          .map((entry: any) => entry?.legacyId)
          .filter(Boolean)
      );

      const legacyDonations = legacySnapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        const locationValue = typeof data.location === 'string'
          ? data.location
          : data.location?.city || '';
        return {
          legacyId: docSnapshot.id,
          id: docSnapshot.id,
          date: data.donationDate ? data.donationDate : Timestamp.now(),
          location: locationValue,
          bloodBank: data.hospitalName || data.bloodBank || '',
          hospitalId: data.hospitalId || '',
          hospitalName: data.hospitalName || '',
          quantity: data.quantity || '450ml',
          status: data.status || 'completed',
          certificateUrl: data.certificateUrl,
          units: data.units || 1,
          notes: data.notes || '',
          source: 'verified',
        };
      });

      const mergedDonations = [...existingDonations];
      legacyDonations.forEach((entry) => {
        if (!existingLegacyIds.has(entry.legacyId)) {
          mergedDonations.push(entry);
        }
      });

      const sorted = mergedDonations
        .sort((a: any, b: any) => {
          const dateA = parseDonationDate(a?.date ?? a?.donationDate)?.getTime() || 0;
          const dateB = parseDonationDate(b?.date ?? b?.donationDate)?.getTime() || 0;
          return dateB - dateA;
        })
        .slice(0, 20);

      const lastDonationDate = sorted.length > 0 ? parseDonationDate(sorted[0].date ?? sorted[0].donationDate) : null;

      await setDoc(
        historyRef,
        {
          userId,
          donations: sorted,
          lastDonationDate: lastDonationDate ? Timestamp.fromDate(lastDonationDate) : null,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
    } catch (err) {
      console.error('Error syncing legacy donation history:', err);
    }
  };

  useEffect(() => {
    legacySyncRef.current = false;
  }, [userId]);

  // Real-time stats listener
  useEffect(() => {
    if (!userId) return;
    const userStatsRef = doc(db, 'userStats', userId);
    const unsubscribe = onSnapshot(userStatsRef, (snapshot) => {
      if (!snapshot.exists()) return;
      const data = snapshot.data();
      setStats((prev) => {
        const totalDonationsValue = data.totalDonations ?? prev?.totalDonations ?? 0;
        const pointsValue = typeof data.points === 'number' ? data.points : prev?.impactScore;
        const impactScoreValue = pointsValue && pointsValue > 0 ? pointsValue : totalDonationsValue * 100;
        return {
          totalDonations: totalDonationsValue,
          livesSaved: totalDonationsValue * 3,
          nextEligibleDate: prev?.nextEligibleDate ?? null,
          daysUntilEligible: prev?.daysUntilEligible ?? 0,
          impactScore: impactScoreValue,
          streak: data.currentStreak ?? prev?.streak ?? 0,
          emergencyResponses: data.emergencyResponses ?? prev?.emergencyResponses ?? 0,
          rank: data.rank ?? prev?.rank,
          badges: prev?.badges ?? [],
        };
      });
    });
    return () => unsubscribe();
  }, [userId]);

  // Fetch donation history
  const fetchDonationHistory = async () => {
    try {
      if (!legacySyncRef.current) {
        legacySyncRef.current = true;
        void syncDonationHistoryFromLegacy();
      }

      const historyRef = doc(db, 'DonationHistory', userId);
      const unsubscribe = onSnapshot(historyRef, (snapshot) => {
        if (!snapshot.exists()) {
          setDonationHistory([]);
          setFirstDonationDate(null);
          return;
        }

        const data = snapshot.data();
        const rawDonations = Array.isArray(data.donations) ? data.donations : [];
        const mapped = rawDonations.map((entry: any, index: number) => (
          mapDonationEntry(entry, `donation-${index}`)
        ));

        if (mapped.length === 0) {
          setDonationHistory([]);
          setFirstDonationDate(null);
          return;
        }

        const sortedDonations = [...mapped]
          .sort((a, b) => b.date.getTime() - a.date.getTime())
          .slice(0, 20);

        const oldestDonation = mapped.reduce((oldest, donation) => (
          donation.date < oldest ? donation.date : oldest
        ), mapped[0].date);

        setDonationHistory(sortedDonations);
        setFirstDonationDate(oldestDonation);
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
        emergencyResponses: userStats.emergencyResponses || 0,
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

        setLoading(false);

        // Fetch camps and stats in background
        void fetchBloodCamps();
        void fetchStatsAndBadges();

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
    await syncDonationHistoryFromLegacy();
    await fetchDonationHistory();
    await fetchEmergencyRequests();
    await fetchBloodCamps();
    await fetchStatsAndBadges();
    setLoading(false);
  };

  return {
    donationHistory,
    firstDonationDate,
    emergencyRequests,
    bloodCamps,
    stats,
    badges,
    loading,
    error,
    refreshData,
  };
};
