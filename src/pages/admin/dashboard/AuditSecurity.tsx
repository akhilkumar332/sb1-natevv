import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Link } from 'react-router-dom';
import { Shield, UserCog } from 'lucide-react';
import { collection, getDocs, limit, orderBy, query, startAfter, type QueryDocumentSnapshot, type DocumentData } from 'firebase/firestore';
import { toDateValue } from '../../../utils/dateValue';
import { useAuth } from '../../../contexts/AuthContext';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { ROUTES } from '../../../constants/routes';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';

type AuditRow = {
  id: string;
  actorUid: string;
  actorRole?: string;
  action: string;
  targetUid?: string;
  createdAt?: Date;
};

function AuditSecurityPage() {
  const { t } = useTranslation();
  const { isSuperAdmin } = useAuth();
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<QueryDocumentSnapshot<DocumentData> | null>(null);

  const fetchAuditLogsPage = async (options?: {
    reset?: boolean;
    cursor?: QueryDocumentSnapshot<DocumentData> | null;
  }) => {
    const snapshot = await getDocs(query(
      collection(db, COLLECTIONS.AUDIT_LOGS),
      orderBy('createdAt', 'desc'),
      ...(options?.cursor ? [startAfter(options.cursor)] : []),
      limit(101),
    ));
    const docs = snapshot.docs;
    const nextRows = docs.slice(0, 100).map((docSnap) => {
      const data = docSnap.data() as Record<string, unknown>;
      return {
        id: docSnap.id,
        actorUid: typeof data.actorUid === 'string' ? data.actorUid : '-',
        actorRole: typeof data.actorRole === 'string' ? data.actorRole : undefined,
        action: typeof data.action === 'string' ? data.action : 'unknown',
        targetUid: typeof data.targetUid === 'string' ? data.targetUid : undefined,
        createdAt: toDateValue(data.createdAt),
      } as AuditRow;
    }).filter((entry) => Boolean(entry.id));

    setEvents((current) => options?.reset ? nextRows : [...current, ...nextRows]);
    setHasMore(docs.length > 100);
    setLastDoc(docs.length > 100 ? docs[99] : docs[docs.length - 1] || null);
  };

  useEffect(() => {
    let isActive = true;
    setLoading(true);
    setError(null);
    fetchAuditLogsPage({ reset: true })
      .catch((nextError) => {
        if (!isActive) return;
        setError(nextError instanceof Error ? nextError.message : 'Failed to fetch audit logs.');
        setEvents([]);
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
  }, [searchTerm, pageSize]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return events;
    return events.filter((event) => (
      `${event.actorUid} ${event.actorRole || ''} ${event.action} ${event.targetUid || ''}`.toLowerCase().includes(term)
    ));
  }, [events, searchTerm]);

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
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">{t('admin.auditSecurity')}</h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">{t('admin.reviewSecurityActions')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminRefreshButton
              onClick={async () => {
                setRefreshing(true);
                setError(null);
                try {
                  await fetchAuditLogsPage({ reset: true });
                } catch (nextError) {
                  setError(nextError instanceof Error ? nextError.message : t('admin.failedRefreshAuditLogs'));
                } finally {
                  setRefreshing(false);
                }
              }}
              isRefreshing={refreshing}
              label={t('admin.refreshAuditLogs')}
            />
            <Link
              to={ROUTES.portal.admin.dashboard.impersonationAudit}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-300 dark:hover:bg-red-950/60"
            >
              <UserCog className="h-4 w-4" />
              {t('admin.impersonationAudit')}
            </Link>
          </div>
        </div>

        {!isSuperAdmin && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/40 dark:text-amber-200">
            {t('admin.impersonationRestrictedToSuperadmins')}
          </div>
        )}
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder={t('admin.searchAuditLogsPlaceholder')}
        rightContent={<span className="text-xs font-semibold text-gray-500 dark:text-slate-400">{t('admin.loadedEvents', { count: filtered.length })}</span>}
      />

      <AdminRefreshingBanner show={loading || refreshing || loadingMore} message={t('admin.refreshingAuditLogs')} />
      <AdminErrorCard message={error} onRetry={() => {
        setLoading(true);
        setError(null);
        void fetchAuditLogsPage({ reset: true })
          .catch((nextError) => {
            setError(nextError instanceof Error ? nextError.message : t('admin.failedFetchAuditLogs'));
          })
          .finally(() => setLoading(false));
      }} />

      {paged.length === 0 ? (
        <AdminEmptyStateCard message={t('admin.noAuditEventsFound')} />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {paged.map((entry) => (
              <article key={`mobile-${entry.id}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
                <p className="font-semibold text-gray-900 dark:text-slate-100">{entry.actorUid}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600 dark:text-slate-400">
                  <p>{t('admin.roleLabel')}: <span className="font-semibold text-gray-800 dark:text-slate-200">{entry.actorRole || '-'}</span></p>
                  <p>{t('admin.actionLabel')}: <span className="font-semibold text-gray-800 dark:text-slate-200">{entry.action}</span></p>
                  <p className="col-span-2">{t('admin.targetUidLabel')}: <span className="font-semibold text-gray-800 dark:text-slate-200">{entry.targetUid || '-'}</span></p>
                  <p className="col-span-2">{t('admin.timestampLabel')}: <span className="font-semibold text-gray-800 dark:text-slate-200">{entry.createdAt ? entry.createdAt.toLocaleString() : t('admin.notAvailable')}</span></p>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900 lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800 dark:bg-red-950/30 dark:text-red-300">
                  <tr>
                    <th className="px-4 py-3">Actor UID</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Target UID</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
                  {paged.map((entry) => (
                    <tr key={entry.id} className="hover:bg-red-50/40 dark:hover:bg-slate-800/70">
                      <td className="px-4 py-3 font-semibold text-gray-700 dark:text-slate-200">{entry.actorUid}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{entry.actorRole || '-'}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{entry.action}</td>
                      <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{entry.targetUid || '-'}</td>
                      <td className="px-4 py-3 text-gray-600 dark:text-slate-400">{entry.createdAt ? entry.createdAt.toLocaleString() : 'N/A'}</td>
                    </tr>
                  ))}
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
        <p className="mt-1">Search and pagination operate on the loaded audit window. Load older events to extend the visible range.</p>
        <button
          type="button"
          onClick={() => {
            if (!hasMore || !lastDoc) return;
            setLoadingMore(true);
            setError(null);
            void fetchAuditLogsPage({ cursor: lastDoc })
              .catch((nextError) => {
                setError(nextError instanceof Error ? nextError.message : 'Failed to load older audit logs.');
              })
              .finally(() => setLoadingMore(false));
          }}
          disabled={!hasMore || loadingMore}
          className="mt-3 rounded-lg border border-blue-200 bg-white px-4 py-2 text-sm font-semibold text-blue-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-blue-800 dark:bg-slate-900 dark:text-blue-300"
        >
          {loadingMore ? 'Loading older events...' : hasMore ? 'Load older events' : 'All currently reachable events loaded'}
        </button>
      </div>

      <div className="rounded-xl border border-red-100 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
        <p className="flex items-center gap-2 font-semibold text-red-700 dark:text-red-300"><Shield className="h-4 w-4" />Security control</p>
        <p className="mt-1">All admin operations should emit an `auditLogs` entry. Review this feed regularly for privileged changes.</p>
      </div>
    </div>
  );
}

export default AuditSecurityPage;
