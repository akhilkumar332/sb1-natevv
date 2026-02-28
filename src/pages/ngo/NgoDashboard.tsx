import { useEffect } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import {
  useNgoData,
  Campaign,
  Volunteer,
  Partnership,
  DonorCommunity,
  NgoStats,
} from '../../hooks/useNgoData';
import { useReferrals } from '../../hooks/useReferrals';
import { useFcmNotificationBridge } from '../../hooks/useFcmNotificationBridge';
import NotificationPermissionPrompt from '../../components/shared/NotificationPermissionPrompt';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Handshake,
  Heart,
  Loader2,
  Share2,
  Settings,
  Target,
  Users,
} from 'lucide-react';
import AdminRefreshButton from '../../components/admin/AdminRefreshButton';

export type NgoDashboardContext = {
  user: any;
  campaigns: Campaign[];
  volunteers: Volunteer[];
  partnerships: Partnership[];
  donorCommunity: DonorCommunity;
  stats: NgoStats;
  getParticipantDonors: (donorIds: string[]) => Promise<any[]>;
  loading: boolean;
  error: string | null;
  refreshData: (options?: { silent?: boolean }) => Promise<void>;
  getStatusColor: (status: string) => string;
  getCampaignTypeIcon: (type: string) => JSX.Element;
  getPartnershipIcon: (type: string) => JSX.Element;
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

function NgoDashboard() {
  const { user } = useAuth();

  useFcmNotificationBridge();

  const {
    campaigns,
    volunteers,
    partnerships,
    donorCommunity,
    stats,
    getParticipantDonors,
    loading,
    error,
    refreshData,
  } = useNgoData(user?.uid || '');

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

  useEffect(() => {
    if (!user?.uid) return;
    if (typeof window === 'undefined' || !window.sessionStorage) return;
    const prefetchKey = `ngo_dashboard_prefetch_${user.uid}`;
    const lastPrefetch = window.sessionStorage.getItem(prefetchKey);
    if (lastPrefetch && Date.now() - Number(lastPrefetch) < 5 * 60 * 1000) {
      return;
    }
    const task = () => {
      refreshData({ silent: true })
        .catch((error) => {
          console.warn('NGO dashboard prefetch failed', error);
        })
        .finally(() => {
          window.sessionStorage.setItem(prefetchKey, Date.now().toString());
        });
    };
    const idle = typeof globalThis !== 'undefined' ? (globalThis as any).requestIdleCallback : null;
    if (typeof idle === 'function') {
      const id = idle(task);
      return () => {
        const cancel = (globalThis as any).cancelIdleCallback;
        if (typeof cancel === 'function') {
          cancel(id);
        }
      };
    }
    const timer = setTimeout(task, 1200);
    return () => clearTimeout(timer);
  }, [user?.uid, refreshData]);

  const menuItems = [
    { id: 'overview', label: 'Overview', to: 'overview', icon: Activity },
    { id: 'campaigns', label: 'Campaigns', to: 'campaigns', icon: Target },
    { id: 'volunteers', label: 'Volunteers', to: 'volunteers', icon: Users },
    { id: 'partnerships', label: 'Partnerships', to: 'partnerships', icon: Handshake },
    { id: 'donors', label: 'Donors', to: 'donors', icon: Heart },
    { id: 'analytics', label: 'Analytics', to: 'analytics', icon: BarChart3 },
    { id: 'referrals', label: 'Referrals', to: 'referrals', icon: Share2 },
    { id: 'account', label: 'Account', to: 'account', icon: Settings },
  ] as const;

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return 'text-emerald-700 bg-emerald-50 border border-emerald-200';
      case 'upcoming':
        return 'text-amber-700 bg-amber-50 border border-amber-200';
      case 'completed':
        return 'text-gray-600 bg-gray-100 border border-gray-200';
      case 'pending':
        return 'text-orange-700 bg-orange-50 border border-orange-200';
      case 'draft':
        return 'text-slate-600 bg-slate-100 border border-slate-200';
      case 'cancelled':
        return 'text-rose-700 bg-rose-50 border border-rose-200';
      case 'inactive':
        return 'text-gray-500 bg-gray-100 border border-gray-200';
      default:
        return 'text-gray-600 bg-gray-100 border border-gray-200';
    }
  };

  const getCampaignTypeIcon = (type: string) => {
    switch (type) {
      case 'blood-drive':
        return <Heart className="w-4 h-4" />;
      case 'awareness':
        return <Target className="w-4 h-4" />;
      case 'fundraising':
        return <BarChart3 className="w-4 h-4" />;
      case 'volunteer':
        return <Users className="w-4 h-4" />;
      default:
        return <Target className="w-4 h-4" />;
    }
  };

  const getPartnershipIcon = (type: string) => {
    switch (type) {
      case 'bloodbank':
      case 'hospital':
        return <Heart className="w-5 h-5" />;
      case 'corporate':
        return <BarChart3 className="w-5 h-5" />;
      case 'community':
        return <Users className="w-5 h-5" />;
      default:
        return <Handshake className="w-5 h-5" />;
    }
  };

  const dashboardContext: NgoDashboardContext = {
    user,
    campaigns,
    volunteers,
    partnerships,
    donorCommunity,
    stats,
    getParticipantDonors,
    loading,
    error,
    refreshData,
    getStatusColor,
    getCampaignTypeIcon,
    getPartnershipIcon,
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
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-amber-50 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 text-red-600 animate-spin mx-auto mb-4" />
          <p className="text-gray-600 font-semibold">Loading NGO dashboard...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-amber-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md w-full text-center">
          <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Error Loading Data</h2>
          <p className="text-gray-600 mb-6">{error}</p>
          <AdminRefreshButton
            onClick={() => void refreshData()}
            isRefreshing={loading}
            label="Retry loading NGO dashboard"
            className="h-12 w-12 mx-auto border-red-600 bg-gradient-to-r from-red-600 to-amber-600 text-white hover:from-red-700 hover:to-amber-700"
          />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-amber-50">
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
                          ? 'bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-md'
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
            {user?.notificationPreferences?.push !== false && (
              <div className="mb-4">
                <NotificationPermissionPrompt />
              </div>
            )}
            <Outlet context={dashboardContext} />
          </main>
        </div>
      </div>

    </div>
  );
}

export default NgoDashboard;
