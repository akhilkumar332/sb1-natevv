import { useEffect, useMemo, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Calendar,
  FileImage,
  FileText,
  ChevronDown,
  ChevronRight,
  ClipboardCheck,
  Droplets,
  Heart,
  LayoutTemplate,
  ListTree,
  LayoutDashboard,
  Mail,
  Newspaper,
  Settings,
  Shield,
  SlidersHorizontal,
  Tags,
  Users,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import { ROUTES, getAdminDashboardMenuGroups, type AdminDashboardMenuGroup, type AdminDashboardMenuItem } from '../../constants/routes';

type MenuGroup = {
  id: string;
  label: string;
  icon: any;
  items: Array<AdminDashboardMenuItem & { to: string; icon: any }>;
};

function AdminPortal() {
  const { isSuperAdmin } = useAuth();
  const location = useLocation();
  const overviewItem = {
    id: 'overview',
    label: 'Overview',
    to: 'overview',
    icon: LayoutDashboard,
  };

  const itemIconMap: Record<string, any> = {
    users: Users,
    donors: Heart,
    ngos: Users,
    bloodbanks: Building2,
    verification: ClipboardCheck,
    emergency: Activity,
    inventory: Droplets,
    campaigns: BarChart3,
    ops: Users,
    appointments: Calendar,
    analytics: BarChart3,
    nps: BarChart3,
    'cms-overview': LayoutTemplate,
    'cms-pages': FileText,
    'cms-blog-posts': Newspaper,
    'cms-categories': Tags,
    'cms-menus': ListTree,
    'cms-media': FileImage,
    'cms-settings': SlidersHorizontal,
    audit: Shield,
    errors: AlertTriangle,
    impersonation: Shield,
    'contact-submissions': Mail,
    notifications: Bell,
    settings: Settings,
  };
  const groupIconMap: Record<string, any> = {
    users: Users,
    operations: Activity,
    insights: BarChart3,
    content: LayoutTemplate,
    security: Shield,
    system: Settings,
  };

  const menuGroups = useMemo<MenuGroup[]>(() => {
    const groups: AdminDashboardMenuGroup[] = getAdminDashboardMenuGroups(isSuperAdmin);
    return groups.map((group) => ({
      id: group.id,
      label: group.label,
      icon: groupIconMap[group.id] ?? Settings,
      items: group.items.map((item) => ({
        ...item,
        to: item.path.replace(`${ROUTES.portal.admin.dashboard.root}/`, ''),
        icon: itemIconMap[item.id] ?? Settings,
      })),
    }));
  }, [isSuperAdmin]);
  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>({});
  const OverviewIcon = overviewItem.icon;

  useEffect(() => {
    const currentPath = location.pathname.replace(`${ROUTES.portal.admin.dashboard.root}/`, '');
    setExpandedGroups((prev) => {
      const next: Record<string, boolean> = {};
      menuGroups.forEach((group) => {
        const containsActive = group.items.some((item) => item.to === currentPath);
        next[group.id] = prev[group.id] ?? (containsActive || group.id === 'security' || group.id === 'content');
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
