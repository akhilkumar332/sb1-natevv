import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  ChevronDown,
  ChevronRight,
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

type MenuGroup = {
  id: string;
  label: string;
  icon: any;
  items: MenuItem[];
};

function AdminPortal() {
  const { isSuperAdmin } = useAuth();
  const location = useLocation();
  const overviewItem: MenuItem = {
    id: 'overview',
    label: 'Overview',
    to: 'overview',
    icon: LayoutDashboard,
  };

  const menuGroups = useMemo<MenuGroup[]>(() => {
    const groups: MenuGroup[] = [
      {
        id: 'users',
        label: 'User Management',
        icon: Users,
        items: [
          { id: 'users', label: 'Users', to: 'users', icon: Users },
          { id: 'donors', label: 'Donors', to: 'donors', icon: Heart },
          { id: 'ngos', label: 'NGOs', to: 'ngos', icon: Users },
          { id: 'bloodbanks', label: 'Blood Banks', to: 'bloodbanks', icon: Building2 },
          { id: 'verification', label: 'Verification', to: 'verification', icon: ClipboardCheck },
        ],
      },
      {
        id: 'operations',
        label: 'Operations',
        icon: Activity,
        items: [
          { id: 'emergency', label: 'Emergency Requests', to: 'emergency-requests', icon: Activity },
          { id: 'inventory', label: 'Inventory Alerts', to: 'inventory-alerts', icon: Droplets },
          { id: 'campaigns', label: 'Campaigns', to: 'campaigns', icon: BarChart3 },
          { id: 'ops', label: 'Volunteers & Partners', to: 'volunteers-partnerships', icon: Users },
          { id: 'appointments', label: 'Appointments & Donations', to: 'appointments-donations', icon: Calendar },
        ],
      },
      {
        id: 'insights',
        label: 'Insights',
        icon: BarChart3,
        items: [{ id: 'analytics', label: 'Analytics', to: 'analytics-reports', icon: BarChart3 }],
      },
      {
        id: 'security',
        label: 'Security',
        icon: Shield,
        items: [
          { id: 'audit', label: 'Audit & Security', to: 'audit-security', icon: Shield },
          { id: 'errors', label: 'Error Logs', to: 'error-logs', icon: AlertTriangle },
          { id: 'impersonation', label: 'Impersonation Audit', to: 'impersonation-audit', icon: Shield, superAdminOnly: true },
        ],
      },
      {
        id: 'system',
        label: 'System',
        icon: Settings,
        items: [
          { id: 'notifications', label: 'Notifications', to: 'notifications', icon: Bell },
          { id: 'settings', label: 'Settings', to: 'settings', icon: Settings },
        ],
      },
    ];
    return groups
      .map((group) => ({
        ...group,
        items: group.items.filter((item) => !item.superAdminOnly || isSuperAdmin),
      }))
      .filter((group) => group.items.length > 0);
  }, [isSuperAdmin]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const OverviewIcon = overviewItem.icon;

  useEffect(() => {
    const currentPath = location.pathname.replace('/admin/dashboard/', '');
    setExpandedGroups((prev) => {
      const next: Record<string, boolean> = {};
      menuGroups.forEach((group) => {
        const containsActive = group.items.some((item) => item.to === currentPath);
        next[group.id] = prev[group.id] ?? (containsActive || group.id === 'security');
      });
      return next;
    });
  }, [menuGroups, location.pathname]);

  const navItemClass = ({ isActive }: { isActive: boolean }) => (
    `flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition-all ${
      isActive
        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md'
        : 'text-gray-700 hover:bg-red-50/80'
    }`
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-red-100">
      <div className="container mx-auto px-4 py-6 sm:py-8">
        <div className="lg:flex lg:gap-6">
          <aside className="hidden lg:block lg:w-72">
            <div className="sticky top-6 max-h-[calc(100vh-3rem)] overflow-auto rounded-2xl border border-red-100 bg-white p-4 shadow-lg">
              <div className="space-y-4">
                <NavLink to={overviewItem.to} className={navItemClass}>
                  <OverviewIcon className="h-4 w-4" />
                  {overviewItem.label}
                </NavLink>
                {menuGroups.map((group) => {
                  const GroupIcon = group.icon;
                  const isExpanded = expandedGroups[group.id] ?? false;
                  return (
                    <section key={group.id} className="space-y-2">
                      <button
                        type="button"
                        onClick={() => setExpandedGroups((prev) => ({ ...prev, [group.id]: !(prev[group.id] ?? false) }))}
                        className="flex w-full items-center justify-between rounded-lg px-2 py-1.5 text-left hover:bg-red-50/70"
                        aria-expanded={isExpanded}
                      >
                        <span className="flex items-center gap-2">
                          <GroupIcon className="h-4 w-4 text-red-600" />
                          <span className="text-xs font-bold uppercase tracking-[0.12em] text-red-700">{group.label}</span>
                        </span>
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-red-500" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-red-500" />
                        )}
                      </button>
                      {isExpanded && (
                        <div className="space-y-1">
                          {group.items.map((item) => {
                            const Icon = item.icon;
                            return (
                              <NavLink key={item.id} to={item.to} className={navItemClass}>
                                <Icon className="h-4 w-4" />
                                {item.label}
                              </NavLink>
                            );
                          })}
                        </div>
                      )}
                    </section>
                  );
                })}
              </div>
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
