import { FileImage, FileText, Newspaper, Settings, Tags } from 'lucide-react';
import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { ROUTES } from '../../../constants/routes';
import { CMS_FRONTEND_PAGE_PRESETS } from '../../../constants/cms';
import {
  useAdminCmsBlogCategories,
  useAdminCmsBlogPosts,
  useAdminCmsMedia,
  useAdminCmsPages,
  useAdminCmsSettings,
} from '../../../hooks/admin/useAdminQueries';

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
  const pagesQuery = useAdminCmsPages();
  const postsQuery = useAdminCmsBlogPosts();
  const categoriesQuery = useAdminCmsBlogCategories();
  const mediaQuery = useAdminCmsMedia();
  const settingsQuery = useAdminCmsSettings();

  const pages = pagesQuery.data || [];
  const posts = postsQuery.data || [];
  const categories = categoriesQuery.data || [];
  const media = mediaQuery.data || [];
  const publishedPages = pages.filter((entry) => entry.status === 'published');
  const publishedPosts = posts.filter((entry) => entry.status === 'published');
  const pagesMissingSearchTitle = publishedPages.filter((entry) => !(entry.seoTitle || entry.title || '').trim()).length;
  const pagesMissingSearchDescription = publishedPages.filter((entry) => !(entry.seoDescription || entry.excerpt || '').trim()).length;
  const postsMissingSearchTitle = publishedPosts.filter((entry) => !(entry.seoTitle || entry.title || '').trim()).length;
  const postsMissingSearchDescription = publishedPosts.filter((entry) => !(entry.seoDescription || entry.excerpt || '').trim()).length;
  const postsMissingSocialImage = publishedPosts.filter((entry) => !(entry.ogImageUrl || entry.coverImageUrl || '').trim()).length;
  const noindexPublishedPages = publishedPages.filter((entry) => entry.seoNoIndex === true).length;
  const noindexPublishedPosts = publishedPosts.filter((entry) => entry.seoNoIndex === true).length;

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
        </div>
        <div className="mt-3 rounded-lg border border-blue-200 bg-white p-3 text-xs text-gray-700">
          <p className="font-semibold text-blue-900">Fix priority</p>
          <p>1) Fill missing search descriptions, 2) add social images for published posts, 3) confirm noindex usage on published content.</p>
        </div>
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
