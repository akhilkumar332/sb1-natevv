/**
 * StatsCard Component
 *
 * Displays a statistic with an icon, label, and optional trend
 */

import React from 'react';
import { LucideIcon } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  trend?: {
    value: number;
    label: string;
    isPositive?: boolean;
  };
  subtitle?: string;
}

/**
 * StatsCard component
 */
export const StatsCard: React.FC<StatsCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor = 'text-blue-600',
  iconBgColor = 'bg-blue-100',
  trend,
  subtitle,
}) => {
  return (
    <div className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>

          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}

          {trend && (
            <div className="flex items-center gap-1 mt-2">
              <span
                className={`text-sm font-medium ${
                  trend.isPositive ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {trend.isPositive ? '↑' : '↓'} {Math.abs(trend.value)}%
              </span>
              <span className="text-xs text-gray-500">{trend.label}</span>
            </div>
          )}
        </div>

        <div className={`p-3 rounded-full ${iconBgColor}`}>
          <Icon className={`w-6 h-6 ${iconColor}`} />
        </div>
      </div>
    </div>
  );
};

export default StatsCard;
