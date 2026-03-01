import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { useBloodBankData, BloodInventoryItem, BloodRequest, Appointment, Donation, BloodBankStats } from '../../hooks/useBloodBankData';
import { useReferrals } from '../../hooks/useReferrals';
import PortalNotificationBridge from '../../components/shared/PortalNotificationBridge';
import PendingActionsPanel from '../../components/shared/PendingActionsPanel';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Calendar,
  Heart,
  Loader2,
  Package,
  Share2,
  Settings,
  Users,
} from 'lucide-react';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';

export type BloodBankDashboardContext = {
  user: any;
  inventory: BloodInventoryItem[];
  bloodRequests: BloodRequest[];
  appointments: Appointment[];
  donations: Donation[];
  stats: BloodBankStats;
  loading: boolean;
  error: string | null;
  refreshData: () => Promise<void>;
  getStatusColor: (status: string) => string;
  getInventoryStatusColor: (status: string) => string;
  referralCount: number;
  referralLoading: boolean;
  referralUsersLoading: boolean;
  referralMilestone: { next: number | null; remaining: number; label: string };
  referralDetails: any[];
  eligibleReferralCount: number;
  referralSummary: Record<string, number>;
  referralQrDataUrl: string | null;
  referralQrLoading: boolean;
  loadReferralQr: () => Promise<void>;
  copyInviteLink: () => Promise<void>;
  shareInviteLink: () => Promise<void>;
  openWhatsAppInvite: () => void;
};

function BloodBankDashboard() {
  const { user } = useAuth();
  const baseHospitalId = user?.parentHospitalId || user?.uid || '';

  const {
    inventory,
    bloodRequests,
    appointments,
    donations,
    stats,
    loading,
    error,
    refreshData,
  } = useBloodBankData(baseHospitalId);

  const {
    referralLoading,
    referralUsersLoading,
    referralCount,
    referralMilestone,
    referralDetails,
    eligibleReferralCount,
    referralSummary,
    referralQrDataUrl,
    referralQrLoading,
    loadReferralQr,
    copyInviteLink,
    shareInviteLink,
    openWhatsAppInvite,
  } = useReferrals(user);

  const menuItems = [
    { id: 'overview', label: 'Overview', to: 'overview', icon: Activity },
    { id: 'requests', label: 'Requests', to: 'requests', icon: Heart },
    { id: 'donors', label: 'Donors', to: 'donors', icon: Users },
    { id: 'appointments', label: 'Appointments', to: 'appointments', icon: Calendar },
    { id: 'inventory', label: 'Inventory', to: 'inventory', icon: Package },
    { id: 'analytics', label: 'Analytics', to: 'analytics', icon: BarChart3 },
    { id: 'referrals', label: 'Referrals', to: 'referrals', icon: Share2 },
    { id: 'account', label: 'Account', to: 'account', icon: Settings },
  ] as const;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-emerald-700 bg-emerald-50 border border-emerald-200';
      case 'partially_fulfilled':
        return 'text-yellow-700 bg-yellow-50 border border-yellow-200';
      case 'fulfilled':
        return 'text-gray-600 bg-gray-100 border border-gray-200';
      case 'expired':
      case 'cancelled':
        return 'text-rose-700 bg-rose-50 border border-rose-200';
      case 'scheduled':
      case 'confirmed':
        return 'text-yellow-700 bg-yellow-50 border border-yellow-200';
      case 'completed':
        return 'text-emerald-700 bg-emerald-50 border border-emerald-200';
      default:
        return 'text-gray-600 bg-gray-100 border border-gray-200';
    }
  };

  const getInventoryStatusColor = (status: string) => {
    switch (status) {
      case 'critical':
        return 'text-rose-700 bg-rose-50 border border-rose-200';
      case 'low':
        return 'text-yellow-700 bg-yellow-50 border border-yellow-200';
      case 'adequate':
        return 'text-emerald-700 bg-emerald-50 border border-emerald-200';
      case 'surplus':
        return 'text-blue-700 bg-blue-50 border border-blue-200';
      default:
        return 'text-gray-600 bg-gray-100 border border-gray-200';
    }
  };

  const dashboardContext: BloodBankDashboardContext = {
    user,
    inventory,
    bloodRequests,
    appointments,
    donations,
    stats,
    loading,
    error,
    refreshData,
    getStatusColor,
    getInventoryStatusColor,
    referralCount,
    referralLoading,
    referralUsersLoading,
    referralMilestone,
    referralDetails,
    eligibleReferralCount,
    referralSummary,
    referralQrDataUrl,
    referralQrLoading,
    loadReferralQr,
    copyInviteLink,
    shareInviteLink,
    openWhatsAppInvite,
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-yellow-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading BloodBank dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-yellow-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <AdminRefreshButton
            onClick={() => void refreshData()}
            isRefreshing={loading}
            label="Retry loading bloodbank dashboard"
            className="h-12 w-12 mx-auto border-red-600 bg-gradient-to-r from-red-600 to-yellow-600 text-white hover:from-red-700 hover:to-yellow-700"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-yellow-50">
      <div className="container mx-auto px-4 py-8">
        <div className="lg:flex lg:gap-6">
          <aside className="hidden lg:block lg:w-64">
            <div className="sticky top-6 space-y-2 rounded-2xl border border-red-100 bg-white p-4 shadow-lg">
              {menuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink
                    key={item.id}
                    to={item.to}
                    className={({ isActive }) =>
                      `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                        isActive
                          ? 'bg-gradient-to-r from-red-600 to-yellow-600 text-white shadow-md'
                          : 'text-gray-600 hover:bg-red-50'
                      }`
                    }
                  >
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </aside>

          <main className="min-w-0 flex-1">
            <PortalNotificationBridge disabled={user?.notificationPreferences?.push === false} />
            <PendingActionsPanel />
            <Outlet context={dashboardContext} />
          </main>
        </div>
      </div>

    </div>
  );
}

export default BloodBankDashboard;
