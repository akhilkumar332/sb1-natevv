/**
 * Custom hook for NGO Dashboard data
 * Fetches all NGO-related data from Firestore
 */

import { useMemo, useState, useEffect, useRef } from 'react';
import { collection, query, where, limit, onSnapshot, getDocs, documentId, writeBatch, doc } from 'firebase/firestore';
import { db } from '../firebase';
import { getServerTimestamp } from '../utils/firestore.utils';

export interface Campaign {
  id: string;
  title: string;
  type: 'blood-drive' | 'awareness' | 'fundraising' | 'volunteer';
  status: 'active' | 'upcoming' | 'completed' | 'draft' | 'cancelled';
  startDate: Date;
  endDate: Date;
  target: number;
  achieved: number;
  targetType?: 'units' | 'donors' | 'funds' | 'volunteers';
  location: string;
  city?: string;
  state?: string;
  description?: string;
  registeredDonors?: string[] | number;
  confirmedDonors?: number;
  locationDetails?: {
    address?: string;
    city?: string;
    state?: string;
    latitude?: number;
    longitude?: number;
    venue?: string;
  };
}

export interface Volunteer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  joinDate: Date;
  hoursContributed: number;
  status: 'active' | 'inactive';
  skills?: string[];
  availability?: string;
}

export interface Partnership {
  id: string;
  organization: string;
  organizationId?: string;
  type: 'bloodbank' | 'hospital' | 'corporate' | 'community' | 'government';
  since: Date;
  donations: number;
  status: 'active' | 'pending' | 'inactive';
  contactPerson?: string;
  contactEmail?: string;
  contactPhone?: string;
}

export interface DonorCommunity {
  totalDonors: number;
  activeDonors: number;
  newThisMonth: number;
  retentionRate: number;
}

export interface DonorSummary {
  id: string;
  name: string;
  email?: string | null;
  phone?: string | null;
  bloodType?: string;
  city?: string;
  state?: string;
  latitude?: number;
  longitude?: number;
  isAvailable?: boolean;
  lastDonation?: Date;
  totalDonations?: number;
  createdAt?: Date;
}

export interface NgoStats {
  totalCampaigns: number;
  activeCampaigns: number;
  totalVolunteers: number;
  activeVolunteers: number;
  totalPartnerships: number;
  bloodUnitsCollected: number;
  fundsRaised: number;
  peopleImpacted: number;
}

interface UseNgoDataReturn {
  campaigns: Campaign[];
  volunteers: Volunteer[];
  partnerships: Partnership[];
  donorCommunity: DonorCommunity;
  stats: NgoStats;
  getParticipantDonors: (donorIds: string[]) => Promise<DonorSummary[]>;
  loading: boolean;
  error: string | null;
  refreshData: (options?: { silent?: boolean }) => Promise<void>;
}

export const useNgoData = (ngoId: string): UseNgoDataReturn => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [volunteers, setVolunteers] = useState<Volunteer[]>([]);
  const [partnerships, setPartnerships] = useState<Partnership[]>([]);
  const [donorCommunity, setDonorCommunity] = useState<DonorCommunity>({
    totalDonors: 0,
    activeDonors: 0,
    newThisMonth: 0,
    retentionRate: 0,
  });
  const [stats, setStats] = useState<NgoStats>({
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalVolunteers: 0,
    activeVolunteers: 0,
    totalPartnerships: 0,
    bloodUnitsCollected: 0,
    fundsRaised: 0,
    peopleImpacted: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const autoCompleteRef = useRef<{ lastRun: number; inFlight: boolean }>({ lastRun: 0, inFlight: false });

  const cacheKey = useMemo(() => (ngoId ? `ngo_dashboard_cache_${ngoId}` : ''), [ngoId]);
  const cacheTTL = 5 * 60 * 1000;
  const participantsCacheTTL = 5 * 60 * 1000;

  const serializeCampaigns = (items: Campaign[]) =>
    items.map((campaign) => ({
      ...campaign,
      startDate: campaign.startDate?.toISOString(),
      endDate: campaign.endDate?.toISOString(),
    }));

  const serializeVolunteers = (items: Volunteer[]) =>
    items.map((volunteer) => ({
      ...volunteer,
      joinDate: volunteer.joinDate?.toISOString(),
      email: undefined,
      phone: undefined,
    }));

  const serializePartnerships = (items: Partnership[]) =>
    items.map((partner) => ({
      ...partner,
      since: partner.since?.toISOString(),
      contactEmail: undefined,
      contactPhone: undefined,
    }));

  const hydrateCampaigns = (items: any[] = []): Campaign[] =>
    items.map((campaign) => ({
      ...campaign,
      startDate: campaign.startDate ? new Date(campaign.startDate) : new Date(),
      endDate: campaign.endDate ? new Date(campaign.endDate) : new Date(),
    }));

  const hydrateVolunteers = (items: any[] = []): Volunteer[] =>
    items.map((volunteer) => ({
      ...volunteer,
      joinDate: volunteer.joinDate ? new Date(volunteer.joinDate) : new Date(),
    }));

  const hydratePartnerships = (items: any[] = []): Partnership[] =>
    items.map((partner) => ({
      ...partner,
      since: partner.since ? new Date(partner.since) : new Date(),
    }));

  const buildLocationLabel = (locationData: any): string => {
    if (!locationData) return '';
    if (typeof locationData === 'string') return locationData;
    if (locationData.address) return locationData.address;
    if (locationData.venue) return locationData.venue;
    const parts = [locationData.city, locationData.state].filter(Boolean);
    return parts.join(', ');
  };

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      const campaignsRef = collection(db, 'campaigns');
      const q = query(
        campaignsRef,
        where('ngoId', '==', ngoId),
        limit(50)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const campaignList: Campaign[] = snapshot.docs.map(doc => {
          const data = doc.data();
          const locationData = data.location;
          const registeredCount = Array.isArray(data.registeredDonors)
            ? data.registeredDonors.length
            : typeof data.registeredDonors === 'number'
              ? data.registeredDonors
              : 0;
          return {
            id: doc.id,
            title: data.title || data.name || '',
            type: data.type || 'blood-drive',
            status: data.status || 'draft',
            startDate: data.startDate?.toDate() || new Date(),
            endDate: data.endDate?.toDate() || new Date(),
            target: data.target || data.targetDonors || 0,
            achieved: data.achieved || registeredCount || 0,
            targetType: data.targetType,
            location: buildLocationLabel(locationData) || (typeof data.location === 'string' ? data.location : ''),
            city: data.city || locationData?.city,
            state: data.state || locationData?.state,
            description: data.description,
            registeredDonors: Array.isArray(data.registeredDonors)
              ? data.registeredDonors
              : typeof data.registeredDonors === 'number'
                ? data.registeredDonors
                : [],
            confirmedDonors: data.confirmedDonors?.length || 0,
            locationDetails: typeof locationData === 'object'
              ? {
                  address: locationData.address,
                  city: locationData.city,
                  state: locationData.state,
                  latitude: locationData.latitude,
                  longitude: locationData.longitude,
                  venue: locationData.venue,
                }
              : undefined,
          };
        });
        const sorted = [...campaignList].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
        setCampaigns(sorted);
      });

      return unsubscribe;
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError('Failed to load campaigns');
      return () => {};
    }
  };

  const fetchCampaignsOnce = async () => {
    try {
      const campaignsRef = collection(db, 'campaigns');
      const q = query(
        campaignsRef,
        where('ngoId', '==', ngoId),
        limit(50)
      );
      const snapshot = await getDocs(q);
      const campaignList: Campaign[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const locationData = data.location;
        const registeredCount = Array.isArray(data.registeredDonors)
          ? data.registeredDonors.length
          : typeof data.registeredDonors === 'number'
            ? data.registeredDonors
            : 0;
        return {
          id: doc.id,
          title: data.title || data.name || '',
          type: data.type || 'blood-drive',
          status: data.status || 'draft',
          startDate: data.startDate?.toDate() || new Date(),
          endDate: data.endDate?.toDate() || new Date(),
          target: data.target || data.targetDonors || 0,
          achieved: data.achieved || registeredCount || 0,
          targetType: data.targetType,
          location: buildLocationLabel(locationData) || (typeof data.location === 'string' ? data.location : ''),
          city: data.city || locationData?.city,
          state: data.state || locationData?.state,
          description: data.description,
          registeredDonors: Array.isArray(data.registeredDonors)
            ? data.registeredDonors
            : typeof data.registeredDonors === 'number'
              ? data.registeredDonors
              : [],
          confirmedDonors: data.confirmedDonors?.length || 0,
          locationDetails: typeof locationData === 'object'
            ? {
                address: locationData.address,
                city: locationData.city,
                state: locationData.state,
                latitude: locationData.latitude,
                longitude: locationData.longitude,
                venue: locationData.venue,
              }
            : undefined,
        };
      });
      const sorted = [...campaignList].sort((a, b) => b.startDate.getTime() - a.startDate.getTime());
      setCampaigns(sorted);
    } catch (err) {
      console.error('Error fetching campaigns:', err);
    }
  };

  // Fetch volunteers
  const fetchVolunteers = async () => {
    try {
      const volunteersRef = collection(db, 'volunteers');
      const q = query(
        volunteersRef,
        where('ngoId', '==', ngoId),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const volunteerList: Volunteer[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          name: data.name || data.displayName || '',
          email: data.email || '',
          phone: data.phone || data.phoneNumber,
          role: data.role || 'Volunteer',
          joinDate: data.joinedAt?.toDate() || data.joinDate?.toDate() || data.createdAt?.toDate() || new Date(),
          hoursContributed: data.hoursContributed || 0,
          status: data.status || 'active',
          skills: data.skills || [],
          availability: data.availability,
        };
      });
      const sorted = [...volunteerList].sort((a, b) => b.joinDate.getTime() - a.joinDate.getTime());
      setVolunteers(sorted);
    } catch (err) {
      console.error('Error fetching volunteers:', err);
    }
  };

  // Fetch partnerships
  const fetchPartnerships = async () => {
    try {
      const partnershipsRef = collection(db, 'partnerships');
      const q = query(
        partnershipsRef,
        where('ngoId', '==', ngoId),
        limit(30)
      );

      const snapshot = await getDocs(q);
      const partnershipList: Partnership[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          organization: data.partnerName || data.organization || data.name || '',
          organizationId: data.organizationId || data.partnerId,
          type: data.partnerType || data.type || 'corporate',
          since: data.startDate?.toDate() || data.since?.toDate() || data.createdAt?.toDate() || new Date(),
          donations: data.totalDonations || data.donations || 0,
          status: data.status || 'active',
          contactPerson: data.contactPerson,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
        };
      });
      const sorted = [...partnershipList].sort((a, b) => b.since.getTime() - a.since.getTime());
      setPartnerships(sorted);
    } catch (err) {
      console.error('Error fetching partnerships:', err);
    }
  };

  const fetchDonorCommunity = async () => {
    try {
      const donorsRef = collection(db, 'users');
      const donorsQuery = query(donorsRef, where('role', '==', 'donor'));
      const allDonorsSnap = await getDocs(donorsQuery);

      const eligibleDonors = allDonorsSnap.docs
        .map((doc) => doc.data())
        .filter((data: any) => data && data.status !== 'deleted' && data.onboardingCompleted !== false)
        .filter((data: any) => !data.status || data.status === 'active');

      const totalDonors = eligibleDonors.length;

      const publicSnap = await getDocs(collection(db, 'publicDonors'));
      const activeDonors = publicSnap.docs
        .map((doc) => doc.data())
        .filter((data: any) => data && data.status !== 'deleted' && data.onboardingCompleted !== false)
        .filter((data: any) => data.isAvailable === true).length;

      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const newThisMonth = eligibleDonors.filter((data: any) => {
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : null;
        return createdAt && createdAt >= oneMonthAgo;
      }).length;

      const retentionRate = totalDonors > 0 ? (activeDonors / totalDonors) * 100 : 0;

      setDonorCommunity({
        totalDonors,
        activeDonors,
        newThisMonth,
        retentionRate: Math.round(retentionRate * 10) / 10,
      });
    } catch (err) {
      console.error('Error fetching donor community:', err);
    }
  };


  // Calculate stats
  const calculateStats = () => {
    const activeCampaigns = campaigns.filter(c => c.status === 'active').length;
    const activeVolunteers = volunteers.filter(v => v.status === 'active').length;

    const bloodUnitsCollected = campaigns
      .filter(c => c.type === 'blood-drive')
      .reduce((sum, c) => sum + c.achieved, 0);

    const fundsRaised = campaigns
      .filter(c => c.type === 'fundraising')
      .reduce((sum, c) => sum + c.achieved, 0);

    const peopleImpacted = bloodUnitsCollected * 3;

    setStats({
      totalCampaigns: campaigns.length,
      activeCampaigns,
      totalVolunteers: volunteers.length,
      activeVolunteers,
      totalPartnerships: partnerships.length,
      bloodUnitsCollected,
      fundsRaised,
      peopleImpacted,
    });
  };

  useEffect(() => {
    if (!ngoId) return;
    let isActive = true;
    let unsubscribeCampaigns: (() => void) | null = null;
    let idleFetchId: number | null = null;
    let timeoutFetchId: ReturnType<typeof setTimeout> | null = null;

    const loadData = async () => {
      let usedCache = false;
      setError(null);

      if (typeof window !== 'undefined' && cacheKey) {
        const sanitizeCache = (payload: any) => {
          const safeCampaigns = Array.isArray(payload?.campaigns) ? payload.campaigns : [];
          const safeVolunteers = Array.isArray(payload?.volunteers)
            ? payload.volunteers.map((volunteer: any) => ({
                ...volunteer,
                email: undefined,
                phone: undefined,
              }))
            : [];
          const safePartnerships = Array.isArray(payload?.partnerships)
            ? payload.partnerships.map((partner: any) => ({
                ...partner,
                contactEmail: undefined,
                contactPhone: undefined,
              }))
            : [];
          return {
            timestamp: payload?.timestamp || Date.now(),
            campaigns: safeCampaigns,
            volunteers: safeVolunteers,
            partnerships: safePartnerships,
            donorCommunity: payload?.donorCommunity || donorCommunity,
            stats: payload?.stats || stats,
          };
        };

        if (window.localStorage && window.sessionStorage) {
          const legacyRaw = window.localStorage.getItem(cacheKey);
          if (legacyRaw) {
            try {
              const legacy = JSON.parse(legacyRaw);
              const sanitized = sanitizeCache(legacy);
              let shouldWrite = true;
              const existingRaw = window.sessionStorage.getItem(cacheKey);
              if (existingRaw) {
                try {
                  const existing = JSON.parse(existingRaw);
                  if (existing?.timestamp && existing.timestamp > sanitized.timestamp) {
                    shouldWrite = false;
                  }
                } catch {
                  // ignore
                }
              }
              if (shouldWrite) {
                window.sessionStorage.setItem(cacheKey, JSON.stringify(sanitized));
              }
            } catch (err) {
              console.warn('Failed to migrate NGO dashboard cache', err);
            }
            window.localStorage.removeItem(cacheKey);
          }
        }

        if (window.sessionStorage) {
          const cachedRaw = window.sessionStorage.getItem(cacheKey);
          if (cachedRaw) {
            try {
              const cached = sanitizeCache(JSON.parse(cachedRaw));
              if (cached?.timestamp && Date.now() - cached.timestamp < cacheTTL) {
                setCampaigns(hydrateCampaigns(cached.campaigns));
                setVolunteers(hydrateVolunteers(cached.volunteers));
                setPartnerships(hydratePartnerships(cached.partnerships));
                setDonorCommunity(cached.donorCommunity || donorCommunity);
                setStats(cached.stats || stats);
                setLoading(false);
                usedCache = true;
              }
            } catch (err) {
              console.warn('Failed to hydrate NGO dashboard cache', err);
            }
          }
        }
      }
      if (!usedCache) {
        setLoading(true);
      }

      const runFetch = async () => {
        try {
          unsubscribeCampaigns = await fetchCampaigns();

          if (!isActive) return;
          if (!usedCache) {
            setLoading(false);
          }

          await fetchVolunteers();
          await fetchPartnerships();
          await fetchDonorCommunity();
        } catch (err) {
          if (!isActive) return;
          console.error('Error loading NGO data:', err);
          setError('Failed to load NGO data');
          setLoading(false);
        }
      };

      if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
        idleFetchId = (window as any).requestIdleCallback(() => {
          void runFetch();
        });
      } else {
        timeoutFetchId = setTimeout(() => {
          void runFetch();
        }, 0);
      }
    };

    void loadData();

    return () => {
      isActive = false;
      if (idleFetchId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleFetchId);
      }
      if (timeoutFetchId !== null) {
        window.clearTimeout(timeoutFetchId);
      }
      if (unsubscribeCampaigns) {
        unsubscribeCampaigns();
      }
    };
  }, [ngoId]);

  useEffect(() => {
    if (!ngoId || campaigns.length === 0) return;
    if (autoCompleteRef.current.inFlight) return;
    const now = Date.now();
    if (now - autoCompleteRef.current.lastRun < 5 * 60 * 1000) {
      return;
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const toComplete = campaigns.filter((campaign) => {
      if (!campaign?.endDate) return false;
      const endDate = campaign.endDate instanceof Date ? campaign.endDate : new Date(campaign.endDate);
      if (Number.isNaN(endDate.getTime())) return false;
      const isPast = endDate < today;
      const isActiveLike = campaign.status === 'active' || campaign.status === 'upcoming';
      return isPast && isActiveLike;
    });
    if (toComplete.length === 0) {
      autoCompleteRef.current.lastRun = now;
      return;
    }
    autoCompleteRef.current.inFlight = true;
    const batch = writeBatch(db);
    toComplete.forEach((campaign) => {
      batch.update(doc(db, 'campaigns', campaign.id), {
        status: 'completed',
        completedAt: getServerTimestamp(),
        updatedAt: getServerTimestamp(),
      });
    });
    batch.commit()
      .catch((error) => {
        console.warn('Failed to auto-complete past campaigns', error);
      })
      .finally(() => {
        autoCompleteRef.current.lastRun = Date.now();
        autoCompleteRef.current.inFlight = false;
      });
  }, [campaigns, ngoId]);

  useEffect(() => {
    if (!loading && campaigns.length >= 0) {
      calculateStats();
    }
  }, [campaigns, volunteers, partnerships, loading]);

  useEffect(() => {
    if (!cacheKey || loading) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const payload = {
      timestamp: Date.now(),
      campaigns: serializeCampaigns(campaigns),
      volunteers: serializeVolunteers(volunteers),
      partnerships: serializePartnerships(partnerships),
      donorCommunity,
      stats,
    };
    try {
      window.sessionStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to write NGO dashboard cache', err);
    }
  }, [cacheKey, loading, campaigns, volunteers, partnerships, donorCommunity, stats]);

  const refreshData = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setError(null);
    }
    await Promise.all([
      fetchCampaignsOnce(),
      fetchVolunteers(),
      fetchPartnerships(),
      fetchDonorCommunity(),
    ]);
  };

  const getParticipantDonors = async (donorIds: string[]): Promise<DonorSummary[]> => {
    if (!Array.isArray(donorIds) || donorIds.length === 0) return [];
    const normalized = Array.from(new Set(donorIds.filter(Boolean)));
    if (normalized.length === 0) return [];
    const cacheKey = `ngo_campaign_participants_${normalized.slice().sort().join('_')}`;
    if (typeof window !== 'undefined' && window.sessionStorage) {
      const cachedRaw = window.sessionStorage.getItem(cacheKey);
      if (cachedRaw) {
        try {
          const cached = JSON.parse(cachedRaw);
          if (cached?.timestamp && Date.now() - cached.timestamp < participantsCacheTTL) {
            return Array.isArray(cached.donors)
              ? cached.donors.map((donor: any) => ({
                  ...donor,
                  lastDonation: donor.lastDonation ? new Date(donor.lastDonation) : undefined,
                  createdAt: donor.createdAt ? new Date(donor.createdAt) : undefined,
                }))
              : [];
          }
        } catch (error) {
          console.warn('Failed to parse campaign participants cache', error);
        }
      }
    }

    const donors: DonorSummary[] = [];
    const chunks: string[][] = [];
    for (let index = 0; index < normalized.length; index += 10) {
      chunks.push(normalized.slice(index, index + 10));
    }
    try {
      const queries = chunks.map((chunk) =>
        getDocs(query(collection(db, 'users'), where(documentId(), 'in', chunk)))
      );
      const snapshots = await Promise.all(queries);
      snapshots.forEach((snapshot) => {
        snapshot.docs.forEach((docSnap) => {
          const data = docSnap.data();
          donors.push({
            id: docSnap.id,
            name: data.displayName || data.name || 'Donor',
            email: data.email,
            phone: data.phoneNumber,
            bloodType: data.bloodType,
            city: data.city,
            state: data.state,
            latitude: typeof data.latitude === 'number'
              ? data.latitude
              : typeof data.location?.latitude === 'number'
                ? data.location.latitude
                : undefined,
            longitude: typeof data.longitude === 'number'
              ? data.longitude
              : typeof data.location?.longitude === 'number'
                ? data.location.longitude
                : undefined,
            isAvailable: data.isAvailable,
            lastDonation: data.lastDonation?.toDate ? data.lastDonation.toDate() : data.lastDonation ? new Date(data.lastDonation) : undefined,
            totalDonations: data.totalDonations,
            createdAt: data.createdAt?.toDate ? data.createdAt.toDate() : data.createdAt ? new Date(data.createdAt) : undefined,
          });
        });
      });
    } catch (error) {
      console.error('Failed to load participant donors', error);
    }

    const ordered = normalized
      .map((id) => donors.find((donor) => donor.id === id))
      .filter(Boolean) as DonorSummary[];

    if (typeof window !== 'undefined' && window.sessionStorage) {
      try {
        const sanitized = ordered.map((donor) => ({
          ...donor,
          email: undefined,
          phone: undefined,
          lastDonation: donor.lastDonation ? donor.lastDonation.toISOString() : undefined,
          createdAt: donor.createdAt ? donor.createdAt.toISOString() : undefined,
        }));
        window.sessionStorage.setItem(
          cacheKey,
          JSON.stringify({
            timestamp: Date.now(),
            donors: sanitized,
          })
        );
      } catch (error) {
        console.warn('Failed to write participant donors cache', error);
      }
    }

    return ordered;
  };

  return {
    campaigns,
    volunteers,
    partnerships,
    donorCommunity,
    stats,
    getParticipantDonors,
    loading,
    error,
    refreshData,
  };
};
