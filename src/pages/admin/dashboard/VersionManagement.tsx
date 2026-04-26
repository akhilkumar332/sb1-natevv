import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, ExternalLink, GitCommitHorizontal, History, ShieldCheck, Tag } from 'lucide-react';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import AdminPagination from '../../../components/admin/AdminPagination';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { useAdminDeploymentHistory, useAdminDeployments } from '../../../hooks/admin/useAdminQueries';
import { adminQueryKeys } from '../../../constants/adminQueryKeys';
import { toDateValue } from '../../../utils/dateValue';

type VersionMetadata = {
  appVersion?: string;
  buildTime?: string;
  gitCommit?: string;
  gitBranch?: string;
  deployId?: string;
  environment?: string;
  deployTarget?: string;
  version?: string;
  commit?: string;
};

const VERSION_URL = '/version.json';
const PAGE_SIZE_OPTIONS = [10, 25, 50];
const HISTORY_FILTERS = [
  { id: 'all', label: 'All activity', kind: undefined },
  { id: 'git-commit', label: 'Git commits', kind: 'git-commit' },
  { id: 'firebase-hosting-release', label: 'Hosting releases', kind: 'firebase-hosting-release' },
] as const;

const formatDateTime = (value: unknown) => {
  const date = toDateValue(value);
  if (!date) return 'Unknown';
  return date.toLocaleString();
};

const readLiveVersionMetadata = async (): Promise<VersionMetadata> => {
  const response = await fetch(`${VERSION_URL}?ts=${Date.now()}`, { cache: 'no-store' });
  if (!response.ok) {
    throw new Error(`Failed to load version metadata (${response.status})`);
  }

  return response.json();
};

export default function VersionManagementPage() {
  const [deploymentsPage, setDeploymentsPage] = useState(1);
  const [deploymentsPageSize, setDeploymentsPageSize] = useState(10);
  const [historyPage, setHistoryPage] = useState(1);
  const [historyPageSize, setHistoryPageSize] = useState(10);
  const [historyFilter, setHistoryFilter] = useState<(typeof HISTORY_FILTERS)[number]['id']>('all');
  const liveVersionQuery = useQuery({
    queryKey: adminQueryKeys.versionMetadata(),
    queryFn: readLiveVersionMetadata,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const deploymentsQuery = useAdminDeployments(100);
  const selectedHistoryFilter = HISTORY_FILTERS.find((filter) => filter.id === historyFilter) || HISTORY_FILTERS[0];
  const historyQuery = useAdminDeploymentHistory(200);

  const liveVersion = liveVersionQuery.data;
  const effectiveBuildVersion = liveVersion?.buildTime || liveVersion?.version || 'unknown';
  const effectiveCommit = liveVersion?.gitCommit || liveVersion?.commit || 'unknown';
  const deployments = deploymentsQuery.data || [];
  const historyEntries = useMemo(() => {
    const entries = historyQuery.data || [];
    if (!selectedHistoryFilter.kind) {
      return entries;
    }
    return entries.filter((entry) => entry.kind === selectedHistoryFilter.kind);
  }, [historyQuery.data, selectedHistoryFilter.kind]);

  useEffect(() => {
    setDeploymentsPage(1);
  }, [deploymentsPageSize]);

  useEffect(() => {
    setHistoryPage(1);
  }, [historyPageSize, historyFilter]);

  const paginatedDeployments = useMemo(() => {
    const start = (deploymentsPage - 1) * deploymentsPageSize;
    return deployments.slice(start, start + deploymentsPageSize);
  }, [deployments, deploymentsPage, deploymentsPageSize]);

  const paginatedHistory = useMemo(() => {
    const start = (historyPage - 1) * historyPageSize;
    return historyEntries.slice(start, start + historyPageSize);
  }, [historyEntries, historyPage, historyPageSize]);

  const hasNextDeploymentsPage = deploymentsPage * deploymentsPageSize < deployments.length;
  const hasNextHistoryPage = historyPage * historyPageSize < historyEntries.length;

  const refreshAll = () => {
    void liveVersionQuery.refetch();
    void deploymentsQuery.refetch();
    void historyQuery.refetch();
  };

  const versionError = liveVersionQuery.error;
  const deploymentsError = deploymentsQuery.error;
  const historyError = historyQuery.error;
  const combinedError = versionError || deploymentsError || historyError;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-red-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-red-700 dark:bg-red-500/10 dark:text-red-300">
              <ShieldCheck className="h-3.5 w-3.5" />
              Deploy Traceability
            </div>
            <h1 className="mt-3 text-3xl font-bold text-gray-900 dark:text-white">Version Management</h1>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-slate-300">
              Review the current live runtime version metadata, the verified Firebase deploy ledger, and the backfilled historical timeline from one admin surface.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminRefreshButton
              onClick={refreshAll}
              isRefreshing={liveVersionQuery.isFetching || deploymentsQuery.isFetching || historyQuery.isFetching}
              label="Refresh version data"
            />
          </div>
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-red-100 bg-red-50/60 p-4 dark:border-red-500/20 dark:bg-red-500/10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-red-700 dark:text-red-300">App version</p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{liveVersion?.appVersion || 'Unknown'}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">Human release version from package metadata.</p>
          </div>
          <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 dark:border-blue-500/20 dark:bg-blue-500/10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700 dark:text-blue-300">Git commit</p>
            <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{effectiveCommit}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">Exact deployed code revision on the live frontend build.</p>
          </div>
          <div className="rounded-2xl border border-amber-100 bg-amber-50/60 p-4 dark:border-amber-500/20 dark:bg-amber-500/10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-700 dark:text-amber-300">Build time</p>
            <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{formatDateTime(effectiveBuildVersion)}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">Current cache/version invalidation marker used by the runtime.</p>
          </div>
          <div className="rounded-2xl border border-emerald-100 bg-emerald-50/60 p-4 dark:border-emerald-500/20 dark:bg-emerald-500/10">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-700 dark:text-emerald-300">Deploy id</p>
            <p className="mt-2 text-lg font-bold text-gray-900 dark:text-white">{liveVersion?.deployId || 'Unknown'}</p>
            <p className="mt-1 text-sm text-gray-600 dark:text-slate-300">Deployment instance identifier linked to GitHub Actions deploy history.</p>
          </div>
        </div>
      </section>

      <AdminRefreshingBanner
        show={liveVersionQuery.isFetching || deploymentsQuery.isFetching || historyQuery.isFetching}
        message="Refreshing live version metadata, deployment ledger, and historical timeline."
      />
      <AdminErrorCard
        message={combinedError instanceof Error
          ? combinedError.message
          : null}
        onRetry={refreshAll}
      />

      <section className="grid gap-4 xl:grid-cols-[1.1fr,1.4fr]">
        <div className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
          <div className="flex items-center gap-2">
            <Boxes className="h-5 w-5 text-red-600 dark:text-red-300" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Current Live Metadata</h2>
          </div>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ['App version', liveVersion?.appVersion || 'Unknown'],
              ['Git commit', effectiveCommit],
              ['Git branch', liveVersion?.gitBranch || 'Unknown'],
              ['Deploy id', liveVersion?.deployId || 'Unknown'],
              ['Build time', formatDateTime(effectiveBuildVersion)],
              ['Environment', liveVersion?.environment || 'Unknown'],
              ['Deploy target', liveVersion?.deployTarget || 'Unknown'],
            ].map(([label, value]) => (
              <div key={label} className="flex items-start justify-between gap-3 rounded-xl border border-gray-100 px-4 py-3 dark:border-gray-700">
                <dt className="font-semibold text-gray-600 dark:text-slate-300">{label}</dt>
                <dd className="text-right font-mono text-gray-900 dark:text-white">{value}</dd>
              </div>
            ))}
          </dl>
        </div>

        <div className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
          <div className="flex items-center gap-2">
            <History className="h-5 w-5 text-red-600 dark:text-red-300" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Deployment Ledger</h2>
          </div>
          <p className="mt-2 text-sm text-gray-600 dark:text-slate-300">
            Successful production deployments recorded from GitHub Actions after Firebase Hosting deploy completion.
          </p>

          {!deploymentsQuery.isLoading && deployments.length === 0 ? (
            <div className="mt-4">
              <AdminEmptyStateCard message="No deployment ledger entries have been recorded yet." />
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              {paginatedDeployments.map((deployment) => (
                <article key={deployment.id} className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="inline-flex items-center gap-1 rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-700 dark:bg-slate-800 dark:text-slate-200">
                          <Tag className="h-3.5 w-3.5" />
                          {deployment.appVersion}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                          <GitCommitHorizontal className="h-3.5 w-3.5" />
                          {deployment.gitCommit || 'unknown'}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                          {deployment.status}
                        </span>
                      </div>
                      <div className="grid gap-2 text-sm text-gray-600 dark:text-slate-300 md:grid-cols-2">
                        <p><span className="font-semibold text-gray-900 dark:text-white">Deploy id:</span> {deployment.deployId}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Branch:</span> {deployment.gitBranch || 'Unknown'}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Deployed at:</span> {formatDateTime(deployment.deployedAt)}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Build time:</span> {formatDateTime(deployment.buildTime)}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Environment:</span> {deployment.environment}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Target:</span> {deployment.deployTarget}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Run number:</span> {deployment.workflowRunNumber || 'Unknown'}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Actor:</span> {deployment.actor || 'Unknown'}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {deployment.workflowRunUrl && (
                        <a
                          href={deployment.workflowRunUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-red-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-red-500/10"
                        >
                          GitHub Run
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {deployment.siteUrl && (
                        <a
                          href={deployment.siteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-red-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-red-500/10"
                        >
                          Live Site
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              ))}

              <AdminPagination
                page={deploymentsPage}
                pageSize={deploymentsPageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                itemCount={deployments.length}
                hasNextPage={hasNextDeploymentsPage}
                loading={deploymentsQuery.isFetching}
                onPageChange={setDeploymentsPage}
                onPageSizeChange={setDeploymentsPageSize}
              />
            </div>
          )}
        </div>
      </section>

      <section className="rounded-3xl border border-red-100 bg-white p-6 shadow-sm dark:border-gray-700 dark:bg-[#0b1220]">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex items-center gap-2">
              <History className="h-5 w-5 text-red-600 dark:text-red-300" />
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Historical Timeline</h2>
            </div>
            <p className="mt-2 max-w-3xl text-sm text-gray-600 dark:text-slate-300">
              Historical activity combines backfilled git commit history and Firebase Hosting releases. Verified deploy ledger rows stay separate because they are recorded at deploy time.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {HISTORY_FILTERS.map((filter) => (
              <button
                key={filter.id}
                type="button"
                onClick={() => setHistoryFilter(filter.id)}
                className={`rounded-full border px-3 py-1.5 text-sm font-semibold transition ${
                  historyFilter === filter.id
                    ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:bg-[#0b1220] dark:text-slate-300 dark:hover:bg-slate-900/60'
                }`}
              >
                {filter.label}
              </button>
            ))}
          </div>
        </div>

        {!historyQuery.isLoading && historyEntries.length === 0 ? (
          <div className="mt-4">
            <AdminEmptyStateCard message="No historical version activity has been backfilled yet." />
          </div>
        ) : (
          <div className="mt-4 space-y-3">
            {paginatedHistory.map((entry) => {
              const badgeColor = entry.verificationLevel === 'verified'
                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                : entry.verificationLevel === 'partial'
                  ? 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300'
                  : 'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-200';

              return (
                <article key={entry.id} className="rounded-2xl border border-gray-100 p-4 dark:border-gray-700">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-semibold ${badgeColor}`}>
                          {entry.verificationLevel}
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-full bg-red-50 px-2.5 py-1 text-xs font-semibold text-red-700 dark:bg-red-500/10 dark:text-red-300">
                          {entry.kind}
                        </span>
                        {entry.gitShortCommit && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-700 dark:bg-blue-500/10 dark:text-blue-300">
                            <GitCommitHorizontal className="h-3.5 w-3.5" />
                            {entry.gitShortCommit}
                          </span>
                        )}
                      </div>

                      <div className="grid gap-2 text-sm text-gray-600 dark:text-slate-300 md:grid-cols-2">
                        <p><span className="font-semibold text-gray-900 dark:text-white">Occurred at:</span> {formatDateTime(entry.occurredAt)}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Recorded at:</span> {formatDateTime(entry.recordedAt)}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Source:</span> {entry.source}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Branch:</span> {entry.gitBranch || 'Unknown'}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Commit:</span> {entry.gitCommit || 'Unknown'}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Release id:</span> {entry.releaseId || 'Unknown'}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">App version:</span> {entry.appVersion || 'Unknown'}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Environment:</span> {entry.environment || 'Unknown'}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Actor:</span> {entry.actor || entry.authorName || 'Unknown'}</p>
                        <p><span className="font-semibold text-gray-900 dark:text-white">Author email:</span> {entry.authorEmail || 'Unknown'}</p>
                      </div>

                      {entry.commitMessage && (
                        <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm text-gray-700 dark:border-gray-700 dark:bg-slate-900/50 dark:text-slate-200">
                          <span className="font-semibold text-gray-900 dark:text-white">Commit message:</span> {entry.commitMessage}
                        </div>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {entry.workflowRunUrl && (
                        <a
                          href={entry.workflowRunUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-red-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-red-500/10"
                        >
                          GitHub Run
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                      {entry.siteUrl && (
                        <a
                          href={entry.siteUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-semibold text-gray-700 hover:bg-red-50 dark:border-gray-600 dark:text-gray-200 dark:hover:bg-red-500/10"
                        >
                          Site
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      )}
                    </div>
                  </div>
                </article>
              );
            })}

            <AdminPagination
              page={historyPage}
              pageSize={historyPageSize}
              pageSizeOptions={PAGE_SIZE_OPTIONS}
              itemCount={historyEntries.length}
              hasNextPage={hasNextHistoryPage}
              loading={historyQuery.isFetching}
              onPageChange={setHistoryPage}
              onPageSizeChange={setHistoryPageSize}
            />
          </div>
        )}
      </section>
    </div>
  );
}
