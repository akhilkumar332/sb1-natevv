import { useMemo } from 'react';
import { NavLink, Outlet } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  ClipboardCheck,
  Droplets,
  Heart,
  LayoutDashboard,
  Settings,
  Shield,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

type MenuItem = {
  id: string;
  label: string;
  to: string;
  icon: any;
  superAdminOnly?: boolean;
};

function AdminPortal() {
  const { isSuperAdmin } = useAuth();

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
    { id: 'errors', label: 'Error Logs', to: 'error-logs', icon: AlertTriangle },
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
      <div className="container mx-auto px-4 py-6 sm:py-8">
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

    </div>
  );
}

export default AdminPortal;
