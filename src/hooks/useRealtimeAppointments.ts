/**
 * useRealtimeAppointments Hook
 *
 * Real-time appointment monitoring using Firebase onSnapshot
 */

import { useState, useEffect } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  limit,
  onSnapshot,
  Timestamp,
} from 'firebase/firestore';
import { db } from '../firebase';
import { Appointment } from '../types/database.types';
import { extractQueryData } from '../utils/firestore.utils';

interface UseRealtimeAppointmentsOptions {
  donorId?: string;
  hospitalId?: string;
  status?: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  limitCount?: number;
  upcomingOnly?: boolean;
  onNewAppointment?: (appointment: Appointment) => void;
}

interface UseRealtimeAppointmentsResult {
  appointments: Appointment[];
  loading: boolean;
  error: string | null;
}

/**
 * Hook for real-time appointments
 * Automatically updates when appointments change
 */
export const useRealtimeAppointments = ({
  donorId,
  hospitalId,
  status,
  limitCount = 20,
  upcomingOnly = false,
  onNewAppointment,
}: UseRealtimeAppointmentsOptions = {}): UseRealtimeAppointmentsResult => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

    if (upcomingOnly) {
      constraints.push(where('scheduledDate', '>=', Timestamp.now()));
    }

    constraints.push(orderBy('scheduledDate', upcomingOnly ? 'asc' : 'desc'));
    constraints.push(limit(limitCount));

    const q = query(collection(db, 'appointments'), ...constraints);

    // Set up real-time listener
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const appointmentData = extractQueryData<Appointment>(snapshot, [
            'scheduledDate',
            'reminderSentAt',
            'completedAt',
            'createdAt',
            'updatedAt',
          ]);

          // Detect new appointments
          if (appointments.length > 0 && appointmentData.length > 0) {
            const latestAppointment = appointmentData[0];
            const wasNew = !appointments.find(a => a.id === latestAppointment.id);

            if (wasNew && onNewAppointment) {
              onNewAppointment(latestAppointment);
            }
          }

          setAppointments(appointmentData);
          setLoading(false);
        } catch (err) {
          console.error('Error processing appointments:', err);
          setError('Failed to load appointments');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to appointments:', err);
        setError('Failed to listen to appointments');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [donorId, hospitalId, status, limitCount, upcomingOnly]);

  return {
    appointments,
    loading,
    error,
  };
};

/**
 * Hook for donor's upcoming appointments
 */
export const useDonorUpcomingAppointments = (
  donorId: string
): UseRealtimeAppointmentsResult => {
  return useRealtimeAppointments({
    donorId,
    upcomingOnly: true,
    status: undefined,
    limitCount: 10,
  });
};

/**
 * Hook for hospital's today appointments
 */
export const useTodayAppointments = (hospitalId: string): UseRealtimeAppointmentsResult => {
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!hospitalId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const q = query(
      collection(db, 'appointments'),
      where('hospitalId', '==', hospitalId),
      where('scheduledDate', '>=', Timestamp.fromDate(today)),
      where('scheduledDate', '<', Timestamp.fromDate(tomorrow)),
      where('status', 'in', ['scheduled', 'confirmed']),
      orderBy('scheduledDate', 'asc')
    );

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        try {
          const appointmentData = extractQueryData<Appointment>(snapshot, [
            'scheduledDate',
            'reminderSentAt',
            'completedAt',
            'createdAt',
            'updatedAt',
          ]);

          setAppointments(appointmentData);
          setLoading(false);
        } catch (err) {
          console.error('Error processing today appointments:', err);
          setError('Failed to load appointments');
          setLoading(false);
        }
      },
      (err) => {
        console.error('Error listening to today appointments:', err);
        setError('Failed to listen to appointments');
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [hospitalId]);

  return {
    appointments,
    loading,
    error,
  };
};

/**
 * Hook for upcoming appointment count
 */
export const useUpcomingAppointmentCount = (
  donorId?: string,
  hospitalId?: string
): number => {
  const [count, setCount] = useState(0);

  useEffect(() => {
    const constraints: any[] = [
      where('scheduledDate', '>=', Timestamp.now()),
      where('status', 'in', ['scheduled', 'confirmed']),
    ];

    if (donorId) {
      constraints.push(where('donorId', '==', donorId));
    }

    if (hospitalId) {
      constraints.push(where('hospitalId', '==', hospitalId));
    }

    const q = query(collection(db, 'appointments'), ...constraints);

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setCount(snapshot.size);
    });

    return () => unsubscribe();
  }, [donorId, hospitalId]);

  return count;
};
