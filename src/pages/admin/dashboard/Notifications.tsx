import { useEffect, useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { BellRing, MailCheck } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { toDateValue } from '../../../utils/dateValue';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { useAdminNotifications } from '../../../hooks/admin/useAdminQueries';
import { refetchQuery } from '../../../utils/queryRefetch';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { runWithFeedback } from '../../../utils/runWithFeedback';

type NotificationRow = {
  id: string;
  userId: string;
  userRole?: string;
  type: string;
  title: string;
  message: string;
  priority?: string;
  read: boolean;
  createdAt?: Date;
};

type PriorityFilter = 'all' | 'low' | 'medium' | 'high';

function NotificationsPage() {
  const queryClient = useQueryClient();
  const [notifications, setNotifications] = useState<NotificationRow[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [priorityFilter, setPriorityFilter] = useState<PriorityFilter>('all');
  const [showUnreadOnly, setShowUnreadOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const notificationsQuery = useAdminNotifications(1000);
  const loading = notificationsQuery.isLoading;
  const error = notificationsQuery.error instanceof Error ? notificationsQuery.error.message : null;

  useEffect(() => {
    const rows = (notificationsQuery.data || []).map((entry) => ({
      id: entry.id || '',
      userId: entry.userId || '-',
      userRole: entry.userRole,
      type: entry.type || 'general',
      title: entry.title || 'Notification',
      message: entry.message || '',
      priority: entry.priority || 'medium',
      read: Boolean(entry.read),
      createdAt: toDateValue(entry.createdAt),
    })) as NotificationRow[];
    setNotifications(rows.filter((entry) => Boolean(entry.id)));
  }, [notificationsQuery.data]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, priorityFilter, showUnreadOnly, pageSize]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return notifications.filter((entry) => {
      if (priorityFilter !== 'all' && entry.priority !== priorityFilter) return false;
      if (showUnreadOnly && entry.read) return false;
      if (!term) return true;
      const haystack = [entry.userId, entry.userRole, entry.type, entry.title, entry.message, entry.priority]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [notifications, priorityFilter, searchTerm, showUnreadOnly]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const hasNextPage = page * pageSize < filtered.length;

  const toggleRead = async (entry: NotificationRow, read: boolean) => {
    setProcessingId(entry.id);
    await runWithFeedback({
      action: () => updateDoc(doc(db, 'notifications', entry.id), {
        read,
        updatedAt: getServerTimestamp(),
      }),
      successMessage: read ? 'Marked as read' : 'Marked as unread',
      errorMessage: 'Failed to update notification.',
      capture: { scope: 'admin', metadata: { kind: 'admin.notification.read.toggle', read } },
      invalidate: () => invalidateAdminRecipe(queryClient, 'notificationUpdated'),
    });
    setProcessingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Notifications</h2>
            <p className="text-sm text-gray-600">Review and moderate platform notifications for all user roles.</p>
          </div>
          <AdminRefreshButton
            onClick={() => refetchQuery(notificationsQuery)}
            isRefreshing={notificationsQuery.isFetching}
            label="Refresh notifications"
          />
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search user id, role, type, title, message"
        leftContent={
          <>
            <select
              value={priorityFilter}
              onChange={(event) => setPriorityFilter(event.target.value as PriorityFilter)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
            <label className="inline-flex items-center gap-2 rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={showUnreadOnly}
                onChange={(event) => setShowUnreadOnly(event.target.checked)}
              />
              Unread only
            </label>
          </>
        }
        rightContent={<span className="text-xs font-semibold text-gray-500">{filtered.length} notifications</span>}
      />

      <AdminRefreshingBanner show={loading} message="Refreshing notifications..." />
      <AdminErrorCard message={error} onRetry={() => refetchQuery(notificationsQuery)} />

      {paged.length === 0 ? (
        <AdminEmptyStateCard message="No notifications found." />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {paged.map((entry) => (
              <article key={`mobile-${entry.id}`} className={`rounded-2xl border border-red-100 bg-white p-4 shadow-sm ${entry.read ? '' : 'ring-1 ring-red-200'}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{entry.title}</p>
                    <p className="text-xs text-gray-500">{entry.userId} • {entry.userRole || '-'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.read ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                    {entry.read ? 'Read' : 'Unread'}
                  </span>
                </div>
                <p className="mt-2 text-sm text-gray-600">{entry.message}</p>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <p>Type: <span className="font-semibold text-gray-800">{entry.type}</span></p>
                  <p>Priority: <span className="font-semibold text-gray-800 capitalize">{entry.priority || '-'}</span></p>
                  <p className="col-span-2">Created: <span className="font-semibold text-gray-800">{entry.createdAt ? entry.createdAt.toLocaleString() : 'N/A'}</span></p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void toggleRead(entry, true)}
                    disabled={processingId === entry.id || entry.read}
                    className="rounded-md border border-emerald-200 px-2 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <MailCheck className="mr-1 inline h-3.5 w-3.5" />
                    Read
                  </button>
                  <button
                    type="button"
                    onClick={() => void toggleRead(entry, false)}
                    disabled={processingId === entry.id || !entry.read}
                    className="rounded-md border border-red-200 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <BellRing className="mr-1 inline h-3.5 w-3.5" />
                    Unread
                  </button>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
                  <tr>
                    <th className="px-4 py-3">User</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Priority</th>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Created</th>
                    <th className="px-4 py-3">Read</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((entry) => (
                    <tr key={entry.id} className={`hover:bg-red-50/40 ${entry.read ? '' : 'bg-red-50/30'}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{entry.userId}</p>
                        <p className="text-xs text-gray-500">{entry.userRole || '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{entry.type}</td>
                      <td className="px-4 py-3 text-gray-700 capitalize">{entry.priority || '-'}</td>
                      <td className="px-4 py-3 text-gray-700">{entry.title}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[320px] truncate">{entry.message}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.createdAt ? entry.createdAt.toLocaleString() : 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.read ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                          {entry.read ? 'Read' : 'Unread'}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void toggleRead(entry, true)}
                            disabled={processingId === entry.id || entry.read}
                            className="rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <MailCheck className="mr-1 inline h-3.5 w-3.5" />
                            Read
                          </button>
                          <button
                            type="button"
                            onClick={() => void toggleRead(entry, false)}
                            disabled={processingId === entry.id || !entry.read}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <BellRing className="mr-1 inline h-3.5 w-3.5" />
                            Unread
                          </button>
                        </div>
                      </td>
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
    </div>
  );
}

export default NotificationsPage;
