import type { ComponentType } from 'react';
import { Activity, BarChart3, Calendar, Heart, Home, Settings, Shield, Users } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';

type MobileNavItem = {
  to: string;
  label: string;
  icon: ComponentType<{ className?: string }>;
};

const donorNav: MobileNavItem[] = [
  { to: '/donor/dashboard/overview', label: 'Home', icon: Home },
  { to: '/donor/dashboard/requests', label: 'Requests', icon: Heart },
  { to: '/donor/dashboard/journey', label: 'Journey', icon: Activity },
  { to: '/donor/dashboard/account', label: 'Account', icon: Settings },
];

const ngoNav: MobileNavItem[] = [
  { to: '/ngo/dashboard/overview', label: 'Home', icon: Home },
  { to: '/ngo/dashboard/campaigns', label: 'Campaigns', icon: Heart },
  { to: '/ngo/dashboard/donors', label: 'Donors', icon: Users },
  { to: '/ngo/dashboard/account', label: 'Account', icon: Settings },
];

const bloodbankNav: MobileNavItem[] = [
  { to: '/bloodbank/dashboard/overview', label: 'Home', icon: Home },
  { to: '/bloodbank/dashboard/requests', label: 'Requests', icon: Heart },
  { to: '/bloodbank/dashboard/appointments', label: 'Appts', icon: Calendar },
  { to: '/bloodbank/dashboard/account', label: 'Account', icon: Settings },
];

const adminNav: MobileNavItem[] = [
  { to: '/admin/dashboard/overview', label: 'Home', icon: Home },
  { to: '/admin/dashboard/users', label: 'Users', icon: Users },
  { to: '/admin/dashboard/analytics-reports', label: 'Reports', icon: BarChart3 },
  { to: '/admin/dashboard/settings', label: 'Settings', icon: Shield },
];

const resolveItems = (pathname: string): MobileNavItem[] | null => {
  if (pathname.startsWith('/donor/dashboard')) return donorNav;
  if (pathname.startsWith('/ngo/dashboard')) return ngoNav;
  if (pathname.startsWith('/bloodbank/dashboard')) return bloodbankNav;
  if (pathname.startsWith('/admin/dashboard')) return adminNav;
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
