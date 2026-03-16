/**
 * StatsCard Component
 *
 * Reusable card component for displaying statistics
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  iconColor?: string;
  badge?: string;
  accent?: 'red' | 'blue' | 'amber' | 'green' | 'slate';
  footer?: string;
  trend?: {
    value: number;
    isPositive: boolean;
    label?: string;
  };
  loading?: boolean;
}

const ACCENT_STYLES = {
  red: {
    shell: 'border-red-200 bg-[linear-gradient(135deg,#fff1f2_0%,#ffffff_65%)] dark:border-red-900/40 dark:bg-[linear-gradient(135deg,rgba(127,29,29,0.42)_0%,rgba(15,23,42,0.96)_65%)]',
    value: 'text-red-700 dark:text-red-300',
    icon: 'text-red-600 bg-red-100 dark:bg-red-950/60 dark:text-red-300',
    badge: 'border-red-200 bg-red-50 text-red-700 dark:border-red-900/40 dark:bg-red-950/50 dark:text-red-200',
  },
  blue: {
    shell: 'border-blue-200 bg-[linear-gradient(135deg,#eff6ff_0%,#ffffff_65%)] dark:border-blue-900/40 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.28)_0%,rgba(15,23,42,0.96)_65%)]',
    value: 'text-blue-700 dark:text-blue-300',
    icon: 'text-blue-600 bg-blue-100 dark:bg-blue-950/60 dark:text-blue-300',
    badge: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/50 dark:text-blue-200',
  },
  amber: {
    shell: 'border-amber-200 bg-[linear-gradient(135deg,#fffbeb_0%,#ffffff_65%)] dark:border-amber-900/40 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.34)_0%,rgba(15,23,42,0.96)_65%)]',
    value: 'text-amber-700 dark:text-amber-300',
    icon: 'text-amber-600 bg-amber-100 dark:bg-amber-950/60 dark:text-amber-300',
    badge: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/50 dark:text-amber-200',
  },
  green: {
    shell: 'border-emerald-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#ffffff_65%)] dark:border-emerald-900/40 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.34)_0%,rgba(15,23,42,0.96)_65%)]',
    value: 'text-emerald-700 dark:text-emerald-300',
    icon: 'text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 dark:text-emerald-300',
    badge: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/50 dark:text-emerald-200',
  },
  slate: {
    shell: 'border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#ffffff_65%)] dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(30,41,59,0.92)_0%,rgba(15,23,42,0.98)_65%)]',
    value: 'text-slate-800 dark:text-slate-100',
    icon: 'text-slate-600 bg-slate-100 dark:bg-slate-800 dark:text-slate-200',
    badge: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
  },
} as const;

/**
 * StatsCard Component
 */
export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  iconColor = 'text-red-600',
  badge,
  accent = 'slate',
  footer,
  trend,
  loading = false,
}) => {
  const accentStyle = ACCENT_STYLES[accent];

  if (loading) {
    return (
      <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="h-4 w-1/3 rounded bg-slate-200 dark:bg-slate-800"></div>
          <div className="h-9 w-9 rounded-xl bg-slate-200 dark:bg-slate-800"></div>
        </div>
        <div className="mb-3 h-9 w-2/3 rounded bg-slate-200 dark:bg-slate-800"></div>
        <div className="h-3 w-1/2 rounded bg-slate-200 dark:bg-slate-800"></div>
      </div>
    );
  }

  return (
    <div className={`rounded-2xl border p-5 shadow-sm transition-shadow hover:shadow-md ${accentStyle.shell}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="mb-3 flex flex-col items-start gap-2 sm:flex-row sm:flex-wrap sm:items-center">
            <p className="min-w-0 break-words text-sm font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">{title}</p>
            {badge ? (
              <span className={`inline-flex max-w-full items-center rounded-full border px-2 py-0.5 text-[11px] font-semibold ${accentStyle.badge}`}>
                <span className="truncate">{badge}</span>
              </span>
            ) : null}
          </div>
          <p className={`mb-1 break-words text-3xl font-bold leading-tight ${accentStyle.value}`}>{value}</p>
          {subtitle && <p className="break-words text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p>}

          {trend && (
            <div className="mt-3 flex items-center gap-2">
              <span className={`shrink-0 text-sm font-semibold ${trend.isPositive ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="min-w-0 break-words text-xs text-slate-500 dark:text-slate-400">{trend.label || 'vs last period'}</span>
            </div>
          )}
        </div>

        {Icon && (
          <div className={`shrink-0 rounded-2xl p-3 ${accentStyle.icon}`}>
            <Icon className={`h-6 w-6 ${iconColor}`} />
          </div>
        )}
      </div>
      {footer ? (
        <div className="mt-4 border-t border-slate-200/80 pt-3 text-xs font-medium text-slate-500 dark:border-slate-800 dark:text-slate-400">
          {footer}
        </div>
      ) : null}
    </div>
  );
};

export default StatsCard;
