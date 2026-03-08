import { FileImage, FileText, Newspaper, Settings, Tags } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../../../firebase';
import { COLLECTIONS } from '../../../constants/firestore';
import { ROUTES } from '../../../constants/routes';
import { CMS_FRONTEND_PAGE_PRESETS, CMS_RUNTIME, CMS_STATUS } from '../../../constants/cms';
import {
  useAdminCmsBlogCategories,
  useAdminCmsBlogPosts,
  useAdminCmsMedia,
  useAdminCmsPages,
  useAdminCmsSettings,
} from '../../../hooks/admin/useAdminQueries';
import { toDateValue } from '../../../utils/dateValue';
import { getServerTimestamp } from '../../../utils/firestore.utils';
import { invalidateAdminRecipe } from '../../../utils/adminQueryInvalidation';
import { notify } from '../../../services/notify.service';
import { useAuth } from '../../../contexts/AuthContext';

function MetricCard({ label, value, to, icon }: { label: string; value: number; to: string; icon: ReactNode }) {
  return (
    <Link to={to} className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm hover:bg-red-50/40">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-[0.12em] text-red-700">{label}</p>
        <span className="text-red-600">{icon}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-gray-900">{value}</p>
    </Link>
  );
}

export default function CmsOverviewPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const pagesQuery = useAdminCmsPages();
  const postsQuery = useAdminCmsBlogPosts();
  const categoriesQuery = useAdminCmsBlogCategories();
  const mediaQuery = useAdminCmsMedia();
  const settingsQuery = useAdminCmsSettings();

  const pages = pagesQuery.data || [];
  const posts = postsQuery.data || [];
  const categories = categoriesQuery.data || [];
  const media = mediaQuery.data || [];
  const [applyingSchedule, setApplyingSchedule] = useState(false);
  const publishedPages = pages.filter((entry) => entry.status === 'published');
  const publishedPosts = posts.filter((entry) => entry.status === 'published');
  const pagesMissingSearchTitle = publishedPages.filter((entry) => !(entry.seoTitle || entry.title || '').trim()).length;
  const pagesMissingSearchDescription = publishedPages.filter((entry) => !(entry.seoDescription || entry.excerpt || '').trim()).length;
  const postsMissingSearchTitle = publishedPosts.filter((entry) => !(entry.seoTitle || entry.title || '').trim()).length;
  const postsMissingSearchDescription = publishedPosts.filter((entry) => !(entry.seoDescription || entry.excerpt || '').trim()).length;
  const postsMissingSocialImage = publishedPosts.filter((entry) => !(entry.ogImageUrl || entry.coverImageUrl || '').trim()).length;
  const noindexPublishedPages = publishedPages.filter((entry) => entry.seoNoIndex === true).length;
  const noindexPublishedPosts = publishedPosts.filter((entry) => entry.seoNoIndex === true).length;
  const staleCutoff = Date.now() - (180 * 24 * 60 * 60 * 1000);
  const stalePublishedPosts = publishedPosts.filter((entry) => {
    const updatedAt = toDateValue(entry.updatedAt);
    return !updatedAt || updatedAt.getTime() < staleCutoff;
  }).length;
  const stalePublishedPages = publishedPages.filter((entry) => {
    const updatedAt = toDateValue(entry.updatedAt);
    return !updatedAt || updatedAt.getTime() < staleCutoff;
  }).length;
  const scheduledItems = [...pages, ...posts].filter((entry) => entry.status === 'scheduled').length;
  const seoPriorityQueue = [
    ...publishedPages
      .filter((entry) => !(entry.seoDescription || entry.excerpt || '').trim())
      .map((entry) => ({
        key: `page-${entry.slug}`,
        label: `Page "${entry.title || entry.slug}" missing search description`,
        href: ROUTES.portal.admin.dashboard.cmsPageEditor.replace(':slug', entry.slug),
      })),
    ...publishedPosts
      .filter((entry) => !(entry.seoDescription || entry.excerpt || '').trim())
      .map((entry) => ({
        key: `post-${entry.slug}`,
        label: `Post "${entry.title || entry.slug}" missing search description`,
        href: ROUTES.portal.admin.dashboard.cmsBlogPostEditor.replace(':slug', entry.slug),
      })),
  ].slice(0, 8);
  const orphanPosts = publishedPosts.filter((entry) => {
    const hasSeries = Boolean((entry.seriesSlug || '').trim());
    const hasRelated = (entry.relatedPostSlugs || []).length > 0;
    const hasCategory = Boolean((entry.categorySlug || '').trim());
    const hasTags = (entry.tags || []).length > 0;
    return !hasSeries && !hasRelated && !hasCategory && !hasTags;
  }).length;

  const applyScheduledTransitions = async () => {
    setApplyingSchedule(true);
    try {
      const nowMs = Date.now();
      const now = getServerTimestamp();
      const updates: Array<() => Promise<void>> = [];

      pages.forEach((entry) => {
        const publishAt = toDateValue(entry.scheduledPublishAt);
        const unpublishAt = toDateValue(entry.scheduledUnpublishAt);
        const shouldPublish = entry.status === CMS_STATUS.scheduled && publishAt && publishAt.getTime() <= nowMs && (!unpublishAt || unpublishAt.getTime() > nowMs);
        const shouldUnpublish = entry.status === CMS_STATUS.published && unpublishAt && unpublishAt.getTime() <= nowMs;
        const entryId = entry.id;
        if (!entryId || (!shouldPublish && !shouldUnpublish)) return;
        updates.push(() => setDoc(doc(db, COLLECTIONS.CMS_PAGES, entryId), {
          status: shouldPublish ? CMS_STATUS.published : CMS_STATUS.archived,
          publishedAt: shouldPublish ? (entry.publishedAt || now) : null,
          updatedAt: now,
          updatedBy: user?.uid || 'admin',
        }, { merge: true }));
      });

      posts.forEach((entry) => {
        const publishAt = toDateValue(entry.scheduledPublishAt);
        const unpublishAt = toDateValue(entry.scheduledUnpublishAt);
        const shouldPublish = entry.status === CMS_STATUS.scheduled && publishAt && publishAt.getTime() <= nowMs && (!unpublishAt || unpublishAt.getTime() > nowMs);
        const shouldUnpublish = entry.status === CMS_STATUS.published && unpublishAt && unpublishAt.getTime() <= nowMs;
        const entryId = entry.id;
        if (!entryId || (!shouldPublish && !shouldUnpublish)) return;
        const nextStatus = shouldPublish ? CMS_STATUS.published : CMS_STATUS.archived;
        const nextPublishedAt = shouldPublish ? (entry.publishedAt || now) : null;
        updates.push(async () => {
          await setDoc(doc(db, COLLECTIONS.CMS_BLOG_POSTS, entryId), {
            status: nextStatus,
            publishedAt: nextPublishedAt,
            updatedAt: now,
            updatedBy: user?.uid || 'admin',
          }, { merge: true });
          await setDoc(doc(db, COLLECTIONS.CMS_BLOG_POST_SUMMARIES, entryId), {
            status: nextStatus,
            publishedAt: nextPublishedAt,
            updatedAt: now,
            updatedBy: user?.uid || 'admin',
          }, { merge: true });
        });
      });

      if (!updates.length) {
        notify.info('No scheduled transitions are due right now.');
        return;
      }

      const settled = await Promise.allSettled(
        updates.map(async (task, index) => {
          if (index > 0 && index % CMS_RUNTIME.manualScheduleTransitionBatchSize === 0) {
            await new Promise((resolve) => setTimeout(resolve, 0));
          }
          await task();
        })
      );
      const successful = settled.filter((entry) => entry.status === 'fulfilled').length;
      const failed = settled.length - successful;
      await invalidateAdminRecipe(queryClient, 'cmsUpdated');
      if (failed > 0) {
        notify.error(`Applied ${successful} transition(s). ${failed} failed; retry to finish remaining.`);
      } else {
        notify.success(`Applied ${successful} scheduled transition(s).`);
      }
    } catch (error) {
      notify.error(error instanceof Error ? error.message : 'Failed to apply scheduled transitions.');
    } finally {
      setApplyingSchedule(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-red-100 bg-white p-6 shadow-sm">
        <h2 className="text-2xl font-bold text-gray-900">CMS Overview</h2>
        <p className="text-sm text-gray-600">Manage frontend website content, blog, and configuration from one place.</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <MetricCard
          label="Pages"
          value={pages.length}
          to={ROUTES.portal.admin.dashboard.cmsPages}
          icon={<FileText className="h-4 w-4" />}
        />
        <MetricCard
          label="Blog Posts"
          value={posts.length}
          to={ROUTES.portal.admin.dashboard.cmsBlogPosts}
          icon={<Newspaper className="h-4 w-4" />}
        />
        <MetricCard
          label="Categories"
          value={categories.length}
          to={ROUTES.portal.admin.dashboard.cmsCategories}
          icon={<Tags className="h-4 w-4" />}
        />
        <MetricCard
          label="Media"
          value={media.length}
          to={ROUTES.portal.admin.dashboard.cmsMedia}
          icon={<FileImage className="h-4 w-4" />}
        />
        <MetricCard
          label="Settings"
          value={settingsQuery.data ? 1 : 0}
          to={ROUTES.portal.admin.dashboard.cmsSettings}
          icon={<Settings className="h-4 w-4" />}
        />
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 text-sm text-gray-600 shadow-sm">
        <p>Published pages: <span className="font-semibold text-gray-900">{publishedPages.length}</span></p>
        <p>Published posts: <span className="font-semibold text-gray-900">{publishedPosts.length}</span></p>
        <div className="mt-3">
          <button
            type="button"
            onClick={() => void applyScheduledTransitions()}
            disabled={applyingSchedule}
            className="rounded-md border border-red-300 px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-50"
          >
            {applyingSchedule ? 'Applying...' : 'Apply Scheduled Transitions'}
          </button>
        </div>
      </div>

      <div className="rounded-2xl border border-blue-100 bg-blue-50/60 p-4 shadow-sm">
        <div className="mb-2">
          <h3 className="text-base font-bold text-blue-900">SEO Health Snapshot</h3>
          <p className="text-xs text-blue-800">Human-friendly summary of what to fix first.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700">
            Pages missing search title: <span className="font-semibold text-gray-900">{pagesMissingSearchTitle}</span>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700">
            Pages missing search description: <span className="font-semibold text-gray-900">{pagesMissingSearchDescription}</span>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700">
            Posts missing search title: <span className="font-semibold text-gray-900">{postsMissingSearchTitle}</span>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700">
            Posts missing search description: <span className="font-semibold text-gray-900">{postsMissingSearchDescription}</span>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700">
            Posts missing social image: <span className="font-semibold text-gray-900">{postsMissingSocialImage}</span>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700">
            Published pages/posts with noindex: <span className="font-semibold text-gray-900">{noindexPublishedPages + noindexPublishedPosts}</span>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700">
            Stale published posts (180+ days): <span className="font-semibold text-gray-900">{stalePublishedPosts}</span>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700">
            Stale published pages (180+ days): <span className="font-semibold text-gray-900">{stalePublishedPages}</span>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700">
            Scheduled items queued: <span className="font-semibold text-gray-900">{scheduledItems}</span>
          </div>
          <div className="rounded-lg border border-blue-200 bg-white px-3 py-2 text-sm text-gray-700">
            Orphan post candidates: <span className="font-semibold text-gray-900">{orphanPosts}</span>
          </div>
        </div>
        <div className="mt-3 rounded-lg border border-blue-200 bg-white p-3 text-xs text-gray-700">
          <p className="font-semibold text-blue-900">Fix priority</p>
          <p>1) Fill missing search descriptions, 2) add social images for published posts, 3) refresh stale content and confirm noindex usage.</p>
        </div>
        {seoPriorityQueue.length ? (
          <div className="mt-3 rounded-lg border border-blue-200 bg-white p-3 text-xs text-gray-700">
            <p className="font-semibold text-blue-900">Top SEO Fixes</p>
            <div className="mt-2 space-y-1">
              {seoPriorityQueue.map((item) => (
                <Link key={item.key} to={item.href} className="block rounded border border-gray-200 px-2 py-1 hover:bg-gray-50">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
        ) : null}
      </div>

      <div className="rounded-2xl border border-red-100 bg-white p-4 shadow-sm">
        <div className="mb-3">
          <h3 className="text-base font-bold text-gray-900">Manage Existing Frontend Pages</h3>
          <p className="text-xs text-gray-600">Quick open editor for Home, Find Donors, Request Blood, About, and Contact content.</p>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {CMS_FRONTEND_PAGE_PRESETS.map((preset) => (
            <Link
              key={preset.key}
              to={ROUTES.portal.admin.dashboard.cmsPageEditor.replace(':slug', preset.slug)}
              className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:border-red-300 hover:bg-red-50"
            >
              <div>{preset.label}</div>
              <div className="text-xs font-normal text-gray-500">{preset.path}</div>
            </Link>
          ))}
          <Link
            to={ROUTES.portal.admin.dashboard.cmsBlogPosts}
            className="rounded-xl border border-gray-200 px-3 py-2 text-sm font-semibold text-gray-800 hover:border-red-300 hover:bg-red-50"
          >
            <div>Frontend Blog</div>
            <div className="text-xs font-normal text-gray-500">{ROUTES.blog}</div>
          </Link>
        </div>
      </div>
    </div>
  );
}
