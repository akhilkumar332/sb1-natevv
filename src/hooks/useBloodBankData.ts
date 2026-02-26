/**
 * Custom hook for BloodBank Dashboard data
 * Fetches all bloodbank-related data from Firestore with caching
 */

import { useMemo, useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, onSnapshot, getDocs } from 'firebase/firestore';
import { db } from '../firebase';

export interface BloodInventoryItem {
  id: string;
  hospitalId: string;
  branchId?: string;
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
    status: 'available' | 'reserved' | 'used' | 'expired';
    source?: string;
    donorId?: string;
    reservationId?: string;
    reservedForRequestId?: string;
    reservedByUid?: string;
    testedStatus?: string;
    notes?: string;
    createdAt?: Date;
    updatedAt?: Date;
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

export interface BloodBankStats {
  totalInventory: number;
  criticalTypes: number;
  lowTypes: number;
  adequateTypes: number;
  expiringIn7Days: number;
  expiringIn30Days: number;
  reservedUnits: number;
  availableUnits: number;
  activeRequests: number;
  fulfilledRequests: number;
  todayAppointments: number;
  todayDonations: number;
  totalDonationsThisMonth: number;
  totalUnitsThisMonth: number;
}

interface UseBloodBankDataReturn {
  inventory: BloodInventoryItem[];
  bloodRequests: BloodRequest[];
  appointments: Appointment[];
  donations: Donation[];
  stats: BloodBankStats;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export const useBloodBankData = (bloodBankId: string): UseBloodBankDataReturn => {
  const [inventory, setInventory] = useState<BloodInventoryItem[]>([]);
  const [bloodRequests, setBloodRequests] = useState<BloodRequest[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [donations, setDonations] = useState<Donation[]>([]);
  const [stats, setStats] = useState<BloodBankStats>({
    totalInventory: 0,
    criticalTypes: 0,
    lowTypes: 0,
    adequateTypes: 0,
    expiringIn7Days: 0,
    expiringIn30Days: 0,
    reservedUnits: 0,
    availableUnits: 0,
    activeRequests: 0,
    fulfilledRequests: 0,
    todayAppointments: 0,
    todayDonations: 0,
    totalDonationsThisMonth: 0,
    totalUnitsThisMonth: 0,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const cacheKey = useMemo(() => (bloodBankId ? `bloodbank_dashboard_cache_${bloodBankId}` : ''), [bloodBankId]);
  const cacheTTL = 5 * 60 * 1000;

  const serializeInventory = (items: BloodInventoryItem[]) =>
    items.map((item) => ({
      ...item,
      lastRestocked: item.lastRestocked?.toISOString(),
      updatedAt: item.updatedAt?.toISOString(),
      batches: item.batches.map((batch) => ({
        ...batch,
        collectionDate: batch.collectionDate?.toISOString(),
        expiryDate: batch.expiryDate?.toISOString(),
        createdAt: batch.createdAt?.toISOString(),
        updatedAt: batch.updatedAt?.toISOString(),
      })),
    }));

  const serializeRequests = (items: BloodRequest[]) =>
    items.map((item) => ({
      ...item,
      requestedAt: item.requestedAt?.toISOString(),
      neededBy: item.neededBy?.toISOString(),
      fulfilledAt: item.fulfilledAt ? item.fulfilledAt.toISOString() : null,
      respondedDonors: (item.respondedDonors || []).map((donor) => ({
        ...donor,
        respondedAt: donor.respondedAt?.toISOString(),
      })),
    }));

  const hydrateInventory = (items: any[] = []): BloodInventoryItem[] =>
    items.map((item) => ({
      ...item,
      lastRestocked: item.lastRestocked ? new Date(item.lastRestocked) : new Date(),
      updatedAt: item.updatedAt ? new Date(item.updatedAt) : new Date(),
      batches: (item.batches || []).map((batch: any) => ({
        ...batch,
        collectionDate: batch.collectionDate ? new Date(batch.collectionDate) : new Date(),
        expiryDate: batch.expiryDate ? new Date(batch.expiryDate) : new Date(),
        createdAt: batch.createdAt ? new Date(batch.createdAt) : undefined,
        updatedAt: batch.updatedAt ? new Date(batch.updatedAt) : undefined,
      })),
    }));

  const hydrateRequests = (items: any[] = []): BloodRequest[] =>
    items.map((item) => ({
      ...item,
      requestedAt: item.requestedAt ? new Date(item.requestedAt) : new Date(),
      neededBy: item.neededBy ? new Date(item.neededBy) : new Date(),
      fulfilledAt: item.fulfilledAt ? new Date(item.fulfilledAt) : undefined,
      respondedDonors: (item.respondedDonors || []).map((donor: any) => ({
        ...donor,
        respondedAt: donor.respondedAt ? new Date(donor.respondedAt) : new Date(),
      })),
    }));

  const fetchInventory = async () => {
    try {
      const inventoryRef = collection(db, 'bloodInventory');
      const q = query(inventoryRef, where('hospitalId', '==', bloodBankId));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const inventoryList: BloodInventoryItem[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            hospitalId: data.hospitalId || '',
            branchId: data.branchId || data.hospitalId || '',
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
              source: batch.source,
              donorId: batch.donorId,
              reservationId: batch.reservationId,
              reservedForRequestId: batch.reservedForRequestId,
              reservedByUid: batch.reservedByUid,
              testedStatus: batch.testedStatus,
              notes: batch.notes,
              createdAt: batch.createdAt?.toDate(),
              updatedAt: batch.updatedAt?.toDate(),
            })),
            updatedAt: data.updatedAt?.toDate() || new Date(),
          };
        });
        setInventory(inventoryList);
      });
      return unsubscribe;
    } catch (err) {
      console.error('Error fetching inventory:', err);
      setError('Failed to load inventory');
      return () => {};
    }
  };

  const fetchRequests = async () => {
    try {
      const requestsRef = collection(db, 'bloodRequests');
      const q = query(
        requestsRef,
        where('requesterId', '==', bloodBankId),
        orderBy('requestedAt', 'desc'),
        limit(50)
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const requestsList: BloodRequest[] = snapshot.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            requesterId: data.requesterId || '',
            hospitalId: data.hospitalId || data.requesterId || '',
            hospitalName: data.hospitalName || data.bloodBankName || '',
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
            location: {
              city: data.location?.city || data.city || '',
              state: data.location?.state || data.state || '',
              address: data.location?.address,
            },
          };
        });
        setBloodRequests(requestsList);
      });
      return unsubscribe;
    } catch (err) {
      console.error('Error fetching blood requests:', err);
      setError('Failed to load blood requests');
      return () => {};
    }
  };

  const fetchAppointments = async () => {
    try {
      const appointmentsRef = collection(db, 'appointments');
      const q = query(
        appointmentsRef,
        where('hospitalId', '==', bloodBankId),
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
      console.error('Error fetching appointments:', err);
    }
  };

  const fetchDonations = async () => {
    try {
      const donationsRef = collection(db, 'donations');
      const q = query(
        donationsRef,
        where('hospitalId', '==', bloodBankId),
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
          hospitalName: data.hospitalName || data.bloodBankName || '',
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
      console.error('Error fetching donations:', err);
    }
  };

  const fetchInventoryOnce = async () => {
    const inventoryRef = collection(db, 'bloodInventory');
    const q = query(inventoryRef, where('hospitalId', '==', bloodBankId));
    const snapshot = await getDocs(q);
    const inventoryList: BloodInventoryItem[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        hospitalId: data.hospitalId || '',
        branchId: data.branchId || data.hospitalId || '',
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
  };

  const fetchRequestsOnce = async () => {
    const requestsRef = collection(db, 'bloodRequests');
    const q = query(
      requestsRef,
      where('requesterId', '==', bloodBankId),
      orderBy('requestedAt', 'desc'),
      limit(50)
    );
    const snapshot = await getDocs(q);
    const requestsList: BloodRequest[] = snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        id: doc.id,
        requesterId: data.requesterId || '',
        hospitalId: data.hospitalId || data.requesterId || '',
        hospitalName: data.hospitalName || data.bloodBankName || '',
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
        location: {
          city: data.location?.city || data.city || '',
          state: data.location?.state || data.state || '',
          address: data.location?.address,
        },
      };
    });
    setBloodRequests(requestsList);
  };

  const calculateStats = () => {
    const totalInventory = inventory.reduce((sum, item) => sum + item.units, 0);
    const criticalTypes = inventory.filter(item => item.status === 'critical').length;
    const lowTypes = inventory.filter(item => item.status === 'low').length;
    const adequateTypes = inventory.filter(item => item.status === 'adequate' || item.status === 'surplus').length;

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let expiringIn7Days = 0;
    let expiringIn30Days = 0;
    let reservedUnits = 0;
    let availableUnits = 0;

    inventory.forEach(item => {
      item.batches.forEach(batch => {
        if (batch.status === 'available') {
          availableUnits += batch.units;
          if (batch.expiryDate <= sevenDaysFromNow) {
            expiringIn7Days += batch.units;
          } else if (batch.expiryDate <= thirtyDaysFromNow) {
            expiringIn30Days += batch.units;
          }
        } else if (batch.status === 'reserved') {
          reservedUnits += batch.units;
          if (batch.expiryDate <= sevenDaysFromNow) {
            expiringIn7Days += batch.units;
          } else if (batch.expiryDate <= thirtyDaysFromNow) {
            expiringIn30Days += batch.units;
          }
        }
      });
    });

    const activeRequests = bloodRequests.filter(r => r.status === 'active' || r.status === 'partially_fulfilled').length;
    const fulfilledRequests = bloodRequests.filter(r => r.status === 'fulfilled').length;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const todayAppointments = appointments.filter(appt => {
      const apptDate = new Date(appt.scheduledDate);
      return apptDate >= today && apptDate < tomorrow && (appt.status === 'scheduled' || appt.status === 'confirmed');
    }).length;

    const todayDonations = donations.filter(donation => {
      const donationDate = new Date(donation.donationDate);
      return donationDate >= today && donationDate < tomorrow && donation.status === 'completed';
    }).length;

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
      reservedUnits,
      availableUnits,
      activeRequests,
      fulfilledRequests,
      todayAppointments,
      todayDonations,
      totalDonationsThisMonth,
      totalUnitsThisMonth,
    });
  };

  const buildCacheStats = () => {
    const totalInventory = inventory.reduce((sum, item) => sum + item.units, 0);
    const criticalTypes = inventory.filter(item => item.status === 'critical').length;
    const lowTypes = inventory.filter(item => item.status === 'low').length;
    const adequateTypes = inventory.filter(item => item.status === 'adequate' || item.status === 'surplus').length;

    const now = new Date();
    const sevenDaysFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    let expiringIn7Days = 0;
    let expiringIn30Days = 0;
    let reservedUnits = 0;
    let availableUnits = 0;

    inventory.forEach(item => {
      item.batches.forEach(batch => {
        if (batch.status === 'available') {
          availableUnits += batch.units;
          if (batch.expiryDate <= sevenDaysFromNow) {
            expiringIn7Days += batch.units;
          } else if (batch.expiryDate <= thirtyDaysFromNow) {
            expiringIn30Days += batch.units;
          }
        } else if (batch.status === 'reserved') {
          reservedUnits += batch.units;
          if (batch.expiryDate <= sevenDaysFromNow) {
            expiringIn7Days += batch.units;
          } else if (batch.expiryDate <= thirtyDaysFromNow) {
            expiringIn30Days += batch.units;
          }
        }
      });
    });

    const activeRequests = bloodRequests.filter(r => r.status === 'active' || r.status === 'partially_fulfilled').length;
    const fulfilledRequests = bloodRequests.filter(r => r.status === 'fulfilled').length;

    return {
      totalInventory,
      criticalTypes,
      lowTypes,
      adequateTypes,
      expiringIn7Days,
      expiringIn30Days,
      reservedUnits,
      availableUnits,
      activeRequests,
      fulfilledRequests,
    };
  };

  useEffect(() => {
    if (!bloodBankId) return;
    let isActive = true;
    let unsubscribeInventory: (() => void) | null = null;
    let unsubscribeRequests: (() => void) | null = null;
    let idleFetchId: number | null = null;
    let timeoutFetchId: ReturnType<typeof setTimeout> | null = null;
    let idleBackgroundId: number | null = null;
    let timeoutBackgroundId: ReturnType<typeof setTimeout> | null = null;

    const loadData = async () => {
      setError(null);

      let usedCache = false;
      if (cacheKey && typeof window !== 'undefined') {
        const cachedRaw = window.localStorage.getItem(cacheKey);
        if (cachedRaw) {
          try {
            const cached = JSON.parse(cachedRaw);
            if (cached.appointments || cached.donations) {
              delete cached.appointments;
              delete cached.donations;
              try {
                window.localStorage.setItem(cacheKey, JSON.stringify(cached));
              } catch (err) {
                console.warn('Failed to sanitize BloodBank dashboard cache', err);
              }
            }
            if (cached.timestamp && Date.now() - cached.timestamp < cacheTTL) {
              setInventory(hydrateInventory(cached.inventory));
              setBloodRequests(hydrateRequests(cached.bloodRequests));
              // Do not hydrate appointments/donations from localStorage (sensitive data)
              if (cached.stats) {
                const safeStats = { ...cached.stats };
                delete safeStats.todayAppointments;
                delete safeStats.todayDonations;
                delete safeStats.totalDonationsThisMonth;
                delete safeStats.totalUnitsThisMonth;
                if (cached.stats !== safeStats) {
                  cached.stats = safeStats;
                  try {
                    window.localStorage.setItem(cacheKey, JSON.stringify(cached));
                  } catch (err) {
                    console.warn('Failed to sanitize BloodBank stats cache', err);
                  }
                }
                setStats(prev => ({ ...prev, ...safeStats }));
              }
              setLoading(false);
              usedCache = true;
            }
          } catch (err) {
            console.warn('Failed to hydrate BloodBank dashboard cache', err);
          }
        }
      }
      if (!usedCache) {
        setLoading(true);
      }

      const scheduleBackground = (task: () => void) => {
        if (typeof window !== 'undefined' && 'requestIdleCallback' in window) {
          idleBackgroundId = (window as any).requestIdleCallback(task);
        } else {
          timeoutBackgroundId = setTimeout(task, 0);
        }
      };

      const runFetch = async () => {
        try {
          unsubscribeInventory = await fetchInventory();
          unsubscribeRequests = await fetchRequests();

          if (!isActive) return;
          if (!usedCache) {
            setLoading(false);
          }

          scheduleBackground(() => {
            if (!isActive) return;
            void fetchAppointments();
            void fetchDonations();
          });
        } catch (err) {
          if (!isActive) return;
          console.error('Error loading bloodbank data:', err);
          setError('Failed to load bloodbank data');
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
      if (idleBackgroundId !== null && typeof window !== 'undefined' && 'cancelIdleCallback' in window) {
        (window as any).cancelIdleCallback(idleBackgroundId);
      }
      if (timeoutFetchId !== null) {
        window.clearTimeout(timeoutFetchId);
      }
      if (timeoutBackgroundId !== null) {
        window.clearTimeout(timeoutBackgroundId);
      }
      if (unsubscribeInventory) {
        unsubscribeInventory();
      }
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }
    };
  }, [bloodBankId]);

  useEffect(() => {
    if (!bloodBankId) return;
    const interval = setInterval(() => {
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        return;
      }
      void fetchAppointments();
      void fetchDonations();
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, [bloodBankId]);

  useEffect(() => {
    if (!loading && inventory.length >= 0) {
      calculateStats();
    }
  }, [inventory, bloodRequests, appointments, donations, loading]);

  useEffect(() => {
    if (!cacheKey || loading) return;
    if (typeof window === 'undefined') return;
    const payload = {
      timestamp: Date.now(),
      inventory: serializeInventory(inventory),
      bloodRequests: serializeRequests(bloodRequests),
      stats: buildCacheStats(),
    };
    try {
      window.localStorage.setItem(cacheKey, JSON.stringify(payload));
    } catch (err) {
      console.warn('Failed to write BloodBank dashboard cache', err);
    }
  }, [cacheKey, loading, inventory, bloodRequests]);

  const refreshData = async () => {
    await Promise.all([
      fetchInventoryOnce(),
      fetchRequestsOnce(),
      fetchAppointments(),
      fetchDonations(),
    ]);
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
