/**
 * AdminAnalyticsDashboard Component
 *
 * Platform-wide analytics dashboard for administrators
 * Shows platform metrics, growth trends, and geographic distribution
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Users, Droplet, Building2, TrendingUp } from 'lucide-react';
import { StatsCard } from './StatsCard';
import { LineChart } from './LineChart';
import { PieChart } from './PieChart';
import { BarChart } from './BarChart';
import { DateRangeFilter } from './DateRangeFilter';
import { ExportButton } from './ExportButton';
import {
  useBloodTypeDistribution,
  useGeographicDistribution,
  usePlatformRangeStats,
  usePlatformStats,
  useUserGrowthTrend,
} from '../../hooks/useAnalyticsQuery';
import { ANALYTICS_LIMITS, ANALYTICS_QUEUE_DELAYS_MS } from '../../constants/analytics';
import { CHART_PALETTE, KPI_ALIGNED_CHART_PALETTE } from '../../constants/theme';
import { FIFTEEN_MINUTES_MS, TEN_MINUTES_MS } from '../../constants/time';
import { getAdminCacheKey, readAdminCache, writeAdminCache } from '../../utils/adminCache';
import AdminRefreshButton from '../admin/AdminRefreshButton';
import { refetchQueries } from '../../utils/queryRefetch';

/**
 * AdminAnalyticsDashboard Component
 */
export const AdminAnalyticsDashboard: React.FC = () => {
  const [dateRange, setDateRange] = useState(() => {
    const end = new Date();
    const start = new Date();
    start.setFullYear(end.getFullYear() - 1);
    return { start, end };
  });
  const dateRangeQuery = useMemo(() => ({
    startDate: dateRange.start,
    endDate: dateRange.end,
  }), [dateRange]);

  const [queueState, setQueueState] = useState({
    platformStats: false,
    rangeStats: false,
    growthTrend: false,
    bloodType: false,
    geo: false,
  });

  useEffect(() => {
    const timers = [
      setTimeout(() => setQueueState((prev) => ({ ...prev, platformStats: true })), ANALYTICS_QUEUE_DELAYS_MS.platformStats),
      setTimeout(() => setQueueState((prev) => ({ ...prev, rangeStats: true })), ANALYTICS_QUEUE_DELAYS_MS.rangeStats),
      setTimeout(() => setQueueState((prev) => ({ ...prev, growthTrend: true })), ANALYTICS_QUEUE_DELAYS_MS.growthTrend),
      setTimeout(() => setQueueState((prev) => ({ ...prev, bloodType: true })), ANALYTICS_QUEUE_DELAYS_MS.bloodType),
      setTimeout(() => setQueueState((prev) => ({ ...prev, geo: true })), ANALYTICS_QUEUE_DELAYS_MS.geo),
    ];

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  const platformStatsKey = useMemo(() => getAdminCacheKey(['platformStats']), []);
  const platformRangeKey = useMemo(() => getAdminCacheKey(['platformRangeStats', dateRangeQuery]), [dateRangeQuery]);
  const growthKey = useMemo(() => getAdminCacheKey(['userGrowthTrend', dateRangeQuery]), [dateRangeQuery]);
  const bloodTypeKey = useMemo(() => getAdminCacheKey(['bloodTypeDistribution', dateRangeQuery]), [dateRangeQuery]);
  const geoKey = useMemo(() => getAdminCacheKey(['geographicDistribution', dateRangeQuery]), [dateRangeQuery]);

  const platformStatsQuery = usePlatformStats({
    enabled: queueState.platformStats,
    initialData: () => readAdminCache(platformStatsKey, TEN_MINUTES_MS),
  });
  const platformRangeStatsQuery = usePlatformRangeStats(dateRangeQuery, {
    enabled: queueState.rangeStats,
    initialData: () => readAdminCache(platformRangeKey, TEN_MINUTES_MS),
  });
  const growthQuery = useUserGrowthTrend(dateRangeQuery, {
    enabled: queueState.growthTrend,
    initialData: () => readAdminCache(growthKey, TEN_MINUTES_MS),
  });
  const bloodTypeQuery = useBloodTypeDistribution(dateRangeQuery, {
    enabled: queueState.bloodType,
    initialData: () => readAdminCache(bloodTypeKey, FIFTEEN_MINUTES_MS),
  });
  const geoQuery = useGeographicDistribution(dateRangeQuery, {
    enabled: queueState.geo,
    initialData: () => readAdminCache(geoKey, FIFTEEN_MINUTES_MS),
  });

  useEffect(() => {
    if (platformStatsQuery.data) writeAdminCache(platformStatsKey, platformStatsQuery.data);
  }, [platformStatsKey, platformStatsQuery.data]);
  useEffect(() => {
    if (platformRangeStatsQuery.data) writeAdminCache(platformRangeKey, platformRangeStatsQuery.data);
  }, [platformRangeKey, platformRangeStatsQuery.data]);
  useEffect(() => {
    if (growthQuery.data) writeAdminCache(growthKey, growthQuery.data);
  }, [growthKey, growthQuery.data]);
  useEffect(() => {
    if (bloodTypeQuery.data) writeAdminCache(bloodTypeKey, bloodTypeQuery.data);
  }, [bloodTypeKey, bloodTypeQuery.data]);
  useEffect(() => {
    if (geoQuery.data) writeAdminCache(geoKey, geoQuery.data);
  }, [geoKey, geoQuery.data]);

  const stats = platformStatsQuery.data || null;
  const rangeStats = platformRangeStatsQuery.data || null;
  const growthData = growthQuery.data || [];
  const bloodTypeData = bloodTypeQuery.data || [];
  const geoData = (geoQuery.data || []).slice(0, ANALYTICS_LIMITS.geoTopLocations);
  const loading = (!stats && platformStatsQuery.isFetching)
    || (!rangeStats && platformRangeStatsQuery.isFetching)
    || (growthData.length === 0 && growthQuery.isFetching)
    || (bloodTypeData.length === 0 && bloodTypeQuery.isFetching)
    || (geoData.length === 0 && geoQuery.isFetching);
  const errorMessage = [
    platformStatsQuery.error,
    platformRangeStatsQuery.error,
    growthQuery.error,
    bloodTypeQuery.error,
    geoQuery.error,
  ].find(Boolean);

  const selectedRangeLabel = useMemo(() => {
    const format = (value: Date) => value.toLocaleDateString(undefined, { day: '2-digit', month: 'short', year: 'numeric' });
    return `${format(dateRange.start)} - ${format(dateRange.end)}`;
  }, [dateRange]);

  const kpiAlignedPalette = useMemo(() => ([
    KPI_ALIGNED_CHART_PALETTE.users,
    KPI_ALIGNED_CHART_PALETTE.donors,
    KPI_ALIGNED_CHART_PALETTE.requests,
    KPI_ALIGNED_CHART_PALETTE.donations,
    CHART_PALETTE.warning,
    CHART_PALETTE.sequence[4],
    CHART_PALETTE.sequence[5],
    CHART_PALETTE.sequence[7],
  ]), []);

  const isRefreshing = platformStatsQuery.isFetching
    || platformRangeStatsQuery.isFetching
    || growthQuery.isFetching
    || bloodTypeQuery.isFetching
    || geoQuery.isFetching;

  const handleRefresh = () => {
    refetchQueries(platformStatsQuery, platformRangeStatsQuery, growthQuery, bloodTypeQuery, geoQuery);
  };

  const handleDateRangeChange = (start: Date, end: Date) => {
    setDateRange({ start, end });
  };

  // Prepare export data
  const donorEngagementPct = stats && stats.totalDonors > 0
    ? (stats.activeDonors / stats.totalDonors) * 100
    : 0;
  const verifiedPct = stats && stats.totalUsers > 0
    ? (stats.verifiedUsers / stats.totalUsers) * 100
    : 0;

  const exportData = [
    {
      section: 'filters',
      metric: 'startDate',
      label: dateRange.start.toISOString().slice(0, 10),
      value: dateRange.start.toISOString(),
    },
    {
      section: 'filters',
      metric: 'endDate',
      label: dateRange.end.toISOString().slice(0, 10),
      value: dateRange.end.toISOString(),
    },
    ...(stats
      ? [
        { section: 'meta', metric: 'data_scope', label: 'selected_range', value: selectedRangeLabel },
        { section: 'meta', metric: 'range_stats_source', label: rangeStats?.source || 'raw', value: rangeStats?.source || 'raw' },
        { section: 'kpi', metric: 'Total Users', label: 'users', value: stats.totalUsers },
        { section: 'kpi', metric: 'Total Donors', label: 'donors', value: stats.totalDonors },
        { section: 'kpi', metric: 'Total BloodBanks', label: 'bloodbanks', value: stats.totalHospitals },
        { section: 'kpi', metric: 'Total NGOs', label: 'ngos', value: stats.totalNGOs },
        { section: 'kpi', metric: 'Total Donations', label: 'donations', value: stats.totalDonations },
        { section: 'kpi', metric: 'Total Blood Requests', label: 'requests', value: stats.totalBloodRequests },
        { section: 'kpi', metric: 'Total Campaigns', label: 'campaigns', value: stats.totalCampaigns },
        { section: 'kpi', metric: 'Active Donors', label: 'active_donors', value: stats.activeDonors },
        { section: 'kpi', metric: 'Verified Users', label: 'verified_users', value: stats.verifiedUsers },
        { section: 'kpi', metric: 'Donor Engagement %', label: 'donor_engagement_pct', value: Number(donorEngagementPct.toFixed(2)) },
        { section: 'kpi', metric: 'Verified Users %', label: 'verified_users_pct', value: Number(verifiedPct.toFixed(2)) },
      ]
      : []),
    ...(rangeStats
      ? [
        { section: 'range_kpi', metric: 'New Users', label: 'new_users', value: rangeStats.newUsers },
        { section: 'range_kpi', metric: 'New Donors', label: 'new_donors', value: rangeStats.newDonors },
        { section: 'range_kpi', metric: 'Completed Donations', label: 'completed_donations', value: rangeStats.completedDonations },
        { section: 'range_kpi', metric: 'Requests Created', label: 'requests_created', value: rangeStats.requestsCreated },
        { section: 'range_kpi', metric: 'Campaigns Created', label: 'campaigns_created', value: rangeStats.campaignsCreated },
      ]
      : []),
    ...growthData.map((entry) => ({
      section: 'trend',
      metric: 'User Growth',
      label: entry.label,
      value: entry.value,
    })),
    ...bloodTypeData.map((entry) => ({
      section: 'blood_type_distribution',
      metric: entry.bloodType,
      label: `${entry.percentage.toFixed(2)}%`,
      value: entry.count,
    })),
    ...geoData.map((entry) => ({
      section: 'geographic_distribution',
      metric: entry.location,
      label: `donors=${entry.donors}, bloodbanks=${entry.hospitals}`,
      value: entry.totalUsers,
    })),
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Platform Analytics</h1>
          <p className="text-sm text-gray-600 mt-1">
            Monitor platform-wide metrics and growth
          </p>
        </div>
        <div className="flex items-center gap-2">
          <AdminRefreshButton
            onClick={handleRefresh}
            isRefreshing={isRefreshing}
            label="Refresh analytics"
          />
          <ExportButton
            data={exportData}
            filename="platform-analytics"
            headers={['section', 'metric', 'label', 'value']}
          />
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          Failed to load one or more analytics datasets. Please refresh.
        </div>
      ) : null}

      {/* Date Range Filter */}
      <DateRangeFilter
        onRangeChange={handleDateRangeChange}
        defaultRange="year"
      />

      <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
        Scope: selected range ({selectedRangeLabel}) for trend, distribution, and range KPIs.
        All-time totals remain visible in platform summary.
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatsCard
          title="New Users"
          value={rangeStats?.newUsers || 0}
          subtitle={`All-time: ${stats?.totalUsers || 0}`}
          icon={Users}
          iconColor="text-blue-600"
          loading={loading}
        />

        <StatsCard
          title="New Donors"
          value={rangeStats?.newDonors || 0}
          subtitle={`All-time donors: ${stats?.totalDonors || 0}`}
          icon={Droplet}
          iconColor="text-red-600"
          loading={loading}
        />

        <StatsCard
          title="Requests Created"
          value={rangeStats?.requestsCreated || 0}
          subtitle={`All-time: ${stats?.totalBloodRequests || 0}`}
          icon={Building2}
          iconColor="text-green-600"
          loading={loading}
        />

        <StatsCard
          title="Completed Donations"
          value={rangeStats?.completedDonations || 0}
          subtitle={`All-time: ${stats?.totalDonations || 0}`}
          icon={TrendingUp}
          iconColor="text-purple-600"
          loading={loading}
        />
      </div>

      {/* Secondary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">Campaigns Created (Range)</p>
          <p className="text-2xl font-bold text-gray-900">
            {rangeStats?.campaignsCreated || 0}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">Range Stats Source</p>
          <p className="text-2xl font-bold text-gray-900">
            {rangeStats?.source || 'raw'}
          </p>
        </div>
        <div className="bg-white rounded-lg shadow p-4">
          <p className="text-sm text-gray-600 mb-1">Active Donors (All-time)</p>
          <p className="text-2xl font-bold text-gray-900">
            {stats?.activeDonors || 0}
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* User Growth Trend */}
        <LineChart
          data={growthData}
          title={`User Growth Trend (${selectedRangeLabel})`}
          color={CHART_PALETTE.secondary}
        />

        {/* Blood Type Distribution */}
        <PieChart
          data={bloodTypeData.map((d, index) => ({
            label: d.bloodType,
            value: d.count,
            color: kpiAlignedPalette[index % kpiAlignedPalette.length] || d.color,
          }))}
          title={`Blood Type Distribution (${selectedRangeLabel})`}
        />
      </div>

      {/* Geographic Distribution */}
      {geoData.length > 0 && (
        <BarChart
          data={geoData.map((d) => ({
            label: d.location,
            value: d.totalUsers,
          }))}
          title={`Top ${ANALYTICS_LIMITS.geoTopLocations} Locations by New Users (${selectedRangeLabel})`}
          color={CHART_PALETTE.success}
          height={300}
          horizontal={true}
        />
      )}

      {/* Platform Summary */}
      {stats && (
        <div className="rounded-lg bg-gradient-to-r from-purple-50 to-purple-100 p-6 dark:from-[#0b1220] dark:to-[#101826]">
          <h3 className="mb-4 text-lg font-semibold text-gray-900 dark:text-gray-100">
            Platform Summary
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Users</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.totalUsers}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {verifiedPct.toFixed(1)}% verified
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Donor Engagement</p>
              <p className="text-2xl font-bold text-purple-600">
                {donorEngagementPct.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {stats.activeDonors} active of {stats.totalDonors}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Total Donations</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.totalDonations}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">all time donations</p>
            </div>
            <div>
              <p className="text-sm text-gray-600 dark:text-gray-400">Healthcare Network</p>
              <p className="text-2xl font-bold text-purple-600">
                {stats.totalHospitals + stats.totalNGOs}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {stats.totalHospitals} bloodbanks, {stats.totalNGOs} NGOs
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Geographic Breakdown */}
      {geoData.length > 0 && (
        <div className="bg-white rounded-lg shadow p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Geographic Distribution Details
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-4 text-sm font-medium text-gray-600">
                    Location
                  </th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-gray-600">
                    Total Users
                  </th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-gray-600">
                    Donors
                  </th>
                  <th className="text-right py-2 px-4 text-sm font-medium text-gray-600">
                    BloodBanks
                  </th>
                </tr>
              </thead>
              <tbody>
                {geoData.map((location, index) => (
                  <tr key={index} className="border-b border-gray-100">
                    <td className="py-2 px-4 text-sm text-gray-900">
                      {location.location}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-900 text-right">
                      {location.totalUsers}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-900 text-right">
                      {location.donors}
                    </td>
                    <td className="py-2 px-4 text-sm text-gray-900 text-right">
                      {location.hospitals}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAnalyticsDashboard;
