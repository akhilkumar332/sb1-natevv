import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, AlertTriangle, Bell, Clock3, Droplet, Gauge, Shield, Users } from 'lucide-react';
import { useAdminOfflineSyncHealth, useAdminOverviewData } from '../../../hooks/admin/useAdminQueries';
import { AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import OfflineSyncHealthCard from '../../../components/admin/OfflineSyncHealthCard';
import MemoryDiagnosticsCard from '../../../components/admin/MemoryDiagnosticsCard';
import { ROUTES } from '../../../constants/routes';
import { OFFLINE_ANALYTICS_WINDOWS } from '../../../constants/offline';
import { HOUR_MS, MINUTE_MS } from '../../../constants/time';
import { buildAdminOverviewSynthesis } from '../../../utils/adminOverview';
import { buildOfflineSystemSummary } from '../../../utils/offlineSyncHealth';

const formatRefreshAgo = (value: number | null, now: number) => {
  if (!value) return 'never';
  const diff = Math.max(0, now - value);
  if (diff < MINUTE_MS) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < HOUR_MS) return `${Math.floor(diff / MINUTE_MS)}m ago`;
  return `${Math.floor(diff / HOUR_MS)}h ago`;
};

const formatActivityAt = (value: Date | null) => {
  if (!value) return 'Time unavailable';
  return value.toLocaleString();
};

function AdminOverviewPage() {
  const {
    systemAlerts,
    stats,
    recentActivity,
    loading,
    error,
    partialErrors,
    refreshData,
  } = useAdminOverviewData();
  const [lastRefreshedAt, setLastRefreshedAt] = useState<number | null>(Date.now());
  const [refreshNowTs, setRefreshNowTs] = useState(Date.now());
  const offlineSystemQuery = useAdminOfflineSyncHealth(OFFLINE_ANALYTICS_WINDOWS.oneDay, 300);
  const offlineSystemSummary = useMemo(
    () => buildOfflineSystemSummary(offlineSystemQuery.data || [], refreshNowTs),
    [offlineSystemQuery.data, refreshNowTs],
  );

  const synthesis = useMemo(() => buildAdminOverviewSynthesis({
    stats,
    systemAlerts,
    offlinePendingCount: offlineSystemSummary.totalPendingCount,
    offlineFailedCount: offlineSystemSummary.totalDeadLetterCount,
    recentActivity,
    routes: {
      verification: ROUTES.portal.admin.dashboard.verification,
      emergencyRequests: ROUTES.portal.admin.dashboard.emergencyRequests,
      inventoryAlerts: ROUTES.portal.admin.dashboard.inventoryAlerts,
      offlineSyncHealth: ROUTES.portal.admin.dashboard.offlineSyncHealth,
      analyticsReports: ROUTES.portal.admin.dashboard.analyticsReports,
      users: ROUTES.portal.admin.dashboard.users,
    },
  }), [stats, systemAlerts, offlineSystemSummary.totalPendingCount, offlineSystemSummary.totalDeadLetterCount, recentActivity]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setRefreshNowTs(Date.now());
    }, 5000);
    return () => {
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!loading) {
      setLastRefreshedAt(Date.now());
    }
  }, [loading]);

  const handleRefresh = async () => {
    await Promise.all([
      refreshData(),
      offlineSystemQuery.refetch(),
    ]);
    setLastRefreshedAt(Date.now());
  };

  return (
    <div className="space-y-6">
      <AdminRefreshingBanner show={loading || offlineSystemQuery.isFetching} message="Refreshing overview data..." />
      <AdminErrorCard
        message={error || (offlineSystemQuery.error instanceof Error ? offlineSystemQuery.error.message : null)}
        onRetry={() => { void handleRefresh(); }}
      />
      {!error && partialErrors.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm dark:border-amber-500/40 dark:bg-amber-500/12 dark:text-amber-200">
          <p className="font-semibold">Some overview sections are unavailable.</p>
          <p className="mt-1">{partialErrors[0]}</p>
          {partialErrors.length > 1 && (
            <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
              {partialErrors.length - 1} more section{partialErrors.length === 2 ? '' : 's'} also failed to load.
            </p>
          )}
        </div>
      )}

      <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.18em] text-red-600 dark:text-red-300">Operations</p>
            <h1 className="mt-2 text-2xl font-bold text-gray-900 dark:text-slate-100">Admin Overview</h1>
            <p className="mt-1 max-w-2xl text-sm text-gray-600 dark:text-slate-300">
              A single operations snapshot for queues, incidents, activity, and the next best admin action.
            </p>
          </div>
          <div className="rounded-xl border border-gray-200 bg-gray-50 px-4 py-3 text-sm dark:border-slate-700 dark:bg-slate-800/60">
            <p className="font-semibold text-gray-900 dark:text-slate-100">{synthesis.incident.title}</p>
            <p className="mt-1 text-gray-600 dark:text-slate-300">{synthesis.incident.summary}</p>
            <p className="mt-2 text-xs text-gray-500 dark:text-slate-400">
              Last refreshed {formatRefreshAgo(lastRefreshedAt, refreshNowTs)}
            </p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        {synthesis.actionCards.map((card) => (
          <div
            key={card.id}
            className={`rounded-2xl border p-5 shadow-sm ${
              card.status === 'critical'
                ? 'border-rose-200 bg-rose-50 dark:border-rose-500/30 dark:bg-rose-500/10'
                : card.status === 'warning'
                  ? 'border-amber-200 bg-amber-50 dark:border-amber-500/30 dark:bg-amber-500/10'
                  : 'border-emerald-200 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs uppercase tracking-[0.15em] text-gray-600 dark:text-slate-300">{card.title}</p>
              <span className="text-[11px] font-semibold uppercase tracking-[0.1em] text-gray-700 dark:text-slate-300">
                {card.status}
              </span>
            </div>
            <p className="mt-3 text-3xl font-bold text-gray-900 dark:text-slate-100">{card.value}</p>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">{card.description}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.8fr)_minmax(0,1fr)]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Recommended Actions</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
                  Ranked by urgency using the current admin overview data.
                </p>
              </div>
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {synthesis.priorityActions.slice(0, 6).map((action) => (
                <Link
                  key={action.id}
                  to={action.to}
                  className={`rounded-xl border px-4 py-3 transition-colors ${
                    action.status === 'critical'
                      ? 'border-rose-200 bg-rose-50 hover:bg-rose-100 dark:border-rose-500/30 dark:bg-rose-500/10 dark:hover:bg-rose-500/15'
                      : action.status === 'warning'
                        ? 'border-amber-200 bg-amber-50 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:hover:bg-amber-500/15'
                        : 'border-gray-200 bg-gray-50 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800/60 dark:hover:bg-slate-800'
                  }`}
                >
                  <p className="font-semibold text-gray-900 dark:text-slate-100">{action.label}</p>
                  <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{action.description}</p>
                </Link>
              ))}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Alert Watchlist</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
                  Grouped operational signals instead of a flat message feed.
                </p>
              </div>
              <Bell className="h-5 w-5 text-amber-600" />
            </div>

            <div className="grid gap-4 md:grid-cols-2">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 dark:border-rose-500/30 dark:bg-rose-500/10">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-rose-900 dark:text-rose-200">Critical Alerts</p>
                  <span className="text-sm font-bold text-rose-700 dark:text-rose-300">{synthesis.criticalAlerts.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {synthesis.criticalAlerts.slice(0, 4).map((alert) => (
                    <div key={alert.id} className="rounded-lg border border-rose-200 bg-white px-3 py-2 text-sm text-rose-900 dark:border-rose-500/30 dark:bg-slate-900/70 dark:text-rose-200">
                      <p>{alert.message}</p>
                      <p className="mt-1 text-[11px] text-rose-700 dark:text-rose-300">{alert.source}</p>
                    </div>
                  ))}
                  {synthesis.criticalAlerts.length === 0 && (
                    <p className="text-sm text-rose-700 dark:text-rose-300">No critical alerts.</p>
                  )}
                </div>
              </div>

              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/30 dark:bg-amber-500/10">
                <div className="flex items-center justify-between gap-3">
                  <p className="font-semibold text-amber-900 dark:text-amber-200">Warnings</p>
                  <span className="text-sm font-bold text-amber-700 dark:text-amber-300">{synthesis.warningAlerts.length}</span>
                </div>
                <div className="mt-3 space-y-2">
                  {synthesis.warningAlerts.slice(0, 4).map((alert) => (
                    <div key={alert.id} className="rounded-lg border border-amber-200 bg-white px-3 py-2 text-sm text-amber-900 dark:border-amber-500/30 dark:bg-slate-900/70 dark:text-amber-200">
                      <p>{alert.message}</p>
                      <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300">{alert.source}</p>
                    </div>
                  ))}
                  {synthesis.warningAlerts.length === 0 && (
                    <p className="text-sm text-amber-700 dark:text-amber-300">No warning alerts.</p>
                  )}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-bold text-gray-900 dark:text-slate-100">Recent Platform Activity</h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
                  Unified timeline across donations, requests, and campaigns.
                </p>
              </div>
              <Link to={ROUTES.portal.admin.dashboard.analyticsReports} className="text-sm font-semibold text-red-700 hover:text-red-800 dark:text-red-300 dark:hover:text-red-200">
                View analytics
              </Link>
            </div>
            <div className="space-y-3">
              {synthesis.activity.length ? synthesis.activity.map((entry) => (
                <div key={entry.id} className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-800/60">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <p className="font-semibold text-gray-900 dark:text-slate-100">{entry.title}</p>
                    <span className="inline-flex items-center gap-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-gray-500 dark:text-slate-400">
                      <Clock3 className="h-3.5 w-3.5" />
                      {formatActivityAt(entry.at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{entry.detail}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-[0.1em] text-gray-500 dark:text-slate-400">{entry.type}</p>
                </div>
              )) : (
                <p className="text-sm text-gray-500 dark:text-slate-400">No recent platform activity.</p>
              )}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="rounded-2xl border border-blue-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Platform Health</h3>
                <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">
                  Capacity, activity, and reliability snapshot.
                </p>
              </div>
              <Gauge className="h-5 w-5 text-blue-600" />
            </div>
            <div className="space-y-2 text-sm text-gray-700 dark:text-slate-300">
              <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700"><span className="inline-flex items-center gap-2"><Users className="h-4 w-4 text-red-600" /> Active user rate</span><span className="font-semibold">{synthesis.activeRate.toFixed(1)}%</span></p>
              <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700"><span className="inline-flex items-center gap-2"><Droplet className="h-4 w-4 text-red-600" /> Donation completion</span><span className="font-semibold">{synthesis.completionRate.toFixed(1)}%</span></p>
              <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700"><span className="inline-flex items-center gap-2"><Shield className="h-4 w-4 text-red-600" /> Blood ops footprint</span><span className="font-semibold">{stats.totalHospitals}</span></p>
              <p className="flex items-center justify-between rounded-lg border border-gray-100 px-3 py-2 dark:border-slate-700"><span className="inline-flex items-center gap-2"><Activity className="h-4 w-4 text-red-600" /> Active campaigns</span><span className="font-semibold">{stats.activeCampaigns}</span></p>
            </div>
          </section>

          <section className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <Shield className="h-5 w-5 text-red-600" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Role Footprint</h3>
            </div>
            <div className="space-y-2 text-sm text-gray-700 dark:text-slate-300">
              <p className="flex items-center justify-between"><span>Donors</span><span className="font-semibold">{stats.totalDonors}</span></p>
              <p className="flex items-center justify-between"><span>Blood Banks + Hospitals</span><span className="font-semibold">{stats.totalHospitals}</span></p>
              <p className="flex items-center justify-between"><span>NGOs</span><span className="font-semibold">{stats.totalNGOs}</span></p>
              <p className="flex items-center justify-between"><span>Admins</span><span className="font-semibold">{stats.totalAdmins}</span></p>
            </div>
          </section>

          <OfflineSyncHealthCard />
          <MemoryDiagnosticsCard />

          <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm dark:border-slate-700 dark:bg-slate-900">
            <div className="mb-3 flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-600" />
              <h3 className="text-lg font-bold text-gray-900 dark:text-slate-100">Module Shortcuts</h3>
            </div>
            <div className="grid gap-2">
              <Link to={ROUTES.portal.admin.dashboard.analyticsReports} className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-100 dark:border-slate-700 dark:bg-slate-800/60 dark:text-slate-200 dark:hover:bg-slate-800">
                Open Analytics & Reports
              </Link>
              <Link to={ROUTES.portal.admin.dashboard.inventoryAlerts} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                Review Inventory Alerts
              </Link>
              <Link to={ROUTES.portal.admin.dashboard.verification} className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300">
                Review Verification Queue
              </Link>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

export default AdminOverviewPage;
