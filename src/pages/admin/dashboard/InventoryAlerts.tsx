import { useEffect, useMemo, useState } from 'react';
import { PackageOpen } from 'lucide-react';
import type { BloodInventory } from '../../../types/database.types';
import { toDateValue } from '../../../utils/dateValue';
import AdminListToolbar from '../../../components/admin/AdminListToolbar';
import AdminPagination from '../../../components/admin/AdminPagination';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { AdminEmptyStateCard, AdminErrorCard, AdminRefreshingBanner } from '../../../components/admin/AdminAsyncState';
import { useAdminInventoryAlerts } from '../../../hooks/admin/useAdminQueries';

type StatusFilter = 'all' | 'critical' | 'low' | 'adequate' | 'surplus';

type InventoryRow = {
  id: string;
  hospitalId: string;
  branchId?: string;
  bloodType: string;
  units: number;
  status: string;
  criticalLevel: number;
  lowLevel: number;
  updatedAt?: Date;
};

function InventoryAlertsPage() {
  const [items, setItems] = useState<InventoryRow[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const inventoryQuery = useAdminInventoryAlerts();
  const loading = inventoryQuery.isLoading;
  const error = inventoryQuery.error instanceof Error ? inventoryQuery.error.message : null;

  useEffect(() => {
    const data = inventoryQuery.data || [];
    const mapped = data.map((entry: BloodInventory) => ({
      id: entry.id || '',
      hospitalId: entry.hospitalId,
      branchId: entry.branchId,
      bloodType: entry.bloodType,
      units: entry.units || 0,
      status: entry.status || 'adequate',
      criticalLevel: entry.criticalLevel || 0,
      lowLevel: entry.lowLevel || 0,
      updatedAt: toDateValue(entry.updatedAt),
    }));
    setItems(mapped.filter((entry) => Boolean(entry.id)));
  }, [inventoryQuery.data]);

  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, pageSize]);

  const filtered = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    return items.filter((entry) => {
      if (statusFilter !== 'all' && entry.status !== statusFilter) return false;
      if (!term) return true;
      const haystack = [entry.hospitalId, entry.branchId, entry.bloodType, entry.status]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return haystack.includes(term);
    });
  }, [items, searchTerm, statusFilter]);

  const paged = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const hasNextPage = page * pageSize < filtered.length;

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Inventory Alerts</h2>
            <p className="text-sm text-gray-600">Monitor low and critical stock across all blood banks and branches.</p>
          </div>
          <AdminRefreshButton
            onClick={() => void inventoryQuery.refetch()}
            isRefreshing={inventoryQuery.isFetching}
            label="Refresh inventory alerts"
          />
        </div>
      </div>

      <AdminListToolbar
        searchTerm={searchTerm}
        onSearchTermChange={setSearchTerm}
        searchPlaceholder="Search by hospital id, branch id, blood type"
        leftContent={
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value as StatusFilter)}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-700"
          >
            <option value="all">All statuses</option>
            <option value="critical">Critical</option>
            <option value="low">Low</option>
            <option value="adequate">Adequate</option>
            <option value="surplus">Surplus</option>
          </select>
        }
        rightContent={<span className="text-xs font-semibold text-gray-500">{filtered.length} alerts</span>}
      />

      <AdminRefreshingBanner show={loading} message="Refreshing inventory alerts..." />
      <AdminErrorCard message={error} onRetry={() => void inventoryQuery.refetch()} />

      {paged.length === 0 ? (
        <AdminEmptyStateCard message="No inventory alerts found." />
      ) : (
        <>
          <div className="space-y-3 lg:hidden">
            {paged.map((entry) => (
              <article key={`mobile-${entry.id}`} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold text-gray-900">{entry.hospitalId}</p>
                    <p className="text-xs text-gray-500">Branch: {entry.branchId || 'Main'}</p>
                  </div>
                  <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${
                    entry.status === 'critical'
                      ? 'bg-red-100 text-red-700'
                      : entry.status === 'low'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-emerald-100 text-emerald-700'
                  }`}>
                    {entry.status}
                  </span>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-gray-600">
                  <p>Blood: <span className="font-semibold text-red-700">{entry.bloodType}</span></p>
                  <p>Units: <span className="font-semibold text-gray-800">{entry.units}</span></p>
                  <p className="col-span-2">Thresholds: <span className="font-semibold text-gray-800">Low {entry.lowLevel} • Critical {entry.criticalLevel}</span></p>
                  <p className="col-span-2">Updated: <span className="font-semibold text-gray-800">{entry.updatedAt ? entry.updatedAt.toLocaleString() : 'N/A'}</span></p>
                </div>
              </article>
            ))}
          </div>

          <div className="hidden overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm lg:block">
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
                  <tr>
                    <th className="px-4 py-3">Hospital</th>
                    <th className="px-4 py-3">Branch</th>
                    <th className="px-4 py-3">Blood Type</th>
                    <th className="px-4 py-3">Units</th>
                    <th className="px-4 py-3">Thresholds</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {paged.map((entry) => (
                    <tr key={entry.id} className="hover:bg-red-50/40">
                      <td className="px-4 py-3 text-gray-700 font-semibold">{entry.hospitalId}</td>
                      <td className="px-4 py-3 text-gray-600">{entry.branchId || 'Main'}</td>
                      <td className="px-4 py-3 text-red-700 font-semibold">{entry.bloodType}</td>
                      <td className="px-4 py-3 text-gray-700">{entry.units}</td>
                      <td className="px-4 py-3 text-gray-600 text-xs">Low: {entry.lowLevel} • Critical: {entry.criticalLevel}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-1 text-xs font-semibold capitalize ${
                          entry.status === 'critical'
                            ? 'bg-red-100 text-red-700'
                            : entry.status === 'low'
                              ? 'bg-amber-100 text-amber-700'
                              : 'bg-emerald-100 text-emerald-700'
                        }`}>
                          {entry.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{entry.updatedAt ? entry.updatedAt.toLocaleString() : 'N/A'}</td>
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

      <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        <p className="font-semibold flex items-center gap-2"><PackageOpen className="h-4 w-4" />Operational note</p>
        <p className="mt-1">Inventory alerts are read from low/critical `bloodInventory` documents and should be reviewed alongside branch-level stock updates.</p>
      </div>
    </div>
  );
}

export default InventoryAlertsPage;
