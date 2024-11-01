// src/components/nav/NavLink.tsx
import { Link, useLocation } from 'react-router-dom';
import { cn } from '../../utils/cn';

interface NavLinkProps {
  to: string;
  children: React.ReactNode;
}

export function NavLink({ to, children }: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={cn(
        'text-gray-600 hover:text-gray-900 transition-colors',
        isActive && 'text-red-600 hover:text-red-700'
      )}
    >
      {children}
    </Link>
  );
}

export function MobileNavLink({ to, children }: NavLinkProps) {
  const location = useLocation();
  const isActive = location.pathname === to;

  return (
    <Link
      to={to}
      className={cn(
        'block px-3 py-2 rounded-md text-base font-medium text-gray-600 hover:text-gray-900 hover:bg-gray-50',
        isActive && 'text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100'
      )}
    >
      {children}
    </Link>
  );
}