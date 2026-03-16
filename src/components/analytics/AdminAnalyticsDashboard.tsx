/**
 * AdminAnalyticsDashboard Component
 *
 * Platform-wide analytics dashboard for administrators.
 */

import React, { useEffect, useMemo, useState } from 'react';
import {
  Activity,
  ArrowUpRight,
  Award,
  Building2,
  Droplet,
  Globe2,
  HeartPulse,
  ShieldCheck,
  TrendingUp,
  Users,
} from 'lucide-react';
import { StatsCard } from './StatsCard';
import { LineChart } from './LineChart';
import { PieChart } from './PieChart';
import { BarChart } from './BarChart';
import { DateRangeFilter } from './DateRangeFilter';
import { ExportButton } from './ExportButton';
import {
  useBloodTypeDistribution,
  useBloodBankPlatformAnalytics,
  useGeographicDistribution,
  useNgoPlatformAnalytics,
  usePlatformRangeStats,
  usePlatformStats,
  useTopDonors,
  useUserGrowthTrend,
} from '../../hooks/useAnalyticsQuery';
import { ANALYTICS_LIMITS, ANALYTICS_QUEUE_DELAYS_MS } from '../../constants/analytics';
import { CHART_PALETTE, KPI_ALIGNED_CHART_PALETTE } from '../../constants/theme';
import { FIFTEEN_MINUTES_MS, TEN_MINUTES_MS } from '../../constants/time';
import { clearAdminCache, getAdminCacheKey, readAdminCache, writeAdminCache } from '../../utils/adminCache';
import AdminRefreshButton from '../admin/AdminRefreshButton';
import { refetchQueries } from '../../utils/queryRefetch';

const formatMetric = (value: number) => new Intl.NumberFormat().format(value);

const percentageChange = (current: number, previous: number) => {
  if (previous === 0) {
    if (current === 0) return 0;
    return 100;
  }
  return Number((((current - previous) / previous) * 100).toFixed(1));
};

const buildPreviousRange = (start: Date, end: Date) => {
  const windowMs = Math.max(end.getTime() - start.getTime(), 24 * 60 * 60 * 1000);
  return {
    startDate: new Date(start.getTime() - windowMs),
    endDate: new Date(end.getTime() - windowMs),
  };
};

const formatDateLabel = (start: Date, end: Date) => {
  const format = (value: Date) => value.toLocaleDateString(undefined, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
  return `${format(start)} - ${format(end)}`;
};

const SectionShell: React.FC<{ title: string; subtitle?: string; action?: React.ReactNode; children: React.ReactNode }> = ({
  title,
  subtitle,
  action,
  children,
}) => (
  <section className="min-w-0 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 sm:p-6">
    <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h2 className="text-base font-bold text-slate-900 dark:text-slate-100 sm:text-lg">{title}</h2>
        {subtitle ? <p className="mt-1 text-sm leading-6 text-slate-600 dark:text-slate-300">{subtitle}</p> : null}
      </div>
      {action ? <div className="w-full sm:w-auto">{action}</div> : null}
    </div>
    {children}
  </section>
);

const MetaBadge: React.FC<{ label: string; tone?: 'slate' | 'green' | 'amber' | 'blue' }> = ({ label, tone = 'slate' }) => {
  const toneClass = {
    slate: 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200',
    green: 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/40 dark:bg-emerald-950/40 dark:text-emerald-200',
    amber: 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200',
    blue: 'border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200',
  }[tone];

  return (
    <span className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${toneClass}`}>
      {label}
    </span>
  );
};

type AdminAnalyticsDashboardProps = {
  dateRange?: { start: Date; end: Date };
  onDateRangeChange?: (range: { start: Date; end: Date }) => void;
  refreshNonce?: number;
};

const buildDefaultDateRange = () => {
  const end = new Date();
  const start = new Date();
  start.setFullYear(end.getFullYear() - 1);
  return { start, end };
};

export const AdminAnalyticsDashboard: React.FC<AdminAnalyticsDashboardProps> = ({
  dateRange: controlledDateRange,
  onDateRangeChange,
  refreshNonce = 0,
}) => {
  const [internalDateRange, setInternalDateRange] = useState(buildDefaultDateRange);
  const dateRange = controlledDateRange || internalDateRange;

  const dateRangeQuery = useMemo(
    () => ({
      startDate: dateRange.start,
      endDate: dateRange.end,
    }),
    [dateRange]
  );

  const previousRangeQuery = useMemo(
    () => buildPreviousRange(dateRange.start, dateRange.end),
    [dateRange]
  );

  const [queueState, setQueueState] = useState({
    platformStats: false,
    rangeStats: false,
    previousRangeStats: false,
    growthTrend: false,
    bloodType: false,
    geo: false,
    topDonors: false,
  });

  useEffect(() => {
    const timers = [
      setTimeout(() => setQueueState((prev) => ({ ...prev, platformStats: true })), ANALYTICS_QUEUE_DELAYS_MS.platformStats),
      setTimeout(() => setQueueState((prev) => ({ ...prev, rangeStats: true })), ANALYTICS_QUEUE_DELAYS_MS.rangeStats),
      setTimeout(() => setQueueState((prev) => ({ ...prev, previousRangeStats: true })), ANALYTICS_QUEUE_DELAYS_MS.rangeStats + 80),
      setTimeout(() => setQueueState((prev) => ({ ...prev, growthTrend: true })), ANALYTICS_QUEUE_DELAYS_MS.growthTrend),
      setTimeout(() => setQueueState((prev) => ({ ...prev, bloodType: true })), ANALYTICS_QUEUE_DELAYS_MS.bloodType),
      setTimeout(() => setQueueState((prev) => ({ ...prev, geo: true })), ANALYTICS_QUEUE_DELAYS_MS.geo),
      setTimeout(() => setQueueState((prev) => ({ ...prev, topDonors: true })), ANALYTICS_QUEUE_DELAYS_MS.geo + 100),
    ];

    return () => timers.forEach((timer) => clearTimeout(timer));
  }, []);

  const platformStatsKey = useMemo(() => getAdminCacheKey(['platformStats']), []);
  const platformRangeKey = useMemo(() => getAdminCacheKey(['platformRangeStats', dateRangeQuery]), [dateRangeQuery]);
  const previousPlatformRangeKey = useMemo(
    () => getAdminCacheKey(['platformRangeStats', previousRangeQuery]),
    [previousRangeQuery]
  );
  const growthKey = useMemo(() => getAdminCacheKey(['userGrowthTrend', dateRangeQuery]), [dateRangeQuery]);
  const bloodTypeKey = useMemo(() => getAdminCacheKey(['bloodTypeDistribution', dateRangeQuery]), [dateRangeQuery]);
  const geoKey = useMemo(() => getAdminCacheKey(['geographicDistribution', dateRangeQuery]), [dateRangeQuery]);
  const ngoAnalyticsKey = useMemo(() => getAdminCacheKey(['ngoPlatformAnalytics', dateRangeQuery]), [dateRangeQuery]);
  const bloodBankAnalyticsKey = useMemo(() => getAdminCacheKey(['bloodBankPlatformAnalytics', dateRangeQuery]), [dateRangeQuery]);

  const platformStatsQuery = usePlatformStats({
    enabled: queueState.platformStats,
    initialData: () => readAdminCache(platformStatsKey, TEN_MINUTES_MS),
  });
  const platformRangeStatsQuery = usePlatformRangeStats(dateRangeQuery, {
    enabled: queueState.rangeStats,
    initialData: () => readAdminCache(platformRangeKey, TEN_MINUTES_MS),
  });
  const previousRangeStatsQuery = usePlatformRangeStats(previousRangeQuery, {
    enabled: queueState.previousRangeStats,
    initialData: () => readAdminCache(previousPlatformRangeKey, TEN_MINUTES_MS),
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
  const ngoAnalyticsQuery = useNgoPlatformAnalytics(dateRangeQuery, {
    enabled: queueState.geo,
    initialData: () => readAdminCache(ngoAnalyticsKey, TEN_MINUTES_MS),
  });
  const bloodBankAnalyticsQuery = useBloodBankPlatformAnalytics(dateRangeQuery, {
    enabled: queueState.geo,
    initialData: () => readAdminCache(bloodBankAnalyticsKey, TEN_MINUTES_MS),
  });
  const topDonorsQuery = useTopDonors(8, {
    enabled: queueState.topDonors,
  });

  useEffect(() => {
    if (platformStatsQuery.data) writeAdminCache(platformStatsKey, platformStatsQuery.data);
  }, [platformStatsKey, platformStatsQuery.data]);
  useEffect(() => {
    if (platformRangeStatsQuery.data) writeAdminCache(platformRangeKey, platformRangeStatsQuery.data);
  }, [platformRangeKey, platformRangeStatsQuery.data]);
  useEffect(() => {
    if (previousRangeStatsQuery.data) writeAdminCache(previousPlatformRangeKey, previousRangeStatsQuery.data);
  }, [previousPlatformRangeKey, previousRangeStatsQuery.data]);
  useEffect(() => {
    if (growthQuery.data) writeAdminCache(growthKey, growthQuery.data);
  }, [growthKey, growthQuery.data]);
  useEffect(() => {
    if (bloodTypeQuery.data) writeAdminCache(bloodTypeKey, bloodTypeQuery.data);
  }, [bloodTypeKey, bloodTypeQuery.data]);
  useEffect(() => {
    if (geoQuery.data) writeAdminCache(geoKey, geoQuery.data);
  }, [geoKey, geoQuery.data]);
  useEffect(() => {
    if (ngoAnalyticsQuery.data) writeAdminCache(ngoAnalyticsKey, ngoAnalyticsQuery.data);
  }, [ngoAnalyticsKey, ngoAnalyticsQuery.data]);
  useEffect(() => {
    if (bloodBankAnalyticsQuery.data) writeAdminCache(bloodBankAnalyticsKey, bloodBankAnalyticsQuery.data);
  }, [bloodBankAnalyticsKey, bloodBankAnalyticsQuery.data]);

  const stats = platformStatsQuery.data || null;
  const rangeStats = platformRangeStatsQuery.data || null;
  const previousRangeStats = previousRangeStatsQuery.data || null;
  const growthData = growthQuery.data || [];
  const bloodTypeData = bloodTypeQuery.data || [];
  const geoData = (geoQuery.data || []).slice(0, ANALYTICS_LIMITS.geoTopLocations);
  const ngoAnalytics = ngoAnalyticsQuery.data || null;
  const bloodBankAnalytics = bloodBankAnalyticsQuery.data || null;
  const topDonors = topDonorsQuery.data || [];

  const errorMessage = [
    platformStatsQuery.error,
    platformRangeStatsQuery.error,
    previousRangeStatsQuery.error,
    growthQuery.error,
    bloodTypeQuery.error,
    geoQuery.error,
    ngoAnalyticsQuery.error,
    bloodBankAnalyticsQuery.error,
    topDonorsQuery.error,
  ].find(Boolean);

  const selectedRangeLabel = useMemo(
    () => formatDateLabel(dateRange.start, dateRange.end),
    [dateRange]
  );
  const previousRangeLabel = useMemo(
    () => formatDateLabel(previousRangeQuery.startDate, previousRangeQuery.endDate),
    [previousRangeQuery]
  );

  const donorEngagementPct = stats && stats.totalDonors > 0
    ? (stats.activeDonors / stats.totalDonors) * 100
    : 0;
  const verifiedPct = stats && stats.totalUsers > 0
    ? (stats.verifiedUsers / stats.totalUsers) * 100
    : 0;
  const donorSharePct = stats && stats.totalUsers > 0
    ? (stats.totalDonors / stats.totalUsers) * 100
    : 0;

  const currentVsPrevious = useMemo(() => {
    if (!rangeStats || !previousRangeStats) return null;
    return {
      newUsers: percentageChange(rangeStats.newUsers, previousRangeStats.newUsers),
      newDonors: percentageChange(rangeStats.newDonors, previousRangeStats.newDonors),
      requestsCreated: percentageChange(rangeStats.requestsCreated, previousRangeStats.requestsCreated),
      completedDonations: percentageChange(rangeStats.completedDonations, previousRangeStats.completedDonations),
      campaignsCreated: percentageChange(rangeStats.campaignsCreated, previousRangeStats.campaignsCreated),
    };
  }, [previousRangeStats, rangeStats]);

  const bloodTypeLeader = useMemo(
    () => bloodTypeData.slice().sort((a, b) => b.count - a.count)[0] || null,
    [bloodTypeData]
  );
  const geoLeader = geoData[0] || null;
  const donorDensityLeader = useMemo(
    () => geoData
      .filter((entry) => entry.totalUsers > 0)
      .slice()
      .sort((a, b) => (b.donors / b.totalUsers) - (a.donors / a.totalUsers))[0] || null,
    [geoData]
  );

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

  const isRefreshing = [
    platformStatsQuery.isFetching,
    platformRangeStatsQuery.isFetching,
    previousRangeStatsQuery.isFetching,
    growthQuery.isFetching,
    bloodTypeQuery.isFetching,
    geoQuery.isFetching,
    ngoAnalyticsQuery.isFetching,
    bloodBankAnalyticsQuery.isFetching,
    topDonorsQuery.isFetching,
  ].some(Boolean);

  const handleRefresh = () => {
    refetchQueries(
      platformStatsQuery,
      platformRangeStatsQuery,
      previousRangeStatsQuery,
      growthQuery,
      bloodTypeQuery,
      geoQuery,
      ngoAnalyticsQuery,
      bloodBankAnalyticsQuery,
      topDonorsQuery
    );
  };

  const handleDateRangeChange = (start: Date, end: Date) => {
    const nextRange = { start, end };
    if (!controlledDateRange) setInternalDateRange(nextRange);
    onDateRangeChange?.(nextRange);
  };

  useEffect(() => {
    if (!refreshNonce) return;
    clearAdminCache((key) => key.includes('platform') || key.includes('GrowthTrend') || key.includes('bloodTypeDistribution') || key.includes('geographicDistribution') || key.includes('ngoPlatformAnalytics') || key.includes('bloodBankPlatformAnalytics'));
    handleRefresh();
  }, [refreshNonce]);

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
    ...(stats ? [
      { section: 'overview', metric: 'total_users', label: 'Total Users', value: stats.totalUsers },
      { section: 'overview', metric: 'total_donors', label: 'Total Donors', value: stats.totalDonors },
      { section: 'overview', metric: 'total_bloodbanks', label: 'Total BloodBanks', value: stats.totalHospitals },
      { section: 'overview', metric: 'total_ngos', label: 'Total NGOs', value: stats.totalNGOs },
      { section: 'overview', metric: 'active_donors', label: 'Active Donors', value: stats.activeDonors },
      { section: 'overview', metric: 'verified_users', label: 'Verified Users', value: stats.verifiedUsers },
      { section: 'overview', metric: 'donor_engagement_pct', label: 'Donor Engagement %', value: Number(donorEngagementPct.toFixed(2)) },
    ] : []),
    ...(rangeStats ? [
      { section: 'range', metric: 'new_users', label: 'New Users', value: rangeStats.newUsers },
      { section: 'range', metric: 'new_donors', label: 'New Donors', value: rangeStats.newDonors },
      { section: 'range', metric: 'requests_created', label: 'Requests Created', value: rangeStats.requestsCreated },
      { section: 'range', metric: 'completed_donations', label: 'Completed Donations', value: rangeStats.completedDonations },
      { section: 'range', metric: 'campaigns_created', label: 'Campaigns Created', value: rangeStats.campaignsCreated },
      { section: 'range', metric: 'source', label: 'Data Source', value: rangeStats.source },
    ] : []),
    ...(ngoAnalytics ? [
      { section: 'ngo', metric: 'active_volunteers', label: 'Active Volunteers', value: ngoAnalytics.activeVolunteers },
      { section: 'ngo', metric: 'active_partnerships', label: 'Active Partnerships', value: ngoAnalytics.activePartnerships },
      { section: 'ngo', metric: 'donor_reach', label: 'Donor Reach', value: ngoAnalytics.donorReach },
      { section: 'ngo', metric: 'donor_confirmed', label: 'Donor Confirmed', value: ngoAnalytics.donorConfirmed },
    ] : []),
    ...(bloodBankAnalytics ? [
      { section: 'bloodbank', metric: 'verified_bloodbanks', label: 'Verified BloodBanks', value: bloodBankAnalytics.verifiedBloodBanks },
      { section: 'bloodbank', metric: 'requests_created', label: 'Requests Created', value: bloodBankAnalytics.requestsCreated },
      { section: 'bloodbank', metric: 'total_units_received', label: 'Units Received', value: bloodBankAnalytics.totalUnitsReceived },
      { section: 'bloodbank', metric: 'inventory_units', label: 'Inventory Units', value: bloodBankAnalytics.inventoryUnits },
    ] : []),
    ...topDonors.map((donor, index) => ({
      section: 'top_donors',
      metric: `rank_${index + 1}`,
      label: donor.displayName || donor.email || donor.uid,
      value: donor.donationCount,
    })),
  ];

  return (
    <div className="space-y-6">
      <div className="overflow-visible rounded-[28px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,_rgba(239,68,68,0.16),_transparent_32%),linear-gradient(135deg,#fff8f6_0%,#ffffff_55%,#f8fafc_100%)] p-4 shadow-sm dark:border-slate-800 dark:bg-[radial-gradient(circle_at_top_left,rgba(239,68,68,0.18),transparent_28%),linear-gradient(135deg,rgba(30,41,59,0.96)_0%,rgba(15,23,42,0.98)_55%,rgba(2,6,23,0.98)_100%)] sm:p-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-3xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <MetaBadge label="Admin Analytics" tone="blue" />
              <MetaBadge label={`Selected range: ${selectedRangeLabel}`} tone="slate" />
              {rangeStats ? (
                <MetaBadge label={`Range source: ${rangeStats.source}`} tone={rangeStats.source === 'snapshot' ? 'green' : 'amber'} />
              ) : null}
            </div>
            <h1 className="text-2xl font-black tracking-tight text-slate-950 dark:text-slate-50 sm:text-3xl">Platform growth, donor supply, and operating signals</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-600 dark:text-slate-300">
              This page combines all-time platform footprint with selected-range live activity so you can spot growth shifts,
              regional concentration, and contribution leaders without leaving the admin dashboard.
            </p>
          </div>
          <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
            <AdminRefreshButton onClick={handleRefresh} isRefreshing={isRefreshing} label="Refresh analytics" />
            <ExportButton data={exportData} filename="platform-analytics" headers={['section', 'metric', 'label', 'value']} />
          </div>
        </div>
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 dark:border-rose-900/40 dark:bg-rose-950/30 dark:text-rose-200">
          Failed to load one or more analytics datasets. Existing sections may still show cached data.
        </div>
      ) : null}

      <DateRangeFilter onRangeChange={handleDateRangeChange} defaultRange="year" />

      <SectionShell
        title="Overview"
        subtitle="All-time platform footprint, donor participation, and network scale."
        action={<span className="text-xs font-medium text-slate-500 dark:text-slate-400">All-time totals update alongside range panels.</span>}
      >
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="Users"
            value={formatMetric(stats?.totalUsers || 0)}
            subtitle={`${verifiedPct.toFixed(1)}% verified accounts`}
            icon={Users}
            accent="blue"
            iconColor="text-blue-600"
            badge="All time"
            footer={`${formatMetric(stats?.verifiedUsers || 0)} verified users`}
            loading={!stats && platformStatsQuery.isFetching}
          />
          <StatsCard
            title="Donors"
            value={formatMetric(stats?.totalDonors || 0)}
            subtitle={`${donorSharePct.toFixed(1)}% of all users`}
            icon={Droplet}
            accent="red"
            iconColor="text-red-600"
            badge="All time"
            footer={`${formatMetric(stats?.activeDonors || 0)} active donors`}
            loading={!stats && platformStatsQuery.isFetching}
          />
          <StatsCard
            title="BloodBanks"
            value={formatMetric(stats?.totalHospitals || 0)}
            subtitle="Registered supply-side institutions"
            icon={Building2}
            accent="green"
            iconColor="text-emerald-600"
            badge="All time"
            footer={`${formatMetric(stats?.totalNGOs || 0)} NGOs also on platform`}
            loading={!stats && platformStatsQuery.isFetching}
          />
          <StatsCard
            title="Donations"
            value={formatMetric(stats?.totalDonations || 0)}
            subtitle={`${formatMetric(stats?.totalBloodRequests || 0)} requests logged`}
            icon={HeartPulse}
            accent="amber"
            iconColor="text-amber-600"
            badge="All time"
            footer={`${donorEngagementPct.toFixed(1)}% donor engagement`}
            loading={!stats && platformStatsQuery.isFetching}
          />
        </div>
      </SectionShell>

      <SectionShell
        title="Selected Range Activity"
        subtitle={`Live activity for ${selectedRangeLabel}, compared against the previous period (${previousRangeLabel}).`}
      >
        <div className="grid grid-cols-1 items-stretch gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatsCard
            title="New Users"
            value={formatMetric(rangeStats?.newUsers || 0)}
            subtitle="Account creation in selected range"
            icon={Users}
            accent="blue"
            iconColor="text-blue-600"
            badge="Range"
            trend={currentVsPrevious ? { value: currentVsPrevious.newUsers, isPositive: currentVsPrevious.newUsers >= 0, label: 'vs previous range' } : undefined}
            footer={`Previous range: ${formatMetric(previousRangeStats?.newUsers || 0)}`}
            loading={!rangeStats && platformRangeStatsQuery.isFetching}
          />
          <StatsCard
            title="New Donors"
            value={formatMetric(rangeStats?.newDonors || 0)}
            subtitle="Fresh donor acquisition"
            icon={Droplet}
            accent="red"
            iconColor="text-red-600"
            badge="Range"
            trend={currentVsPrevious ? { value: currentVsPrevious.newDonors, isPositive: currentVsPrevious.newDonors >= 0, label: 'vs previous range' } : undefined}
            footer={`Previous range: ${formatMetric(previousRangeStats?.newDonors || 0)}`}
            loading={!rangeStats && platformRangeStatsQuery.isFetching}
          />
          <StatsCard
            title="Requests Created"
            value={formatMetric(rangeStats?.requestsCreated || 0)}
            subtitle="Demand entering the system"
            icon={Activity}
            accent="green"
            iconColor="text-emerald-600"
            badge="Range"
            trend={currentVsPrevious ? { value: currentVsPrevious.requestsCreated, isPositive: currentVsPrevious.requestsCreated >= 0, label: 'vs previous range' } : undefined}
            footer={`Previous range: ${formatMetric(previousRangeStats?.requestsCreated || 0)}`}
            loading={!rangeStats && platformRangeStatsQuery.isFetching}
          />
          <StatsCard
            title="Completed Donations"
            value={formatMetric(rangeStats?.completedDonations || 0)}
            subtitle="Successful fulfilment events"
            icon={TrendingUp}
            accent="amber"
            iconColor="text-amber-600"
            badge="Range"
            trend={currentVsPrevious ? { value: currentVsPrevious.completedDonations, isPositive: currentVsPrevious.completedDonations >= 0, label: 'vs previous range' } : undefined}
            footer={`Previous range: ${formatMetric(previousRangeStats?.completedDonations || 0)}`}
            loading={!rangeStats && platformRangeStatsQuery.isFetching}
          />
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Campaign output</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatMetric(rangeStats?.campaignsCreated || 0)}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Campaigns created in the selected range.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Data source</p>
            <div className="mt-2">
              {rangeStats ? (
                <MetaBadge label={rangeStats.source === 'snapshot' ? 'Daily snapshots available' : 'Raw collection fallback'} tone={rangeStats.source === 'snapshot' ? 'green' : 'amber'} />
              ) : (
                <span className="text-sm text-slate-500 dark:text-slate-400">Loading...</span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">Source is shown as metadata because it affects confidence, not business value.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-500 dark:text-slate-400">Network footprint</p>
            <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-slate-100">{formatMetric((stats?.totalHospitals || 0) + (stats?.totalNGOs || 0))}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Combined bloodbank and NGO presence across the platform.</p>
          </div>
        </div>
      </SectionShell>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <SectionShell title="Growth Trend" subtitle="Monthly user acquisition across the selected range.">
          <LineChart
            data={growthData}
            title={`User growth: ${selectedRangeLabel}`}
            color={CHART_PALETTE.secondary}
            height={260}
          />
        </SectionShell>

        <SectionShell title="Contribution Leaders" subtitle="Top donors ranked by completed donations across available live data.">
          {topDonors.length === 0 && topDonorsQuery.isFetching ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">Loading donor leaderboard...</div>
          ) : topDonors.length === 0 ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">No donor leaderboard data available yet.</div>
          ) : (
            <div className="space-y-3">
              {topDonors.map((donor, index) => (
                <div key={donor.uid} className="flex flex-col gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-950/70 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                        {index + 1}
                      </span>
                      <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">
                        {donor.displayName || donor.email || donor.uid}
                      </p>
                    </div>
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                      {donor.city && donor.state ? `${donor.city}, ${donor.state}` : 'Location not set'}
                    </p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-lg font-bold text-slate-900 dark:text-slate-100">{formatMetric(donor.donationCount)}</p>
                    <p className="text-xs text-slate-500 dark:text-slate-400">completed donations</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SectionShell>
      </div>

      <div className="grid grid-cols-1 gap-6 xl:grid-cols-2 xl:items-start">
        <SectionShell title="NGO Analytics" subtitle={`NGO campaign and collaboration signals for ${selectedRangeLabel}.`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatsCard
              title="Active Volunteers"
              value={formatMetric(ngoAnalytics?.activeVolunteers || 0)}
              subtitle={`Total volunteers: ${formatMetric(ngoAnalytics?.totalVolunteers || 0)}`}
              icon={Users}
              accent="blue"
              iconColor="text-blue-600"
              badge="NGO network"
              loading={!ngoAnalytics && ngoAnalyticsQuery.isFetching}
            />
            <StatsCard
              title="Active Partnerships"
              value={formatMetric(ngoAnalytics?.activePartnerships || 0)}
              subtitle={`Total partnerships: ${formatMetric(ngoAnalytics?.totalPartnerships || 0)}`}
              icon={Building2}
              accent="green"
              iconColor="text-emerald-600"
              badge="NGO network"
              loading={!ngoAnalytics && ngoAnalyticsQuery.isFetching}
            />
            <StatsCard
              title="Donors Reached"
              value={formatMetric(ngoAnalytics?.donorReach || 0)}
              subtitle="Registered donors across selected-range NGO campaigns"
              icon={HeartPulse}
              accent="amber"
              iconColor="text-amber-600"
              badge="Selected range"
              footer={`Confirmed donors: ${formatMetric(ngoAnalytics?.donorConfirmed || 0)}`}
              loading={!ngoAnalytics && ngoAnalyticsQuery.isFetching}
            />
            <StatsCard
              title="Confirmation Rate"
              value={`${(ngoAnalytics?.confirmationRate || 0).toFixed(1)}%`}
              subtitle="Confirmed donors divided by reached donors"
              icon={ShieldCheck}
              accent="red"
              iconColor="text-red-600"
              badge="Selected range"
              loading={!ngoAnalytics && ngoAnalyticsQuery.isFetching}
            />
          </div>

          <div className="mt-4 grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <PieChart
              title="NGO campaign mix"
              data={(ngoAnalytics?.campaignTypeDistribution || []).map((entry, index) => ({
                label: entry.label,
                value: entry.value,
                color: kpiAlignedPalette[index % kpiAlignedPalette.length],
              }))}
              size={220}
            />

            <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mb-4 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Top NGOs by campaign output</h3>
                  <p className="text-sm text-slate-600 dark:text-slate-300">Ranked by selected-range campaigns, then donor reach.</p>
                </div>
              </div>
              {(ngoAnalytics?.topNgos?.length || 0) === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  No NGO activity found for the selected range.
                </div>
              ) : (
                <div className="space-y-3">
                  {ngoAnalytics?.topNgos.map((ngo, index) => (
                    <div key={ngo.ngoId} className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                              {index + 1}
                            </span>
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{ngo.ngoName}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Campaigns: {formatMetric(ngo.campaigns)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatMetric(ngo.donorReach)} reached</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">{formatMetric(ngo.confirmedDonors)} confirmed</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionShell>

        <SectionShell title="Blood Bank Analytics" subtitle={`Supply-side activity and inventory signals for ${selectedRangeLabel}.`}>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatsCard
              title="Verified BloodBanks"
              value={formatMetric(bloodBankAnalytics?.verifiedBloodBanks || 0)}
              subtitle={`Total bloodbanks: ${formatMetric(bloodBankAnalytics?.totalBloodBanks || 0)}`}
              icon={Building2}
              accent="green"
              iconColor="text-emerald-600"
              badge="Network"
              loading={!bloodBankAnalytics && bloodBankAnalyticsQuery.isFetching}
            />
            <StatsCard
              title="Requests Created"
              value={formatMetric(bloodBankAnalytics?.requestsCreated || 0)}
              subtitle="Selected-range demand raised by bloodbanks"
              icon={Activity}
              accent="blue"
              iconColor="text-blue-600"
              badge="Selected range"
              loading={!bloodBankAnalytics && bloodBankAnalyticsQuery.isFetching}
            />
            <StatsCard
              title="Units Received"
              value={formatMetric(bloodBankAnalytics?.totalUnitsReceived || 0)}
              subtitle={`${formatMetric(bloodBankAnalytics?.completedDonationsReceived || 0)} completed donations received`}
              icon={Droplet}
              accent="red"
              iconColor="text-red-600"
              badge="Selected range"
              loading={!bloodBankAnalytics && bloodBankAnalyticsQuery.isFetching}
            />
            <StatsCard
              title="Inventory Units"
              value={formatMetric(bloodBankAnalytics?.inventoryUnits || 0)}
              subtitle={`Critical records: ${formatMetric(bloodBankAnalytics?.criticalInventoryRecords || 0)}`}
              icon={ShieldCheck}
              accent="amber"
              iconColor="text-amber-600"
              badge="Current stock"
              footer={`Low stock records: ${formatMetric(bloodBankAnalytics?.lowInventoryRecords || 0)}`}
              loading={!bloodBankAnalytics && bloodBankAnalyticsQuery.isFetching}
            />
          </div>

          <div className="mt-4 grid min-w-0 gap-4 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <PieChart
              title="Inventory status mix"
              data={(bloodBankAnalytics?.inventoryStatusDistribution || []).map((entry, index) => ({
                label: entry.label,
                value: entry.value,
                color: kpiAlignedPalette[index % kpiAlignedPalette.length],
              }))}
              size={220}
            />

            <div className="min-w-0 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="mb-4">
                <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">Top blood banks by range activity</h3>
                <p className="text-sm text-slate-600 dark:text-slate-300">Ranked by requests created, then units received.</p>
              </div>
              {(bloodBankAnalytics?.topBloodBanks?.length || 0) === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-white p-5 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400">
                  No blood bank activity found for the selected range.
                </div>
              ) : (
                <div className="space-y-3">
                  {bloodBankAnalytics?.topBloodBanks.map((bloodBank, index) => (
                    <div key={bloodBank.bloodBankId} className="min-w-0 rounded-2xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white dark:bg-slate-100 dark:text-slate-900">
                              {index + 1}
                            </span>
                            <p className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{bloodBank.bloodBankName}</p>
                          </div>
                          <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">Requests: {formatMetric(bloodBank.requestsCreated)}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">{formatMetric(bloodBank.unitsReceived)} units</p>
                          <p className="text-xs text-slate-500 dark:text-slate-400">received in selected range</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </SectionShell>

        <SectionShell title="Blood Group Composition" subtitle="Donor blood-group spread for the selected range.">
          <PieChart
            data={bloodTypeData.map((d, index) => ({
              label: d.bloodType,
              value: d.count,
              color: kpiAlignedPalette[index % kpiAlignedPalette.length] || d.color,
            }))}
            title={`Blood type distribution: ${selectedRangeLabel}`}
          />
          {bloodTypeLeader ? (
            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center gap-2">
                <Award className="h-4 w-4 text-amber-600 dark:text-amber-400" />
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Largest blood group in range</p>
              </div>
              <p className="mt-2 text-xl font-bold text-slate-900 dark:text-slate-100">{bloodTypeLeader.bloodType}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {formatMetric(bloodTypeLeader.count)} donors, {bloodTypeLeader.percentage.toFixed(1)}% of the range distribution.
              </p>
            </div>
          ) : null}
        </SectionShell>

        <SectionShell title="Geographic Concentration" subtitle={`Top ${ANALYTICS_LIMITS.geoTopLocations} locations by users in the selected range.`}>
          {geoData.length > 0 ? (
            <BarChart
              data={geoData.map((entry) => ({
                label: entry.location,
                value: entry.totalUsers,
              }))}
              title={`Location ranking: ${selectedRangeLabel}`}
              color={CHART_PALETTE.success}
              height={320}
              horizontal={true}
            />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
              No geography data is available for the selected range.
            </div>
          )}
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center gap-2">
                <Globe2 className="h-4 w-4 text-blue-600 dark:text-blue-400" />
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Largest location by users</p>
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{geoLeader?.location || 'No data'}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">{geoLeader ? `${formatMetric(geoLeader.totalUsers)} users in selected range` : 'Select a wider range to inspect concentration.'}</p>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950/70">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Highest donor density</p>
              </div>
              <p className="mt-2 text-lg font-bold text-slate-900 dark:text-slate-100">{donorDensityLeader?.location || 'No data'}</p>
              <p className="text-sm text-slate-600 dark:text-slate-300">
                {donorDensityLeader
                  ? `${((donorDensityLeader.donors / Math.max(donorDensityLeader.totalUsers, 1)) * 100).toFixed(1)}% of users are donors`
                  : 'No density signal is available yet.'}
              </p>
            </div>
          </div>
        </SectionShell>
      </div>

      <SectionShell title="Geographic Detail Table" subtitle="Richer breakdown of the selected-range footprint for operations review.">
        {geoData.length > 0 ? (
          <div className="-mx-4 overflow-x-auto sm:mx-0">
            <table className="w-full min-w-[760px]">
              <thead>
                <tr className="border-b border-slate-200 text-left dark:border-slate-800">
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Location</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Users</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Donors</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">BloodBanks</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-[0.12em] text-slate-500 dark:text-slate-400">Donor Share</th>
                </tr>
              </thead>
              <tbody>
                {geoData.map((location) => {
                  const donorShare = location.totalUsers > 0 ? (location.donors / location.totalUsers) * 100 : 0;
                  return (
                    <tr key={location.location} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="px-4 py-3 text-sm font-medium text-slate-900 dark:text-slate-100">{location.location}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatMetric(location.totalUsers)}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatMetric(location.donors)}</td>
                      <td className="px-4 py-3 text-right text-sm text-slate-700 dark:text-slate-300">{formatMetric(location.hospitals)}</td>
                      <td className="px-4 py-3 text-right text-sm font-semibold text-slate-900 dark:text-slate-100">{donorShare.toFixed(1)}%</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-sm text-slate-500 dark:border-slate-800 dark:bg-slate-950/70 dark:text-slate-400">
            No location rows are available for the selected range.
          </div>
        )}
      </SectionShell>

      <SectionShell
        title="Operational Signals"
        subtitle="Quick readouts combining the live totals and the selected range."
      >
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#eff6ff_0%,#f8fafc_100%)] p-5 dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(30,64,175,0.18)_0%,rgba(15,23,42,0.96)_100%)]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Verification health</p>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">{verifiedPct.toFixed(1)}%</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Share of users who are verified on platform.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#ecfdf5_0%,#f8fafc_100%)] p-5 dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(6,78,59,0.18)_0%,rgba(15,23,42,0.96)_100%)]">
            <div className="flex items-center gap-2">
              <Droplet className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Active donor readiness</p>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">{donorEngagementPct.toFixed(1)}%</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Active donors as a share of all donor accounts.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-[linear-gradient(135deg,#fff7ed_0%,#f8fafc_100%)] p-5 dark:border-slate-800 dark:bg-[linear-gradient(135deg,rgba(154,52,18,0.18)_0%,rgba(15,23,42,0.96)_100%)]">
            <div className="flex items-center gap-2">
              <Activity className="h-4 w-4 text-amber-600 dark:text-amber-400" />
              <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">Range fulfilment pace</p>
            </div>
            <p className="mt-3 text-2xl font-bold text-slate-900 dark:text-slate-100">
              {rangeStats && rangeStats.requestsCreated > 0
                ? `${((rangeStats.completedDonations / rangeStats.requestsCreated) * 100).toFixed(1)}%`
                : '0.0%'}
            </p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">Completed donations relative to requests created in the same range.</p>
          </div>
        </div>
      </SectionShell>
    </div>
  );
};

export default AdminAnalyticsDashboard;
