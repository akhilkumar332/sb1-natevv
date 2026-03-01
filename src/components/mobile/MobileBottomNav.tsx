import type { ComponentType } from 'react';
import { Activity, BarChart3, Calendar, Heart, Home, Settings, Shield, Users } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { DASHBOARD_PREFIX, ROUTES } from '../../constants/routes';

type MobileNavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const donorNav: MobileNavItem[] = [
  { to: ROUTES.portal.donor.dashboard.overview, label: 'Home', icon: Home },
  { to: ROUTES.portal.donor.dashboard.requests, label: 'Requests', icon: Heart },
  { to: ROUTES.portal.donor.dashboard.journey, label: 'Journey', icon: Activity },
  { to: ROUTES.portal.donor.dashboard.account, label: 'Account', icon: Settings },
];

const ngoNav: MobileNavItem[] = [
  { to: ROUTES.portal.ngo.dashboard.overview, label: 'Home', icon: Home },
  { to: ROUTES.portal.ngo.dashboard.campaigns, label: 'Campaigns', icon: Heart },
  { to: ROUTES.portal.ngo.dashboard.donors, label: 'Donors', icon: Users },
  { to: ROUTES.portal.ngo.dashboard.account, label: 'Account', icon: Settings },
];

const bloodbankNav: MobileNavItem[] = [
  { to: ROUTES.portal.bloodbank.dashboard.overview, label: 'Home', icon: Home },
  { to: ROUTES.portal.bloodbank.dashboard.requests, label: 'Requests', icon: Heart },
  { to: ROUTES.portal.bloodbank.dashboard.appointments, label: 'Appts', icon: Calendar },
  { to: ROUTES.portal.bloodbank.dashboard.account, label: 'Account', icon: Settings },
];

const adminNav: MobileNavItem[] = [
  { to: ROUTES.portal.admin.dashboard.overview, label: 'Home', icon: Home },
  { to: ROUTES.portal.admin.dashboard.users, label: 'Users', icon: Users },
  { to: ROUTES.portal.admin.dashboard.analyticsReports, label: 'Reports', icon: BarChart3 },
  { to: ROUTES.portal.admin.dashboard.settings, label: 'Settings', icon: Shield },
];

const resolveItems = (pathname: string): MobileNavItem[] | null => {
  if (pathname.startsWith(DASHBOARD_PREFIX.donor)) return donorNav;
  if (pathname.startsWith(DASHBOARD_PREFIX.ngo)) return ngoNav;
  if (pathname.startsWith(DASHBOARD_PREFIX.bloodbank)) return bloodbankNav;
  if (pathname.startsWith(DASHBOARD_PREFIX.admin)) return adminNav;
  return null;
};

const isActivePath = (pathname: string, to: string) =>
  pathname === to || pathname.startsWith(`${to}/`);

export default function MobileBottomNav({ enabled }: { enabled: boolean }) {
  const location = useLocation();
  const items = resolveItems(location.pathname);

  if (!enabled || !items) return null;

  return (
    <nav className="mobile-bottom-nav" aria-label="Mobile dashboard navigation">
      {items.map((item) => {
        const Icon = item.icon;
        const active = isActivePath(location.pathname, item.to);
        return (
          <NavLink
            key={item.to}
            to={item.to}
            className={`mobile-bottom-nav-item ${active ? 'mobile-bottom-nav-item-active' : ''}`}
          >
            <Icon className="h-4 w-4" />
            <span>{item.label}</span>
          </NavLink>
        );
      })}
    </nav>
  );
}
