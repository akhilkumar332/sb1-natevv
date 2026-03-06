import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';
import { CMS_STATUS } from '../../../constants/cms';
import { useAdminCmsMedia } from '../../../hooks/admin/useAdminQueries';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { notify } from '../../../services/notify.service';
import { useAuth } from '../../../contexts/AuthContext';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { refetchQuery } from '../../../utils/queryRefetch';

const statusOptions = Object.values(CMS_STATUS);

export default function CmsMediaPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mediaQuery = useAdminCmsMedia();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [status, setStatus] = useState<(typeof statusOptions)[number]>(CMS_STATUS.published);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => mediaQuery.data || [], [mediaQuery.data]);

  const saveMedia = async () => {
    const normalizedName = name.trim();
    const normalizedUrl = url.trim();
    if (!normalizedName || !normalizedUrl) {
      notify.error('Media name and URL are required.');
      return;
    }

    setSaving(true);
    try {
      const now = getServerTimestamp();
      await addDoc(collection(db, COLLECTIONS.CMS_MEDIA), {
        name: normalizedName,
        url: normalizedUrl,
        altText: altText.trim() || null,
        status,
        createdBy: user?.uid || 'admin',
        updatedBy: user?.uid || 'admin',
        createdAt: now,
        updatedAt: now,
      });
      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      notify.success('Media entry saved.');
      setName('');
      setUrl('');
      setAltText('');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to save media entry.');
    } finally {
      setSaving(false);
    }
  };

  const removeMedia = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Delete this media entry?')) return;
    try {
      await deleteDoc(doc(db, COLLECTIONS.CMS_MEDIA, id));
      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      notify.success('Media entry deleted.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to delete media entry.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">CMS Media</h2>
            <p className="text-sm text-gray-600">Manage media metadata references used by CMS content.</p>
          </div>
          <AdminRefreshButton onClick={() => refetchQuery(mediaQuery)} isRefreshing={mediaQuery.isFetching} label="Refresh media" />
        </div>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm grid gap-3 md:grid-cols-2">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Media name" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
        <input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Alt text" className="rounded-xl border border-gray-300 px-3 py-2 text-sm" />
        <select value={status} onChange={(event) => setStatus(event.target.value as (typeof statusOptions)[number])} className="rounded-xl border border-gray-300 px-3 py-2 text-sm">
          {statusOptions.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
        </select>
        <button type="button" onClick={() => void saveMedia()} disabled={saving} className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 md:col-span-2">
          {saving ? 'Saving...' : 'Save Media'}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 font-semibold text-gray-900">{entry.name}</td>
                  <td className="px-4 py-3 text-gray-700 max-w-[340px] truncate">{entry.url}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.status}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => void removeMedia(entry.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50">Delete</button>
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
