import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';
import { ROUTES } from '../../../constants/routes';
import { useAdminCmsBlogCategories } from '../../../hooks/admin/useAdminQueries';
import { notify } from '../../../services/notify.service';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { refetchQuery } from '../../../utils/queryRefetch';

export default function CmsCategoriesPage() {
  const queryClient = useQueryClient();
  const categoriesQuery = useAdminCmsBlogCategories();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const rows = useMemo(() => categoriesQuery.data || [], [categoriesQuery.data]);

  const removeCategory = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Delete this category?')) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, COLLECTIONS.CMS_BLOG_CATEGORIES, id));
      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      notify.success('Category deleted.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to delete category.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">CMS Categories</h2>
            <p className="text-sm text-gray-600">Manage categories and open editor in a dedicated page.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.portal.admin.dashboard.cmsCategoryEditor.replace(':slug', 'new')}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              New Category
            </Link>
            <AdminRefreshButton onClick={() => refetchQuery(categoriesQuery)} isRefreshing={categoriesQuery.isFetching} label="Refresh categories" />
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Color</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 font-semibold text-gray-900">{entry.name}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.slug}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.status}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.colorHex || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={ROUTES.portal.admin.dashboard.cmsCategoryEditor.replace(':slug', entry.slug || 'new')}
                      className="mr-2 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => void removeCategory(entry.id)}
                      disabled={deletingId === entry.id}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
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
