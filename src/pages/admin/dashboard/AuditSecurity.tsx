import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Shield, UserCog } from 'lucide-react';
import { toDateValue } from '../../../utils/dateValue';
import { useAuth } from '../../../contexts/AuthContext';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { useAdminAuditLogs } from '../../../hooks/admin/useAdminQueries';
import { refetchQuery } from '../../../utils/queryRefetch';
import { ROUTES } from '../../../constants/routes';

type AuditRow = {
  id: string;
  actorUid: string;
  actorRole?: string;
  action: string;
  targetUid?: string;
  createdAt?: Date;
};

function AuditSecurityPage() {
  const { isSuperAdmin } = useAuth();
  const [events, setEvents] = useState<AuditRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const auditQuery = useAdminAuditLogs(1000);
  const loading = auditQuery.isLoading;
  const error = auditQuery.error instanceof Error ? auditQuery.error.message : null;

  useEffect(() => {
    const rows = (auditQuery.data || []).map((entry) => ({
      id: entry.id || '',
      actorUid: entry.actorUid || '-',
      actorRole: entry.actorRole,
      action: entry.action || 'unknown',
      targetUid: entry.targetUid,
      createdAt: toDateValue(entry.createdAt),
    })) as AuditRow[];
    setEvents(rows.filter((entry) => Boolean(entry.id)));
  }, [auditQuery.data]);

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
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Audit & Security</h2>
            <p className="text-sm text-gray-600">Review admin security actions and audit events.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <AdminRefreshButton
              onClick={() => refetchQuery(auditQuery)}
              isRefreshing={auditQuery.isFetching}
              label="Refresh audit logs"
            />
            <Link
              to={ROUTES.portal.admin.dashboard.impersonationAudit}
              className="inline-flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
            >
              <UserCog className="h-4 w-4" />
              Impersonation Audit
            </Link>
          </div>
        </div>

        {!isSuperAdmin && (
          <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
            You are viewing general audit logs. Impersonation audit details are restricted to superadmins.
          </div>
        )}
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search actor uid, role, action, target uid"
        rightContent={<span className="text-xs font-semibold text-gray-500">{filtered.length} events</span>}
      />

      <AdminRefreshingBanner show={loading} message="Refreshing audit logs..." />
      <AdminErrorCard message={error} onRetry={() => refetchQuery(auditQuery)} />

      {paged.length === 0 ? (
        <AdminEmptyStateCard message="No audit events found." />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {paged.map((entry) => (
              <article key={`mobile-${entry.id}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                <p className="font-semibold text-gray-900">{entry.actorUid}</p>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <p>Role: <span className="font-semibold text-gray-800">{entry.actorRole || '-'}</span></p>
                  <p>Action: <span className="font-semibold text-gray-800">{entry.action}</span></p>
                  <p className="col-span-2">Target UID: <span className="font-semibold text-gray-800">{entry.targetUid || '-'}</span></p>
                  <p className="col-span-2">Timestamp: <span className="font-semibold text-gray-800">{entry.createdAt ? entry.createdAt.toLocaleString() : 'N/A'}</span></p>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
                  <tr>
                    <th className="px-4 py-3">Actor UID</th>
                    <th className="px-4 py-3">Role</th>
                    <th className="px-4 py-3">Action</th>
                    <th className="px-4 py-3">Target UID</th>
                    <th className="px-4 py-3">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((entry) => (
                    <tr key={entry.id} className="hover:bg-red-50/40">
                      <td className="px-4 py-3 text-gray-700 font-semibold">{entry.actorUid}</td>
                      <td className="px-4 py-3 text-gray-700">{entry.actorRole || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{entry.action}</td>
                      <td className="px-4 py-3 text-gray-700">{entry.targetUid || '-'}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.createdAt ? entry.createdAt.toLocaleString() : 'N/A'}</td>
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
        loading={loading}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <div className="rounded-xl border border-red-100 bg-white px-4 py-3 text-sm text-gray-700 shadow-sm">
        <p className="flex items-center gap-2 font-semibold text-red-700"><Shield className="h-4 w-4" />Security control</p>
        <p className="mt-1">All admin operations should emit an `auditLogs` entry. Review this feed regularly for privileged changes.</p>
      </div>
    </div>
  );
}

export default AuditSecurityPage;
