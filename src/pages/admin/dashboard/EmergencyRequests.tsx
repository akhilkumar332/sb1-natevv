import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import type { BloodRequest } from '../../../types/database.types';
import { db } from '../../../firebase';
import { getServerTimestamp, timestampToDate } from '../../../utils/firestore.utils';
import { getEmergencyRequests } from '../../../services/admin.service';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';

type UrgencyFilter = 'all' | 'critical' | 'high' | 'medium' | 'low';
type StatusFilter = 'all' | 'active' | 'partially_fulfilled' | 'fulfilled' | 'expired' | 'cancelled';

type RequestRow = {
  id: string;
  requesterName: string;
  bloodType: string;
  units: number;
  urgency: string;
  status: string;
  city?: string;
  state?: string;
  requestedAt?: Date;
  neededBy?: Date;
};

const toDate = (value: any): Date | undefined => {
  if (!value) return undefined;
  if (value instanceof Date) return value;
  if (typeof value?.toDate === 'function') return value.toDate();
  if (typeof value?.seconds === 'number') return new Date(value.seconds * 1000);
  return timestampToDate(value as any);
};

function EmergencyRequestsPage() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [urgencyFilter, setUrgencyFilter] = useState<UrgencyFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);

  const loadRequests = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getEmergencyRequests();
      const mapped = data.map((entry: BloodRequest) => ({
        id: entry.id || '',
        requesterName: entry.requesterName || (entry as any).hospitalName || 'Requester',
        bloodType: entry.bloodType || '-',
        units: entry.units || 0,
        urgency: entry.urgency || 'medium',
        status: entry.status || 'active',
        city: entry.location?.city,
        state: entry.location?.state,
        requestedAt: toDate(entry.requestedAt),
        neededBy: toDate(entry.neededBy),
      }));
      setRequests(mapped.filter((entry) => Boolean(entry.id)));
    } catch (fetchError: any) {
      setError(fetchError?.message || 'Unable to load emergency requests.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadRequests();
  }, [loadRequests]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, urgencyFilter, statusFilter, pageSize]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return requests.filter((entry) => {
      if (urgencyFilter !== 'all' && entry.urgency !== urgencyFilter) return false;
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = [
        entry.requesterName,
        entry.bloodType,
        entry.urgency,
        entry.status,
        entry.city,
        entry.state,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [requests, searchTerm, urgencyFilter, statusFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const hasNextPage = page * pageSize < filtered.length;

  const handleStatusUpdate = async (id: string, nextStatus: 'fulfilled' | 'cancelled') => {
    setProcessingId(id);
    try {
      await updateDoc(doc(db, 'bloodRequests', id), {
        status: nextStatus,
        updatedAt: getServerTimestamp(),
        ...(nextStatus === 'fulfilled' ? { fulfilledAt: getServerTimestamp() } : {}),
      });
      toast.success(`Request marked as ${nextStatus}`);
      await loadRequests();
    } catch (updateError: any) {
      toast.error(updateError?.message || 'Failed to update request.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Emergency Requests</h2>
            <p className="text-sm text-gray-600">Track and moderate emergency blood requests across the platform.</p>
          </div>
          <button
            type="button"
            onClick={loadRequests}
            className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm font-semibold text-red-700 hover:bg-red-100"
          >
            Refresh
          </button>
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search by requester, blood type, city, state"
        leftContent={
          <>
            <select
              value={urgencyFilter}
              onChange={(event) => setUrgencyFilter(event.target.value as UrgencyFilter)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All urgencies</option>
              <option value="critical">Critical</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
              className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="partially_fulfilled">Partially fulfilled</option>
              <option value="fulfilled">Fulfilled</option>
              <option value="expired">Expired</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </>
        }
        rightContent={<span className="text-xs font-semibold text-gray-500">{filtered.length} requests</span>}
      />

      {loading ? (
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-500 shadow-sm">Loading emergency requests...</div>
      ) : error ? (
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700">{error}</div>
      ) : paged.length === 0 ? (
        <div className="rounded-2xl border border-red-100 bg-white p-8 text-center text-gray-500 shadow-sm">No requests found.</div>
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {paged.map((entry) => {
              const busy = processingId === entry.id;
              return (
                <article key={`mobile-${entry.id}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold text-gray-900">{entry.requesterName}</p>
                      <p className="text-xs text-gray-500">{entry.city || 'N/A'}{entry.state ? `, ${entry.state}` : ''}</p>
                    </div>
                    <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${
                      entry.urgency === 'critical'
                        ? 'bg-red-100 text-red-700'
                        : entry.urgency === 'high'
                          ? 'bg-amber-100 text-amber-700'
                          : 'bg-yellow-100 text-yellow-700'
                    }`}>{entry.urgency}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <p>Blood: <span className="font-semibold text-red-700">{entry.bloodType}</span></p>
                    <p>Units: <span className="font-semibold text-gray-800">{entry.units}</span></p>
                    <p>Status: <span className="font-semibold text-gray-800 capitalize">{entry.status}</span></p>
                    <p>Requested: <span className="font-semibold text-gray-800">{entry.requestedAt ? entry.requestedAt.toLocaleDateString() : 'N/A'}</span></p>
                    <p className="col-span-2">Needed By: <span className="font-semibold text-gray-800">{entry.neededBy ? entry.neededBy.toLocaleDateString() : 'N/A'}</span></p>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => void handleStatusUpdate(entry.id, 'fulfilled')}
                      disabled={busy || entry.status === 'fulfilled'}
                      className="rounded-md border border-emerald-200 px-2 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Fulfilled
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatusUpdate(entry.id, 'cancelled')}
                      disabled={busy || entry.status === 'cancelled'}
                      className="rounded-md border border-red-200 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
                  <tr>
                    <th className="px-4 py-3">Requester</th>
                    <th className="px-4 py-3">Blood</th>
                    <th className="px-4 py-3">Units</th>
                    <th className="px-4 py-3">Urgency</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Requested</th>
                    <th className="px-4 py-3">Needed By</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((entry) => {
                    const busy = processingId === entry.id;
                    return (
                      <tr key={entry.id} className="hover:bg-red-50/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{entry.requesterName}</p>
                          <p className="text-xs text-gray-500">{entry.city || 'N/A'}{entry.state ? `, ${entry.state}` : ''}</p>
                        </td>
                        <td className="px-4 py-3 font-semibold text-red-700">{entry.bloodType}</td>
                        <td className="px-4 py-3">{entry.units}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2 py-1 text-xs font-semibold uppercase ${
                            entry.urgency === 'critical'
                              ? 'bg-red-100 text-red-700'
                              : entry.urgency === 'high'
                                ? 'bg-amber-100 text-amber-700'
                                : 'bg-yellow-100 text-yellow-700'
                          }`}>{entry.urgency}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700">{entry.status}</span>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{entry.requestedAt ? entry.requestedAt.toLocaleDateString() : 'N/A'}</td>
                        <td className="px-4 py-3 text-gray-600">{entry.neededBy ? entry.neededBy.toLocaleDateString() : 'N/A'}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => void handleStatusUpdate(entry.id, 'fulfilled')}
                              disabled={busy || entry.status === 'fulfilled'}
                              className="rounded-md p-2 text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Mark fulfilled"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleStatusUpdate(entry.id, 'cancelled')}
                              disabled={busy || entry.status === 'cancelled'}
                              className="rounded-md p-2 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Cancel"
                            >
                              <XCircle className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
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

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold flex items-center gap-2"><AlertTriangle className="h-4 w-4" />High-impact action notice</p>
        <p className="mt-1">Status actions here write directly to `bloodRequests` and are intended for admin emergency moderation only.</p>
      </div>
    </div>
  );
}

export default EmergencyRequestsPage;
