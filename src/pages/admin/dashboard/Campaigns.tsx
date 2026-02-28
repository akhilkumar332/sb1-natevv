import { useEffect, useMemo, useState } from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';
import { notify } from 'services/notify.service';
import { useQueryClient } from '@tanstack/react-query';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { toDateValue } from '../../../utils/dateValue';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { useAdminCampaigns } from '../../../hooks/admin/useAdminQueries';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';

type CampaignRow = {
  id: string;
  title: string;
  ngoId: string;
  status: string;
  type: string;
  target: number;
  achieved: number;
  city?: string;
  state?: string;
  startDate?: Date;
  endDate?: Date;
};

type StatusFilter = 'all' | 'draft' | 'upcoming' | 'active' | 'completed' | 'cancelled';

function CampaignsPage() {
  const queryClient = useQueryClient();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const campaignsQuery = useAdminCampaigns(1000);
  const loading = campaignsQuery.isLoading;
  const error = campaignsQuery.error instanceof Error ? campaignsQuery.error.message : null;

  useEffect(() => {
    const rows = (campaignsQuery.data || []).map((entry) => ({
      id: entry.id || '',
      title: entry.title || entry.name || 'Campaign',
      ngoId: entry.ngoId || '-',
      status: entry.status || 'draft',
      type: entry.type || 'blood-drive',
      target: Number(entry.target || entry.targetDonors || 0),
      achieved: Number(entry.achieved || 0),
      city: entry.city || (entry.location as any)?.city,
      state: entry.state || (entry.location as any)?.state,
      startDate: toDateValue(entry.startDate),
      endDate: toDateValue(entry.endDate),
    })) as CampaignRow[];
    setCampaigns(rows.filter((entry) => Boolean(entry.id)));
  }, [campaignsQuery.data]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, pageSize]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return campaigns.filter((campaign) => {
      if (statusFilter !== 'all' && campaign.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = [
        campaign.title,
        campaign.ngoId,
        campaign.type,
        campaign.status,
        campaign.city,
        campaign.state,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [campaigns, searchTerm, statusFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const hasNextPage = page * pageSize < filtered.length;

  const handleStatusUpdate = async (campaignId: string, nextStatus: 'active' | 'completed' | 'cancelled') => {
    setProcessingId(campaignId);
    try {
      await updateDoc(doc(db, 'campaigns', campaignId), {
        status: nextStatus,
        updatedAt: getServerTimestamp(),
      });
      notify.success(`Campaign marked ${nextStatus}`);
      await invalidateAdminRecipe(queryClient, 'campaignStatusUpdated');
    } catch (updateError: any) {
      notify.error(updateError?.message || 'Failed to update campaign status.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Campaign Management</h2>
            <p className="text-sm text-gray-600">Manage campaign lifecycle across NGOs and partner organizations.</p>
          </div>
          <AdminRefreshButton
            onClick={() => void campaignsQuery.refetch()}
            isRefreshing={campaignsQuery.isFetching}
            label="Refresh campaigns"
          />
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search by campaign name, ngo id, location, type"
        leftContent={
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">All statuses</option>
            <option value="draft">Draft</option>
            <option value="upcoming">Upcoming</option>
            <option value="active">Active</option>
            <option value="completed">Completed</option>
            <option value="cancelled">Cancelled</option>
          </select>
        }
        rightContent={<span className="text-xs font-semibold text-gray-500">{filtered.length} campaigns</span>}
      />

      <AdminRefreshingBanner show={loading} message="Refreshing campaigns..." />
      <AdminErrorCard message={error} onRetry={() => void campaignsQuery.refetch()} />

      {paged.length === 0 ? (
        <AdminEmptyStateCard message="No campaigns found." />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {paged.map((campaign) => {
              const busy = processingId === campaign.id;
              return (
                <article key={`mobile-${campaign.id}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-semibold text-gray-900">{campaign.title}</p>
                      <p className="text-xs text-gray-500">{campaign.city || 'N/A'}{campaign.state ? `, ${campaign.state}` : ''}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 capitalize">{campaign.status}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <p>NGO: <span className="font-semibold text-gray-800">{campaign.ngoId}</span></p>
                    <p>Type: <span className="font-semibold text-gray-800 capitalize">{campaign.type}</span></p>
                    <p>Progress: <span className="font-semibold text-gray-800">{campaign.achieved} / {campaign.target}</span></p>
                    <p>
                      Schedule:
                      <span className="font-semibold text-gray-800"> {campaign.startDate ? campaign.startDate.toLocaleDateString() : 'N/A'} - {campaign.endDate ? campaign.endDate.toLocaleDateString() : 'N/A'}</span>
                    </p>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => void handleStatusUpdate(campaign.id, 'active')}
                      disabled={busy || campaign.status === 'active'}
                      className="rounded-md border border-emerald-200 px-2 py-2 text-xs font-semibold text-emerald-700 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Active
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatusUpdate(campaign.id, 'completed')}
                      disabled={busy || campaign.status === 'completed'}
                      className="rounded-md border border-red-200 px-2 py-2 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Complete
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleStatusUpdate(campaign.id, 'cancelled')}
                      disabled={busy || campaign.status === 'cancelled'}
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
                    <th className="px-4 py-3">Campaign</th>
                    <th className="px-4 py-3">NGO</th>
                    <th className="px-4 py-3">Type</th>
                    <th className="px-4 py-3">Progress</th>
                    <th className="px-4 py-3">Schedule</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((campaign) => {
                    const busy = processingId === campaign.id;
                    return (
                      <tr key={campaign.id} className="hover:bg-red-50/40">
                        <td className="px-4 py-3">
                          <p className="font-semibold text-gray-900">{campaign.title}</p>
                          <p className="text-xs text-gray-500">{campaign.city || 'N/A'}{campaign.state ? `, ${campaign.state}` : ''}</p>
                        </td>
                        <td className="px-4 py-3 text-gray-700">{campaign.ngoId}</td>
                        <td className="px-4 py-3 text-gray-700 capitalize">{campaign.type}</td>
                        <td className="px-4 py-3 text-gray-700">{campaign.achieved} / {campaign.target}</td>
                        <td className="px-4 py-3 text-gray-600 text-xs">
                          {campaign.startDate ? campaign.startDate.toLocaleDateString() : 'N/A'}
                          {' - '}
                          {campaign.endDate ? campaign.endDate.toLocaleDateString() : 'N/A'}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-700 capitalize">{campaign.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => void handleStatusUpdate(campaign.id, 'active')}
                              disabled={busy || campaign.status === 'active'}
                              className="rounded-md p-2 text-emerald-700 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Set active"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleStatusUpdate(campaign.id, 'completed')}
                              disabled={busy || campaign.status === 'completed'}
                              className="rounded-md p-2 text-red-700 hover:bg-red-100 disabled:cursor-not-allowed disabled:opacity-50"
                              title="Set completed"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleStatusUpdate(campaign.id, 'cancelled')}
                              disabled={busy || campaign.status === 'cancelled'}
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
    </div>
  );
}

export default CampaignsPage;
