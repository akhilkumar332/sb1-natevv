import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Boxes, ExternalLink, ShieldCheck, Smartphone, Users, Wifi } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { useAdminPwaRuntimeDiagnostics } from '../../../hooks/admin/useAdminQueries';
import { adminQueryKeys } from '../../../constants/adminQueryKeys';
import { ROUTES } from '../../../constants/routes';
import { monitoringService } from '../../../services/monitoring.service';
import { FIREBASE_ANALYTICS_EVENTS } from '../../../constants/analytics';
import { summarizePwaFleetDiagnostics } from '../../../utils/pwaFleetDiagnostics';
import { toDateValue } from '../../../utils/dateValue';

type VersionMetadata = {
  appVersion?: string;
  buildTime?: string;
  gitCommit?: string;
  deployId?: string;
};

type ActiveWindow = '24h' | '7d' | '30d' | 'all';
type RoleFilter = 'all' | 'donor' | 'ngo' | 'bloodbank' | 'admin' | 'superadmin' | 'hospital';
type PermissionFilter = 'all' | 'granted' | 'denied' | 'default' | 'unsupported';

const VERSION_URL = '/version.json';
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const ACTIVE_WINDOW_OPTIONS: Array<{ value: ActiveWindow; label: string }> = [
  { value: '24h', label: 'Last 24h' },
  { value: '7d', label: 'Last 7d' },
  { value: '30d', label: 'Last 30d' },
  { value: 'all', label: 'All time' },
];
const ROLE_FILTER_OPTIONS: Array<{ value: RoleFilter; label: string }> = [
  { value: 'all', label: 'All roles' },
  { value: 'donor', label: 'Donor' },
  { value: 'ngo', label: 'NGO' },
  { value: 'bloodbank', label: 'Blood bank' },
  { value: 'admin', label: 'Admin' },
  { value: 'superadmin', label: 'Superadmin' },
  { value: 'hospital', label: 'Hospital' },
];
const PERMISSION_FILTER_OPTIONS: Array<{ value: PermissionFilter; label: string }> = [
  { value: 'all', label: 'All permissions' },
  { value: 'granted', label: 'Granted' },
  { value: 'denied', label: 'Denied' },
  { value: 'default', label: 'Default' },
  { value: 'unsupported', label: 'Unsupported' },
];

const readLiveVersionMetadata = async (): Promise<VersionMetadata> => {
  const response = await fetch(`${VERSION_URL}?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load version metadata (${response.status})`);
  }
  return response.json();
};

const formatDateTime = (value: unknown) => {
  const date = toDateValue(value);
  if (!date) return 'Unknown';
  return date.toLocaleString();
};

const formatPercent = (value: number, total: number) => {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
};

const getWindowThreshold = (windowKey: ActiveWindow): number | null => {
  const now = Date.now();
  if (windowKey === '24h') return now - 24 * 60 * 60 * 1000;
  if (windowKey === '7d') return now - 7 * 24 * 60 * 60 * 1000;
  if (windowKey === '30d') return now - 30 * 24 * 60 * 60 * 1000;
  return null;
};

const formatBucket = (value: string, count: number) => `${value || 'unknown'} (${count})`;

export default function PwaTelemetryPage() {
  const { t } = useTranslation();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [activeWindow, setActiveWindow] = useState<ActiveWindow>('7d');
  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [permissionFilter, setPermissionFilter] = useState<PermissionFilter>('all');

  const versionQuery = useQuery({
    queryKey: adminQueryKeys.versionMetadata(),
    queryFn: readLiveVersionMetadata,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchInterval: 60_000,
  });
  const diagnosticsQuery = useAdminPwaRuntimeDiagnostics(500);

  useEffect(() => {
    monitoringService.trackEvent(FIREBASE_ANALYTICS_EVENTS.pwaFleetOverviewViewed, {
      surface: 'admin',
    });
  }, []);

  useEffect(() => {
    setPage(1);
  }, [activeWindow, pageSize, permissionFilter, roleFilter]);

  const refreshAll = () => {
    void versionQuery.refetch();
    void diagnosticsQuery.refetch();
  };

  const records = diagnosticsQuery.data || [];
  const filteredRecords = useMemo(() => {
    const threshold = getWindowThreshold(activeWindow);
    return records.filter((record) => {
      if (roleFilter !== 'all' && record.role !== roleFilter) return false;
      if (permissionFilter !== 'all' && record.notificationPermission !== permissionFilter) return false;
      if (threshold !== null) {
        const lastSeen = toDateValue(record.lastSeenAt);
        if (!lastSeen || lastSeen.getTime() < threshold) return false;
      }
      return true;
    });
  }, [activeWindow, permissionFilter, records, roleFilter]);

  useEffect(() => {
    const totalPages = Math.max(1, Math.ceil(filteredRecords.length / pageSize));
    setPage((currentPage) => (currentPage > totalPages ? totalPages : currentPage));
  }, [filteredRecords.length, pageSize]);

  const summary = useMemo(
    () => summarizePwaFleetDiagnostics(filteredRecords, versionQuery.data?.buildTime || null),
    [filteredRecords, versionQuery.data?.buildTime],
  );
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRecords.slice(start, start + pageSize);
  }, [filteredRecords, page, pageSize]);
  const hasNextPage = page * pageSize < filteredRecords.length;
  const combinedError = versionQuery.error || diagnosticsQuery.error;
  const isRefreshing = versionQuery.isFetching || diagnosticsQuery.isFetching;
  const topDeviceCategories = Object.entries(summary.byDeviceCategory).slice(0, 4);
  const topBrowserFamilies = Object.entries(summary.byBrowserFamily).slice(0, 4);

  const cards = [
    {
      label: activeWindow === 'all' ? 'Tracked devices' : `Active devices (${activeWindow})`,
      value: summary.totalDevices,
      detail: 'Authenticated browsers/devices reporting telemetry inside the selected activity window.',
    },
    {
      label: 'Installed / standalone',
      value: `${summary.installedFootprintDevices} (${formatPercent(summary.installedFootprintDevices, summary.totalDevices)})`,
      detail: 'Devices that reported an installed or standalone PWA footprint.',
    },
    {
      label: 'Latest build',
      value: `${summary.latestBuildDevices} (${formatPercent(summary.latestBuildDevices, summary.totalDevices)})`,
      detail: 'Devices already reporting the current deployed build.',
    },
    {
      label: 'Notifications granted',
      value: `${summary.notificationGranted} (${formatPercent(summary.notificationGranted, summary.totalDevices)})`,
      detail: 'Devices that currently allow browser notifications.',
    },
  ];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <Users className="h-3.5 w-3.5" />
              Fleet Telemetry
            </div>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">{t('admin.pwaTelemetry')}</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-slate-300">
              Review cross-user PWA install adoption, build freshness, notification permission, and recent device activity. This page intentionally replaces local browser diagnostics in the admin panel.
            </p>
          </div>
          <AdminRefreshButton
            onClick={refreshAll}
            isRefreshing={isRefreshing}
            label="Refresh PWA telemetry"
          />
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {cards.map((card) => (
            <div key={card.label} className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-slate-900/40">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:text-slate-300">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{card.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <AdminRefreshingBanner
        show={isRefreshing}
        message="Refreshing PWA fleet telemetry and live build metadata."
      />
      <AdminErrorCard
        message={combinedError instanceof Error ? combinedError.message : null}
        onRetry={refreshAll}
      />

      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-600 dark:text-red-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Telemetry Filters</h2>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              Focus the fleet metrics on recent activity windows and the user/device slices that matter for rollout health.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="space-y-1 text-sm text-gray-600 dark:text-slate-300">
              <span className="font-semibold text-gray-900 dark:text-white">Active window</span>
              <select
                value={activeWindow}
                onChange={(event) => setActiveWindow(event.target.value as ActiveWindow)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-[#0f1726] dark:text-gray-100"
              >
                {ACTIVE_WINDOW_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-gray-600 dark:text-slate-300">
              <span className="font-semibold text-gray-900 dark:text-white">Role</span>
              <select
                value={roleFilter}
                onChange={(event) => setRoleFilter(event.target.value as RoleFilter)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-[#0f1726] dark:text-gray-100"
              >
                {ROLE_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>

            <label className="space-y-1 text-sm text-gray-600 dark:text-slate-300">
              <span className="font-semibold text-gray-900 dark:text-white">Notification permission</span>
              <select
                value={permissionFilter}
                onChange={(event) => setPermissionFilter(event.target.value as PermissionFilter)}
                className="w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 dark:border-gray-600 dark:bg-[#0f1726] dark:text-gray-100"
              >
                {PERMISSION_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </label>
          </div>
        </div>
      </section>

      <section className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-red-600 dark:text-red-300" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Release Adoption</h2>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ['Current app version', versionQuery.data?.appVersion || 'Unknown'],
              ['Current build time', versionQuery.data?.buildTime || 'Unknown'],
              ['Current deploy id', versionQuery.data?.deployId || 'Unknown'],
              ['Latest-build devices', `${summary.latestBuildDevices} / ${summary.totalDevices}`],
              ['Stale-build devices', `${summary.staleBuildDevices} / ${summary.totalDevices}`],
              ['Installed / standalone footprint', `${summary.installedFootprintDevices} / ${summary.totalDevices}`],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-700">
                <dt className="font-semibold text-gray-600 dark:text-slate-300">{label}</dt>
                <dd className="text-right font-mono text-gray-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="space-y-6">
          <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
            <div className="flex items-center gap-2">
              <Wifi className="h-5 w-5 text-red-600 dark:text-red-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Permission Mix</h2>
            </div>
            <div className="mt-4 space-y-3 text-sm">
              {[
                ['Granted', summary.notificationGranted],
                ['Denied', summary.notificationDenied],
                ['Default', summary.notificationDefault],
                ['Unsupported', summary.notificationUnsupported],
              ].map(([label, value]) => (
                <div key={String(label)} className="flex items-center justify-between rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-700">
                  <span className="font-semibold text-gray-700 dark:text-slate-200">{label}</span>
                  <span className="font-mono text-gray-900 dark:text-white">{value}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
            <div className="flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-red-600 dark:text-red-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Telemetry Breakdown</h2>
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">Device categories</p>
                <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-slate-200">
                  {topDeviceCategories.length > 0 ? topDeviceCategories.map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span>{key}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  )) : <p className="text-gray-500 dark:text-slate-400">No device data yet.</p>}
                </div>
              </div>
              <div className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-500 dark:text-slate-400">Browser families</p>
                <div className="mt-3 space-y-2 text-sm text-gray-700 dark:text-slate-200">
                  {topBrowserFamilies.length > 0 ? topBrowserFamilies.map(([key, count]) => (
                    <div key={key} className="flex items-center justify-between">
                      <span>{key}</span>
                      <span className="font-mono">{count}</span>
                    </div>
                  )) : <p className="text-gray-500 dark:text-slate-400">No browser data yet.</p>}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-red-600 dark:text-red-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Related Operations</h2>
            </div>
            <div className="mt-4 space-y-3">
              {[
                { label: t('admin.offlineSyncHealth'), path: ROUTES.portal.admin.dashboard.offlineSyncHealth },
                { label: t('admin.versionManagement'), path: ROUTES.portal.admin.dashboard.versionManagement },
                { label: t('admin.translations'), path: ROUTES.portal.admin.dashboard.translations },
              ].map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-red-50 dark:border-gray-700 dark:text-slate-200 dark:hover:bg-red-500/10"
                >
                  <span>{item.label}</span>
                  <ExternalLink className="h-4 w-4" />
                </Link>
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-600 dark:text-red-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Device Telemetry</h2>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              Filtered recent devices with install, notification, and rollout data. Current breakdowns: {Object.entries(summary.bySurface).map(([surface, count]) => formatBucket(surface, count)).join(', ') || 'No surface data yet.'}
            </p>
          </div>
        </div>

        {!diagnosticsQuery.isLoading && filteredRecords.length === 0 ? (
          <div className="mt-4">
            <AdminEmptyStateCard message="No PWA telemetry records match the current filters." />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {paginated.map((record) => (
              <article key={record.id || record.deviceKey} className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                        {record.role}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                        {record.deviceCategory}
                      </span>
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                        {record.notificationPermission}
                      </span>
                    </div>
                    <div className="grid gap-2 text-sm text-gray-600 dark:text-slate-300 md:grid-cols-2">
                      <p><span className="font-semibold text-gray-900 dark:text-white">UID:</span> {record.uid}</p>
                      <p><span className="font-semibold text-gray-900 dark:text-white">Surface:</span> {record.surface}</p>
                      <p><span className="font-semibold text-gray-900 dark:text-white">Build time:</span> {record.buildTime || 'Unknown'}</p>
                      <p><span className="font-semibold text-gray-900 dark:text-white">Deploy id:</span> {record.deployId}</p>
                      <p><span className="font-semibold text-gray-900 dark:text-white">Installed:</span> {record.installed ? 'Yes' : 'No'}</p>
                      <p><span className="font-semibold text-gray-900 dark:text-white">Service worker:</span> {record.serviceWorkerRegistered ? 'Registered' : 'Missing'}</p>
                      <p><span className="font-semibold text-gray-900 dark:text-white">Browser:</span> {record.browserFamily}</p>
                      <p><span className="font-semibold text-gray-900 dark:text-white">OS:</span> {record.osFamily}</p>
                      <p><span className="font-semibold text-gray-900 dark:text-white">Last seen:</span> {formatDateTime(record.lastSeenAt)}</p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-500 dark:text-slate-400">
                    <p>Updated from: <span className="font-semibold text-gray-700 dark:text-slate-200">{record.updatedFrom}</span></p>
                    <p className="mt-1">Path: <span className="font-mono">{record.lastPath || 'Unknown'}</span></p>
                  </div>
                </div>
              </article>
            ))}

            <AdminPagination
              page={page}
              pageSize={pageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              itemCount={filteredRecords.length}
              hasNextPage={hasNextPage}
              loading={diagnosticsQuery.isFetching}
              onPageChange={setPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        )}
      </section>
    </div>
  );
}
