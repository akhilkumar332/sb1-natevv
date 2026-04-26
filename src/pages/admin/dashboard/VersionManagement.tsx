import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Boxes, ExternalLink, GitCommitHorizontal, History, ShieldCheck, Tag } from 'lucide-react';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import AdminPagination from '../../../components/admin/AdminPagination';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { useAdminDeployments } from '../../../hooks/admin/useAdminQueries';
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
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const liveVersionQuery = useQuery({
    queryKey: adminQueryKeys.versionMetadata(),
    queryFn: readLiveVersionMetadata,
    staleTime: 60_000,
    gcTime: 300_000,
    refetchInterval: 60_000,
    refetchIntervalInBackground: false,
  });
  const deploymentsQuery = useAdminDeployments(100);

  const liveVersion = liveVersionQuery.data;
  const effectiveBuildVersion = liveVersion?.buildTime || liveVersion?.version || 'unknown';
  const effectiveCommit = liveVersion?.gitCommit || liveVersion?.commit || 'unknown';
  const deployments = deploymentsQuery.data || [];

  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  const paginatedDeployments = useMemo(() => {
    const start = (page - 1) * pageSize;
    return deployments.slice(start, start + pageSize);
  }, [deployments, page, pageSize]);

  const hasNextPage = page * pageSize < deployments.length;

  const refreshAll = () => {
    void liveVersionQuery.refetch();
    void deploymentsQuery.refetch();
  };

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
              Review the current live runtime version metadata and the recent Firebase Hosting deploy ledger from one admin surface.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <AdminRefreshButton
              onClick={refreshAll}
              isRefreshing={liveVersionQuery.isFetching || deploymentsQuery.isFetching}
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
        show={liveVersionQuery.isFetching || deploymentsQuery.isFetching}
        message="Refreshing live version metadata and deployment ledger."
      />
      <AdminErrorCard
        message={(liveVersionQuery.error || deploymentsQuery.error) instanceof Error
          ? ((liveVersionQuery.error || deploymentsQuery.error) as Error).message
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
                page={page}
                pageSize={pageSize}
                pageSizeOptions={PAGE_SIZE_OPTIONS}
                itemCount={deployments.length}
                hasNextPage={hasNextPage}
                loading={deploymentsQuery.isFetching}
                onPageChange={setPage}
                onPageSizeChange={setPageSize}
              />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
