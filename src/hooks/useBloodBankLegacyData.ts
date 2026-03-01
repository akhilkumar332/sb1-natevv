/**
 * Custom hook for BloodBank Dashboard data (legacy)
 * Fetches all hospital-related data from Firestore
 */

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';
import { captureHandledError } from '../services/errorLog.service';
import { COLLECTIONS } from '../constants/firestore';
import { SEVEN_DAYS_MS, THIRTY_DAYS_MS } from '../constants/time';

export interface BloodInventoryItem {
  id: string;
  hospitalId: string;
  bloodType: string;
  units: number;
  status: 'critical' | 'low' | 'adequate' | 'surplus';
  lowLevel: number;
  criticalLevel: number;
  lastRestocked: Date;
  batches: Array<{
    batchId: string;
    units: number;
    collectionDate: Date;
    expiryDate: Date;
    status: 'available' | 'used' | 'expired';
  }>;
  updatedAt: Date;
}

export interface BloodRequest {
  id: string;
  requesterId: string;
  hospitalId: string;
  hospitalName: string;
  bloodType: string;
  units: number;
  unitsReceived: number;
  urgency: 'critical' | 'high' | 'medium';
  isEmergency: boolean;
  patientId?: string;
  patientName?: string;
  department?: string;
  reason: string;
  status: 'active' | 'fulfilled' | 'partially_fulfilled' | 'expired' | 'cancelled';
  requestedAt: Date;
  neededBy: Date;
  respondedDonors?: Array<{
    donorId: string;
    donorName: string;
    respondedAt: Date;
    status: 'pending' | 'confirmed' | 'rejected';
  }>;
  confirmedDonors?: string[];
  fulfilledAt?: Date;
  location: {
    city: string;
    state: string;
    address?: string;
  };
}

export interface Appointment {
  id: string;
  hospitalId: string;
  donorId: string;
  donorName: string;
  donorEmail?: string;
  donorPhone?: string;
  bloodType: string;
  scheduledDate: Date;
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no-show';
  type: 'donation' | 'screening' | 'follow-up';
  notes?: string;
  completedAt?: Date;
  createdAt: Date;
}

export interface Donation {
  id: string;
  donorId: string;
  donorName: string;
  hospitalId: string;
  hospitalName: string;
  bloodType: string;
  units: number;
  donationDate: Date;
  status: 'completed' | 'pending' | 'rejected';
  requestId?: string;
  notes?: string;
  certificateUrl?: string;
  createdAt: Date;
}

export interface BloodBankLegacyStats {
  totalInventory: number;
  criticalTypes: number;
  lowTypes: number;
  adequateTypes: number;
  expiringIn7Days: number;
  expiringIn30Days: number;
  activeRequests: number;
  fulfilledRequests: number;
  todayAppointments: number;
  todayDonations: number;
  totalDonationsThisMonth: number;
  totalUnitsThisMonth: number;
}

interface UseBloodBankLegacyDataReturn {
  inventory: BloodInventoryItem[];
  bloodRequests: BloodRequest[];
  appointments: Appointment[];
  donations: Donation[];
  stats: BloodBankLegacyStats;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export const useBloodBankLegacyData = (hospitalId: string): UseBloodBankLegacyDataReturn => {
  const [inventory, setInventory] = useState<BloodInventoryItem[]>([]);
  const [bloodRequests, setBloodRequests] = useState<BloodRequest[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [stats, setStats] = useState<BloodBankLegacyStats>({
    totalInventory: 0,
    criticalTypes: 0,
    lowTypes: 0,
    adequateTypes: 0,
    expiringIn7Days: 0,
    expiringIn30Days: 0,
    activeRequests: 0,
    fulfilledRequests: 0,
    todayAppointments: 0,
    todayDonations: 0,
    totalDonationsThisMonth: 0,
    totalUnitsThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reportLegacyError = (err: unknown, kind: string) => {
    void captureHandledError(err, {
      source: 'frontend',
      scope: 'bloodbank',
      metadata: { kind, hook: 'useBloodBankLegacyData' },
    });
  };

  // Fetch blood inventory
  const fetchInventory = async () => {
    try {
      const inventoryRef = collection(db, COLLECTIONS.BLOOD_INVENTORY);
      const q = query(
        inventoryRef,
        where('hospitalId', '==', hospitalId)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const inventoryList: BloodInventoryItem[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              hospitalId: data.hospitalId || '',
              bloodType: data.bloodType || '',
              units: data.units || 0,
              status: data.status || 'adequate',
              lowLevel: data.lowLevel || 10,
              criticalLevel: data.criticalLevel || 5,
              lastRestocked: data.lastRestocked?.toDate() || new Date(),
              batches: (data.batches || []).map((batch: any) => ({
                batchId: batch.batchId || '',
                units: batch.units || 0,
                collectionDate: batch.collectionDate?.toDate() || new Date(),
                expiryDate: batch.expiryDate?.toDate() || new Date(),
                status: batch.status || 'available',
              })),
              updatedAt: data.updatedAt?.toDate() || new Date(),
            };
          });
          setInventory(inventoryList);
        },
        (err) => {
          reportLegacyError(err, 'fetch_inventory.listen');
        }
      );

      return unsubscribe;
    } catch (err) {
      reportLegacyError(err, 'fetch_inventory');
      setError('Failed to load inventory');
      return () => {};
    }
  };

  // Fetch blood requests
  const fetchBloodRequests = async () => {
    try {
      const requestsRef = collection(db, COLLECTIONS.BLOOD_REQUESTS);
      const q = query(
        requestsRef,
        where('requesterId', '==', hospitalId),
        orderBy('requestedAt', 'desc'),
        limit(50)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const requestsList: BloodRequest[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              requesterId: data.requesterId || '',
              hospitalId: data.hospitalId || data.requesterId || '',
              hospitalName: data.hospitalName || '',
              bloodType: data.bloodType || '',
              units: data.units || 0,
              unitsReceived: data.unitsReceived || 0,
              urgency: data.urgency || 'medium',
              isEmergency: data.isEmergency || false,
              patientId: data.patientId,
              patientName: data.patientName,
              department: data.department,
              reason: data.reason || '',
              status: data.status || 'active',
              requestedAt: data.requestedAt?.toDate() || data.createdAt?.toDate() || new Date(),
              neededBy: data.neededBy?.toDate() || new Date(),
              respondedDonors: (data.respondedDonors || []).map((donor: any) => ({
                donorId: donor.donorId || '',
                donorName: donor.donorName || '',
                respondedAt: donor.respondedAt?.toDate() || new Date(),
                status: donor.status || 'pending',
              })),
              confirmedDonors: data.confirmedDonors || [],
              fulfilledAt: data.fulfilledAt?.toDate(),
              location: data.location || { city: '', state: '' },
            };
          });
          setBloodRequests(requestsList);
        },
        (err) => {
          reportLegacyError(err, 'fetch_blood_requests.listen');
        }
      );

      return unsubscribe;
    } catch (err) {
      reportLegacyError(err, 'fetch_blood_requests');
      setError('Failed to load blood requests');
      return () => {};
    }
  };

  // Fetch appointments
  const fetchAppointments = async () => {
    try {
      const appointmentsRef = collection(db, COLLECTIONS.APPOINTMENTS);
      const q = query(
        appointmentsRef,
        where('hospitalId', '==', hospitalId),
        orderBy('scheduledDate', 'desc'),
        limit(50)
      );

      const snapshot = await getDocs(q);
      const appointmentsList: Appointment[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          hospitalId: data.hospitalId || '',
          donorId: data.donorId || '',
          donorName: data.donorName || '',
          donorEmail: data.donorEmail,
          donorPhone: data.donorPhone,
          bloodType: data.bloodType || '',
          scheduledDate: data.scheduledDate?.toDate() || new Date(),
          status: data.status || 'scheduled',
          type: data.type || 'donation',
          notes: data.notes,
          completedAt: data.completedAt?.toDate(),
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
      setAppointments(appointmentsList);
    } catch (err) {
      reportLegacyError(err, 'fetch_appointments');
    }
  };

  // Fetch donations
  const fetchDonations = async () => {
    try {
      const donationsRef = collection(db, COLLECTIONS.DONATIONS);
      const q = query(
        donationsRef,
        where('hospitalId', '==', hospitalId),
        orderBy('donationDate', 'desc'),
        limit(100)
      );

      const snapshot = await getDocs(q);
      const donationsList: Donation[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          donorId: data.donorId || '',
          donorName: data.donorName || '',
          hospitalId: data.hospitalId || '',
          hospitalName: data.hospitalName || '',
          bloodType: data.bloodType || '',
          units: data.units || 0,
          donationDate: data.donationDate?.toDate() || new Date(),
          status: data.status || 'completed',
          requestId: data.requestId,
          notes: data.notes,
          certificateUrl: data.certificateUrl,
          createdAt: data.createdAt?.toDate() || new Date(),
        };
      });
      setDonations(donationsList);
    } catch (err) {
      reportLegacyError(err, 'fetch_donations');
    }
  };

  // Calculate stats
  const calculateStats = () => {
    // Inventory stats
    const totalInventory = inventory.reduce((sum, item) => sum + item.units, 0);
    const criticalTypes = inventory.filter(item => item.status === 'critical').length;
    const lowTypes = inventory.filter(item => item.status === 'low').length;
    const adequateTypes = inventory.filter(item => item.status === 'adequate' || item.status === 'surplus').length;

    // Expiring batches
    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + SEVEN_DAYS_MS);
    const thirtyDaysFromNow = new Date(now.getTime() + THIRTY_DAYS_MS);

    let expiringIn7Days = 0;
    let expiringIn30Days = 0;

    inventory.forEach(item => {
      item.batches.forEach(batch => {
        if (batch.status === 'available') {
          if (batch.expiryDate <= sevenDaysFromNow) {
            expiringIn7Days += batch.units;
          } else if (batch.expiryDate <= thirtyDaysFromNow) {
            expiringIn30Days += batch.units;
          }
        }
      });
    });

    // Request stats
    const activeRequests = bloodRequests.filter(r => r.status === 'active' || r.status === 'partially_fulfilled').length;
    const fulfilledRequests = bloodRequests.filter(r => r.status === 'fulfilled').length;

    // Today's appointments
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppointments = appointments.filter(appt => {
      const apptDate = new Date(appt.scheduledDate);
      return apptDate >= today && apptDate < tomorrow && (appt.status === 'scheduled' || appt.status === 'confirmed');
    }).length;

    // Today's donations
    const todayDonations = donations.filter(donation => {
      const donationDate = new Date(donation.donationDate);
      return donationDate >= today && donationDate < tomorrow && donation.status === 'completed';
    }).length;

    // This month's donations
    const firstDayOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const completedDonations = donations.filter(d => d.status === 'completed');
    const thisMonthDonations = completedDonations.filter(donation => {
      const donationDate = new Date(donation.donationDate);
      return donationDate >= firstDayOfMonth;
    });

    const totalDonationsThisMonth = thisMonthDonations.length;
    const totalUnitsThisMonth = thisMonthDonations.reduce((sum, d) => sum + d.units, 0);

    setStats({
      totalInventory,
      criticalTypes,
      lowTypes,
      adequateTypes,
      expiringIn7Days,
      expiringIn30Days,
      activeRequests,
      fulfilledRequests,
      todayAppointments,
      todayDonations,
      totalDonationsThisMonth,
      totalUnitsThisMonth,
    });
  };

  // Initial data fetch
  useEffect(() => {
    if (!hospitalId) return;
    let isActive = true;
    let unsubscribeInventory: (() => void) | null = null;
    let unsubscribeRequests: (() => void) | null = null;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Set up real-time listeners
        unsubscribeInventory = await fetchInventory();
        unsubscribeRequests = await fetchBloodRequests();

        // Fetch other data
        await Promise.all([
          fetchAppointments(),
          fetchDonations(),
        ]);

        if (isActive) {
          setLoading(false);
        }
      } catch (err) {
        reportLegacyError(err, 'load_bloodbank_data');
        if (isActive) {
          setError('Failed to load bloodbank data');
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      isActive = false;
      unsubscribeInventory?.();
      unsubscribeRequests?.();
    };
  }, [hospitalId]);

  // Recalculate stats when data changes
  useEffect(() => {
    if (!loading && inventory.length >= 0) {
      calculateStats();
    }
  }, [inventory, bloodRequests, appointments, donations, loading]);

  const refreshData = async () => {
    setLoading(true);
    await fetchInventory();
    await fetchBloodRequests();
    await fetchAppointments();
    await fetchDonations();
    setLoading(false);
  };

  return {
    inventory,
    bloodRequests,
    appointments,
    donations,
    stats,
    loading,
    error,
    refreshData,
  };
};
