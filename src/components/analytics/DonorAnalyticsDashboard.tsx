/**
 * DonorAnalyticsDashboard Component
 *
 * Comprehensive analytics dashboard for donors
 * Demonstrates usage of all analytics components
 */

import React, { useState, useEffect } from 'react';
import { Activity, TrendingUp, Calendar, Award } from 'lucide-react';
import { StatsCard } from './StatsCard';
import { LineChart } from './LineChart';
import { PieChart } from './PieChart';
import { BarChart } from './BarChart';
import { DateRangeFilter } from './DateRangeFilter';
import { ExportButton } from './ExportButton';
import {
  getDonorStats,
  getDonationTrend,
  getBloodTypeDistribution,
  type DonorStats,
  type TrendData,
  type BloodTypeDistribution,
} from '../../services/analytics.service';
import { captureHandledError } from '../../services/errorLog.service';
import { CHART_PALETTE } from '../../constants/theme';

interface DonorAnalyticsDashboardProps {
  donorId: string;
}

/**
 * DonorAnalyticsDashboard Component
 */
export const DonorAnalyticsDashboard: React.FC<DonorAnalyticsDashboardProps> = ({
  donorId,
}) => {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<DonorStats | null>(null);
  const [trendData, setTrendData] = useState<TrendData[]>([]);
  const [bloodTypeData, setBloodTypeData] = useState<BloodTypeDistribution[]>([]);
  const [dateRange, setDateRange] = useState({ start: new Date(), end: new Date() });

  // Initialize date range (last 90 days)
  useEffect(() => {
    const end = new Date();
    const start = new Date();
    start.setDate(end.getDate() - 90);
    setDateRange({ start, end });
  }, []);

  // Load analytics data
  useEffect(() => {
    const loadAnalytics = async () => {
      try {
        setLoading(true);

        // Load donor stats
        const donorStats = await getDonorStats(donorId);
        setStats(donorStats);

        // Load donation trend
        const trend = await getDonationTrend(donorId, {
          startDate: dateRange.start,
          endDate: dateRange.end,
        });
        setTrendData(trend);

        // Load blood type distribution (platform-wide for comparison)
        const bloodTypes = await getBloodTypeDistribution();
        setBloodTypeData(bloodTypes);
      } catch (error) {
        void captureHandledError(error, {
          source: 'frontend',
          scope: 'donor',
          metadata: { kind: 'analytics.load', component: 'DonorAnalyticsDashboard' },
        });
      } finally {
        setLoading(false);
      }
    };

    if (donorId) {
      loadAnalytics();
    }
  }, [donorId, dateRange]);

  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange({ start, end });
  };

  // Prepare export data
  const exportData = stats
    ? [
        {
          metric: 'Total Donations',
          value: stats.totalDonations,
        },
        {
          metric: 'Total Units Donated',
          value: stats.totalUnits,
        },
        {
          metric: 'Donation Frequency (per year)',
          value: stats.donationFrequency.toFixed(2),
        },
        {
          metric: 'Impact Score',
          value: stats.impactScore,
        },
        {
          metric: 'Current Streak',
          value: stats.currentStreak,
        },
        {
          metric: 'Longest Streak',
          value: stats.longestStreak,
        },
        {
          metric: 'Lives Impacted',
          value: stats.lifetimeImpact,
        },
      ]
    : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Donor Analytics</h1>
          <p className="text-sm text-gray-600 mt-1">
            Track your donation history and impact
          </p>
        </div>
        <ExportButton
          data={exportData}
          filename={`donor-analytics-${donorId}`}
          headers={['metric', 'value']}
        />
      </div>

      {/* Date Range Filter */}
      <DateRangeFilter
        onRangeChange={handleDateRangeChange}
        defaultRange="quarter"
      />

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="Total Donations"
          value={stats?.totalDonations || 0}
          subtitle="All time"
          icon={Activity}
          iconColor="text-red-600"
          loading={loading}
        />

        <StatsCard
          title="Units Donated"
          value={stats?.totalUnits || 0}
          subtitle="Total units"
          icon={TrendingUp}
          iconColor="text-blue-600"
          loading={loading}
        />

        <StatsCard
          title="Current Streak"
          value={stats?.currentStreak || 0}
          subtitle="Consecutive donations"
          icon={Calendar}
          iconColor="text-green-600"
          loading={loading}
        />

        <StatsCard
          title="Impact Score"
          value={stats?.impactScore || 0}
          subtitle={`${stats?.lifetimeImpact || 0} lives impacted`}
          icon={Award}
          iconColor="text-purple-600"
          trend={
            stats && stats.currentStreak > 0
              ? { value: stats.currentStreak, isPositive: true }
              : undefined
          }
          loading={loading}
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Donation Trend */}
        <LineChart
          data={trendData}
          title="Donation Trend"
          color={CHART_PALETTE.primary}
        />

        {/* Blood Type Distribution */}
        <PieChart
          data={bloodTypeData.map((d) => ({
            label: d.bloodType,
            value: d.count,
            color: d.color,
          }))}
          title="Platform Blood Type Distribution"
        />
      </div>

      {/* Monthly Breakdown */}
      {trendData.length > 0 && (
        <BarChart
          data={trendData.map((d) => ({
            label: d.label,
            value: d.value,
          }))}
          title="Monthly Donation Breakdown"
          color={CHART_PALETTE.primary}
          height={250}
        />
      )}

      {/* Impact Summary */}
      {stats && (
        <div className="bg-gradient-to-r from-red-50 to-red-100 rounded-lg p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Your Impact Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Donation Frequency</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.donationFrequency.toFixed(1)}
              </p>
              <p className="text-xs text-gray-500">donations per year</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Longest Streak</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.longestStreak}
              </p>
              <p className="text-xs text-gray-500">consecutive donations</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Lives Impacted</p>
              <p className="text-2xl font-bold text-red-600">
                {stats.lifetimeImpact}
              </p>
              <p className="text-xs text-gray-500">people helped</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DonorAnalyticsDashboard;
