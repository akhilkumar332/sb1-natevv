/**
 * Custom hook for NGO Dashboard data
 * Fetches all NGO-related data from Firestore
 */

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export interface Campaign {
  id: string;
  title: string;
  type: 'blood-drive' | 'awareness' | 'fundraising' | 'volunteer';
  status: 'active' | 'upcoming' | 'completed' | 'draft';
  startDate: Date;
  endDate: Date;
  target: number;
  achieved: number;
  location: string;
  city?: string;
  description?: string;
  registeredDonors?: number;
  confirmedDonors?: number;
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
  type: 'hospital' | 'corporate' | 'community' | 'government';
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
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
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

  // Fetch campaigns
  const fetchCampaigns = async () => {
    try {
      const campaignsRef = collection(db, 'campaigns');
      const q = query(
        campaignsRef,
        where('ngoId', '==', ngoId),
        orderBy('startDate', 'desc'),
        limit(20)
      );

      const unsubscribe = onSnapshot(q, (snapshot) => {
        const campaignList: Campaign[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            title: data.title || data.name || '',
            type: data.type || 'blood-drive',
            status: data.status || 'draft',
            startDate: data.startDate?.toDate() || new Date(),
            endDate: data.endDate?.toDate() || new Date(),
            target: data.target || data.targetDonors || 0,
            achieved: data.achieved || data.registeredDonors?.length || 0,
            location: data.location || '',
            city: data.city,
            description: data.description,
            registeredDonors: data.registeredDonors?.length || 0,
            confirmedDonors: data.confirmedDonors?.length || 0,
          };
        });
        setCampaigns(campaignList);
      });

      return unsubscribe;
    } catch (err) {
      console.error('Error fetching campaigns:', err);
      setError('Failed to load campaigns');
      return () => {};
    }
  };

  // Fetch volunteers
  const fetchVolunteers = async () => {
    try {
      const volunteersRef = collection(db, 'volunteers');
      const q = query(
        volunteersRef,
        where('ngoId', '==', ngoId),
        orderBy('joinDate', 'desc'),
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
          joinDate: data.joinDate?.toDate() || data.createdAt?.toDate() || new Date(),
          hoursContributed: data.hoursContributed || 0,
          status: data.status || 'active',
          skills: data.skills || [],
          availability: data.availability,
        };
      });
      setVolunteers(volunteerList);
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
        orderBy('createdAt', 'desc'),
        limit(30)
      );

      const snapshot = await getDocs(q);
      const partnershipList: Partnership[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          organization: data.organization || data.name || '',
          organizationId: data.organizationId || data.partnerId,
          type: data.type || 'corporate',
          since: data.since?.toDate() || data.createdAt?.toDate() || new Date(),
          donations: data.donations || data.totalDonations || 0,
          status: data.status || 'active',
          contactPerson: data.contactPerson,
          contactEmail: data.contactEmail,
          contactPhone: data.contactPhone,
        };
      });
      setPartnerships(partnershipList);
    } catch (err) {
      console.error('Error fetching partnerships:', err);
    }
  };

  // Fetch donor community stats
  const fetchDonorCommunity = async () => {
    try {
      // Get all donors - in production, you'd filter by NGO relationship
      const donorsRef = collection(db, 'donors');
      const allDonorsSnap = await getDocs(donorsRef);

      const totalDonors = allDonorsSnap.size;
      const activeDonors = allDonorsSnap.docs.filter(doc =>
        doc.data().isAvailable === true
      ).length;

      // Calculate new donors this month
      const oneMonthAgo = new Date();
      oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);

      const newThisMonth = allDonorsSnap.docs.filter(doc => {
        const createdAt = doc.data().createdAt?.toDate();
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

    // Sum up blood units collected from campaigns
    const bloodUnitsCollected = campaigns
      .filter(c => c.type === 'blood-drive')
      .reduce((sum, c) => sum + c.achieved, 0);

    // Sum up funds raised
    const fundsRaised = campaigns
      .filter(c => c.type === 'fundraising')
      .reduce((sum, c) => sum + c.achieved, 0);

    // Calculate people impacted (blood units * 3)
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

  // Initial data fetch
  useEffect(() => {
    if (!ngoId) return;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Set up real-time listener for campaigns
        const unsubscribeCampaigns = await fetchCampaigns();

        // Fetch other data
        await Promise.all([
          fetchVolunteers(),
          fetchPartnerships(),
          fetchDonorCommunity(),
        ]);

        setLoading(false);

        // Cleanup listener on unmount
        return () => {
          unsubscribeCampaigns();
        };
      } catch (err) {
        console.error('Error loading NGO data:', err);
        setError('Failed to load NGO data');
        setLoading(false);
      }
    };

    loadData();
  }, [ngoId]);

  // Recalculate stats when data changes
  useEffect(() => {
    if (!loading && campaigns.length >= 0) {
      calculateStats();
    }
  }, [campaigns, volunteers, partnerships, loading]);

  const refreshData = async () => {
    setLoading(true);
    await fetchCampaigns();
    await fetchVolunteers();
    await fetchPartnerships();
    await fetchDonorCommunity();
    setLoading(false);
  };

  return {
    campaigns,
    volunteers,
    partnerships,
    donorCommunity,
    stats,
    loading,
    error,
    refreshData,
  };
};
