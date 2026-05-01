import { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Boxes,
  ExternalLink,
  Languages,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Users,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import AdminPagination from '../../../components/admin/AdminPagination';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { useAdminPwaRuntimeDiagnostics } from '../../../hooks/admin/useAdminQueries';
import { usePwaRuntime } from '../../../hooks/usePwaRuntime';
import { monitoringService } from '../../../services/monitoring.service';
import { FIREBASE_ANALYTICS_EVENTS } from '../../../constants/analytics';
import { ROUTES } from '../../../constants/routes';
import { adminQueryKeys } from '../../../constants/adminQueryKeys';
import { summarizePwaFleetDiagnostics } from '../../../utils/pwaFleetDiagnostics';
import { toDateValue } from '../../../utils/dateValue';

type VersionMetadata = {
  appVersion?: string;
  buildTime?: string;
  gitCommit?: string;
  deployId?: string;
};

type DiagnosticsTab = 'browser' | 'fleet';

const VERSION_URL = '/version.json';
const PAGE_SIZE_OPTIONS = [10, 25, 50];

const readLiveVersionMetadata = async (): Promise<VersionMetadata> => {
  const response = await fetch(`${VERSION_URL}?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load version metadata (${response.status})`);
  }

  return response.json();
};

const booleanLabel = (value: boolean) => (value ? 'Yes' : 'No');

const formatDateTime = (value: unknown) => {
  const date = toDateValue(value);
  if (!date) return 'Unknown';
  return date.toLocaleString();
};

const formatPercent = (value: number, total: number) => {
  if (total <= 0) return '0%';
  return `${Math.round((value / total) * 100)}%`;
};

const getDiagnosticsTab = (searchParams: URLSearchParams): DiagnosticsTab => (
  searchParams.get('tab') === 'fleet' ? 'fleet' : 'browser'
);

export default function PwaDiagnosticsPage() {
  const { t } = useTranslation();
  const runtime = usePwaRuntime();
  const [searchParams, setSearchParams] = useSearchParams();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const activeTab = getDiagnosticsTab(searchParams);
  const isFleetTab = activeTab === 'fleet';
  const versionQuery = useQuery({
    queryKey: adminQueryKeys.versionMetadata(),
    queryFn: readLiveVersionMetadata,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchInterval: 60_000,
  });
  const diagnosticsQuery = useAdminPwaRuntimeDiagnostics(500, isFleetTab);

  useEffect(() => {
    monitoringService.trackEvent(FIREBASE_ANALYTICS_EVENTS.pwaDiagnosticsViewed, {
      surface: 'admin',
      tab: activeTab,
    });
  }, [activeTab]);

  useEffect(() => {
    if (!isFleetTab) return;
    monitoringService.trackEvent(FIREBASE_ANALYTICS_EVENTS.pwaFleetOverviewViewed, {
      surface: 'admin',
    });
  }, [isFleetTab]);

  useEffect(() => {
    setPage(1);
  }, [pageSize, activeTab]);

  const setActiveTab = (tab: DiagnosticsTab) => {
    const next = new URLSearchParams(searchParams);
    if (tab === 'fleet') {
      next.set('tab', 'fleet');
    } else {
      next.delete('tab');
    }
    setSearchParams(next, { replace: true });
  };

  const statusCards = useMemo(() => ([
    {
      label: 'Installed',
      value: booleanLabel(runtime.installed),
      detail: 'Standalone launch state detected from the current browser session.',
    },
    {
      label: 'Service worker',
      value: runtime.registered ? 'Registered' : runtime.supported ? 'Pending' : 'Unsupported',
      detail: runtime.registrationScope || 'No active registration scope detected yet.',
    },
    {
      label: 'Update state',
      value: runtime.updateAvailable || runtime.waitingWorker ? 'Update ready' : 'Current',
      detail: runtime.nextBuildTime || runtime.currentBuildTime || 'No build metadata recorded yet.',
    },
    {
      label: 'Notifications',
      value: runtime.notificationPermission,
      detail: 'Browser notification permission from the active runtime session.',
    },
  ]), [
    runtime.currentBuildTime,
    runtime.installed,
    runtime.nextBuildTime,
    runtime.notificationPermission,
    runtime.registered,
    runtime.registrationScope,
    runtime.supported,
    runtime.updateAvailable,
    runtime.waitingWorker,
  ]);

  const records = diagnosticsQuery.data || [];
  const summary = useMemo(
    () => summarizePwaFleetDiagnostics(records, versionQuery.data?.buildTime || null),
    [records, versionQuery.data?.buildTime],
  );
  const paginated = useMemo(() => {
    const start = (page - 1) * pageSize;
    return records.slice(start, start + pageSize);
  }, [page, pageSize, records]);
  const hasNextPage = page * pageSize < records.length;

  const fleetCards = [
    {
      label: 'Tracked devices',
      value: summary.totalDevices,
      detail: 'Authenticated browsers/devices currently reporting PWA runtime telemetry.',
    },
    {
      label: 'Installed / standalone',
      value: `${summary.installedDevices} (${formatPercent(summary.installedDevices, summary.totalDevices)})`,
      detail: 'Devices that reported an installed or standalone PWA footprint in their latest session.',
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

  const combinedError = isFleetTab
    ? (versionQuery.error || diagnosticsQuery.error)
    : versionQuery.error;
  const isRefreshing = isFleetTab
    ? versionQuery.isFetching || diagnosticsQuery.isFetching
    : versionQuery.isFetching;
  const refreshAll = () => {
    void versionQuery.refetch();
    if (isFleetTab) {
      void diagnosticsQuery.refetch();
    }
  };

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <Smartphone className="h-3.5 w-3.5" />
              PWA Operations
            </div>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">PWA Diagnostics</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-slate-300">
              Inspect current-browser installability, service worker lifecycle, update readiness, and release context, then switch to fleet telemetry for cross-user adoption and notification health.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-2xl border border-gray-200 bg-gray-50 p-1 dark:border-gray-700 dark:bg-slate-900/40">
              {[
                { id: 'browser' as const, label: 'Current Browser' },
                { id: 'fleet' as const, label: 'Fleet Overview' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
                    activeTab === tab.id
                      ? 'bg-white text-red-700 shadow-sm dark:bg-[#0b1220] dark:text-red-300'
                      : 'text-gray-600 hover:text-red-700 dark:text-slate-300 dark:hover:text-red-300'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            {activeTab === 'browser' ? (
              <button
                type="button"
                onClick={() => void versionQuery.refetch()}
                className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-red-50 dark:border-gray-600 dark:text-slate-200 dark:hover:bg-red-500/10"
              >
                <RefreshCw className="h-4 w-4" />
                Refresh release metadata
              </button>
            ) : (
              <AdminRefreshButton
                onClick={refreshAll}
                isRefreshing={isRefreshing}
                label="Refresh fleet telemetry"
              />
            )}
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {(activeTab === 'browser' ? statusCards : fleetCards).map((card) => (
            <div
              key={card.label}
              className="rounded-2xl border border-gray-100 bg-gray-50/70 p-4 dark:border-gray-700 dark:bg-slate-900/40"
            >
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-gray-600 dark:text-slate-300">{card.label}</p>
              <p className="mt-2 text-2xl font-bold text-gray-900 dark:text-white">{card.value}</p>
              <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">{card.detail}</p>
            </div>
          ))}
        </div>
      </section>

      <AdminRefreshingBanner
        show={isRefreshing}
        message={isFleetTab
          ? 'Refreshing PWA fleet telemetry and live build metadata.'
          : 'Refreshing release metadata for the current browser diagnostics view.'}
      />
      <AdminErrorCard
        message={combinedError instanceof Error ? combinedError.message : null}
        onRetry={refreshAll}
      />

      {activeTab === 'browser' ? (
        <section className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-600 dark:text-red-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Current Runtime State</h2>
            </div>
            <dl className="mt-4 space-y-3 text-sm">
              {[
                ['Service worker supported', booleanLabel(runtime.supported)],
                ['Service worker registered', booleanLabel(runtime.registered)],
                ['Controlling this tab', booleanLabel(runtime.controlled)],
                ['Offline bundle ready', booleanLabel(runtime.offlineReady)],
                ['Waiting worker present', booleanLabel(runtime.waitingWorker)],
                ['Install prompt available', booleanLabel(runtime.installPromptAvailable)],
                ['Installed / standalone', booleanLabel(runtime.installed)],
                ['iOS install guidance active', booleanLabel(runtime.iosInstallGuidance)],
                ['Notification permission', runtime.notificationPermission],
                ['Manifest URL', runtime.manifestHref || 'Unknown'],
                ['Registration scope', runtime.registrationScope || 'Unknown'],
                ['Current build time', runtime.currentBuildTime || 'Unknown'],
                ['Next build time', runtime.nextBuildTime || 'Unknown'],
                ['Registration error', runtime.registrationError || 'None'],
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
                <Boxes className="h-5 w-5 text-red-600 dark:text-red-300" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Release Context</h2>
              </div>
              <dl className="mt-4 space-y-3 text-sm">
                {[
                  ['App version', versionQuery.data?.appVersion || 'Unknown'],
                  ['Build time', versionQuery.data?.buildTime || 'Unknown'],
                  ['Git commit', versionQuery.data?.gitCommit || 'Unknown'],
                  ['Deploy id', versionQuery.data?.deployId || 'Unknown'],
                ].map(([label, value]) => (
                  <div key={label} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-700">
                    <dt className="font-semibold text-gray-600 dark:text-slate-300">{label}</dt>
                    <dd className="text-right font-mono text-gray-900 dark:text-white">{value}</dd>
                  </div>
                ))}
              </dl>
            </section>

            <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
              <div className="flex items-center gap-2">
                <WifiOff className="h-5 w-5 text-red-600 dark:text-red-300" />
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Related Operations</h2>
              </div>
              <div className="mt-4 space-y-3">
                <button
                  type="button"
                  onClick={() => setActiveTab('fleet')}
                  className="flex w-full items-center justify-between rounded-2xl border border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-red-50 dark:border-gray-700 dark:text-slate-200 dark:hover:bg-red-500/10"
                >
                  <span className="flex items-center gap-2">
                    <Users className="h-4 w-4 text-red-600 dark:text-red-300" />
                    Fleet Overview
                  </span>
                  <ExternalLink className="h-4 w-4" />
                </button>
                {[
                  { label: t('admin.offlineSyncHealth'), path: ROUTES.portal.admin.dashboard.offlineSyncHealth, icon: WifiOff },
                  { label: t('admin.versionManagement'), path: ROUTES.portal.admin.dashboard.versionManagement, icon: Boxes },
                  { label: t('admin.translations'), path: ROUTES.portal.admin.dashboard.translations, icon: Languages },
                ].map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link
                      key={item.path}
                      to={item.path}
                      className="flex items-center justify-between rounded-2xl border border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-red-50 dark:border-gray-700 dark:text-slate-200 dark:hover:bg-red-500/10"
                    >
                      <span className="flex items-center gap-2">
                        <Icon className="h-4 w-4 text-red-600 dark:text-red-300" />
                        {item.label}
                      </span>
                      <ExternalLink className="h-4 w-4" />
                    </Link>
                  );
                })}
              </div>
            </section>
          </div>
        </section>
      ) : (
        <>
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
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Related Operations</h2>
                </div>
                <div className="mt-4 space-y-3">
                  <button
                    type="button"
                    onClick={() => setActiveTab('browser')}
                    className="flex w-full items-center justify-between rounded-2xl border border-gray-100 px-4 py-3 text-sm font-semibold text-gray-700 transition-colors hover:bg-red-50 dark:border-gray-700 dark:text-slate-200 dark:hover:bg-red-500/10"
                  >
                    <span className="flex items-center gap-2">
                      <Smartphone className="h-4 w-4 text-red-600 dark:text-red-300" />
                      Current Browser
                    </span>
                    <ExternalLink className="h-4 w-4" />
                  </button>
                  {[
                    { label: 'Offline Sync Health', path: ROUTES.portal.admin.dashboard.offlineSyncHealth },
                    { label: 'Version Management', path: ROUTES.portal.admin.dashboard.versionManagement },
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
            <div className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-red-600 dark:text-red-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Recent Device Telemetry</h2>
            </div>
            <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
              Latest authenticated devices reporting install, build, and notification state.
            </p>

            {!diagnosticsQuery.isLoading && records.length === 0 ? (
              <div className="mt-4">
                <AdminEmptyStateCard message="No PWA fleet telemetry has been recorded yet." />
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
                  itemCount={records.length}
                  hasNextPage={hasNextPage}
                  loading={diagnosticsQuery.isFetching}
                  onPageChange={setPage}
                  onPageSizeChange={setPageSize}
                />
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
