import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';
import { CMS_REVIEW_STATUS, CMS_STATUS } from '../../../constants/cms';
import { toHumanCmsStatus } from '../../../constants/cmsHuman';
import { ROUTES } from '../../../constants/routes';
import { useAdminCmsBlogPosts } from '../../../hooks/admin/useAdminQueries';
import { notify } from '../../../services/notify.service';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import AdminRefreshButton from '../../../components/admin/AdminRefreshButton';
import { refetchQuery } from '../../../utils/queryRefetch';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { useAuth } from '../../../contexts/AuthContext';
import { toDateValue } from '../../../utils/dateValue';
import { toCmsBlogSummaryPayload } from '../../../utils/cmsBlogSummary';

const PAGE_SIZE = 12;
const FILTER_STORAGE_KEY = 'cms_blog_posts_filters_v1';
const toHumanLabel = (value: string) => value
  .split(/[-_]/g)
  .map((part) => part.trim())
  .filter(Boolean)
  .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
  .join(' ');

export default function CmsBlogPostsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const postsQuery = useAdminCmsBlogPosts();

  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMutating, setBulkMutating] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | (typeof CMS_STATUS)[keyof typeof CMS_STATUS]>('all');
  const [categoryFilter, setCategoryFilter] = useState<'all' | string>('all');
  const [tagFilter, setTagFilter] = useState<'all' | string>('all');
  const [seriesFilter, setSeriesFilter] = useState<'all' | string>('all');
  const [page, setPage] = useState(1);
  const [activeQueue, setActiveQueue] = useState<'all' | 'needs-review' | 'ready-publish' | 'scheduled' | 'seo-fix'>('all');
  const [filtersHydrated, setFiltersHydrated] = useState(false);

  const rows = useMemo(() => postsQuery.data || [], [postsQuery.data]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((entry) => {
      if (entry.categorySlug) set.add(entry.categorySlug);
    });
    return Array.from(set).sort();
  }, [rows]);
  const tags = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((entry) => (entry.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [rows]);
  const series = useMemo(() => {
    const set = new Set<string>();
    rows.forEach((entry) => {
      if (entry.seriesSlug) set.add(entry.seriesSlug);
    });
    return Array.from(set).sort();
  }, [rows]);

  const filteredRows = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return rows.filter((entry) => {
      const hasWeakSeo = (entry.seoTitle || '').trim().length < 30
        || (entry.seoDescription || '').trim().length < 80
        || !(entry.coverImageUrl || '').trim()
        || !(entry.excerpt || '').trim();
      const hasSchedule = Boolean(toDateValue(entry.scheduledPublishAt));
      const matchesQueue = activeQueue === 'all'
        || (activeQueue === 'needs-review' && entry.reviewStatus === CMS_REVIEW_STATUS.inReview)
        || (activeQueue === 'ready-publish' && entry.reviewStatus === CMS_REVIEW_STATUS.approved && entry.status !== CMS_STATUS.published)
        || (activeQueue === 'scheduled' && hasSchedule)
        || (activeQueue === 'seo-fix' && hasWeakSeo);
      const matchesQuery = !query
        || entry.title.toLowerCase().includes(query)
        || entry.slug.toLowerCase().includes(query)
        || (entry.categorySlug || '').toLowerCase().includes(query);
      const matchesStatus = statusFilter === 'all' || entry.status === statusFilter;
      const matchesCategory = categoryFilter === 'all' || entry.categorySlug === categoryFilter;
      const matchesTag = tagFilter === 'all' || (entry.tags || []).includes(tagFilter);
      const matchesSeries = seriesFilter === 'all' || entry.seriesSlug === seriesFilter;
      return matchesQueue && matchesQuery && matchesStatus && matchesCategory && matchesTag && matchesSeries;
    });
  }, [rows, activeQueue, searchTerm, statusFilter, categoryFilter, tagFilter, seriesFilter]);

  const queueCounts = useMemo(() => {
    const needsReview = rows.filter((entry) => entry.reviewStatus === CMS_REVIEW_STATUS.inReview).length;
    const readyPublish = rows.filter((entry) => entry.reviewStatus === CMS_REVIEW_STATUS.approved && entry.status !== CMS_STATUS.published).length;
    const scheduled = rows.filter((entry) => Boolean(toDateValue(entry.scheduledPublishAt))).length;
    const seoFix = rows.filter((entry) => {
      const weakSeo = (entry.seoTitle || '').trim().length < 30
        || (entry.seoDescription || '').trim().length < 80
        || !(entry.coverImageUrl || '').trim()
        || !(entry.excerpt || '').trim();
      return weakSeo;
    }).length;
    return { needsReview, readyPublish, scheduled, seoFix };
  }, [rows]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pagedRows = useMemo(() => {
    const start = (currentPage - 1) * PAGE_SIZE;
    return filteredRows.slice(start, start + PAGE_SIZE);
  }, [filteredRows, currentPage]);

  const filteredIds = useMemo(
    () => filteredRows.map((entry) => entry.id).filter((id): id is string => Boolean(id)),
    [filteredRows]
  );
  const selectedRows = useMemo(() => rows.filter((entry) => entry.id && selectedIds.has(entry.id)), [rows, selectedIds]);
  const selectedCount = selectedIds.size;
  const areAllFilteredSelected = filteredIds.length > 0 && filteredIds.every((id) => selectedIds.has(id));
  const selectedPublishedCount = selectedRows.filter((entry) => entry.status === CMS_STATUS.published).length;
  const selectedDraftCount = selectedRows.filter((entry) => entry.status === CMS_STATUS.draft).length;
  const selectedScheduledCount = selectedRows.filter((entry) => Boolean(toDateValue(entry.scheduledPublishAt))).length;

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem(FILTER_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as Record<string, unknown>;
      if (typeof parsed.searchTerm === 'string') setSearchTerm(parsed.searchTerm);
      if (parsed.statusFilter === 'all' || Object.values(CMS_STATUS).includes(parsed.statusFilter as (typeof CMS_STATUS)[keyof typeof CMS_STATUS])) {
        setStatusFilter(parsed.statusFilter as 'all' | (typeof CMS_STATUS)[keyof typeof CMS_STATUS]);
      }
      if (typeof parsed.categoryFilter === 'string') setCategoryFilter(parsed.categoryFilter || 'all');
      if (typeof parsed.tagFilter === 'string') setTagFilter(parsed.tagFilter || 'all');
      if (typeof parsed.seriesFilter === 'string') setSeriesFilter(parsed.seriesFilter || 'all');
      if (parsed.activeQueue === 'all' || parsed.activeQueue === 'needs-review' || parsed.activeQueue === 'ready-publish' || parsed.activeQueue === 'scheduled' || parsed.activeQueue === 'seo-fix') {
        setActiveQueue(parsed.activeQueue);
      }
    } catch {
      // ignore storage parsing errors
    }
    setFiltersHydrated(true);
  }, []);

  useEffect(() => {
    if (!filtersHydrated || typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify({
        searchTerm,
        statusFilter,
        categoryFilter,
        tagFilter,
        seriesFilter,
        activeQueue,
      }));
    } catch {
      // ignore storage write errors
    }
  }, [filtersHydrated, searchTerm, statusFilter, categoryFilter, tagFilter, seriesFilter, activeQueue]);

  useEffect(() => {
    if (categoryFilter !== 'all' && !categories.includes(categoryFilter)) {
      setCategoryFilter('all');
      setPage(1);
    }
  }, [categoryFilter, categories]);

  useEffect(() => {
    if (tagFilter !== 'all' && !tags.includes(tagFilter)) {
      setTagFilter('all');
      setPage(1);
    }
  }, [tagFilter, tags]);

  useEffect(() => {
    if (seriesFilter !== 'all' && !series.includes(seriesFilter)) {
      setSeriesFilter('all');
      setPage(1);
    }
  }, [seriesFilter, series]);

  const toggleSelected = (id?: string) => {
    if (!id) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAllFiltered = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (areAllFilteredSelected) {
        filteredIds.forEach((id) => next.delete(id));
      } else {
        filteredIds.forEach((id) => next.add(id));
      }
      return next;
    });
  };

  const removePost = async (id?: string) => {
    if (!id) return;
    if (!window.confirm('Delete this blog post?\n\nThis permanently removes the post and its summary.')) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, COLLECTIONS.CMS_BLOG_POSTS, id));
      await deleteDoc(doc(db, COLLECTIONS.CMS_BLOG_POST_SUMMARIES, id));
      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      setSelectedIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      notify.success('Post deleted.');
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to delete post.');
    } finally {
      setDeletingId(null);
    }
  };

  const updateSelectedStatus = async (nextStatus: (typeof CMS_STATUS)[keyof typeof CMS_STATUS]) => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      notify.error('Select at least one post.');
      return;
    }
    if (!window.confirm(`Update ${ids.length} selected posts to "${toHumanCmsStatus(nextStatus)}"?`)) return;

    setBulkMutating(true);
    try {
      const now = getServerTimestamp();
      await Promise.all(ids.map(async (id) => {
        const entry = rows.find((item) => item.id === id);
        if (!entry) return;
        await setDoc(doc(db, COLLECTIONS.CMS_BLOG_POSTS, id), {
          status: nextStatus,
          publishedAt: nextStatus === CMS_STATUS.published ? (entry.publishedAt || now) : null,
          updatedBy: user?.uid || 'admin',
          updatedAt: now,
        }, { merge: true });
        await setDoc(doc(db, COLLECTIONS.CMS_BLOG_POST_SUMMARIES, id), {
          ...toCmsBlogSummaryPayload({
            ...entry,
            status: nextStatus,
            publishedAt: nextStatus === CMS_STATUS.published ? (entry.publishedAt || now) : null,
            updatedBy: user?.uid || 'admin',
            updatedAt: now,
          }),
        }, { merge: true });
      }));
      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      setSelectedIds(new Set());
      notify.success(`Updated ${ids.length} posts.`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to update selected posts.');
    } finally {
      setBulkMutating(false);
    }
  };

  const deleteSelected = async () => {
    const ids = [...selectedIds];
    if (ids.length === 0) {
      notify.error('Select at least one post.');
      return;
    }
    if (!window.confirm(`Delete ${ids.length} selected posts?\n\nThis cannot be undone.`)) return;

    setBulkMutating(true);
    try {
      await Promise.all(ids.map(async (id) => {
        await deleteDoc(doc(db, COLLECTIONS.CMS_BLOG_POSTS, id));
        await deleteDoc(doc(db, COLLECTIONS.CMS_BLOG_POST_SUMMARIES, id));
      }));
      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      setSelectedIds(new Set());
      notify.success(`Deleted ${ids.length} posts.`);
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to delete selected posts.');
    } finally {
      setBulkMutating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">CMS Blog Posts</h2>
            <p className="text-sm text-gray-600">Manage articles with a clear publish workflow.</p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              to={ROUTES.portal.admin.dashboard.cmsBlogPostEditor.replace(':slug', 'new')}
              className="rounded-lg border border-red-200 px-3 py-2 text-sm font-semibold text-red-700 hover:bg-red-50"
            >
              New Post
            </Link>
            <AdminRefreshButton onClick={() => refetchQuery(postsQuery)} isRefreshing={postsQuery.isFetching} label="Refresh posts" />
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          <button type="button" onClick={() => { setActiveQueue('all'); setPage(1); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${activeQueue === 'all' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 text-gray-700'}`}>All ({rows.length})</button>
          <button type="button" onClick={() => { setActiveQueue('needs-review'); setPage(1); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${activeQueue === 'needs-review' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 text-gray-700'}`}>Needs Review ({queueCounts.needsReview})</button>
          <button type="button" onClick={() => { setActiveQueue('ready-publish'); setPage(1); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${activeQueue === 'ready-publish' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 text-gray-700'}`}>Ready To Publish ({queueCounts.readyPublish})</button>
          <button type="button" onClick={() => { setActiveQueue('scheduled'); setPage(1); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${activeQueue === 'scheduled' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 text-gray-700'}`}>Scheduled ({queueCounts.scheduled})</button>
          <button type="button" onClick={() => { setActiveQueue('seo-fix'); setPage(1); }} className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${activeQueue === 'seo-fix' ? 'border-red-600 bg-red-600 text-white' : 'border-gray-300 text-gray-700'}`}>SEO Needs Fix ({queueCounts.seoFix})</button>
        </div>
        <div className="grid gap-2 md:grid-cols-6">
          <input
            value={searchTerm}
            onChange={(event) => {
              setSearchTerm(event.target.value);
              setPage(1);
            }}
            placeholder="Search title, slug, category"
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          />
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as typeof statusFilter);
              setPage(1);
            }}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All statuses</option>
            {Object.values(CMS_STATUS).map((status) => (
              <option key={status} value={status}>{toHumanCmsStatus(status)}</option>
            ))}
          </select>
          <select
            value={categoryFilter}
            onChange={(event) => {
              setCategoryFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All categories</option>
            {categories.map((category) => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
          <select
            value={tagFilter}
            onChange={(event) => {
              setTagFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All tags</option>
            {tags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
          <select
            value={seriesFilter}
            onChange={(event) => {
              setSeriesFilter(event.target.value);
              setPage(1);
            }}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All series</option>
            {series.map((seriesSlug) => (
              <option key={seriesSlug} value={seriesSlug}>{seriesSlug}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => {
              setSearchTerm('');
              setStatusFilter('all');
              setCategoryFilter('all');
              setTagFilter('all');
              setSeriesFilter('all');
              setActiveQueue('all');
              setPage(1);
            }}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
          >
            Reset Filters
          </button>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => void updateSelectedStatus(CMS_STATUS.published)}
            disabled={bulkMutating || selectedCount === 0}
            className="rounded-md border border-green-300 px-2.5 py-1.5 text-xs font-semibold text-green-700 disabled:opacity-50"
          >
            Publish Selected ({selectedCount})
          </button>
          <button
            type="button"
            onClick={() => void updateSelectedStatus(CMS_STATUS.draft)}
            disabled={bulkMutating || selectedCount === 0}
            className="rounded-md border border-amber-300 px-2.5 py-1.5 text-xs font-semibold text-amber-700 disabled:opacity-50"
          >
            Move To Draft
          </button>
          <button
            type="button"
            onClick={() => void updateSelectedStatus(CMS_STATUS.archived)}
            disabled={bulkMutating || selectedCount === 0}
            className="rounded-md border border-gray-300 px-2.5 py-1.5 text-xs font-semibold text-gray-700 disabled:opacity-50"
          >
            Hide Selected
          </button>
          <button
            type="button"
            onClick={() => void deleteSelected()}
            disabled={bulkMutating || selectedCount === 0}
            className="rounded-md border border-red-300 px-2.5 py-1.5 text-xs font-semibold text-red-700 disabled:opacity-50"
          >
            Delete Selected
          </button>
          <span className="text-xs text-gray-500">Filtered: {filteredRows.length}</span>
          {selectedCount > 0 ? (
            <span className="text-xs text-gray-500">
              Selected impact: {selectedPublishedCount} published, {selectedDraftCount} drafts, {selectedScheduledCount} scheduled
            </span>
          ) : null}
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-red-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="bg-red-50 text-left text-xs uppercase tracking-[0.12em] text-red-800">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={areAllFilteredSelected}
                    onChange={toggleSelectAllFiltered}
                    aria-label="Select all filtered"
                  />
                </th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Slug</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Published</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pagedRows.map((entry) => (
                <tr key={entry.id}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={Boolean(entry.id && selectedIds.has(entry.id))}
                      onChange={() => toggleSelected(entry.id)}
                      aria-label={`Select ${entry.title}`}
                    />
                  </td>
                  <td className="px-4 py-3 font-semibold text-gray-900">{entry.title}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.slug}</td>
                  <td className="px-4 py-3 text-gray-700">{entry.categorySlug ? toHumanLabel(entry.categorySlug) : '-'}</td>
                  <td className="px-4 py-3 text-gray-700">{toHumanCmsStatus(entry.status)}</td>
                  <td className="px-4 py-3 text-gray-700">{toDateValue(entry.publishedAt)?.toLocaleString() || '-'}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      to={ROUTES.portal.admin.dashboard.cmsBlogPostEditor.replace(':slug', entry.slug || 'new')}
                      className="mr-2 rounded-md border border-gray-300 px-2 py-1 text-xs font-semibold text-gray-700 hover:bg-gray-50"
                    >
                      Edit
                    </Link>
                    <button
                      type="button"
                      onClick={() => void removePost(entry.id)}
                      disabled={deletingId === entry.id || bulkMutating}
                      className="rounded-md border border-red-200 px-2 py-1 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-sm text-gray-500">No posts found for selected filters.</td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center justify-between rounded-2xl border border-red-100 bg-white px-4 py-3 text-sm shadow-sm">
        <p className="text-gray-600">Page {currentPage} of {totalPages}</p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={currentPage <= 1}
            className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={currentPage >= totalPages}
            className="rounded-md border border-gray-300 px-3 py-1.5 font-semibold text-gray-700 disabled:opacity-50"
          >
            Next
          </button>
        </div>
      </div>
    </div>
  );
}
