import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { deleteDoc, doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';
import { CMS_FRONTEND_PAGE_PRESETS, CMS_LIMITS, CMS_STATUS, getCmsPageDocId } from '../../../constants/cms';
import { CMS_FRONTEND_PAGE_DEFAULT_CONTENT } from '../../../constants/cmsPageDefaults';
import { ROUTES } from '../../../constants/routes';
import { toHumanCmsStatus } from '../../../constants/cmsHuman';
import { useAdminCmsPages } from '../../../hooks/admin/useAdminQueries';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { notify } from '../../../services/notify.service';
import { useAuth } from '../../../contexts/AuthContext';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { refetchQuery } from '../../../utils/queryRefetch';

export default function CmsPagesPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const pagesQuery = useAdminCmsPages();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [syncingSlug, setSyncingSlug] = useState<string | null>(null);
  const [syncingAll, setSyncingAll] = useState(false);

  const rows = useMemo(() => pagesQuery.data || [], [pagesQuery.data]);

  const syncPresetDefaults = async (preset: (typeof CMS_FRONTEND_PAGE_PRESETS)[number]) => {
    setSyncingSlug(preset.slug);
    try {
      const now = getServerTimestamp();
      const existingEntry = rows.find((entry) => entry.slug === preset.slug);
      const ref = doc(
        db,
        COLLECTIONS.CMS_PAGES,
        existingEntry?.id || getCmsPageDocId(preset.slug)
      );
      const existing = await getDoc(ref);
      const existingData = existing.exists() ? existing.data() : null;
      const createdAt = existingData?.createdAt || now;
      const createdBy = existingData?.createdBy || user?.uid || 'admin';
      const contentDefault = CMS_FRONTEND_PAGE_DEFAULT_CONTENT[preset.slug as keyof typeof CMS_FRONTEND_PAGE_DEFAULT_CONTENT];
      const contentJson = JSON.stringify(contentDefault, null, 2);
      if (contentJson.length > CMS_LIMITS.contentJson) {
        throw new Error(`Default content for ${preset.label} exceeds ${CMS_LIMITS.contentJson} characters.`);
      }
      const nextTitle = existingData?.title || preset.label;
      const nextStatus = existingData?.status || CMS_STATUS.draft;
      const canonicalDocId = getCmsPageDocId(preset.slug);
      const payload = {
        slug: preset.slug,
        title: nextTitle.slice(0, CMS_LIMITS.title),
        kind: preset.kind,
        status: nextStatus,
        excerpt: existingData?.excerpt || null,
        contentJson,
        publishedAt: nextStatus === CMS_STATUS.published ? (existingData?.publishedAt || now) : null,
        createdBy,
        updatedBy: user?.uid || 'admin',
        createdAt,
        updatedAt: now,
      };

      await setDoc(ref, payload, { merge: true });

      if (existingEntry?.id && existingEntry.id !== canonicalDocId) {
        const canonicalRef = doc(db, COLLECTIONS.CMS_PAGES, canonicalDocId);
        await setDoc(canonicalRef, payload, { merge: true });
        await deleteDoc(ref);
      }

      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      notify.success(`Synced defaults for ${preset.label}.`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : `Failed syncing ${preset.label}.`);
    } finally {
      setSyncingSlug(null);
    }
  };

  const syncAllDefaults = async () => {
    setSyncingAll(true);
    try {
      for (const preset of CMS_FRONTEND_PAGE_PRESETS) {
        await syncPresetDefaults(preset);
      }
      notify.success('Synced defaults for all frontend pages.');
    } finally {
      setSyncingAll(false);
    }
  };

  const removePage = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Delete this page from CMS?\n\nThis removes the page configuration and cannot be undone.')) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, COLLECTIONS.CMS_PAGES, id));
      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      notify.success('Page deleted.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to delete page.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">CMS Pages</h2>
            <p className="text-sm text-gray-600">Manage website pages in a human-friendly workflow.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.portal.admin.dashboard.cmsPageEditor.replace(':slug', 'new')}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              New Page
            </Link>
            <AdminRefreshButton onClick={() => refetchQuery(pagesQuery)} isRefreshing={pagesQuery.isFetching} label="Refresh pages" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-sm font-semibold text-gray-900">Manage Existing Frontend Routes</p>
          <button
            type="button"
            onClick={() => void syncAllDefaults()}
            disabled={syncingAll || Boolean(syncingSlug)}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {syncingAll ? 'Syncing...' : 'Sync All Defaults'}
          </button>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CMS_FRONTEND_PAGE_PRESETS.map((preset) => {
            const existing = rows.find((entry) => entry.slug === preset.slug);
            return (
              <div key={preset.key} className="rounded-xl border border-gray-200 px-3 py-2">
                <Link
                  to={ROUTES.portal.admin.dashboard.cmsPageEditor.replace(':slug', preset.slug)}
                  className="block w-full text-left hover:text-red-700"
                >
                  <div className="text-sm font-semibold text-gray-900">{preset.label}</div>
                  <div className="text-xs text-gray-500">{preset.path}</div>
                  <div className="mt-1 text-[11px] font-semibold text-red-700">
                    {existing ? `CMS: ${toHumanCmsStatus(existing.status)}` : 'CMS: Not created yet'}
                  </div>
                </Link>
                <button
                  type="button"
                  onClick={() => void syncPresetDefaults(preset)}
                  disabled={syncingSlug === preset.slug || syncingAll}
                  className="mt-2 rounded-md border border-red-200 px-2 py-1 text-[11px] font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                >
                  {syncingSlug === preset.slug ? 'Syncing...' : 'Sync Defaults'}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
              <tr>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Kind</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3 font-semibold text-gray-900">{entry.title}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.slug}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.kind}</td>
                  <td className="px-4 py-3 text-gray-700">{toHumanCmsStatus(entry.status)}</td>
                  <td className="px-4 py-3 text-right">
                    {CMS_FRONTEND_PAGE_PRESETS.some((preset) => preset.slug === entry.slug) ? (
                      <Link
                        to={`${CMS_FRONTEND_PAGE_PRESETS.find((preset) => preset.slug === entry.slug)?.path || ROUTES.home}?edit=1`}
                        target="_blank"
                        rel="noreferrer"
                        className="mr-2 rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50"
                      >
                        Visual
                      </Link>
                    ) : null}
                    <Link
                      to={ROUTES.portal.admin.dashboard.cmsPageEditor.replace(':slug', entry.slug || 'new')}
                      className="mr-2 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => void removePage(entry.id)}
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
