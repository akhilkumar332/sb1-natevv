/**
 * Custom hook for Admin Dashboard data
 * Fetches all platform-wide data from Firestore for admin monitoring
 */

import { useState, useEffect } from 'react';
import { collection, query, where, orderBy, limit, getDocs, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase';
import { COLLECTIONS } from '../constants/firestore';
import { captureHandledError } from '../services/errorLog.service';

export interface UserRecord {
  id: string;
  uid: string;
  displayName: string;
  email: string;
  role: 'donor' | 'bloodbank' | 'hospital' | 'ngo' | 'admin' | 'superadmin';
  status: 'active' | 'inactive' | 'suspended' | 'pending_verification';
  verified: boolean;
  createdAt: Date;
  lastLoginAt?: Date;
  city?: string;
  phoneNumber?: string;
}

export interface VerificationRequest {
  id: string;
  userId: string;
  organizationType: 'bloodbank' | 'hospital' | 'ngo';
  organizationName: string;
  registrationNumber?: string;
  address?: string;
  city?: string;
  state?: string;
  contactPerson?: string;
  documents: Array<{
    type: string;
    url: string;
    name: string;
  }>;
  status: 'pending' | 'under_review' | 'approved' | 'rejected';
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string;
  rejectionReason?: string;
}

export interface EmergencyRequest {
  id: string;
  hospitalId: string;
  hospitalName: string;
  bloodType: string;
  units: number;
  unitsReceived: number;
  urgency: 'critical' | 'high' | 'medium';
  isEmergency: boolean;
  status: 'active' | 'fulfilled' | 'partially_fulfilled' | 'expired' | 'cancelled';
  requestedAt: Date;
  neededBy: Date;
  location: {
    city: string;
    state: string;
  };
  respondedDonors?: number;
}

export interface SystemAlert {
  id: string;
  type: 'critical' | 'warning' | 'info';
  message: string;
  source: string;
  timestamp: Date;
  resolved: boolean;
  action?: string;
}

export interface PlatformStats {
  totalUsers: number;
  totalDonors: number;
  totalHospitals: number;
  totalNGOs: number;
  totalAdmins: number;
  activeUsers: number;
  inactiveUsers: number;
  pendingVerification: number;
  totalDonations: number;
  completedDonations: number;
  totalBloodUnits: number;
  activeRequests: number;
  fulfilledRequests: number;
  totalCampaigns: number;
  activeCampaigns: number;
  completedCampaigns: number;
  pendingVerificationRequests: number;
  approvedVerificationRequests: number;
  rejectedVerificationRequests: number;
}

export interface RecentActivity {
  donations: Array<{
    id: string;
    donorName: string;
    hospitalName: string;
    bloodType: string;
    units: number;
    donationDate: Date;
  }>;
  requests: Array<{
    id: string;
    hospitalName: string;
    bloodType: string;
    units: number;
    urgency: string;
    requestedAt: Date;
  }>;
  campaigns: Array<{
    id: string;
    title: string;
    organizer: string;
    type: string;
    startDate: Date;
  }>;
}

interface UseAdminDataReturn {
  users: UserRecord[];
  verificationRequests: VerificationRequest[];
  emergencyRequests: EmergencyRequest[];
  systemAlerts: SystemAlert[];
  stats: PlatformStats;
  recentActivity: RecentActivity;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
}

export const useAdminData = (): UseAdminDataReturn => {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [verificationRequests, setVerificationRequests] = useState<VerificationRequest[]>([]);
  const [emergencyRequests, setEmergencyRequests] = useState<EmergencyRequest[]>([]);
  const [systemAlerts, setSystemAlerts] = useState<SystemAlert[]>([]);
  const [stats, setStats] = useState<PlatformStats>({
    totalUsers: 0,
    totalDonors: 0,
    totalHospitals: 0,
    totalNGOs: 0,
    totalAdmins: 0,
    activeUsers: 0,
    inactiveUsers: 0,
    pendingVerification: 0,
    totalDonations: 0,
    completedDonations: 0,
    totalBloodUnits: 0,
    activeRequests: 0,
    fulfilledRequests: 0,
    totalCampaigns: 0,
    activeCampaigns: 0,
    completedCampaigns: 0,
    pendingVerificationRequests: 0,
    approvedVerificationRequests: 0,
    rejectedVerificationRequests: 0,
  });
  const [recentActivity, setRecentActivity] = useState<RecentActivity>({
    donations: [],
    requests: [],
    campaigns: [],
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const reportAdminDataError = (err: unknown, kind: string) => {
    void captureHandledError(err, {
      source: 'frontend',
      scope: 'admin',
      metadata: { kind, hook: 'useAdminData' },
    });
  };

  // Fetch recent users
  const fetchUsers = async () => {
    try {
      const usersRef = collection(db, COLLECTIONS.USERS);
      const q = query(usersRef, orderBy('createdAt', 'desc'), limit(100));

      const snapshot = await getDocs(q);
      const usersList: UserRecord[] = snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          uid: data.uid || doc.id,
          displayName: data.displayName || data.name || '',
          email: data.email || '',
          role: data.role || 'donor',
          status: data.status || 'active',
          verified: data.verified || false,
          createdAt: data.createdAt?.toDate() || new Date(),
          lastLoginAt: data.lastLoginAt?.toDate(),
          city: data.city,
          phoneNumber: data.phoneNumber || data.phone,
        };
      });
      setUsers(usersList);
    } catch (err) {
      reportAdminDataError(err, 'fetch_users');
    }
  };

  // Fetch verification requests
  const fetchVerificationRequests = async () => {
    try {
      const verificationsRef = collection(db, COLLECTIONS.VERIFICATION_REQUESTS);
      const q = query(verificationsRef, orderBy('submittedAt', 'desc'), limit(50));

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const verificationsList: VerificationRequest[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              userId: data.userId || '',
              organizationType: data.organizationType || 'bloodbank',
              organizationName: data.organizationName || data.name || '',
              registrationNumber: data.registrationNumber,
              address: data.address,
              city: data.city,
              state: data.state,
              contactPerson: data.contactPerson,
              documents: data.documents || [],
              status: data.status || 'pending',
              submittedAt: data.submittedAt?.toDate() || data.createdAt?.toDate() || new Date(),
              reviewedAt: data.reviewedAt?.toDate(),
              reviewedBy: data.reviewedBy,
              rejectionReason: data.rejectionReason,
            };
          });
          setVerificationRequests(verificationsList);
        },
        (err) => {
          reportAdminDataError(err, 'fetch_verification_requests.listen');
        }
      );

      return unsubscribe;
    } catch (err) {
      reportAdminDataError(err, 'fetch_verification_requests');
      return () => {};
    }
  };

  // Fetch emergency requests
  const fetchEmergencyRequests = async () => {
    try {
      const requestsRef = collection(db, COLLECTIONS.BLOOD_REQUESTS);
      const q = query(
        requestsRef,
        where('isEmergency', '==', true),
        orderBy('requestedAt', 'desc'),
        limit(20)
      );

      const unsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const requestsList: EmergencyRequest[] = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
              id: doc.id,
              hospitalId: data.hospitalId || data.requesterId || '',
              hospitalName: data.hospitalName || '',
              bloodType: data.bloodType || '',
              units: data.units || 0,
              unitsReceived: data.unitsReceived || 0,
              urgency: data.urgency || 'medium',
              isEmergency: data.isEmergency || false,
              status: data.status || 'active',
              requestedAt: data.requestedAt?.toDate() || data.createdAt?.toDate() || new Date(),
              neededBy: data.neededBy?.toDate() || new Date(),
              location: data.location || { city: '', state: '' },
              respondedDonors: data.respondedDonors?.length || 0,
            };
          });
          setEmergencyRequests(requestsList);
        },
        (err) => {
          reportAdminDataError(err, 'fetch_emergency_requests.listen');
        }
      );

      return unsubscribe;
    } catch (err) {
      reportAdminDataError(err, 'fetch_emergency_requests');
      return () => {};
    }
  };

  // Fetch system alerts (inventory alerts)
  const fetchSystemAlerts = async () => {
    try {
      const inventoryRef = collection(db, COLLECTIONS.BLOOD_INVENTORY);
      const q = query(
        inventoryRef,
        where('status', 'in', ['low', 'critical']),
        orderBy('units', 'asc'),
        limit(20)
      );

      const snapshot = await getDocs(q);
      const alertsList: SystemAlert[] = snapshot.docs.map(doc => {
        const data = doc.data();
        const isCritical = data.status === 'critical';
        return {
          id: doc.id,
          type: isCritical ? 'critical' : 'warning',
          message: `${isCritical ? 'Critical' : 'Low'} blood shortage for ${data.bloodType} - Only ${data.units} units available`,
          source: `Inventory Alert - BloodBank ID: ${data.hospitalId}`,
          timestamp: data.updatedAt?.toDate() || new Date(),
          resolved: false,
          action: 'View Inventory',
        };
      });

      // Add verification alerts
      const pendingVerifications = verificationRequests.filter(v => v.status === 'pending');
      if (pendingVerifications.length > 5) {
        alertsList.unshift({
          id: 'verify-alert',
          type: 'warning',
          message: `${pendingVerifications.length} verification requests pending review`,
          source: 'Verification System',
          timestamp: new Date(),
          resolved: false,
          action: 'Review Requests',
        });
      }

      setSystemAlerts(alertsList);
    } catch (err) {
      reportAdminDataError(err, 'fetch_system_alerts');
    }
  };

  // Fetch recent activity
  const fetchRecentActivity = async () => {
    try {
      // Recent donations
      const donationsQuery = query(
        collection(db, COLLECTIONS.DONATIONS),
        orderBy('donationDate', 'desc'),
        limit(5)
      );
      const donationsSnapshot = await getDocs(donationsQuery);
      const donations = donationsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          donorName: data.donorName || 'Anonymous',
          hospitalName: data.hospitalName || '',
          bloodType: data.bloodType || '',
          units: data.units || 0,
          donationDate: data.donationDate?.toDate() || new Date(),
        };
      });

      // Recent requests
      const requestsQuery = query(
        collection(db, COLLECTIONS.BLOOD_REQUESTS),
        orderBy('requestedAt', 'desc'),
        limit(5)
      );
      const requestsSnapshot = await getDocs(requestsQuery);
      const requests = requestsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          hospitalName: data.hospitalName || '',
          bloodType: data.bloodType || '',
          units: data.units || 0,
          urgency: data.urgency || 'medium',
          requestedAt: data.requestedAt?.toDate() || data.createdAt?.toDate() || new Date(),
        };
      });

      // Recent campaigns
      const campaignsQuery = query(
        collection(db, COLLECTIONS.CAMPAIGNS),
        orderBy('startDate', 'desc'),
        limit(5)
      );
      const campaignsSnapshot = await getDocs(campaignsQuery);
      const campaigns = campaignsSnapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          title: data.title || data.name || '',
          organizer: data.organizerName || data.ngoName || '',
          type: data.type || 'blood-drive',
          startDate: data.startDate?.toDate() || new Date(),
        };
      });

      setRecentActivity({ donations, requests, campaigns });
    } catch (err) {
      reportAdminDataError(err, 'fetch_recent_activity');
    }
  };

  // Calculate platform statistics
  const calculateStats = async () => {
    try {
      // User stats
      const totalUsers = users.length;
      const totalDonors = users.filter(u => u.role === 'donor').length;
      const totalHospitals = users.filter(u => u.role === 'bloodbank' || u.role === 'hospital').length;
      const totalNGOs = users.filter(u => u.role === 'ngo').length;
      const totalAdmins = users.filter(u => u.role === 'admin' || u.role === 'superadmin').length;
      const activeUsers = users.filter(u => u.status === 'active').length;
      const inactiveUsers = users.filter(u => u.status === 'inactive').length;
      const pendingVerification = users.filter(u => u.status === 'pending_verification').length;

      // Donation stats
      const donationsSnapshot = await getDocs(collection(db, COLLECTIONS.DONATIONS));
      const totalDonations = donationsSnapshot.size;
      const completedDonations = donationsSnapshot.docs.filter(doc => doc.data().status === 'completed').length;
      const totalBloodUnits = donationsSnapshot.docs
        .filter(doc => doc.data().status === 'completed')
        .reduce((sum, doc) => sum + (doc.data().units || 0), 0);

      // Request stats
      const requestsSnapshot = await getDocs(collection(db, COLLECTIONS.BLOOD_REQUESTS));
      const activeRequests = requestsSnapshot.docs.filter(doc => doc.data().status === 'active').length;
      const fulfilledRequests = requestsSnapshot.docs.filter(doc => doc.data().status === 'fulfilled').length;

      // Campaign stats
      const campaignsSnapshot = await getDocs(collection(db, COLLECTIONS.CAMPAIGNS));
      const totalCampaigns = campaignsSnapshot.size;
      const activeCampaigns = campaignsSnapshot.docs.filter(doc => doc.data().status === 'active').length;
      const completedCampaigns = campaignsSnapshot.docs.filter(doc => doc.data().status === 'completed').length;

      // Verification stats
      const pendingVerificationRequests = verificationRequests.filter(v => v.status === 'pending').length;
      const approvedVerificationRequests = verificationRequests.filter(v => v.status === 'approved').length;
      const rejectedVerificationRequests = verificationRequests.filter(v => v.status === 'rejected').length;

      setStats({
        totalUsers,
        totalDonors,
        totalHospitals,
        totalNGOs,
        totalAdmins,
        activeUsers,
        inactiveUsers,
        pendingVerification,
        totalDonations,
        completedDonations,
        totalBloodUnits,
        activeRequests,
        fulfilledRequests,
        totalCampaigns,
        activeCampaigns,
        completedCampaigns,
        pendingVerificationRequests,
        approvedVerificationRequests,
        rejectedVerificationRequests,
      });
    } catch (err) {
      reportAdminDataError(err, 'calculate_stats');
    }
  };

  // Initial data fetch
  useEffect(() => {
    let isActive = true;
    let unsubscribeVerifications: (() => void) | null = null;
    let unsubscribeRequests: (() => void) | null = null;

    const loadData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Set up real-time listeners
        unsubscribeVerifications = await fetchVerificationRequests();
        unsubscribeRequests = await fetchEmergencyRequests();

        // Fetch other data
        await Promise.all([
          fetchUsers(),
          fetchRecentActivity(),
        ]);

        if (!isActive) return;
        setLoading(false);
      } catch (err) {
        if (!isActive) return;
        reportAdminDataError(err, 'load_admin_data');
        setError('Failed to load admin data');
        setLoading(false);
      }
    };

    void loadData();

    return () => {
      isActive = false;
      if (unsubscribeVerifications) {
        unsubscribeVerifications();
      }
      if (unsubscribeRequests) {
        unsubscribeRequests();
      }
    };
  }, []);

  // Calculate stats and alerts when data changes
  useEffect(() => {
    if (!loading && users.length >= 0) {
      calculateStats();
      fetchSystemAlerts();
    }
  }, [users, verificationRequests, loading]);

  const refreshData = async () => {
    setLoading(true);
    await fetchUsers();
    await fetchVerificationRequests();
    await fetchEmergencyRequests();
    await fetchRecentActivity();
    await calculateStats();
    await fetchSystemAlerts();
    setLoading(false);
  };

  return {
    users,
    verificationRequests,
    emergencyRequests,
    systemAlerts,
    stats,
    recentActivity,
    loading,
    error,
    refreshData,
  };
};
