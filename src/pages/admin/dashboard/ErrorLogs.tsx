import { Fragment, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, Shield } from 'lucide-react';
import { collection, getDocs, limit, orderBy, query, startAfter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { toDateValue } from '../../../utils/dateValue';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';

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

const getMetadataString = (metadata: Record<string, unknown> | null): string => {
  if (!metadata) return '';
  try {
    return JSON.stringify(metadata).toLowerCase();
  } catch {
    return '';
  }
};

const getFirestoreMeta = (metadata: Record<string, unknown> | null) => ({
  operation: typeof metadata?.firestoreOperation === 'string' ? metadata.firestoreOperation : null,
  collection: typeof metadata?.firestoreCollection === 'string' ? metadata.firestoreCollection : null,
  docId: typeof metadata?.firestoreDocId === 'string' ? metadata.firestoreDocId : null,
  phase: typeof metadata?.firestorePhase === 'string' ? metadata.firestorePhase : null,
  blocking: metadata?.firestoreBlocking === true,
  permissionDenied: metadata?.firestorePermissionDenied === true,
  kind: typeof metadata?.kind === 'string' ? metadata.kind : null,
});

const toDate = (value: unknown): Date | undefined => {
  return toDateValue(value);
};

function ErrorLogsPage() {
  const [rows, setRows] = useState<ErrorLogRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [scopeFilter, setScopeFilter] = useState('all');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [levelFilter, setLevelFilter] = useState('all');
  const [operationFilter, setOperationFilter] = useState('all');
  const [impersonationFilter, setImpersonationFilter] = useState<'all' | 'yes' | 'no'>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const fetchErrorLogsPage = async (options?: {
    reset?: boolean;
    cursor?: QueryDocumentSnapshot<DocumentData> | null;
  }) => {
    const snapshot = await getDocs(query(
      collection(db, COLLECTIONS.ERROR_LOGS),
      orderBy('createdAt', 'desc'),
      ...(options?.cursor ? [startAfter(options.cursor)] : []),
      limit(101),
    ));
    const docs = snapshot.docs;
    const nextRows = docs.slice(0, 100).map((docSnap) => {
      const entry = docSnap.data() as Record<string, unknown>;
      return {
        id: docSnap.id,
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
      } as ErrorLogRow;
    }).filter((row) => Boolean(row.id));

    setRows((current) => options?.reset ? nextRows : [...current, ...nextRows]);
    setHasMore(docs.length > 100);
    setLastDoc(docs.length > 100 ? docs[99] : docs[docs.length - 1] || null);
  };

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setError(null);
    fetchErrorLogsPage({ reset: true })
      .catch((nextError) => {
        if (!isActive) return;
        setError(nextError instanceof Error ? nextError.message : 'Failed to fetch error logs.');
        setRows([]);
        setHasMore(false);
        setLastDoc(null);
      })
      .finally(() => {
        if (isActive) setLoading(false);
      });
    return () => {
      isActive = false;
    };
  }, []);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, scopeFilter, sourceFilter, levelFilter, operationFilter, impersonationFilter, pageSize]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return rows.filter((row) => {
      if (scopeFilter !== 'all' && row.scope !== scopeFilter) return false;
      if (sourceFilter !== 'all' && row.source !== sourceFilter) return false;
      if (levelFilter !== 'all' && row.level !== levelFilter) return false;
      const firestoreMeta = getFirestoreMeta(row.metadata);
      if (operationFilter !== 'all' && firestoreMeta.operation !== operationFilter) return false;
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
        getMetadataString(row.metadata),
      ].filter(Boolean).join(' ').toLowerCase();

      return haystack.includes(term);
    });
  }, [rows, searchTerm, scopeFilter, sourceFilter, levelFilter, operationFilter, impersonationFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const hasNextPage = page * pageSize < filtered.length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">Error Logs</h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">Monitor frontend and backend errors across all portal flows.</p>
          </div>
          <AdminRefreshButton
            onClick={async () => {
              setRefreshing(true);
              setError(null);
              try {
                await fetchErrorLogsPage({ reset: true });
              } catch (nextError) {
                setError(nextError instanceof Error ? nextError.message : 'Failed to refresh error logs.');
              } finally {
                setRefreshing(false);
              }
            }}
            isRefreshing={refreshing}
            label="Refresh error logs"
          />
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search message, code, route, uid, fingerprint"
        rightContent={<span className="text-xs font-semibold text-gray-500 dark:text-slate-400">{filtered.length} loaded logs</span>}
      />

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="grid gap-3 md:grid-cols-4 lg:grid-cols-5">
          <select
            value={scopeFilter}
            onChange={(event) => setScopeFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="all">All levels</option>
            <option value="error">error</option>
            <option value="warning">warning</option>
          </select>
          <select
            value={operationFilter}
            onChange={(event) => setOperationFilter(event.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
          >
            <option value="all">All Firestore ops</option>
            <option value="getDoc">getDoc</option>
            <option value="setDoc">setDoc</option>
            <option value="updateDoc">updateDoc</option>
            <option value="query">query</option>
            <option value="listen">listen</option>
          </select>
          <select
            value={impersonationFilter}
            onChange={(event) => setImpersonationFilter(event.target.value as 'all' | 'yes' | 'no')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100"
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
              setOperationFilter('all');
              setImpersonationFilter('all');
            }}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            Reset filters
          </button>
        </div>
      </div>

      <AdminRefreshingBanner show={loading || refreshing || loadingMore} message="Refreshing error logs..." />
      <AdminErrorCard message={error} onRetry={() => {
        setLoading(true);
        setError(null);
        void fetchErrorLogsPage({ reset: true })
          .catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : 'Failed to fetch error logs.');
          })
          .finally(() => setLoading(false));
      }} />

      {paged.length === 0 ? (
        <AdminEmptyStateCard message="No error logs found." />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {paged.map((row) => (
              <article key={`mobile-${row.id}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                {(() => {
                  const firestoreMeta = getFirestoreMeta(row.metadata);
                  return (
                    <>
                <div className="flex items-start justify-between gap-2">
                  <p className="line-clamp-2 font-semibold text-gray-900 dark:text-slate-100">{row.message}</p>
                  <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${row.level === 'warning' ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-200' : 'bg-red-100 text-red-700 dark:bg-red-950/40 dark:text-red-300'}`}>
                    {row.level}
                  </span>
                </div>
                {(firestoreMeta.operation || firestoreMeta.collection) && (
                  <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                    {firestoreMeta.operation && <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{firestoreMeta.operation}</span>}
                    {firestoreMeta.collection && <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{firestoreMeta.collection}</span>}
                    {firestoreMeta.permissionDenied && <span className="rounded-full bg-red-50 px-2 py-1 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">permission-denied</span>}
                    {firestoreMeta.blocking && <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">blocking</span>}
                  </div>
                )}
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-400">
                  <p>Scope: <span className="font-semibold text-gray-800 dark:text-slate-200">{row.scope}</span></p>
                  <p>Source: <span className="font-semibold text-gray-800 dark:text-slate-200">{row.source}</span></p>
                  <p className="col-span-2">Route: <span className="font-semibold text-gray-800 dark:text-slate-200">{row.route || '-'}</span></p>
                  <p>User: <span className="font-semibold text-gray-800 dark:text-slate-200">{row.userUid || '-'}</span></p>
                  <p>Time: <span className="font-semibold text-gray-800 dark:text-slate-200">{row.createdAt ? row.createdAt.toLocaleString() : 'N/A'}</span></p>
                </div>
                    </>
                  );
                })()}
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800 dark:bg-red-950/30 dark:text-red-300">
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
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {paged.map((row) => {
                    const isExpanded = expandedId === row.id;
                    const firestoreMeta = getFirestoreMeta(row.metadata);
                    return (
                      <Fragment key={row.id}>
                        <tr className="hover:bg-red-50/40 dark:hover:bg-slate-800/70">
                          <td className="max-w-lg px-4 py-3 text-gray-700 dark:text-slate-300">
                            <p className="line-clamp-2 font-medium text-gray-700 dark:text-slate-200">{row.message}</p>
                            {row.code && <p className="mt-1 text-xs text-red-600 dark:text-red-300">code: {row.code}</p>}
                            {(firestoreMeta.operation || firestoreMeta.collection) && (
                              <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
                                {firestoreMeta.operation && <span className="rounded-full bg-slate-100 px-2 py-1 font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200">{firestoreMeta.operation}</span>}
                                {firestoreMeta.collection && <span className="rounded-full bg-blue-50 px-2 py-1 font-semibold text-blue-700 dark:bg-blue-950/40 dark:text-blue-300">{firestoreMeta.collection}</span>}
                                {firestoreMeta.permissionDenied && <span className="rounded-full bg-red-50 px-2 py-1 font-semibold text-red-700 dark:bg-red-950/40 dark:text-red-300">permission-denied</span>}
                                {firestoreMeta.blocking && <span className="rounded-full bg-amber-50 px-2 py-1 font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-200">blocking</span>}
                              </div>
                            )}
                          </td>
                          <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{row.scope}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{row.source}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{row.level}</td>
                          <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{row.userUid || '-'}</td>
                          <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{row.createdAt ? row.createdAt.toLocaleString() : 'N/A'}</td>
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => setExpandedId(isExpanded ? null : row.id)}
                              className="rounded-lg border border-gray-300 px-3 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-800"
                            >
                              {isExpanded ? 'Hide' : 'View'}
                            </button>
                          </td>
                        </tr>
                        {isExpanded && (
                          <tr className="bg-gray-50/70 dark:bg-slate-950/70">
                            <td colSpan={7} className="px-4 py-4">
                              <div className="grid gap-3 text-xs text-gray-700 dark:text-slate-300 md:grid-cols-2">
                                <p><span className="font-semibold">Route:</span> {row.route || '-'}</p>
                                <p><span className="font-semibold">User Role:</span> {row.userRole || '-'}</p>
                                <p><span className="font-semibold">Impersonating:</span> {row.isImpersonating ? 'yes' : 'no'}</p>
                                <p><span className="font-semibold">Actor UID:</span> {row.impersonationActorUid || '-'}</p>
                                <p><span className="font-semibold">Fingerprint:</span> {row.fingerprint || '-'}</p>
                                <p><span className="font-semibold">Session ID:</span> {row.sessionId || '-'}</p>
                              </div>
                              {(firestoreMeta.operation || firestoreMeta.collection || firestoreMeta.phase || firestoreMeta.docId || firestoreMeta.kind) && (
                                <div className="mt-3 rounded-lg border border-blue-100 bg-blue-50 p-3 text-xs text-blue-950 dark:border-blue-900/40 dark:bg-blue-950/30 dark:text-blue-100">
                                  <p className="font-semibold">Firestore Trace</p>
                                  <div className="mt-2 grid gap-2 md:grid-cols-2">
                                    <p><span className="font-semibold">Operation:</span> {firestoreMeta.operation || '-'}</p>
                                    <p><span className="font-semibold">Collection:</span> {firestoreMeta.collection || '-'}</p>
                                    <p><span className="font-semibold">Document:</span> {firestoreMeta.docId || '-'}</p>
                                    <p><span className="font-semibold">Phase:</span> {firestoreMeta.phase || '-'}</p>
                                    <p><span className="font-semibold">Blocking:</span> {firestoreMeta.blocking ? 'yes' : 'no'}</p>
                                    <p><span className="font-semibold">Permission Denied:</span> {firestoreMeta.permissionDenied ? 'yes' : 'no'}</p>
                                    <p className="md:col-span-2"><span className="font-semibold">Kind:</span> {firestoreMeta.kind || '-'}</p>
                                  </div>
                                </div>
                              )}
                              {row.metadata && (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">Metadata</p>
                                  <pre className="mt-1 max-h-56 overflow-auto rounded-lg border border-gray-200 bg-white p-3 text-[11px] text-gray-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{JSON.stringify(row.metadata, null, 2)}</pre>
                                </div>
                              )}
                              {row.stack && (
                                <div className="mt-3">
                                  <p className="text-xs font-semibold text-gray-800 dark:text-slate-200">Stack</p>
                                  <pre className="mt-1 max-h-56 overflow-auto whitespace-pre-wrap rounded-lg border border-gray-200 bg-white p-3 text-[11px] text-gray-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">{row.stack}</pre>
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
        loading={loading || refreshing || loadingMore}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <div className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3 text-sm text-blue-800 shadow-sm dark:border-blue-900/40 dark:bg-blue-950/40 dark:text-blue-200">
        <p className="font-semibold">Visibility window</p>
        <p className="mt-1">Search and filters operate on the loaded error-log window. Load older logs to extend the visible range.</p>
        <button
          type="button"
          onClick={() => {
            if (!hasMore || !lastDoc) return;
            setLoadingMore(true);
            setError(null);
            void fetchErrorLogsPage({ cursor: lastDoc })
              .catch((nextError) => {
                setError(nextError instanceof Error ? nextError.message : 'Failed to load older error logs.');
              })
              .finally(() => setLoadingMore(false));
          }}
          disabled={!hasMore || loadingMore}
          className="mt-3 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
        >
          {loadingMore ? 'Loading older logs...' : hasMore ? 'Load older logs' : 'All currently reachable logs loaded'}
        </button>
      </div>

      <div className="rounded-xl border border-red-100 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <p className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300"><Shield className="h-4 w-4" />Operational note</p>
        <p className="mt-1">Logs include sanitized payloads. Stack traces are intentionally truncated in production for safety.</p>
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 shadow-sm dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
        <p className="flex items-center gap-2 font-semibold"><AlertTriangle className="h-4 w-4" />Retention</p>
        <p className="mt-1">Error logs older than 90 days are deleted by scheduled cleanup.</p>
      </div>
    </div>
  );
}

export default ErrorLogsPage;
