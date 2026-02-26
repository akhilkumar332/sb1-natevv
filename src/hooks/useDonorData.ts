/**
 * Custom hook for Donor Dashboard data
 * Fetches all donor-related data from Firestore
 */

import { useState, useEffect, useRef, useMemo } from 'react';
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
  refreshData: (options?: { silent?: boolean }) => Promise<void>;
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
  const isOfflineFirestoreError = (error: any) => {
    const code = error?.code || '';
    const message = String(error?.message || '').toLowerCase();
    return code === 'unavailable' || message.includes('client is offline');
  };
  const cacheKey = useMemo(() => (userId ? `donor_dashboard_cache_${userId}` : ''), [userId]);
  const cacheTTL = 5 * 60 * 1000;

  const serializeDonationHistory = (items: DonationHistory[]) =>
    items.map((entry) => ({
      ...entry,
      date: entry.date?.toISOString(),
      certificateUrl: undefined,
      notes: undefined,
    }));

  const serializeEmergencyRequests = (items: EmergencyRequest[]) =>
    items.map((item) => ({
      ...item,
      requestedAt: item.requestedAt?.toISOString(),
      contactPhone: undefined,
      patientInfo: undefined,
    }));

  const serializeBloodCamps = (items: BloodCamp[]) =>
    items.map((item) => ({
      ...item,
      date: item.date?.toISOString(),
    }));

  const serializeBadges = (items: Badge[]) =>
    items.map((badge) => ({
      ...badge,
      earnedDate: badge.earnedDate?.toISOString(),
    }));

  const serializeStats = (value: DonorStats | null) => {
    if (!value) return null;
    return {
      ...value,
      nextEligibleDate: value.nextEligibleDate?.toISOString() ?? null,
      badges: serializeBadges(value.badges || []),
    };
  };

  const hydrateDonationHistory = (items: any[] = []): DonationHistory[] =>
    items.map((entry) => ({
      ...entry,
      date: entry.date ? new Date(entry.date) : new Date(),
    }));

  const hydrateEmergencyRequests = (items: any[] = []): EmergencyRequest[] =>
    items.map((item) => ({
      ...item,
      requestedAt: item.requestedAt ? new Date(item.requestedAt) : new Date(),
    }));

  const hydrateBloodCamps = (items: any[] = []): BloodCamp[] =>
    items.map((item) => ({
      ...item,
      date: item.date ? new Date(item.date) : new Date(),
    }));

  const hydrateBadges = (items: any[] = []): Badge[] =>
    items.map((badge) => ({
      ...badge,
      earnedDate: badge.earnedDate ? new Date(badge.earnedDate) : undefined,
    }));

  const hydrateStats = (value: any | null): DonorStats | null => {
    if (!value) return null;
    return {
      ...value,
      nextEligibleDate: value.nextEligibleDate ? new Date(value.nextEligibleDate) : null,
      badges: hydrateBadges(value.badges || []),
    };
  };

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
      if (!isOfflineFirestoreError(err)) {
        console.error('Error syncing legacy donation history:', err);
      }
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

  const fetchDonationHistoryOnce = async () => {
    if (!userId) return;
    try {
      const historyRef = doc(db, 'DonationHistory', userId);
      const snapshot = await getDoc(historyRef);
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
    } catch (err) {
      console.error('Error fetching donation history (once):', err);
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
            hospitalName: data.hospitalName || data.hospital || 'BloodBank',
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

  const fetchEmergencyRequestsOnce = async () => {
    if (!bloodType) return;
    try {
      const requestsRef = collection(db, 'bloodRequests');
      const q = query(
        requestsRef,
        where('bloodType', '==', bloodType),
        limit(20)
      );
      const snapshot = await getDocs(q);
      const allRequests: EmergencyRequest[] = snapshot.docs.map(docSnapshot => {
        const data = docSnapshot.data();
        return {
          id: docSnapshot.id,
          bloodType: data.bloodType,
          units: data.units || data.unitsNeeded || 1,
          urgency: data.urgency || 'medium',
          hospitalName: data.hospitalName || data.hospital || 'BloodBank',
          hospitalId: data.hospitalId || '',
          location: data.location || data.city || '',
          city: data.city || '',
          requestedAt: data.createdAt?.toDate() || data.requestedAt?.toDate() || new Date(),
          patientInfo: data.patientInfo,
          contactPhone: data.contactPhone,
          status: data.status || 'active',
        };
      });
      const urgencyOrder = { critical: 3, high: 2, medium: 1 };
      const activeRequests = allRequests
        .filter(r => r.status === 'active')
        .sort((a, b) => {
          const urgencyDiff = (urgencyOrder[b.urgency] || 0) - (urgencyOrder[a.urgency] || 0);
          if (urgencyDiff !== 0) return urgencyDiff;
          return b.requestedAt.getTime() - a.requestedAt.getTime();
        })
        .slice(0, 5);
      setEmergencyRequests(activeRequests);
    } catch (err) {
      console.error('Error fetching emergency requests (once):', err);
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
      if (!isOfflineFirestoreError(err)) {
        console.error('Error fetching stats and badges:', err);
        setError('Failed to load donor stats');
      }
    }
  };

  // Initial data fetch
  useEffect(() => {
    if (!userId) return;
    let isActive = true;
    let unsubscribeDonations: (() => void) | null = null;
    let unsubscribeRequests: (() => void) | null = null;
    let idleTaskId: number | null = null;
    let timeoutTaskId: ReturnType<typeof setTimeout> | null = null;

    const loadData = async () => {
      setError(null);
      let usedCache = false;
      if (cacheKey && typeof window !== 'undefined' && window.sessionStorage) {
        const cachedRaw = window.sessionStorage.getItem(cacheKey);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw);
            if (cached.timestamp && Date.now() - cached.timestamp < cacheTTL) {
              if (cached.donationHistory) {
                const hydrated = hydrateDonationHistory(cached.donationHistory);
                setDonationHistory(hydrated);
                if (cached.firstDonationDate) {
                  setFirstDonationDate(new Date(cached.firstDonationDate));
                } else if (hydrated.length > 0) {
                  const oldestDonation = hydrated.reduce((oldest, donation) => (
                    donation.date < oldest ? donation.date : oldest
                  ), hydrated[0].date);
                  setFirstDonationDate(oldestDonation);
                }
              }
              if (cached.emergencyRequests) {
                setEmergencyRequests(hydrateEmergencyRequests(cached.emergencyRequests));
              }
              if (cached.bloodCamps) {
                setBloodCamps(hydrateBloodCamps(cached.bloodCamps));
              }
              if (cached.stats) {
                setStats(hydrateStats(cached.stats));
              }
              if (cached.badges) {
                setBadges(hydrateBadges(cached.badges));
              }
              setLoading(false);
              usedCache = true;
            }
          } catch (err) {
            console.warn('Failed to hydrate donor dashboard cache', err);
          }
        }
      }
      if (!usedCache) {
        setLoading(true);
      }
      setError(null);

      try {
        // Set up real-time listeners
        unsubscribeDonations = await fetchDonationHistory();
        unsubscribeRequests = await fetchEmergencyRequests();

        if (!isActive) return;
        if (!usedCache) {
          setLoading(false);
        }

        // Fetch camps and stats in background
        const scheduleBackground = (task: () => void) => {
          if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
            idleTaskId = (window as any).requestIdleCallback(task);
          } else {
            timeoutTaskId = setTimeout(task, 0);
          }
        };

        scheduleBackground(() => {
          if (!isActive) return;
          void fetchBloodCamps();
          void fetchStatsAndBadges();
        });
      } catch (err) {
        if (!isActive) return;
        console.error('Error loading donor data:', err);
        setError('Failed to load donor data');
        setLoading(false);
      }
    };

    void loadData();

    return () => {
      isActive = false;
      if (idleTaskId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleTaskId);
      }
      if (timeoutTaskId !== null) {
        window.clearTimeout(timeoutTaskId);
      }
      if (unsubscribeDonations) {
        unsubscribeDonations();
      }
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }
    };
  }, [userId, bloodType, city]);

  // Refresh stats after donation history changes
  useEffect(() => {
    if (donationHistory.length > 0 && !loading) {
      fetchStatsAndBadges();
    }
  }, [donationHistory.length]);

  const refreshData = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setLoading(true);
    }
    await syncDonationHistoryFromLegacy();
    await fetchDonationHistoryOnce();
    await fetchEmergencyRequestsOnce();
    await fetchBloodCamps();
    await fetchStatsAndBadges();
    if (!options?.silent) {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!cacheKey || loading) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const payload = {
      timestamp: Date.now(),
      donationHistory: serializeDonationHistory(donationHistory),
      firstDonationDate: firstDonationDate?.toISOString() ?? null,
      emergencyRequests: serializeEmergencyRequests(emergencyRequests),
      bloodCamps: serializeBloodCamps(bloodCamps),
      stats: serializeStats(stats),
      badges: serializeBadges(badges),
    };
    try {
      window.sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to write donor dashboard cache', err);
    }
  }, [cacheKey, loading, donationHistory, firstDonationDate, emergencyRequests, bloodCamps, stats, badges]);

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
