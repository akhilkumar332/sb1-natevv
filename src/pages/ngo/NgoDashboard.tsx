import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
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
import BhIdBanner from '../../components/BhIdBanner';
import {
  Activity,
  AlertCircle,
  BarChart3,
  Handshake,
  Heart,
  Loader2,
  Menu,
  Plus,
  RefreshCw,
  Share2,
  Settings,
  Target,
  Users,
  X,
} from 'lucide-react';

export type NgoDashboardContext = {
  user: any;
  campaigns: Campaign[];
  volunteers: Volunteer[];
  partnerships: Partnership[];
  donorCommunity: DonorCommunity;
  stats: NgoStats;
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const {
    campaigns,
    volunteers,
    partnerships,
    donorCommunity,
    stats,
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
          <button
            onClick={() => refreshData()}
            className="bg-gradient-to-r from-red-600 to-amber-600 text-white px-6 py-3 rounded-xl font-semibold hover:from-red-700 hover:to-amber-700 transition-all shadow-lg flex items-center gap-2 mx-auto"
          >
            <RefreshCw className="w-5 h-5" />
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-amber-50">
      <div className="bg-gradient-to-r from-red-600 to-amber-600 text-white shadow-xl">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center space-x-3">
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Profile"
                  className="w-12 h-12 rounded-full border-2 border-white shadow-lg object-cover"
                  onError={(e) => {
                    e.currentTarget.src = `https://ui-avatars.com/api/?background=fff&color=dc2626&name=${encodeURIComponent(user?.displayName || 'NGO')}`;
                  }}
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-white/20 backdrop-blur-sm border-2 border-white flex items-center justify-center">
                  <Heart className="w-6 h-6" />
                </div>
              )}
              <div>
                <h1 className="text-lg sm:text-2xl font-bold">
                  Welcome back, {user?.displayName?.split(' ')[0] || 'NGO'}!
                </h1>
                <p className="text-xs sm:text-sm text-white/80">Manage campaigns, volunteers, partnerships, and donors.</p>
                <div className="mt-1 flex flex-wrap items-center gap-3 text-xs sm:text-sm font-semibold text-white/90">
                  {user?.bhId && <span>BH ID: {user.bhId}</span>}
                  {user?.registrationNumber && <span>Reg ID: {user.registrationNumber}</span>}
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center space-x-3">
              <button
                onClick={() => refreshData()}
                className="p-3 bg-white/15 hover:bg-white/25 rounded-full transition-all duration-300"
                title="Refresh data"
              >
                <RefreshCw className="w-5 h-5" />
              </button>
              <Link
                to="/ngo/dashboard/campaigns"
                className="inline-flex items-center gap-2 px-5 py-3 bg-white text-red-600 rounded-full font-semibold shadow-lg hover:bg-red-50 transition-all"
              >
                <Plus className="w-5 h-5" />
                New Campaign
              </Link>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-6">
        <BhIdBanner />
      </div>

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

          <div className="lg:hidden mb-4 flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm"
            >
              <Menu className="h-4 w-4 text-red-600" />
              Menu
            </button>
            <span className="text-xs uppercase tracking-[0.2em] text-red-600">NGO Portal</span>
          </div>

          <main className="min-w-0 flex-1">
            <Outlet context={dashboardContext} />
          </main>
        </div>
      </div>

      <div
        className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
          mobileMenuOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
        }`}
        aria-hidden={!mobileMenuOpen}
      >
        <button
          type="button"
          className="absolute inset-0 bg-black/40 backdrop-blur-sm"
          onClick={() => setMobileMenuOpen(false)}
          aria-label="Close menu overlay"
        />
        <div
          className={`absolute left-0 top-0 h-full w-72 bg-white p-4 shadow-2xl transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">NGO Menu</p>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(false)}
              className="rounded-full p-2 hover:bg-gray-100"
              aria-label="Close menu"
            >
              <X className="h-5 w-5 text-gray-600" />
            </button>
          </div>
          <nav className="space-y-2">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={`mobile-${item.id}`}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
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
          </nav>
        </div>
      </div>
    </div>
  );
}

export default NgoDashboard;
