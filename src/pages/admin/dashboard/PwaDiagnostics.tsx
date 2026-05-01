import { useEffect, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Boxes, ExternalLink, Languages, RefreshCw, ShieldCheck, Smartphone, WifiOff } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { usePwaRuntime } from '../../../hooks/usePwaRuntime';
import { monitoringService } from '../../../services/monitoring.service';
import { FIREBASE_ANALYTICS_EVENTS } from '../../../constants/analytics';
import { ROUTES } from '../../../constants/routes';
import { adminQueryKeys } from '../../../constants/adminQueryKeys';

type VersionMetadata = {
  appVersion?: string;
  buildTime?: string;
  gitCommit?: string;
  deployId?: string;
};

const VERSION_URL = '/version.json';

const readLiveVersionMetadata = async (): Promise<VersionMetadata> => {
  const response = await fetch(`${VERSION_URL}?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load version metadata (${response.status})`);
  }

  return response.json();
};

const booleanLabel = (value: boolean) => (value ? 'Yes' : 'No');

export default function PwaDiagnosticsPage() {
  const { t } = useTranslation();
  const runtime = usePwaRuntime();
  const versionQuery = useQuery({
    queryKey: adminQueryKeys.versionMetadata(),
    queryFn: readLiveVersionMetadata,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchInterval: 60_000,
  });

  useEffect(() => {
    monitoringService.trackEvent(FIREBASE_ANALYTICS_EVENTS.pwaDiagnosticsViewed, {
      surface: 'admin',
    });
  }, []);

  const statusCards = useMemo(() => ([
    {
      label: 'Installed',
      value: booleanLabel(runtime.installed),
      detail: 'Standalone launch state detected from the current browser session.',
      tone: 'emerald',
    },
    {
      label: 'Service worker',
      value: runtime.registered ? 'Registered' : runtime.supported ? 'Pending' : 'Unsupported',
      detail: runtime.registrationScope || 'No active registration scope detected yet.',
      tone: 'blue',
    },
    {
      label: 'Update state',
      value: runtime.updateAvailable || runtime.waitingWorker ? 'Update ready' : 'Current',
      detail: runtime.nextBuildTime || runtime.currentBuildTime || 'No build metadata recorded yet.',
      tone: 'amber',
    },
    {
      label: 'Notifications',
      value: runtime.notificationPermission,
      detail: 'Browser notification permission from the active runtime session.',
      tone: 'violet',
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

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <Smartphone className="h-3.5 w-3.5" />
              Current Browser Runtime
            </div>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">PWA Diagnostics</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-slate-300">
              Inspect installability, service worker lifecycle, update readiness, notification permission, and runtime metadata for the browser session you are using right now. For cross-user adoption and install telemetry, use PWA Fleet Overview.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void versionQuery.refetch()}
            className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-4 py-2 text-sm font-semibold text-gray-700 transition-colors hover:bg-red-50 dark:border-gray-600 dark:text-slate-200 dark:hover:bg-red-500/10"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh PWA state
          </button>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          {statusCards.map((card) => (
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
              {[
                { label: 'PWA Fleet Overview', path: ROUTES.portal.admin.dashboard.pwaFleetOverview, icon: Smartphone },
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
    </div>
  );
}
