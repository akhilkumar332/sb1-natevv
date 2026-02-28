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
import { failRealtimeLoad, reportRealtimeError } from '../utils/realtimeError';
import { useSyncedRef } from './useSyncedRef';
import { notifyNewestItem } from '../utils/realtimeEvents';

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
  const appointmentsRef = useSyncedRef(appointments);
  const onNewAppointmentRef = useSyncedRef(onNewAppointment);

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
          notifyNewestItem({
            previous: appointmentsRef.current,
            current: appointmentData,
            onNew: onNewAppointmentRef.current ?? undefined,
          });

          setAppointments(appointmentData);
          setLoading(false);
        } catch (err) {
          failRealtimeLoad(
            { scope: 'unknown', hook: 'useRealtimeAppointments' },
            {
              error: err,
              kind: 'appointments.process',
              fallbackMessage: 'Failed to load appointments',
              setError,
              setLoading,
            }
          );
        }
      },
      (err) => {
        failRealtimeLoad(
          { scope: 'unknown', hook: 'useRealtimeAppointments' },
          {
            error: err,
            kind: 'appointments.listen',
            fallbackMessage: 'Failed to listen to appointments',
            setError,
            setLoading,
          }
        );
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
          failRealtimeLoad(
            { scope: 'unknown', hook: 'useTodayAppointments' },
            {
              error: err,
              kind: 'appointments.today.process',
              fallbackMessage: 'Failed to load appointments',
              setError,
              setLoading,
            }
          );
        }
      },
      (err) => {
        failRealtimeLoad(
          { scope: 'unknown', hook: 'useTodayAppointments' },
          {
            error: err,
            kind: 'appointments.today.listen',
            fallbackMessage: 'Failed to listen to appointments',
            setError,
            setLoading,
          }
        );
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

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setCount(snapshot.size);
      },
      (err) => {
        reportRealtimeError(
          { scope: donorId ? 'donor' : hospitalId ? 'bloodbank' : 'unknown', hook: 'useUpcomingAppointmentCount' },
          err,
          'appointments.upcoming_count.listen',
          {
            donorId: donorId || null,
            hospitalId: hospitalId || null,
          }
        );
      }
    );

    return () => unsubscribe();
  }, [donorId, hospitalId]);

  return count;
};
