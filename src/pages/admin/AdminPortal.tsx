import { useMemo, useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  Activity,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  ClipboardCheck,
  Droplets,
  Heart,
  LayoutDashboard,
  Menu,
  RefreshCw,
  Settings,
  Shield,
  Users,
  X,
} from 'lucide-react';
import BhIdBanner from '../../components/BhIdBanner';
import { useAuth } from '../../contexts/AuthContext';

type MenuItem = {
  id: string;
  label: string;
  to: string;
  icon: any;
  superAdminOnly?: boolean;
};

function AdminPortal() {
  const { user, isSuperAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const menuItems = useMemo<MenuItem[]>(() => [
    { id: 'overview', label: 'Overview', to: 'overview', icon: LayoutDashboard },
    { id: 'users', label: 'Users', to: 'users', icon: Users },
    { id: 'donors', label: 'Donors', to: 'donors', icon: Heart },
    { id: 'ngos', label: 'NGOs', to: 'ngos', icon: Users },
    { id: 'bloodbanks', label: 'BloodBanks', to: 'bloodbanks', icon: Building2 },
    { id: 'verification', label: 'Verification', to: 'verification', icon: ClipboardCheck },
    { id: 'emergency', label: 'Emergency', to: 'emergency-requests', icon: Activity },
    { id: 'inventory', label: 'Inventory Alerts', to: 'inventory-alerts', icon: Droplets },
    { id: 'campaigns', label: 'Campaigns', to: 'campaigns', icon: BarChart3 },
    { id: 'ops', label: 'Volunteers & Partners', to: 'volunteers-partnerships', icon: Users },
    { id: 'appointments', label: 'Appointments & Donations', to: 'appointments-donations', icon: Calendar },
    { id: 'analytics', label: 'Analytics', to: 'analytics-reports', icon: BarChart3 },
    { id: 'audit', label: 'Audit & Security', to: 'audit-security', icon: Shield },
    { id: 'impersonation', label: 'Impersonation Audit', to: 'impersonation-audit', icon: Shield, superAdminOnly: true },
    { id: 'notifications', label: 'Notifications', to: 'notifications', icon: Bell },
    { id: 'settings', label: 'Settings', to: 'settings', icon: Settings },
  ], []);

  const visibleMenuItems = menuItems.filter((item) => !item.superAdminOnly || isSuperAdmin);

  const navItemClass = ({ isActive }: { isActive: boolean }) => (
    `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
      isActive
        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md'
        : 'text-gray-700 hover:bg-red-50'
    }`
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-100">
      <div className="bg-gradient-to-r from-red-700 to-red-800 text-white shadow-xl">
        <div className="container mx-auto px-4 py-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-white/20 border border-white/30 flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-lg sm:text-2xl font-bold">Admin Control Center</h1>
                <p className="text-xs sm:text-sm text-white/80">
                  {isSuperAdmin ? 'SuperAdmin mode active' : 'Admin mode active'}
                </p>
                <div className="mt-1 text-xs sm:text-sm font-semibold text-white/90 flex flex-wrap gap-3">
                  {user?.bhId && <span>BH ID: {user.bhId}</span>}
                  <span>Role: {isSuperAdmin ? 'superadmin' : 'admin'}</span>
                </div>
              </div>
            </div>
            <div className="hidden md:flex items-center gap-3">
              {isSuperAdmin && (
                <button
                  type="button"
                  onClick={() => navigate('impersonation-audit')}
                  className="rounded-full bg-white px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
                >
                  Open Impersonation Audit
                </button>
              )}
              <button
                type="button"
                onClick={() => navigate('overview')}
                className="p-3 bg-white/20 hover:bg-white/30 rounded-full transition-all"
                title="Go to overview"
              >
                <RefreshCw className="h-5 w-5" />
              </button>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 pt-6">
        <BhIdBanner />
      </div>

      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="lg:hidden mb-4 space-y-3">
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => setMobileMenuOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl border border-red-100 bg-white px-4 py-2 text-sm font-semibold text-gray-700 shadow-sm"
            >
              <Menu className="h-4 w-4 text-red-600" />
              Menu
            </button>
            <span className="text-xs uppercase tracking-[0.2em] text-red-700">Admin Portal</span>
          </div>
          <div className="overflow-x-auto">
            <nav className="flex min-w-max items-center gap-2 pb-1">
              {visibleMenuItems.map((item) => (
                <NavLink
                  key={`quick-${item.id}`}
                  to={item.to}
                  className={({ isActive }) => (
                    `whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all ${
                      isActive
                        ? 'border-red-200 bg-red-600 text-white'
                        : 'border-gray-200 bg-white text-gray-700 hover:bg-red-50'
                    }`
                  )}
                >
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>
        </div>

        <div className="lg:flex lg:gap-6">
          <aside className="hidden lg:block lg:w-72">
            <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-auto space-y-2 rounded-2xl border border-red-100 bg-white p-4 shadow-lg">
              {visibleMenuItems.map((item) => {
                const Icon = item.icon;
                return (
                  <NavLink key={item.id} to={item.to} className={navItemClass}>
                    <Icon className="h-4 w-4" />
                    {item.label}
                  </NavLink>
                );
              })}
            </div>
          </aside>
          <main className="min-w-0 flex-1 pb-16 lg:pb-0">
            <Outlet />
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
          className={`absolute left-0 top-0 h-full w-80 bg-white p-4 shadow-2xl transition-transform duration-300 ${
            mobileMenuOpen ? 'translate-x-0' : '-translate-x-full'
          }`}
        >
          <div className="mb-4 flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-900">Admin Menu</p>
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
            {visibleMenuItems.map((item) => {
              const Icon = item.icon;
              return (
                <NavLink
                  key={`mobile-${item.id}`}
                  to={item.to}
                  onClick={() => setMobileMenuOpen(false)}
                  className={navItemClass}
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

export default AdminPortal;
