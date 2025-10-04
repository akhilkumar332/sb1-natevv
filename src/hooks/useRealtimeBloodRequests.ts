/**
 * useRealtimeBloodRequests Hook
 *
 * Real-time blood request monitoring using Firebase onSnapshot
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
import { BloodRequest } from '../types/database.types';
import { extractQueryData } from '../utils/firestore.utils';

interface UseRealtimeBloodRequestsOptions {
  status?: 'active' | 'fulfilled' | 'partially_fulfilled' | 'expired' | 'cancelled';
  bloodType?: string;
  city?: string;
  isEmergency?: boolean;
  limitCount?: number;
  onNewRequest?: (request: BloodRequest) => void;
}

interface UseRealtimeBloodRequestsResult {
  requests: BloodRequest[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook for real-time blood requests
 * Automatically updates when requests change
 */
export const useRealtimeBloodRequests = ({
  status,
  bloodType,
  city,
  isEmergency,
  limitCount = 20,
  onNewRequest,
}: UseRealtimeBloodRequestsOptions = {}): UseRealtimeBloodRequestsResult => {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);

    // Build query constraints
    const constraints: any[] = [];

    if (status) {
      constraints.push(where('status', '==', status));
    }

    if (bloodType) {
      constraints.push(where('bloodType', '==', bloodType));
    }

    if (city) {
      constraints.push(where('location.city', '==', city));
    }

    if (isEmergency !== undefined) {
      constraints.push(where('isEmergency', '==', isEmergency));
    }

    constraints.push(orderBy('requestedAt', 'desc'));
    constraints.push(limit(limitCount));

    const q = query(collection(db, 'bloodRequests'), ...constraints);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const requestData = extractQueryData<BloodRequest>(snapshot, [
            'requestedAt',
            'neededBy',
            'expiresAt',
            'fulfilledAt',
            'createdAt',
            'updatedAt',
          ]);

          // Detect new requests
          if (requests.length > 0 && requestData.length > 0) {
            const latestRequest = requestData[0];
            const wasNew = !requests.find(r => r.id === latestRequest.id);

            if (wasNew && onNewRequest) {
              onNewRequest(latestRequest);
            }
          }

          setRequests(requestData);
          setLoading(false);
        } catch (err) {
          console.error('Error processing blood requests:', err);
          setError('Failed to load blood requests');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to blood requests:', err);
        setError('Failed to listen to blood requests');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [status, bloodType, city, isEmergency, limitCount]);

  return {
    requests,
    loading,
    error,
  };
};

/**
 * Hook for emergency blood requests only
 */
export const useEmergencyBloodRequests = (
  bloodType?: string,
  city?: string
): UseRealtimeBloodRequestsResult => {
  return useRealtimeBloodRequests({
    status: 'active',
    isEmergency: true,
    bloodType,
    city,
    limitCount: 10,
  });
};

/**
 * Hook for hospital's blood requests
 */
export const useHospitalBloodRequests = (
  hospitalId: string
): UseRealtimeBloodRequestsResult => {
  const [requests, setRequests] = useState<BloodRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hospitalId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const q = query(
      collection(db, 'bloodRequests'),
      where('requesterId', '==', hospitalId),
      orderBy('requestedAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const requestData = extractQueryData<BloodRequest>(snapshot, [
            'requestedAt',
            'neededBy',
            'expiresAt',
            'fulfilledAt',
            'createdAt',
            'updatedAt',
          ]);

          setRequests(requestData);
          setLoading(false);
        } catch (err) {
          console.error('Error processing hospital requests:', err);
          setError('Failed to load requests');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to hospital requests:', err);
        setError('Failed to listen to requests');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [hospitalId]);

  return {
    requests,
    loading,
    error,
  };
};

/**
 * Hook for active blood requests count
 */
export const useActiveBloodRequestCount = (): number => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const q = query(
      collection(db, 'bloodRequests'),
      where('status', '==', 'active')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCount(snapshot.size);
    });

    return () => unsubscribe();
  }, []);

  return count;
};
