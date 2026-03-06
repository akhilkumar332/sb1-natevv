import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { CMS_MENU_LOCATION } from '../../../constants/cms';
import { ROUTES } from '../../../constants/routes';
import { useAdminCmsNavMenus } from '../../../hooks/admin/useAdminQueries';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { refetchQuery } from '../../../utils/queryRefetch';
import { toDateValue } from '../../../utils/dateValue';

export default function CmsMenusPage() {
  const menusQuery = useAdminCmsNavMenus();
  const rows = useMemo(() => menusQuery.data || [], [menusQuery.data]);
  const locations = Object.values(CMS_MENU_LOCATION);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">CMS Menus</h2>
            <p className="text-sm text-gray-600">Manage navigation payloads and open editor in a dedicated page.</p>
          </div>
          <AdminRefreshButton onClick={() => refetchQuery(menusQuery)} isRefreshing={menusQuery.isFetching} label="Refresh menus" />
        </div>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
        <p className="mb-2 text-sm font-semibold text-gray-900">Quick Edit Menu Locations</p>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {locations.map((location) => (
            <Link
              key={location}
              to={ROUTES.portal.admin.dashboard.cmsMenuEditor.replace(':location', location)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:border-red-300 hover:bg-red-50"
            >
              {location}
            </Link>
          ))}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
              <tr>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Items</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 font-semibold text-gray-900">{entry.location}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.status || 'published'}</td>
                  <td className="px-4 py-3 text-gray-700">{Array.isArray(entry.items) ? entry.items.length : 0}</td>
                  <td className="px-4 py-3 text-gray-700">{toDateValue(entry.updatedAt)?.toLocaleString() || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={ROUTES.portal.admin.dashboard.cmsMenuEditor.replace(':location', entry.location)}
                      className="rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
