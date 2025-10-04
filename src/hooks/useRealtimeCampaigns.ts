/**
 * useRealtimeCampaigns Hook
 *
 * Real-time campaign monitoring using Firebase onSnapshot
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Campaign } from '../types/database.types';
import { extractQueryData } from '../utils/firestore.utils';

interface UseRealtimeCampaignsOptions {
  ngoId?: string;
  status?: 'draft' | 'active' | 'upcoming' | 'completed' | 'cancelled';
  city?: string;
  limitCount?: number;
  onNewCampaign?: (campaign: Campaign) => void;
}

interface UseRealtimeCampaignsResult {
  campaigns: Campaign[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook for real-time campaigns
 * Automatically updates when campaigns change
 */
export const useRealtimeCampaigns = ({
  ngoId,
  status,
  city,
  limitCount = 20,
  onNewCampaign,
}: UseRealtimeCampaignsOptions = {}): UseRealtimeCampaignsResult => {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Build query constraints
    const constraints: any[] = [];

    if (ngoId) {
      constraints.push(where('ngoId', '==', ngoId));
    }

    if (status) {
      constraints.push(where('status', '==', status));
    }

    if (city) {
      constraints.push(where('location.city', '==', city));
    }

    constraints.push(orderBy('startDate', 'desc'));
    constraints.push(limit(limitCount));

    const q = query(collection(db, 'campaigns'), ...constraints);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const campaignData = extractQueryData<Campaign>(snapshot, [
            'startDate',
            'endDate',
            'createdAt',
            'updatedAt',
          ]);

          // Detect new campaigns
          if (campaigns.length > 0 && campaignData.length > 0) {
            const latestCampaign = campaignData[0];
            const wasNew = !campaigns.find(c => c.id === latestCampaign.id);

            if (wasNew && onNewCampaign) {
              onNewCampaign(latestCampaign);
            }
          }

          setCampaigns(campaignData);
          setLoading(false);
        } catch (err) {
          console.error('Error processing campaigns:', err);
          setError('Failed to load campaigns');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to campaigns:', err);
        setError('Failed to listen to campaigns');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ngoId, status, city, limitCount]);

  return {
    campaigns,
    loading,
    error,
  };
};

/**
 * Hook for active campaigns only
 */
export const useActiveCampaigns = (city?: string): UseRealtimeCampaignsResult => {
  return useRealtimeCampaigns({
    status: 'active',
    city,
    limitCount: 20,
  });
};

/**
 * Hook for NGO's campaigns
 */
export const useNgoCampaigns = (ngoId: string): UseRealtimeCampaignsResult => {
  return useRealtimeCampaigns({
    ngoId,
    limitCount: 50,
  });
};

/**
 * Hook for single campaign real-time updates
 */
export const useRealtimeCampaign = (campaignId: string): {
  campaign: Campaign | null;
  loading: boolean;
  error: string | null;
} => {
  const [campaign, setCampaign] = useState<Campaign | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!campaignId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'campaigns'),
      where('__name__', '==', campaignId)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const campaigns = extractQueryData<Campaign>(snapshot, [
            'startDate',
            'endDate',
            'createdAt',
            'updatedAt',
          ]);

          setCampaign(campaigns.length > 0 ? campaigns[0] : null);
          setLoading(false);
        } catch (err) {
          console.error('Error processing campaign:', err);
          setError('Failed to load campaign');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to campaign:', err);
        setError('Failed to listen to campaign');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [campaignId]);

  return {
    campaign,
    loading,
    error,
  };
};

/**
 * Hook for campaign statistics with real-time updates
 */
export const useRealtimeCampaignStats = (
  campaignId: string
): {
  registeredCount: number;
  confirmedCount: number;
  volunteerCount: number;
  progressPercentage: number;
  loading: boolean;
} => {
  const { campaign, loading } = useRealtimeCampaign(campaignId);

  if (!campaign) {
    return {
      registeredCount: 0,
      confirmedCount: 0,
      volunteerCount: 0,
      progressPercentage: 0,
      loading,
    };
  }

  const registeredCount = campaign.registeredDonors?.length || 0;
  const confirmedCount = campaign.confirmedDonors?.length || 0;
  const volunteerCount = campaign.volunteers?.length || 0;
  const progressPercentage =
    campaign.target > 0 ? Math.round((campaign.achieved / campaign.target) * 100) : 0;

  return {
    registeredCount,
    confirmedCount,
    volunteerCount,
    progressPercentage,
    loading,
  };
};

/**
 * Hook for active campaign count
 */
export const useActiveCampaignCount = (ngoId?: string): number => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const constraints: any[] = [where('status', '==', 'active')];

    if (ngoId) {
      constraints.push(where('ngoId', '==', ngoId));
    }

    const q = query(collection(db, 'campaigns'), ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [ngoId]);

  return count;
};
