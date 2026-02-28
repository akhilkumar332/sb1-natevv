import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { useAdminErrorLogs } from '../../../hooks/admin/useAdminQueries';
import { refetchQuery } from '../../../utils/queryRefetch';

type ErrorLogRow = {
  id: string;
  source: string;
  scope: string;
  level: string;
  message: string;
  code: string | null;
  route: string | null;
  stack: string | null;
  userUid: string | null;
  userRole: string | null;
  isImpersonating: boolean;
  impersonationActorUid: string | null;
  fingerprint: string | null;
  sessionId: string | null;
  metadata: Record<string, unknown> | null;
  createdAt?: Date;
};

const toDate = (value: unknown): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value === 'object' && value !== null && 'toDate' in value) {
    const candidate = value as { toDate?: () => Date };
    return typeof candidate.toDate === 'function' ? candidate.toDate() : undefined;
  }
  if (typeof value === 'object' && value !== null && 'seconds' in value) {
    const timestamp = value as { seconds?: number };
    if (typeof timestamp.seconds === 'number') {
      return new Date(timestamp.seconds * 1000);
    }
  }
  return undefined;
};

function ErrorLogsPage() {
  const [rows, setRows] = useState<ErrorLogRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [impersonationFilter, setImpersonationFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const query = useAdminErrorLogs(1000);
  const loading = query.isLoading;
  const error = query.error instanceof Error ? query.error.message : null;

  useEffect(() => {
    const nextRows = (query.data || []).map((entry) => ({
      id: entry.id || '',
      source: String(entry.source || 'unknown'),
      scope: String(entry.scope || 'unknown'),
      level: String(entry.level || 'error'),
      message: String(entry.message || 'Unknown error'),
      code: entry.code ? String(entry.code) : null,
      route: entry.route ? String(entry.route) : null,
      stack: entry.stack ? String(entry.stack) : null,
      userUid: entry.userUid ? String(entry.userUid) : null,
      userRole: entry.userRole ? String(entry.userRole) : null,
      isImpersonating: Boolean(entry.isImpersonating),
      impersonationActorUid: entry.impersonationActorUid ? String(entry.impersonationActorUid) : null,
      fingerprint: entry.fingerprint ? String(entry.fingerprint) : null,
      sessionId: entry.sessionId ? String(entry.sessionId) : null,
      metadata: entry.metadata && typeof entry.metadata === 'object'
        ? (entry.metadata as Record<string, unknown>)
        : null,
      createdAt: toDate(entry.createdAt),
    })) as ErrorLogRow[];
    setRows(nextRows.filter((row) => Boolean(row.id)));
  }, [query.data]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, scopeFilter, sourceFilter, levelFilter, impersonationFilter, pageSize]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (scopeFilter !== 'all' && row.scope !== scopeFilter) return false;
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
      if (levelFilter !== 'all' && row.level !== levelFilter) return false;
      if (impersonationFilter === 'yes' && !row.isImpersonating) return false;
      if (impersonationFilter === 'no' && row.isImpersonating) return false;
      if (!term) return true;

      const haystack = [
        row.message,
        row.code,
        row.scope,
        row.source,
        row.route,
        row.userUid,
        row.userRole,
        row.fingerprint,
        row.sessionId,
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(term);
    });
  }, [rows, searchTerm, scopeFilter, sourceFilter, levelFilter, impersonationFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const hasNextPage = page * pageSize < filtered.length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Error Logs</h2>
            <p className="text-sm text-gray-600">Monitor frontend and backend errors across all portal flows.</p>
          </div>
          <AdminRefreshButton
            onClick={() => refetchQuery(query)}
            isRefreshing={query.isFetching}
            label="Refresh error logs"
          />
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search message, code, route, uid, fingerprint"
        rightContent={<span className="text-xs font-semibold text-gray-500">{filtered.length} logs</span>}
      />

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-5">
          <select
            value={scopeFilter}
            onChange={(event) => setScopeFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All scopes</option>
            <option value="auth">auth</option>
            <option value="donor">donor</option>
            <option value="ngo">ngo</option>
            <option value="bloodbank">bloodbank</option>
            <option value="admin">admin</option>
            <option value="unknown">unknown</option>
          </select>
          <select
            value={sourceFilter}
            onChange={(event) => setSourceFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All sources</option>
            <option value="frontend">frontend</option>
            <option value="functions">functions</option>
            <option value="netlify">netlify</option>
            <option value="unknown">unknown</option>
          </select>
          <select
            value={levelFilter}
            onChange={(event) => setLevelFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All levels</option>
            <option value="error">error</option>
            <option value="warning">warning</option>
          </select>
          <select
            value={impersonationFilter}
            onChange={(event) => setImpersonationFilter(event.target.value as 'all' | 'yes' | 'no')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">Impersonation: any</option>
            <option value="yes">Impersonation: yes</option>
            <option value="no">Impersonation: no</option>
          </select>
          <button
            type="button"
            onClick={() => {
              setScopeFilter('all');
              setSourceFilter('all');
              setLevelFilter('all');
              setImpersonationFilter('all');
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Reset filters
          </button>
        </div>
      </div>

      <AdminRefreshingBanner show={loading} message="Refreshing error logs..." />
      <AdminErrorCard message={error} onRetry={() => refetchQuery(query)} />

      {paged.length === 0 ? (
        <AdminEmptyStateCard message="No error logs found." />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {paged.map((row) => (
              <article key={`mobile-${row.id}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-gray-900 line-clamp-2">{row.message}</p>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.level === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-red-100 text-red-700'}`}>
                    {row.level}
                  </span>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <p>Scope: <span className="font-semibold text-gray-800">{row.scope}</span></p>
                  <p>Source: <span className="font-semibold text-gray-800">{row.source}</span></p>
                  <p className="col-span-2">Route: <span className="font-semibold text-gray-800">{row.route || '-'}</span></p>
                  <p>User: <span className="font-semibold text-gray-800">{row.userUid || '-'}</span></p>
                  <p>Time: <span className="font-semibold text-gray-800">{row.createdAt ? row.createdAt.toLocaleString() : 'N/A'}</span></p>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
                  <tr>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Scope</th>
                    <th className="px-4 py-3">Source</th>
                    <th className="px-4 py-3">Level</th>
                    <th className="px-4 py-3">User UID</th>
                    <th className="px-4 py-3">Timestamp</th>
                    <th className="px-4 py-3">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((row) => {
                    const isExpanded = expandedId === row.id;
                    return (
                      <Fragment key={row.id}>
                        <tr className="hover:bg-red-50/40">
                          <td className="px-4 py-3 text-gray-700 max-w-lg">
                            <p className="line-clamp-2 font-medium">{row.message}</p>
                            {row.code && <p className="text-xs text-red-600 mt-1">code: {row.code}</p>}
                          </td>
                          <td className="px-4 py-3 text-gray-700">{row.scope}</td>
                          <td className="px-4 py-3 text-gray-700">{row.source}</td>
                          <td className="px-4 py-3 text-gray-700">{row.level}</td>
                          <td className="px-4 py-3 text-gray-700">{row.userUid || '-'}</td>
                          <td className="px-4 py-3 text-gray-600">{row.createdAt ? row.createdAt.toLocaleString() : 'N/A'}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : row.id)}
                              className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                            >
                              {isExpanded ? 'Hide' : 'View'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/70">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="grid gap-3 text-xs text-gray-700 md:grid-cols-2">
                                <p><span className="font-semibold">Route:</span> {row.route || '-'}</p>
                                <p><span className="font-semibold">User Role:</span> {row.userRole || '-'}</p>
                                <p><span className="font-semibold">Impersonating:</span> {row.isImpersonating ? 'yes' : 'no'}</p>
                                <p><span className="font-semibold">Actor UID:</span> {row.impersonationActorUid || '-'}</p>
                                <p><span className="font-semibold">Fingerprint:</span> {row.fingerprint || '-'}</p>
                                <p><span className="font-semibold">Session ID:</span> {row.sessionId || '-'}</p>
                              </div>
                              {row.metadata && (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold text-gray-800">Metadata</p>
                                  <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-white p-3 text-[11px] text-gray-700 border border-gray-200">{JSON.stringify(row.metadata, null, 2)}</pre>
                                </div>
                              )}
                              {row.stack && (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold text-gray-800">Stack</p>
                                  <pre className="mt-1 max-h-56 overflow-auto rounded-lg bg-white p-3 text-[11px] text-gray-700 border border-gray-200 whitespace-pre-wrap">{row.stack}</pre>
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      <AdminPagination
        page={page}
        pageSize={pageSize}
        itemCount={paged.length}
        hasNextPage={hasNextPage}
        loading={loading}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <div className="rounded-xl border border-red-100 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
        <p className="flex items-center gap-2 font-semibold text-red-700"><Shield className="h-4 w-4" />Operational note</p>
        <p className="mt-1">Logs include sanitized payloads. Stack traces are intentionally truncated in production for safety.</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Retention</p>
        <p className="mt-1">Error logs older than 90 days are deleted by scheduled cleanup.</p>
      </div>
    </div>
  );
}

export default ErrorLogsPage;
