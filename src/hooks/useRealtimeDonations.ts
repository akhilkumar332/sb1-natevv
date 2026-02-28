/**
 * useRealtimeDonations Hook
 *
 * Real-time donation monitoring using Firebase onSnapshot
 */

import { useState, useEffect, useRef } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Donation } from '../types/database.types';
import { extractQueryData } from '../utils/firestore.utils';
import { failRealtimeLoad } from '../utils/realtimeError';

interface UseRealtimeDonationsOptions {
  donorId?: string;
  hospitalId?: string;
  status?: 'scheduled' | 'completed' | 'cancelled';
  limitCount?: number;
  onNewDonation?: (donation: Donation) => void;
}

interface UseRealtimeDonationsResult {
  donations: Donation[];
  loading: boolean;
  error: string | null;
  totalDonations: number;
  completedDonations: number;
}

/**
 * Hook for real-time donations
 * Automatically updates when donations change
 */
export const useRealtimeDonations = ({
  donorId,
  hospitalId,
  status,
  limitCount = 20,
  onNewDonation,
}: UseRealtimeDonationsOptions = {}): UseRealtimeDonationsResult => {
  const [donations, setDonations] = useState<Donation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const donationsRef = useRef<Donation[]>([]);
  const onNewDonationRef = useRef<typeof onNewDonation>(onNewDonation);

  useEffect(() => {
    donationsRef.current = donations;
  }, [donations]);

  useEffect(() => {
    onNewDonationRef.current = onNewDonation;
  }, [onNewDonation]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Build query constraints
    const constraints: any[] = [];

    if (donorId) {
      constraints.push(where('donorId', '==', donorId));
    }

    if (hospitalId) {
      constraints.push(where('hospitalId', '==', hospitalId));
    }

    if (status) {
      constraints.push(where('status', '==', status));
    }

    constraints.push(orderBy('donationDate', 'desc'));
    constraints.push(limit(limitCount));

    const q = query(collection(db, 'donations'), ...constraints);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const donationData = extractQueryData<Donation>(snapshot, [
            'donationDate',
            'createdAt',
            'updatedAt',
          ]);

          // Detect new donations
          const previousDonations = donationsRef.current;
          if (previousDonations.length > 0 && donationData.length > 0) {
            const latestDonation = donationData[0];
            const wasNew = !previousDonations.find(d => d.id === latestDonation.id);

            if (wasNew && onNewDonationRef.current) {
              onNewDonationRef.current(latestDonation);
            }
          }

          setDonations(donationData);
          setLoading(false);
        } catch (err) {
          failRealtimeLoad(
            { scope: 'unknown', hook: 'useRealtimeDonations' },
            {
              error: err,
              kind: 'donations.process',
              fallbackMessage: 'Failed to load donations',
              setError,
              setLoading,
            }
          );
        }
      },
      (err) => {
        failRealtimeLoad(
          { scope: 'unknown', hook: 'useRealtimeDonations' },
          {
            error: err,
            kind: 'donations.listen',
            fallbackMessage: 'Failed to listen to donations',
            setError,
            setLoading,
          }
        );
      }
    );

    return () => unsubscribe();
  }, [donorId, hospitalId, status, limitCount]);

  const totalDonations = donations.length;
  const completedDonations = donations.filter(d => d.status === 'completed').length;

  return {
    donations,
    loading,
    error,
    totalDonations,
    completedDonations,
  };
};

/**
 * Hook for donor's donation history
 */
export const useDonorDonationHistory = (donorId: string): UseRealtimeDonationsResult => {
  return useRealtimeDonations({
    donorId,
    limitCount: 50,
  });
};

/**
 * Hook for blood bank's donations
 */
export const useBloodBankDonations = (hospitalId: string): UseRealtimeDonationsResult => {
  return useRealtimeDonations({
    hospitalId,
    limitCount: 50,
  });
};

// Legacy alias
export const useHospitalDonations = useBloodBankDonations;

/**
 * Hook for donation statistics with real-time updates
 */
export const useRealtimeDonationStats = (
  donorId?: string,
  hospitalId?: string
): {
  totalDonations: number;
  completedDonations: number;
  totalUnits: number;
  loading: boolean;
} => {
  const { donations, loading } = useRealtimeDonations({
    donorId,
    hospitalId,
    limitCount: 1000,
  });

  const completed = donations.filter(d => d.status === 'completed');
  const totalUnits = completed.reduce((sum, d) => sum + (d.units || 0), 0);

  return {
    totalDonations: donations.length,
    completedDonations: completed.length,
    totalUnits,
    loading,
  };
};
