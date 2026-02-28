/**
 * useRealtimeCampaigns Hook
 *
 * Real-time campaign monitoring using Firebase onSnapshot
 */

import { useState, useEffect, useMemo, useRef } from 'react';
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
import { failRealtimeLoad, reportRealtimeError } from '../utils/realtimeError';
import { readCacheWithTtl, writeCache } from '../utils/cacheLifecycle';

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
  const campaignsRef = useRef<Campaign[]>([]);
  const onNewCampaignRef = useRef<typeof onNewCampaign>(onNewCampaign);
  const cacheKey = useMemo(() => {
    const key = [ngoId || 'all', status || 'all', city || 'all', limitCount].join('|');
    return `campaigns_cache_${encodeURIComponent(key)}`;
  }, [ngoId, status, city, limitCount]);
  const cacheTTL = 5 * 60 * 1000;

  useEffect(() => {
    campaignsRef.current = campaigns;
  }, [campaigns]);

  useEffect(() => {
    onNewCampaignRef.current = onNewCampaign;
  }, [onNewCampaign]);

  const serializeCampaigns = (items: Campaign[]) =>
    items.map((item) => ({
      ...item,
      startDate: item.startDate instanceof Date ? item.startDate.toISOString() : item.startDate,
      endDate: item.endDate instanceof Date ? item.endDate.toISOString() : item.endDate,
      createdAt: item.createdAt instanceof Date ? item.createdAt.toISOString() : item.createdAt,
      updatedAt: item.updatedAt instanceof Date ? item.updatedAt.toISOString() : item.updatedAt,
    }));

  const hydrateCampaigns = (items: any[] = []): Campaign[] =>
    items.map((item) => ({
      ...item,
      startDate: item.startDate ? new Date(item.startDate) : item.startDate,
      endDate: item.endDate ? new Date(item.endDate) : item.endDate,
      createdAt: item.createdAt ? new Date(item.createdAt) : item.createdAt,
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : item.updatedAt,
    }));

  useEffect(() => {
    setLoading(true);
    setError(null);
    let usedCache = false;
    const cachedCampaigns = readCacheWithTtl<{ campaigns: any[] }, Campaign[]>({
      storage: 'session',
      key: cacheKey,
      ttlMs: cacheTTL,
      kindPrefix: 'campaigns.cache',
      onError: (err) => {
        reportRealtimeError(
          { scope: 'unknown', hook: 'useRealtimeCampaigns' },
          err,
          'campaigns.cache.hydrate'
        );
      },
      hydrate: (payload) => hydrateCampaigns(payload?.campaigns || []),
    });
    if (cachedCampaigns) {
      setCampaigns(cachedCampaigns);
      setLoading(false);
      usedCache = true;
    }

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
          const previousCampaigns = campaignsRef.current;
          if (previousCampaigns.length > 0 && campaignData.length > 0) {
            const latestCampaign = campaignData[0];
            const wasNew = !previousCampaigns.find(c => c.id === latestCampaign.id);

            if (wasNew && onNewCampaignRef.current) {
              onNewCampaignRef.current(latestCampaign);
            }
          }

          setCampaigns(campaignData);
          if (!usedCache) {
            setLoading(false);
          }
          writeCache({
            storage: 'session',
            key: cacheKey,
            data: {
              campaigns: serializeCampaigns(campaignData),
            },
            kindPrefix: 'campaigns.cache',
            onError: (err) => {
              reportRealtimeError(
                { scope: 'unknown', hook: 'useRealtimeCampaigns' },
                err,
                'campaigns.cache.write'
              );
            },
          });
        } catch (err) {
          failRealtimeLoad(
            { scope: 'unknown', hook: 'useRealtimeCampaigns' },
            {
              error: err,
              kind: 'campaigns.process',
              fallbackMessage: 'Failed to load campaigns',
              setError,
              setLoading,
            }
          );
        }
      },
      (err) => {
        failRealtimeLoad(
          { scope: 'unknown', hook: 'useRealtimeCampaigns' },
          {
            error: err,
            kind: 'campaigns.listen',
            fallbackMessage: 'Failed to listen to campaigns',
            setError,
            setLoading,
          }
        );
      }
    );

    return () => unsubscribe();
  }, [ngoId, status, city, limitCount, cacheKey]);

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
          failRealtimeLoad(
            { scope: 'unknown', hook: 'useRealtimeCampaign' },
            {
              error: err,
              kind: 'campaign.process',
              fallbackMessage: 'Failed to load campaign',
              setError,
              setLoading,
            }
          );
        }
      },
      (err) => {
        failRealtimeLoad(
          { scope: 'unknown', hook: 'useRealtimeCampaign' },
          {
            error: err,
            kind: 'campaign.listen',
            fallbackMessage: 'Failed to listen to campaign',
            setError,
            setLoading,
          }
        );
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

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCount(snapshot.size);
      },
      (err) => {
        reportRealtimeError(
          { scope: ngoId ? 'ngo' : 'unknown', hook: 'useActiveCampaignCount' },
          err,
          'campaigns.active_count.listen',
          { ngoId: ngoId || null }
        );
      }
    );

    return () => unsubscribe();
  }, [ngoId]);

  return count;
};
