import { useMemo, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { addDoc, collection, deleteDoc, doc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';
import { CMS_STATUS } from '../../../constants/cms';
import { toHumanCmsStatus } from '../../../constants/cmsHuman';
import { useAdminCmsBlogPosts, useAdminCmsMedia, useAdminCmsPages } from '../../../hooks/admin/useAdminQueries';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { notify } from '../../../services/notify.service';
import { useAuth } from '../../../contexts/AuthContext';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { refetchQuery } from '../../../utils/queryRefetch';
import { extractMediaUrlReferences, normalizeMediaUrlKey } from '../../../utils/cmsMediaUsage';

const statusOptions = Object.values(CMS_STATUS);

export default function CmsMediaPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const mediaQuery = useAdminCmsMedia();
  const pagesQuery = useAdminCmsPages();
  const postsQuery = useAdminCmsBlogPosts();

  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [altText, setAltText] = useState('');
  const [status, setStatus] = useState<(typeof statusOptions)[number]>(CMS_STATUS.published);
  const [saving, setSaving] = useState(false);

  const rows = useMemo(() => mediaQuery.data || [], [mediaQuery.data]);
  const usageByUrl = useMemo(() => {
    const map = new Map<string, number>();
    const mediaUrlKeys = new Set(
      rows
        .map((entry) => normalizeMediaUrlKey(entry.url))
        .filter(Boolean)
    );

    const bump = (candidate?: string | null) => {
      const key = normalizeMediaUrlKey(candidate);
      if (!key) return;
      map.set(key, (map.get(key) || 0) + 1);
    };

    (pagesQuery.data || []).forEach((page) => {
      const pageRefs = new Set<string>();
      bump(page.coverImageUrl);
      bump(page.ogImageUrl);
      bump(page.twitterImageUrl);
      extractMediaUrlReferences(typeof page.contentJson === 'string' ? page.contentJson : '').forEach((ref) => {
        if (mediaUrlKeys.has(ref)) pageRefs.add(ref);
      });
      pageRefs.forEach((ref) => bump(ref));
    });

    (postsQuery.data || []).forEach((post) => {
      const postRefs = new Set<string>();
      bump(post.coverImageUrl);
      bump(post.ogImageUrl);
      bump(post.twitterImageUrl);
      extractMediaUrlReferences(typeof post.contentJson === 'string' ? post.contentJson : '').forEach((ref) => {
        if (mediaUrlKeys.has(ref)) postRefs.add(ref);
      });
      postRefs.forEach((ref) => bump(ref));
    });

    return map;
  }, [pagesQuery.data, postsQuery.data, rows]);

  const saveMedia = async () => {
    const normalizedName = name.trim();
    const normalizedUrl = url.trim();
    const normalizedUrlKey = normalizeMediaUrlKey(normalizedUrl);
    if (!normalizedName || !normalizedUrl) {
      notify.error('Media name and URL are required.');
      return;
    }
    if (!/^https?:\/\/\S+$/i.test(normalizedUrl) && !normalizedUrl.startsWith('/')) {
      notify.error('Media URL must start with https://, http://, or /.');
      return;
    }
    if (!altText.trim()) {
      notify.error('Alt text is required for accessibility and SEO.');
      return;
    }
    if (rows.some((entry) => normalizeMediaUrlKey(entry.url) === normalizedUrlKey)) {
      notify.error('A media entry with this URL already exists.');
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
    const target = rows.find((entry) => entry.id === id);
    if (!target) return;
    const usageCount = usageByUrl.get(normalizeMediaUrlKey(target.url)) || 0;
    if (usageCount > 0) {
      notify.error(`This media is used ${usageCount} time(s) in pages/posts. Remove references before deleting.`);
      return;
    }
    if (!window.confirm('Delete this media entry?\n\nMake sure no content relies on it before continuing.')) return;
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
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900 dark:text-slate-100">CMS Media</h2>
            <p className="text-sm text-gray-600 dark:text-slate-300">Manage media records used across pages and posts.</p>
          </div>
          <AdminRefreshButton onClick={() => refetchQuery(mediaQuery)} isRefreshing={mediaQuery.isFetching} label="Refresh media" />
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-red-100 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900 md:grid-cols-2">
        <input value={name} onChange={(event) => setName(event.target.value)} placeholder="Media name" className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
        <input value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://..." className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
        <input value={altText} onChange={(event) => setAltText(event.target.value)} placeholder="Alt text" className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder:text-slate-500" />
        <select value={status} onChange={(event) => setStatus(event.target.value as (typeof statusOptions)[number])} className="rounded-xl border border-gray-300 px-3 py-2 text-sm text-gray-900 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100">
          {statusOptions.map((entry) => <option key={entry} value={entry}>{toHumanCmsStatus(entry)}</option>)}
        </select>
        <button type="button" onClick={() => void saveMedia()} disabled={saving} className="rounded-lg border border-red-600 bg-red-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 dark:border-red-500 dark:bg-red-500 dark:hover:bg-red-400 md:col-span-2">
          {saving ? 'Saving...' : 'Save Media'}
        </button>
      </div>

      <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800 dark:bg-red-950/30 dark:text-red-300">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">URL</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Usage</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-slate-800">
              {rows.map((entry) => (
                <tr key={entry.id} className="hover:bg-red-50/40 dark:hover:bg-slate-800/70">
                  <td className="px-4 py-3 font-semibold text-gray-900 dark:text-slate-100">{entry.name}</td>
                  <td className="max-w-[340px] truncate px-4 py-3 text-gray-700 dark:text-slate-300">{entry.url}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{toHumanCmsStatus(entry.status)}</td>
                  <td className="px-4 py-3 text-gray-700 dark:text-slate-300">{usageByUrl.get(normalizeMediaUrlKey(entry.url)) || 0}</td>
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => void removeMedia(entry.id)} className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 dark:border-red-900/40 dark:text-red-300 dark:hover:bg-red-950/40">Delete</button>
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
