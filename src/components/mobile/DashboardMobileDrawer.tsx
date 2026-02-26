import type { ComponentType } from 'react';
import { NavLink } from 'react-router-dom';
import { X } from 'lucide-react';

export type DashboardDrawerItem = {
  id: string;
  label: string;
  to: string;
  icon: ComponentType<{ className?: string }>;
};

type DashboardMobileDrawerProps = {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  items: DashboardDrawerItem[];
  activeClassName?: string;
  inactiveClassName?: string;
  widthClassName?: string;
};

const DEFAULT_ACTIVE_CLASS =
  'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-md';
const DEFAULT_INACTIVE_CLASS = 'text-gray-600 hover:bg-red-50 dark:text-gray-300 dark:hover:bg-red-900/25';

export default function DashboardMobileDrawer({
  isOpen,
  onClose,
  title,
  items,
  activeClassName = DEFAULT_ACTIVE_CLASS,
  inactiveClassName = DEFAULT_INACTIVE_CLASS,
  widthClassName = 'w-72',
}: DashboardMobileDrawerProps) {
  return (
    <div
      className={`fixed inset-0 z-50 lg:hidden transition-opacity duration-300 ${
        isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'
      }`}
      aria-hidden={!isOpen}
    >
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-label="Close menu overlay"
      />
      <div
        className={`absolute left-0 top-0 h-full ${widthClassName} bg-white p-4 shadow-2xl transition-transform duration-300 dark:bg-[#0a0f1a] ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{title}</p>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full p-2 hover:bg-gray-100 dark:hover:bg-gray-800"
            aria-label="Close menu"
          >
            <X className="h-5 w-5 text-gray-600 dark:text-gray-300" />
          </button>
        </div>
        <nav className="space-y-2">
          {items.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={`mobile-${item.id}`}
                to={item.to}
                onClick={onClose}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-semibold transition-all ${
                    isActive ? activeClassName : inactiveClassName
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
  );
}
