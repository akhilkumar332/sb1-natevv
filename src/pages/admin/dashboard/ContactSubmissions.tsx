import { useEffect, useMemo, useState } from 'react';
import { MailCheck, MailOpen } from 'lucide-react';
import { useQueryClient } from '@tanstack/react-query';
import { deleteField, doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { useAdminContactSubmissions } from '../../../hooks/admin/useAdminQueries';
import { refetchQuery } from '../../../utils/queryRefetch';
import { runWithFeedback } from '../../../utils/runWithFeedback';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { COLLECTIONS } from '../../../constants/firestore';
import { CONTACT_SUBMISSION_STATUS } from '../../../constants/contact';
import { useAuth } from '../../../contexts/AuthContext';
import { toDateValue } from '../../../utils/dateValue';

type ContactSubmissionRow = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'read' | 'unread';
  readBy?: string | null;
  createdAt?: Date | null;
  readAt?: Date | null;
};

type StatusFilter = 'all' | 'read' | 'unread';

function ContactSubmissionsPage() {
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const [entries, setEntries] = useState<ContactSubmissionRow[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const submissionsQuery = useAdminContactSubmissions(1000);
  const loading = submissionsQuery.isLoading;
  const error = submissionsQuery.error instanceof Error ? submissionsQuery.error.message : null;

  useEffect(() => {
    const mapped = (submissionsQuery.data || []).map((entry: any) => ({
      id: entry.id || '',
      name: entry.name || '-',
      email: entry.email || '-',
      phone: entry.phone || '',
      subject: entry.subject || 'general',
      message: entry.message || '',
      status: entry.status === CONTACT_SUBMISSION_STATUS.read ? CONTACT_SUBMISSION_STATUS.read : CONTACT_SUBMISSION_STATUS.unread,
      readBy: entry.readBy || null,
      createdAt: toDateValue(entry.createdAt),
      readAt: toDateValue(entry.readAt),
    })) as ContactSubmissionRow[];
    setEntries(mapped.filter((row) => Boolean(row.id)));
  }, [submissionsQuery.data]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, pageSize]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return entries.filter((entry) => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = [entry.name, entry.email, entry.phone, entry.subject, entry.message].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(term);
    });
  }, [entries, searchTerm, statusFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const hasNextPage = page * pageSize < filtered.length;

  const markStatus = async (entry: ContactSubmissionRow, nextStatus: 'read' | 'unread') => {
    setProcessingId(entry.id);
    await runWithFeedback({
      action: () => updateDoc(doc(db, COLLECTIONS.CONTACT_SUBMISSIONS, entry.id), {
        status: nextStatus,
        readAt: nextStatus === CONTACT_SUBMISSION_STATUS.read ? getServerTimestamp() : deleteField(),
        readBy: nextStatus === CONTACT_SUBMISSION_STATUS.read ? (user?.uid || null) : deleteField(),
        updatedAt: getServerTimestamp(),
      }),
      successMessage: nextStatus === CONTACT_SUBMISSION_STATUS.read ? 'Marked as read' : 'Marked as unread',
      errorMessage: 'Failed to update submission status.',
      capture: { scope: 'admin', metadata: { kind: 'admin.contact_submission.status.update', status: nextStatus } },
      invalidate: () => invalidateAdminRecipe(queryClient, 'contactSubmissionUpdated'),
    });
    setProcessingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Contact Submissions</h2>
            <p className="text-sm text-gray-600">Review all website contact form submissions and track read status.</p>
          </div>
          <AdminRefreshButton
            onClick={() => refetchQuery(submissionsQuery)}
            isRefreshing={submissionsQuery.isFetching}
            label="Refresh submissions"
          />
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search by name, email, subject, phone"
        leftContent={(
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">All statuses</option>
            <option value="unread">Unread</option>
            <option value="read">Read</option>
          </select>
        )}
        rightContent={<span className="text-xs font-semibold text-gray-500">{filtered.length} submissions</span>}
      />

      <AdminRefreshingBanner show={loading} message="Refreshing contact submissions..." />
      <AdminErrorCard message={error} onRetry={() => refetchQuery(submissionsQuery)} />

      {paged.length === 0 ? (
        <AdminEmptyStateCard message="No contact submissions found." />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {paged.map((entry) => (
              <article key={entry.id} className={`rounded-2xl border border-red-100 bg-white p-4 shadow-sm ${entry.status === 'unread' ? 'ring-1 ring-red-200' : ''}`}>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-semibold text-gray-900">{entry.name}</p>
                    <p className="text-xs text-gray-500">{entry.email}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.status === 'read' ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                    {entry.status}
                  </span>
                </div>
                <p className="mt-2 text-sm font-medium text-gray-800">Subject: {entry.subject}</p>
                <p className="mt-1 text-sm text-gray-600 whitespace-pre-wrap break-words">{entry.message}</p>
                <div className="mt-3 text-xs text-gray-600 space-y-1">
                  <p>Phone: <span className="font-semibold text-gray-800">{entry.phone || '-'}</span></p>
                  <p>Received: <span className="font-semibold text-gray-800">{entry.createdAt ? entry.createdAt.toLocaleString() : 'N/A'}</span></p>
                  <p>Read At: <span className="font-semibold text-gray-800">{entry.readAt ? entry.readAt.toLocaleString() : '-'}</span></p>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => void markStatus(entry, CONTACT_SUBMISSION_STATUS.read)}
                    disabled={processingId === entry.id || entry.status === CONTACT_SUBMISSION_STATUS.read}
                    className="rounded-md border border-emerald-200 px-2 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                  >
                    <MailCheck className="mr-1 inline h-3.5 w-3.5" />
                    Read
                  </button>
                  <button
                    type="button"
                    onClick={() => void markStatus(entry, CONTACT_SUBMISSION_STATUS.unread)}
                    disabled={processingId === entry.id || entry.status === CONTACT_SUBMISSION_STATUS.unread}
                    className="rounded-md border border-red-200 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                  >
                    <MailOpen className="mr-1 inline h-3.5 w-3.5" />
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
                    <th className="px-4 py-3">Sender</th>
                    <th className="px-4 py-3">Subject</th>
                    <th className="px-4 py-3">Message</th>
                    <th className="px-4 py-3">Received</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((entry) => (
                    <tr key={entry.id} className={`hover:bg-red-50/40 ${entry.status === CONTACT_SUBMISSION_STATUS.unread ? 'bg-red-50/30' : ''}`}>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-gray-900">{entry.name}</p>
                        <p className="text-xs text-gray-500">{entry.email}</p>
                        <p className="text-xs text-gray-500">{entry.phone || '-'}</p>
                      </td>
                      <td className="px-4 py-3 text-gray-700">{entry.subject}</td>
                      <td className="px-4 py-3 text-gray-600 max-w-[380px] truncate">{entry.message}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.createdAt ? entry.createdAt.toLocaleString() : 'N/A'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold ${entry.status === CONTACT_SUBMISSION_STATUS.read ? 'bg-gray-100 text-gray-700' : 'bg-red-100 text-red-700'}`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => void markStatus(entry, CONTACT_SUBMISSION_STATUS.read)}
                            disabled={processingId === entry.id || entry.status === CONTACT_SUBMISSION_STATUS.read}
                            className="rounded-md border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                          >
                            <MailCheck className="mr-1 inline h-3.5 w-3.5" />
                            Read
                          </button>
                          <button
                            type="button"
                            onClick={() => void markStatus(entry, CONTACT_SUBMISSION_STATUS.unread)}
                            disabled={processingId === entry.id || entry.status === CONTACT_SUBMISSION_STATUS.unread}
                            className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                          >
                            <MailOpen className="mr-1 inline h-3.5 w-3.5" />
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

export default ContactSubmissionsPage;
